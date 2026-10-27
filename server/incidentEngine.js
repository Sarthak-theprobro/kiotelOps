// ================================================================
// 🧠 KIOTEL OPERATIONS INTELLIGENCE — GROUP, COMPLAINT & TECH ENGINE
// Contextual evaluation of WhatsApp groups, message importance,
// seriousness, response requirements, 9-stage resolution lifecycle,
// cross-group incident deduplication/linking, and recurring reopen logic.
// ================================================================

import {
  whatsappGroups,
  properties,
  incidents,
  messageLogs,
  isKiotelTeamMember,
  savePersistedState
} from './dataStore.js';
import { getLocalTimeInTimezone, parseTimeToMinutes } from './statusEngine.js';
import { isRoutineOperationalEvidenceMessage } from './propertyDiscovery.js';

export const GROUP_TYPES = {
  PROPERTY: 'PROPERTY',
  MULTI_PROPERTY: 'MULTI_PROPERTY',
  HANDOVER: 'HANDOVER',
  INTERNAL_OPS: 'INTERNAL_OPS',
  ADMIN_CONTROL: 'ADMIN_CONTROL',
  TECH_SUPPORT: 'TECH_SUPPORT',
  CLIENT_ACCOUNT: 'CLIENT_ACCOUNT',
  UNKNOWN: 'UNKNOWN'
};

// Section 8: 9 Distinct Lifecycle States (plus backwards-compatible aliases)
export const RESOLUTION_STATES = {
  REPORTED: 'REPORTED',
  AWAITING_RESPONSE: 'AWAITING_RESPONSE',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESPONSE_PROVIDED_ACTION_PENDING: 'RESPONSE_PROVIDED_ACTION_PENDING', // Alias for superficial ack where action is pending
  ACTION_IN_PROGRESS: 'ACTION_IN_PROGRESS',
  WAITING_EXTERNAL: 'WAITING_EXTERNAL', // Waiting on property, vendor, or another team
  AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
  RESOLVED_VERIFIED: 'RESOLVED_VERIFIED',
  REOPENED: 'REOPENED',
  UNABLE_TO_VERIFY: 'UNABLE_TO_VERIFY',
  UNABLE_TO_DETERMINE: 'UNABLE_TO_DETERMINE'
};

let complaintSequence = 1000;
let techSequence = 1000;

const nextIncidentId = (recordType) => {
  if (recordType === 'TECH_ISSUE') {
    techSequence += 1;
    while (incidents.some(i => i.id === `TECH-${techSequence}`)) {
      techSequence += 1;
    }
    return `TECH-${techSequence}`;
  }
  complaintSequence += 1;
  while (incidents.some(i => i.id === `CMP-${complaintSequence}`)) {
    complaintSequence += 1;
  }
  return `CMP-${complaintSequence}`;
};

/**
 * Determine the property-local time and verified reporting shift for a timestamp.
 * Section 10: Do NOT infer a shift solely from the time of a message when the actual
 * shift schedule is unverified. If the shift cannot be verified, return 'Unknown'.
 */
export const evaluatePropertyLocalTimeAndShift = (property, isoTimestamp = new Date().toISOString()) => {
  const refDate = new Date(isoTimestamp);
  if (!property || !property.timezone) {
    return {
      propertyLocalTime: 'Unknown (Timezone Unverified)',
      reportingShift: 'Unknown',
      shiftVerified: false
    };
  }

  const local = getLocalTimeInTimezone(property.timezone, refDate);
  if (!local) {
    return {
      propertyLocalTime: 'Unknown (Invalid Timezone)',
      reportingShift: 'Unknown',
      shiftVerified: false
    };
  }

  const formattedLocal = `${local.dateStr} ${local.formattedTime} (${property.timezone})`;

  // Check if property has a verified schedule or shift configuration
  const schedule = property.schedule || property.operatingSchedule;
  const isScheduleVerified =
    property.humanVerified ||
    (schedule && (schedule.type === '24_7' || schedule.type === 'SCHEDULED' || schedule.verified));

  if (!isScheduleVerified) {
    return {
      propertyLocalTime: formattedLocal,
      reportingShift: 'Unknown',
      shiftVerified: false
    };
  }

  // If custom shifts are defined on the property, use them; otherwise use verified Kiotel 3-shift window in property local time
  const h = local.hour;
  let shiftName = 'Night Shift (23:00 - 07:00)';
  if (h >= 7 && h < 15) {
    shiftName = 'Morning Shift (07:00 - 15:00)';
  } else if (h >= 15 && h < 23) {
    shiftName = 'Evening Shift (15:00 - 23:00)';
  }

  return {
    propertyLocalTime: formattedLocal,
    reportingShift: shiftName,
    shiftVerified: true
  };
};

/**
 * Classify a WhatsApp group using its subject, recent message context, and existing mappings.
 * Never treats a group name alone as human-verified proof; flags uncertain mappings.
 */
export const classifyWhatsAppGroup = (groupSubject = '', recentMessages = []) => {
  const lower = (groupSubject || '').toLowerCase();
  const msgSample = recentMessages.map(m => (m.text || '').toLowerCase()).join(' ');

  if (lower.includes('handover') || lower.includes('shift change') || msgSample.includes('shift handover report')) {
    return {
      groupType: GROUP_TYPES.HANDOVER,
      confidence: 'HIGH',
      relevanceReason: 'Contains shift handover summaries and shift-to-shift transition logs.',
      humanVerified: false
    };
  }

  if (
    lower.includes('tech support') ||
    lower.includes('it helpdesk') ||
    lower.includes('kiosk tech') ||
    lower.includes('hardware') ||
    lower.includes('engineering')
  ) {
    return {
      groupType: GROUP_TYPES.TECH_SUPPORT,
      confidence: 'HIGH',
      relevanceReason: 'Technical support, kiosk hardware, and PMS troubleshooting group.',
      humanVerified: false
    };
  }

  if (
    lower.includes('admin') ||
    lower.includes('escalation') ||
    lower.includes('response control') ||
    lower.includes('command') ||
    lower.includes('leadership')
  ) {
    return {
      groupType: GROUP_TYPES.ADMIN_CONTROL,
      confidence: 'MEDIUM',
      relevanceReason: 'Management, SLA response-control, or escalation coordination group.',
      humanVerified: false
    };
  }

  if (
    lower.includes('internal') ||
    lower.includes('kiotel team') ||
    lower.includes('kiotel ops') ||
    lower.includes('roster')
  ) {
    return {
      groupType: GROUP_TYPES.INTERNAL_OPS,
      confidence: 'MEDIUM',
      relevanceReason: 'Internal Kiotel operations or staffing coordination group.',
      humanVerified: false
    };
  }

  if (
    lower.includes('portfolio') ||
    lower.includes('all properties') ||
    lower.includes('multi') ||
    lower.includes('owners group') ||
    lower.includes('corp')
  ) {
    return {
      groupType: GROUP_TYPES.MULTI_PROPERTY,
      confidence: 'MEDIUM',
      relevanceReason: 'Multi-property or client account group covering multiple hotels.',
      humanVerified: false
    };
  }

  if (
    lower.includes('hotel') ||
    lower.includes('inn') ||
    lower.includes('suites') ||
    lower.includes('motel') ||
    lower.includes('resort') ||
    lower.includes('lodge') ||
    lower.includes('kiotel') ||
    lower.includes('front desk') ||
    lower.includes('kiosk')
  ) {
    return {
      groupType: GROUP_TYPES.PROPERTY,
      confidence: 'MEDIUM',
      relevanceReason: 'Inferred property communication group from group name/context. Requires human verification of exact property mapping.',
      humanVerified: false
    };
  }

  return {
    groupType: GROUP_TYPES.UNKNOWN,
    confidence: 'LOW',
    relevanceReason: 'Group type and property association cannot be determined automatically from name alone. Needs human verification.',
    humanVerified: false
  };
};

/**
 * Identify specific equipment/system affected for Technical Issues (Section 5)
 */
export const detectEquipmentAndTechCategory = (text = '') => {
  if (isRoutineOperationalEvidenceMessage(text)) {
    return { isTechnical: false, category: null, equipmentSystem: 'General Service / Non-Hardware' };
  }
  const lower = (text || '').toLowerCase();

  if (lower.includes('encoder') || lower.includes('key card') || lower.includes('keycard') || lower.includes('id scan') || lower.includes('passport scan') || lower.includes('scanner')) {
    return { isTechnical: true, category: 'KIOSK', equipmentSystem: 'Encoder / ID Scanner' };
  }
  if (lower.includes('printer') || lower.includes('receipt') || lower.includes('cash') || lower.includes('bill acceptor') || lower.includes('card dispenser')) {
    return { isTechnical: true, category: 'KIOSK', equipmentSystem: 'Printer / Cash & Card Dispenser' };
  }
  if (lower.includes('router') || lower.includes('wifi') || lower.includes('wi-fi') || lower.includes('internet') || lower.includes('network') || lower.includes('connectivity') || lower.includes('ethernet') || lower.includes('offline')) {
    return { isTechnical: true, category: 'NETWORK', equipmentSystem: 'Router / Network Connectivity' };
  }
  if (lower.includes('tablet') || lower.includes('ipad') || lower.includes('laptop') || lower.includes('pc') || lower.includes('monitor') || lower.includes('webcam') || lower.includes('camera') || lower.includes('microphone') || lower.includes('audio') || lower.includes('speaker')) {
    return { isTechnical: true, category: 'PERIPHERALS', equipmentSystem: 'Tablet / PC / Audio-Video Peripheral' };
  }
  if (lower.includes('pms') || lower.includes('reservation') || lower.includes('sync error') || lower.includes('opera') || lower.includes('cloudbeds') || lower.includes('asi ') || lower.includes('booking sync') || lower.includes('rate sync')) {
    return { isTechnical: true, category: 'PMS', equipmentSystem: 'PMS Integration / Reservations Software' };
  }
  if (lower.includes('login') || lower.includes('password') || lower.includes('permission') || lower.includes('access denied') || lower.includes('locked out of account') || lower.includes('2fa') || lower.includes('configuration')) {
    return { isTechnical: true, category: 'ACCESS_CONFIG', equipmentSystem: 'Login / Access / Configuration' };
  }
  if (lower.includes('kiosk') || lower.includes('touchscreen') || lower.includes('screen frozen') || lower.includes('app crashed') || lower.includes('reboot') || lower.includes('terminal')) {
    return { isTechnical: true, category: 'KIOSK', equipmentSystem: 'Kiosk Terminal / Kiosk Software' };
  }

  return { isTechnical: false, category: null, equipmentSystem: 'General Service / Non-Hardware' };
};

/**
 * Evaluate a message in context across:
 * A. Importance (to Operations Manager)
 * B. Seriousness / Severity (Critical, High, Medium, Low)
 * C. Response / Action Required (boolean, expected responder, deadline)
 * D. Resolution / Reply nature (Superficial Ack vs Action in Progress vs Waiting External vs Verified Resolution)
 */
export const analyzeMessageContext = (message, conversationHistory = [], groupProfile = null) => {
  const text = (message.text || '').trim();
  const lower = text.toLowerCase();
  const isStaff = !!message.isTeam;

  // 1. Detect if this message is a reply/update to an existing incident
  const isSuperficialAck =
    /^(ok|okay|noted|sure|checking|looking into it|on it|will check|acknowledged|ack|received|one min|1 min|wait|checking sir|noted sir|we are checking|team is checking)[\s.!]*$/i.test(text) ||
    (text.split(/\s+/).length <= 7 &&
      (lower.includes('checking') || lower.includes('looking into') || lower.includes('noted') || lower.includes('on it')) &&
      !lower.includes('rebooted') &&
      !lower.includes('resolved') &&
      !lower.includes('fixed'));

  const isWaitingExternal =
    lower.includes('waiting on hotel') ||
    lower.includes('waiting on property') ||
    lower.includes('waiting on vendor') ||
    lower.includes('waiting for isp') ||
    lower.includes('waiting on owner') ||
    lower.includes('escalated to vendor') ||
    lower.includes('waiting for maintenance');

  const isActionInProgress =
    lower.includes('investigating') ||
    lower.includes('rebooting') ||
    lower.includes('escalated to tech') ||
    lower.includes('calling the guest') ||
    lower.includes('working on') ||
    lower.includes('contacting pms') ||
    lower.includes('restarting kiosk') ||
    lower.includes('remoting in') ||
    lower.includes('running diagnostic');

  const isResolutionClaimByStaff =
    isStaff &&
    (lower.includes('resolved') ||
      lower.includes('fixed') ||
      lower.includes('issue is sorted') ||
      lower.includes('working fine now') ||
      lower.includes('back online') ||
      lower.includes('guest checked in successfully') ||
      lower.includes('completed the check-in'));

  const isResolutionConfirmationByClient =
    !isStaff &&
    (lower.includes('working now') ||
      lower.includes('fixed thank') ||
      lower.includes('resolved thank') ||
      lower.includes('all good now') ||
      lower.includes('issue resolved') ||
      lower.includes('kiosk is working'));

  // 2. Determine Operational Category & Technical Equipment
  const techDetection = detectEquipmentAndTechCategory(text);
  let category = techDetection.category || 'OTHER';

  if (!techDetection.isTechnical) {
    if (lower.includes('no agent') || lower.includes('nobody on') || lower.includes('coverage') || lower.includes('unattended') || lower.includes('shift') || lower.includes('absent')) {
      category = 'STAFFING';
    } else if (lower.includes('handover') || lower.includes('next shift') || lower.includes('pending from night') || lower.includes('pending from morning')) {
      category = 'HANDOVER';
    } else if (lower.includes('guest') || lower.includes('check-in') || lower.includes('check in') || lower.includes('refund') || lower.includes('complaint') || lower.includes('waiting at lobby') || lower.includes('rude') || lower.includes('overcharged') || lower.includes('wrong room')) {
      category = 'GUEST_SUPPORT';
    } else if (lower.includes('owner') || lower.includes('unacceptable') || lower.includes('contract') || lower.includes('billing') || lower.includes('escalat')) {
      category = 'CLIENT_ESCALATION';
    }
  }

  // 3. Evaluate Seriousness (Critical, High, Medium, Low) based on operational impact, NOT blind "urgent" keyword
  let severity = 'LOW';
  let seriousnessReason = 'Routine operational update or general communication.';
  let affectedDomain = 'Routine Operations';

  const isCasualOrNegated =
    lower.includes('no problem') ||
    lower.includes('not urgent') ||
    lower.includes('nothing urgent') ||
    lower.includes('everything is fine') ||
    lower.includes('all good');

  const isInformationalUpdateOnly =
    lower.includes('kiosk is live') ||
    lower.includes('kiosk live') ||
    lower.includes('kiosk closed') ||
    lower.includes('shift handover report') ||
    lower.includes('starting shift') ||
    lower.includes('ending shift') ||
    isRoutineOperationalEvidenceMessage(text) ||
    isSuperficialAck ||
    isResolutionConfirmationByClient;

  if (!isCasualOrNegated && !isInformationalUpdateOnly) {
    if (
      lower.includes('police') ||
      lower.includes('emergency') ||
      lower.includes('fire') ||
      lower.includes('security breach') ||
      lower.includes('guest locked out') ||
      lower.includes('entire system down') ||
      lower.includes('all kiosks down') ||
      lower.includes('no one answering for') ||
      (lower.includes('guest') && (lower.includes('stranded') || lower.includes('furious') || lower.includes('walking out')))
    ) {
      severity = 'CRITICAL';
      affectedDomain = 'Guest Safety / Total Service Outage';
      seriousnessReason = 'Immediate impact on guest safety, security, or complete front-desk service stoppage.';
    } else if (
      (techDetection.isTechnical && (lower.includes('not working') || lower.includes('offline') || lower.includes('stuck') || lower.includes('frozen') || lower.includes('unresponsive') || lower.includes('blank') || lower.includes('failed') || lower.includes('jammed') || lower.includes('error') || lower.includes('down') || lower.includes('broken') || lower.includes('unable to'))) ||
      (category === 'STAFFING' && (lower.includes('no agent') || lower.includes('unattended') || lower.includes('missing') || lower.includes('no coverage'))) ||
      (category === 'GUEST_SUPPORT' && (lower.includes('waiting') || lower.includes('stuck') || lower.includes('overcharged') || lower.includes('angry') || lower.includes('unhappy') || lower.includes('complaint') || lower.includes('wrong room'))) ||
      lower.includes('unacceptable') ||
      lower.includes('escalat') ||
      lower.includes('disconnect service')
    ) {
      severity = 'HIGH';
      affectedDomain = `${category} / Service Delivery`;
      seriousnessReason = `Significant operational failure in ${category} affecting guest check-in, coverage, or client relationship.`;
    } else if (
      lower.includes('please check') ||
      lower.includes('can someone') ||
      lower.includes('update on') ||
      lower.includes('follow up') ||
      lower.includes('handover') ||
      lower.includes('pending') ||
      lower.includes('need to') ||
      lower.includes('kindly') ||
      lower.includes('issue') ||
      lower.includes('slow') ||
      text.includes('?')
    ) {
      severity = 'MEDIUM';
      affectedDomain = `${category} Follow-Up`;
      seriousnessReason = 'Operational request, question, or pending task that requires follow-up so it does not worsen.';
    }
  }

  // 4. Evaluate Importance to Operations Manager
  let importanceLevel = 'LOW';
  let importanceReason = 'Routine chat message not requiring Operations Manager intervention.';

  if (severity === 'CRITICAL' || severity === 'HIGH') {
    importanceLevel = 'HIGH';
    importanceReason = `Directly impacts service delivery or client relationship (${severity} severity).`;
  } else if (
    category === 'HANDOVER' ||
    lower.includes('schedule change') ||
    lower.includes('operating hours') ||
    lower.includes('go live') ||
    lower.includes('launched') ||
    lower.includes('kiosk is live') ||
    lower.includes('kiosk closed') ||
    lower.includes('shift report')
  ) {
    importanceLevel = 'HIGH';
    importanceReason = 'Key operational state change, shift handover, or coverage update relevant to Operations Manager oversight.';
  } else if (severity === 'MEDIUM' || !isStaff) {
    importanceLevel = 'MEDIUM';
    importanceReason = 'External property/client communication or pending operational task.';
  }

  // 5. Evaluate Response Requirement & Explicit Deadline
  let responseRequired = false;
  let actionType = 'NONE';
  let expectedResponder = 'UNASSIGNED';
  let deadline = 'UNKNOWN';

  // Detect if message states an explicit deadline (e.g. "within 10 mins", "by 5pm", "before check-in at 3pm")
  const deadlineMatch = text.match(/\b(within\s+\d+\s*(?:min|mins|minutes|hr|hour|hours)|by\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|asap|immediately)\b/i);
  if (deadlineMatch) {
    deadline = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  }

  if (!isInformationalUpdateOnly) {
    if (!isStaff && (severity === 'CRITICAL' || severity === 'HIGH' || severity === 'MEDIUM' || text.includes('?'))) {
      responseRequired = true;
      actionType = severity === 'CRITICAL' || severity === 'HIGH' ? 'ACTION' : 'ANSWER';
      expectedResponder = techDetection.isTechnical ? 'Tech Support Team / Shift Agent' : 'Assigned Shift Agent / Ops Manager';
      if (deadline === 'UNKNOWN') {
        deadline = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      }
    } else if (isStaff && (techDetection.isTechnical && (severity === 'CRITICAL' || severity === 'HIGH' || severity === 'MEDIUM'))) {
      // Staff reporting a technical issue in Tech Support or Property group also requires Tech action!
      responseRequired = true;
      actionType = 'INVESTIGATE';
      expectedResponder = 'Tech Support Team';
    } else if (isStaff && (lower.includes('@sarthak') || lower.includes('@vikas') || lower.includes('need approval') || lower.includes('manager decision'))) {
      responseRequired = true;
      actionType = 'DECISION';
      expectedResponder = 'Operations Manager (Sarthak / Vikas)';
    }
  }

  const affectsCheckIn =
    lower.includes('check-in') ||
    lower.includes('check in') ||
    lower.includes('guest waiting') ||
    lower.includes('guest stuck') ||
    lower.includes('all kiosks down') ||
    lower.includes('encoder') ||
    lower.includes('id scan') ||
    (techDetection.isTechnical && (severity === 'CRITICAL' || severity === 'HIGH'));

  return {
    category,
    isTechnical: techDetection.isTechnical,
    equipmentSystem: techDetection.equipmentSystem,
    affectsCheckIn,
    importance: { level: importanceLevel, reason: importanceReason },
    seriousness: { severity, reason: seriousnessReason, affectedDomain },
    responseRequirement: {
      required: responseRequired,
      actionType,
      expectedResponder,
      deadline
    },
    replyNature: {
      isSuperficialAck,
      isWaitingExternal,
      isActionInProgress,
      isResolutionClaimByStaff,
      isResolutionConfirmationByClient,
      isInformationalUpdateOnly
    }
  };
};

/**
 * Detect whether a message mentions specific properties (for Multi-Property, Tech Support, or Handover groups)
 */
export const resolveTargetPropertiesForMessage = (group, text = '') => {
  const lower = (text || '').toLowerCase();

  // First check if any known property name or ID is explicitly mentioned in the message text
  const mentionedAcrossAll = properties.filter(
    p => (p.name && lower.includes(p.name.toLowerCase())) || (p.id && lower.includes(p.id.toLowerCase()))
  );
  if (mentionedAcrossAll.length > 0) {
    return mentionedAcrossAll;
  }

  if (!group) return [];

  // Otherwise return all linked properties for this group
  if (Array.isArray(group.linkedPropertyIds) && group.linkedPropertyIds.length > 0) {
    return properties.filter(p => group.linkedPropertyIds.includes(p.id));
  }

  return [];
};

/**
 * Main Ingestion Pipeline for a WhatsApp Message
 * Implements:
 * - Source Message ID deduplication (Section 9)
 * - Cross-group incident linking for the same property + issue type (Section 9)
 * - Reopening of recurring resolved incidents (Section 8 & 9)
 * - Property Complaints Register & Technical Issues Register fields (Sections 4 & 5)
 */
export const ingestOperationalMessage = (messageData) => {
  const {
    id = `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sourceMessageId = null,
    groupId,
    groupSubject,
    groupName,
    senderPhone = '',
    senderName = '',
    senderRole = null,
    text = '',
    fromMe = false,
    timestamp = new Date().toISOString()
  } = messageData;

  if (!text || !text.trim()) return null;

  const effectiveMsgId = sourceMessageId || id;
  const resolvedGroupTitle = groupSubject || groupName;

  // 0. Duplicate Detection (Section 9): Prevent duplicate processing during sync retries
  const existingDuplicateMsg = messageLogs.find(
    m =>
      (m.sourceMessageId && m.sourceMessageId === effectiveMsgId) ||
      (m.id === effectiveMsgId) ||
      (m.groupId === groupId &&
        m.text === text.trim() &&
        m.senderPhone === senderPhone &&
        Math.abs(new Date(m.timestamp).getTime() - new Date(timestamp).getTime()) < 60000)
  );
  if (existingDuplicateMsg) {
    return { logEntry: existingDuplicateMsg, duplicateSkipped: true };
  }

  // 1. Ensure WhatsApp Group Profile exists (Never auto-creates a fake "LIVE" Property!)
  let group = whatsappGroups.find(g => g.groupId === groupId);
  if (!group) {
    const classification = classifyWhatsAppGroup(resolvedGroupTitle || groupId, [{ text }]);
    group = {
      groupId,
      name: resolvedGroupTitle || `WhatsApp Group ${groupId.split('@')[0]}`,
      groupName: resolvedGroupTitle || `WhatsApp Group ${groupId.split('@')[0]}`,
      participantCount: 0,
      participants: [],
      groupType: classification.groupType,
      linkedPropertyIds: [],
      humanVerified: false,
      classificationSource: 'INFERRED',
      classificationConfidence: classification.confidence,
      relevanceReason: classification.relevanceReason,
      contacts: { owners: [], hotelManagers: [], kiotelStaff: [] },
      isActive: true,
      lastSyncedAt: timestamp,
      lastAnalyzedAt: timestamp,
      messageCount: 0
    };
    whatsappGroups.push(group);
  } else {
    if (resolvedGroupTitle && (group.name.startsWith('WhatsApp Group') || !group.name)) {
      group.name = resolvedGroupTitle;
      group.groupName = resolvedGroupTitle;
    }
    group.lastSyncedAt = timestamp;
    group.lastAnalyzedAt = timestamp;
  }
  group.messageCount = (group.messageCount || 0) + 1;

  // 2. Identify sender identity & role (Section 4 & 5: If reporter cannot be identified, record 'Unknown', never invent a name!)
  const cleanSenderName =
    senderName &&
    senderName.trim() &&
    !['unknown', 'unknown sender', 'simulated sender', 'user'].includes(senderName.trim().toLowerCase())
      ? senderName.trim()
      : 'Unknown';

  const isTeam =
    senderRole === 'KIOTEL_AGENT' ||
    senderRole === 'KIOTEL_STAFF' ||
    isKiotelTeamMember(senderPhone, fromMe, cleanSenderName);

  const computedRole =
    senderRole ||
    (isTeam
      ? 'KIOTEL_STAFF'
      : cleanSenderName === 'Unknown'
      ? 'UNKNOWN'
      : 'PROPERTY_OR_OWNER');

  const groupHistory = messageLogs.filter(m => m.groupId === groupId).slice(0, 15);

  // 3. Analyze message context
  const analysis = analyzeMessageContext(
    { text, isTeam, senderName: cleanSenderName, senderPhone },
    groupHistory,
    group
  );

  // Resolve associated property or properties (if mapped or mentioned in text)
  const targetProps = resolveTargetPropertiesForMessage(group, text);
  const primaryProperty = targetProps[0] || null;
  const shiftInfo = evaluatePropertyLocalTimeAndShift(primaryProperty, timestamp);

  const logEntry = {
    id: effectiveMsgId,
    sourceMessageId: effectiveMsgId,
    groupId,
    groupName: group.name,
    groupType: group.groupType,
    propertyId: primaryProperty?.id || null,
    propertyIds: targetProps.map(p => p.id),
    propertyName:
      primaryProperty?.name ||
      (group.linkedPropertyIds.length > 1 ? 'Multiple Properties' : 'Unmapped Group'),
    propertyLocalTime: shiftInfo.propertyLocalTime,
    reportingShift: shiftInfo.reportingShift,
    senderPhone: senderPhone || 'Unknown',
    senderName: cleanSenderName,
    senderRole: computedRole,
    isTeam,
    text,
    timestamp,
    analysis
  };

  messageLogs.unshift(logEntry);

  // 4. Update Property Operational Evidence if a mapped property is affected
  const lower = text.toLowerCase();
  const isRoutineEvidence = isRoutineOperationalEvidenceMessage(text);
  targetProps.forEach(prop => {
    if (
      lower.includes('kiosk is live') ||
      lower.includes('kiosk live') ||
      lower.includes('coverage confirmed') ||
      isRoutineEvidence
    ) {
      prop.lastEvidence = {
        source: `WhatsApp (${group.name})`,
        messageId: effectiveMsgId,
        summary: `${cleanSenderName !== 'Unknown' ? cleanSenderName : 'Shift Update'}: "${text.replace(/\s+/g, ' ').slice(0, 140)}"`,
        timestamp
      };
      if (prop.coverage) {
        prop.coverage.coverageConfirmed = true;
        prop.coverage.confirmed = true;
        prop.coverage.lastCoverageVerifiedAt = timestamp;
      }
    }
  });

  // 5. Check for Open Incidents (Same Group OR Cross-Group for the same Property + Category/Equipment!)
  const isReplyOrFollowUp =
    isTeam ||
    analysis.replyNature.isSuperficialAck ||
    analysis.replyNature.isActionInProgress ||
    analysis.replyNature.isWaitingExternal ||
    analysis.replyNature.isResolutionClaimByStaff ||
    analysis.replyNature.isResolutionConfirmationByClient;

  const openMatchingIncidents = incidents.filter(inc => {
    if (inc.resolutionState === RESOLUTION_STATES.RESOLVED_VERIFIED) return false;

    // Case A: Same group and either reply/follow-up OR same category/equipment
    if (inc.groupId === groupId || (inc.sourceGroups && inc.sourceGroups.some(sg => sg.groupId === groupId))) {
      const propMatches =
        isReplyOrFollowUp ||
        !primaryProperty ||
        !inc.propertyId ||
        targetProps.some(p => p.id === inc.propertyId);
      if (propMatches && (isReplyOrFollowUp || inc.category === analysis.category)) {
        return true;
      }
    }

    // Case B: Cross-Group Incident Linking (Section 9)
    // E.g. Issue raised in Property Group, then discussed/updated in Tech Support or Handover Group for the same property & category!
    if (primaryProperty && inc.propertyId === primaryProperty.id) {
      if (inc.category === analysis.category || (inc.isTechnical && analysis.isTechnical && inc.equipmentSystem === analysis.equipmentSystem)) {
        return true;
      }
      if (isReplyOrFollowUp) {
        return true;
      }
    }

    return false;
  });

  if (openMatchingIncidents.length > 0 && !analysis.replyNature.isInformationalUpdateOnly || (openMatchingIncidents.length > 0 && isReplyOrFollowUp)) {
    const targetIncident = openMatchingIncidents[0];

    // Record cross-group linkage if this message came from another group
    if (!Array.isArray(targetIncident.sourceGroups)) {
      targetIncident.sourceGroups = [{ groupId: targetIncident.groupId, groupName: targetIncident.groupName }];
    }
    if (!targetIncident.sourceGroups.some(sg => sg.groupId === group.groupId)) {
      targetIncident.sourceGroups.push({ groupId: group.groupId, groupName: group.name });
    }

    // Append message to supporting evidence trail
    targetIncident.supportingMessages.push({
      id: effectiveMsgId,
      messageId: effectiveMsgId,
      groupId: group.groupId,
      groupName: group.name,
      senderName: cleanSenderName,
      senderPhone: senderPhone || 'Unknown',
      senderRole: computedRole,
      isTeam,
      text,
      timestamp
    });

    if (!Array.isArray(targetIncident.chronologicalHistory)) {
      targetIncident.chronologicalHistory = [];
    }

    targetIncident.latestUpdate = `${cleanSenderName} (${group.name}): "${text}"`;
    targetIncident.lastUpdatedBy = cleanSenderName;
    targetIncident.latestUpdateAt = timestamp;
    targetIncident.updatedAt = timestamp;

    // Check if carried over across shifts
    if (
      shiftInfo.reportingShift !== 'Unknown' &&
      targetIncident.reportingShift &&
      targetIncident.reportingShift !== 'Unknown' &&
      targetIncident.reportingShift !== shiftInfo.reportingShift
    ) {
      targetIncident.carriedOverShift = true;
      targetIncident.passedToNextShift = true;
    }

    if (isTeam) {
      targetIncident.responseGiven = true;
      if (!targetIncident.acknowledgedAt) {
        targetIncident.acknowledgedBy = cleanSenderName;
        targetIncident.acknowledgedAt = timestamp;
      }

      if (analysis.replyNature.isSuperficialAck) {
        // Section 8: Superficial reply ("Okay", "Noted", "Checking") moves to ACKNOWLEDGED / RESPONSE_PROVIDED_ACTION_PENDING — NEVER resolves!
        if (
          targetIncident.resolutionState === RESOLUTION_STATES.AWAITING_RESPONSE ||
          targetIncident.resolutionState === RESOLUTION_STATES.REPORTED ||
          targetIncident.resolutionState === RESOLUTION_STATES.REOPENED
        ) {
          targetIncident.resolutionState = RESOLUTION_STATES.RESPONSE_PROVIDED_ACTION_PENDING;
          targetIncident.lifecycleStatus = RESOLUTION_STATES.ACKNOWLEDGED;
          targetIncident.actionPending = true;
          targetIncident.resolutionEvidence = `${cleanSenderName} acknowledged ("${text}"), but no corrective action or resolution is confirmed yet.`;
          targetIncident.resolutionReason = targetIncident.resolutionEvidence;
        }
      } else if (analysis.replyNature.isWaitingExternal) {
        targetIncident.resolutionState = RESOLUTION_STATES.WAITING_EXTERNAL;
        targetIncident.lifecycleStatus = RESOLUTION_STATES.WAITING_EXTERNAL;
        targetIncident.meaningfulResponseProvided = true;
        targetIncident.actionPending = true;
        targetIncident.resolutionEvidence = `Waiting on external party/property/vendor (${cleanSenderName}: "${text}").`;
        targetIncident.resolutionReason = targetIncident.resolutionEvidence;
      } else if (analysis.replyNature.isActionInProgress) {
        targetIncident.resolutionState = RESOLUTION_STATES.ACTION_IN_PROGRESS;
        targetIncident.lifecycleStatus = RESOLUTION_STATES.ACTION_IN_PROGRESS;
        targetIncident.meaningfulResponseProvided = true;
        targetIncident.actionPending = true;
        if (cleanSenderName !== 'Unknown') {
          targetIncident.actionAssignedTo = cleanSenderName;
          targetIncident.assignedTechnician = cleanSenderName;
        }
        if (targetIncident.isTechnical) {
          targetIncident.troubleshootingLog = [
            ...(targetIncident.troubleshootingLog || []),
            `[${new Date(timestamp).toLocaleTimeString()}] ${cleanSenderName}: ${text}`
          ];
        }
        targetIncident.resolutionEvidence = `${cleanSenderName} is actively troubleshooting: "${text}". Issue remains open until verified.`;
        targetIncident.resolutionReason = targetIncident.resolutionEvidence;
      } else if (analysis.replyNature.isResolutionClaimByStaff) {
        targetIncident.meaningfulResponseProvided = true;
        targetIncident.actionCompleted = true;
        targetIncident.actionPending = false;
        targetIncident.resolutionState = RESOLUTION_STATES.RESOLVED_VERIFIED;
        targetIncident.lifecycleStatus = RESOLUTION_STATES.RESOLVED_VERIFIED;
        targetIncident.resolvedAt = timestamp;
        targetIncident.confirmationStatus = 'VERIFIED';
        if (targetIncident.isTechnical) {
          targetIncident.troubleshootingLog = [
            ...(targetIncident.troubleshootingLog || []),
            `[${new Date(timestamp).toLocaleTimeString()}] RESOLVED by ${cleanSenderName}: ${text}`
          ];
          targetIncident.pendingItems = 'None — Verified Resolved';
        }
        targetIncident.resolutionEvidence = `Verified resolution reported by ${cleanSenderName}: "${text}" (${new Date(timestamp).toLocaleTimeString()})`;
        targetIncident.resolutionReason = targetIncident.resolutionEvidence;
      } else {
        targetIncident.meaningfulResponseProvided = true;
        targetIncident.actionPending = true;
        if (targetIncident.resolutionState === RESOLUTION_STATES.AWAITING_RESPONSE) {
          targetIncident.resolutionState = RESOLUTION_STATES.ACTION_IN_PROGRESS;
          targetIncident.lifecycleStatus = RESOLUTION_STATES.ACTION_IN_PROGRESS;
          targetIncident.resolutionEvidence = `Response provided by ${cleanSenderName}: "${text}". Awaiting final resolution confirmation.`;
          targetIncident.resolutionReason = targetIncident.resolutionEvidence;
        }
      }
    } else if (analysis.replyNature.isResolutionConfirmationByClient) {
      targetIncident.resolutionState = RESOLUTION_STATES.RESOLVED_VERIFIED;
      targetIncident.lifecycleStatus = RESOLUTION_STATES.RESOLVED_VERIFIED;
      targetIncident.actionCompleted = true;
      targetIncident.actionPending = false;
      targetIncident.resolvedAt = timestamp;
      targetIncident.confirmationStatus = 'VERIFIED';
      targetIncident.pendingItems = 'None — Confirmed by Property/Client';
      targetIncident.resolutionEvidence = `Confirmed resolved by property/client (${cleanSenderName}): "${text}" (${new Date(timestamp).toLocaleTimeString()})`;
      targetIncident.resolutionReason = targetIncident.resolutionEvidence;
    } else {
      // Follow-up complaint or additional symptom from property side on the same open issue
      targetIncident.occurrenceCount = (targetIncident.occurrenceCount || 1) + 1;
      targetIncident.isRepeated = targetIncident.occurrenceCount > 1;
    }

    targetIncident.chronologicalHistory.push({
      timestamp,
      actor: cleanSenderName,
      role: computedRole,
      groupName: group.name,
      action: `Message logged (${targetIncident.resolutionState})`,
      text
    });

    savePersistedState();
    return { logEntry, updatedIncident: targetIncident };
  }

  // 6. Check if this message REOPENS a previously RESOLVED incident for the same property & equipment/category (Section 8 & 9)
  const shouldCreateOrReopen =
    !analysis.replyNature.isInformationalUpdateOnly &&
    (analysis.responseRequirement.required ||
      analysis.seriousness.severity === 'CRITICAL' ||
      analysis.seriousness.severity === 'HIGH' ||
      analysis.isTechnical);

  if (shouldCreateOrReopen && primaryProperty) {
    const previouslyResolvedMatch = incidents.find(
      inc =>
        inc.resolutionState === RESOLUTION_STATES.RESOLVED_VERIFIED &&
        inc.propertyId === primaryProperty.id &&
        (inc.category === analysis.category ||
          (inc.isTechnical && analysis.isTechnical && inc.equipmentSystem === analysis.equipmentSystem))
    );

    if (previouslyResolvedMatch) {
      previouslyResolvedMatch.resolutionState = RESOLUTION_STATES.REOPENED;
      previouslyResolvedMatch.lifecycleStatus = RESOLUTION_STATES.REOPENED;
      previouslyResolvedMatch.reopenCount = (previouslyResolvedMatch.reopenCount || 0) + 1;
      previouslyResolvedMatch.occurrenceCount = (previouslyResolvedMatch.occurrenceCount || 1) + 1;
      previouslyResolvedMatch.isRecurring = true;
      previouslyResolvedMatch.isRepeated = true;
      previouslyResolvedMatch.actionCompleted = false;
      previouslyResolvedMatch.actionPending = true;
      previouslyResolvedMatch.resolvedAt = null;
      previouslyResolvedMatch.confirmationStatus = 'UNCONFIRMED';
      previouslyResolvedMatch.pendingItems = 'Reopened due to recurring failure — requires root-cause fix';
      previouslyResolvedMatch.latestUpdate = `REOPENED by ${cleanSenderName} (${group.name}): "${text}"`;
      previouslyResolvedMatch.lastUpdatedBy = cleanSenderName;
      previouslyResolvedMatch.latestUpdateAt = timestamp;
      previouslyResolvedMatch.updatedAt = timestamp;
      previouslyResolvedMatch.resolutionEvidence = `Issue recurred after prior resolution. Reopened (#${previouslyResolvedMatch.reopenCount}) based on message from ${cleanSenderName}: "${text}"`;
      previouslyResolvedMatch.resolutionReason = previouslyResolvedMatch.resolutionEvidence;

      if (!previouslyResolvedMatch.sourceGroups.some(sg => sg.groupId === group.groupId)) {
        previouslyResolvedMatch.sourceGroups.push({ groupId: group.groupId, groupName: group.name });
      }
      previouslyResolvedMatch.supportingMessages.push({
        id: effectiveMsgId,
        messageId: effectiveMsgId,
        groupId: group.groupId,
        groupName: group.name,
        senderName: cleanSenderName,
        senderPhone: senderPhone || 'Unknown',
        senderRole: computedRole,
        isTeam,
        text,
        timestamp
      });
      previouslyResolvedMatch.chronologicalHistory = [
        ...(previouslyResolvedMatch.chronologicalHistory || []),
        {
          timestamp,
          actor: cleanSenderName,
          role: computedRole,
          groupName: group.name,
          action: `INCIDENT REOPENED (Recurrence #${previouslyResolvedMatch.reopenCount})`,
          text
        }
      ];

      savePersistedState();
      return { logEntry, reopenedIncident: previouslyResolvedMatch, updatedIncident: previouslyResolvedMatch };
    }
  }

  // 7. Create a New Incident (Property Complaint or Technical Issue) if warranted
  if (shouldCreateOrReopen) {
    const recordType = analysis.isTechnical ? 'TECH_ISSUE' : 'COMPLAINT';
    const generatedId = nextIncidentId(recordType);

    // Check if there are previous complaints/issues on this property to flag repeated patterns
    const priorPropertyIncidents = primaryProperty
      ? incidents.filter(i => i.propertyId === primaryProperty.id && i.category === analysis.category)
      : [];
    const isRepeated = priorPropertyIncidents.length > 0;

    const newIncident = {
      id: generatedId,
      recordType, // 'COMPLAINT' or 'TECH_ISSUE'
      isTechnical: analysis.isTechnical,
      propertyId: primaryProperty?.id || null,
      propertyIds: targetProps.map(p => p.id),
      propertyName:
        primaryProperty?.name ||
        (group.linkedPropertyIds.length > 1 ? `Multi-Property (${group.name})` : `Unmapped (${group.name})`),
      groupId: group.groupId,
      sourceGroupId: group.groupId,
      groupName: group.name,
      sourceGroups: [{ groupId: group.groupId, groupName: group.name }],
      sourceMessageId: effectiveMsgId,

      // Core text & summaries (compatible with all views)
      title: text.length > 90 ? `${text.substring(0, 90)}...` : text,
      originalComplaint: text,
      originalDescription: text,
      summary: text,
      category: analysis.category,
      equipmentSystem: analysis.equipmentSystem,

      // Reporter & Shift metadata (Section 4, 5, 10)
      raisedBy: {
        name: cleanSenderName,
        phone: senderPhone || 'Unknown',
        role: computedRole
      },
      reportedBy: {
        name: cleanSenderName,
        phone: senderPhone || 'Unknown',
        role: computedRole
      },
      reporterName: cleanSenderName,
      raisedAt: timestamp,
      createdAt: timestamp,
      propertyLocalTime: shiftInfo.propertyLocalTime,
      reportingShift: shiftInfo.reportingShift,
      shiftVerified: shiftInfo.shiftVerified,

      // 3-Pillar Classification (Section 7)
      importance: analysis.importance,
      importanceLevel: analysis.importance.level,
      importanceReason: analysis.importance.reason,
      seriousness: analysis.seriousness,
      severity: analysis.seriousness.severity,
      seriousnessReason: analysis.seriousness.reason,
      businessImpact: `${analysis.seriousness.affectedDomain}: ${analysis.seriousness.reason}`,
      operationalImpact: `${analysis.seriousness.affectedDomain}: ${analysis.seriousness.reason}`,
      affectsCheckIn: analysis.affectsCheckIn,

      // Response & Ownership (Section 4, 5, 7, 8)
      responseRequirement: {
        ...analysis.responseRequirement,
        waitingParty: isTeam ? null : cleanSenderName
      },
      expectedResponder: analysis.responseRequirement.expectedResponder,
      actionType: analysis.responseRequirement.actionType,
      deadline: analysis.responseRequirement.deadline !== 'UNKNOWN' ? analysis.responseRequirement.deadline : null,
      responseGiven: false,
      actionPending: true,

      // Technical Issue specific fields (Section 5)
      workaround: analysis.affectsCheckIn
        ? 'Manual remote agent check-in assistance required until hardware/system is restored'
        : 'Standard operations continuing while under investigation',
      assignedTechnician: analysis.isTechnical ? 'Unassigned (Tech Support Queue)' : 'Unassigned',
      troubleshootingLog: [],
      pendingItems: `Awaiting ${analysis.responseRequirement.expectedResponder} response and root-cause verification`,
      confirmationStatus: 'UNCONFIRMED',

      // Lifecycle State (Section 8)
      resolutionState: RESOLUTION_STATES.AWAITING_RESPONSE,
      lifecycleStatus: RESOLUTION_STATES.AWAITING_RESPONSE,
      resolutionEvidence: 'No response or resolution evidence recorded yet.',
      resolutionReason: 'Awaiting initial response and action verification.',
      latestUpdate: `Reported by ${cleanSenderName}: "${text}"`,
      lastUpdatedBy: cleanSenderName,
      latestUpdateAt: timestamp,
      updatedAt: timestamp,
      resolvedAt: null,

      // Accountability flags (Section 9, 10, 11)
      acknowledgedBy: null,
      acknowledgedAt: null,
      meaningfulResponseProvided: false,
      actionAssignedTo: 'UNASSIGNED',
      actionCompleted: false,
      passedToNextShift: false,
      carriedOverShift: false,
      isRepeated,
      isRecurring: isRepeated && analysis.isTechnical,
      occurrenceCount: priorPropertyIncidents.length + 1,
      reopenCount: 0,
      humanVerified: false,
      confidence: primaryProperty ? 'HIGH' : 'MEDIUM',

      supportingMessages: [
        {
          id: effectiveMsgId,
          messageId: effectiveMsgId,
          groupId: group.groupId,
          groupName: group.name,
          senderName: cleanSenderName,
          senderPhone: senderPhone || 'Unknown',
          senderRole: computedRole,
          isTeam,
          text,
          timestamp
        }
      ],
      chronologicalHistory: [
        {
          timestamp,
          actor: cleanSenderName,
          role: computedRole,
          groupName: group.name,
          action: `Incident Created (${generatedId})`,
          text
        }
      ]
    };

    incidents.unshift(newIncident);
    savePersistedState();
    return { logEntry, createdIncident: newIncident };
  }

  savePersistedState();
  return { logEntry };
};
