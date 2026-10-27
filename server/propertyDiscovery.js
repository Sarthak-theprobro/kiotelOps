// ================================================================
// 🏨 KIOTEL OPERATIONS INTELLIGENCE — REAL PROPERTY & SCHEDULE DISCOVERY
// Automatically discovers, deduplicates, links, and evaluates real
// hotel properties from synced WhatsApp groups & operational messages.
// ================================================================

import {
  whatsappGroups,
  properties,
  incidents,
  messageLogs,
  savePersistedState
} from './dataStore.js';
import { getLocalTimeInTimezone, evaluatePropertyStatus } from './statusEngine.js';
import { evaluatePropertyLocalTimeAndShift } from './incidentEngine.js';

// Strictly non-property internal / personal / department / vendor group patterns
const NON_PROPERTY_PATTERNS = [
  /trip to goa/i,
  /office boy/i,
  /sales\s*&\s*marketing/i,
  /software dev/i,
  /leave tracker/i,
  /review tracker/i,
  /shift logs backup/i,
  /help group/i,
  /quality assurance/i,
  /hr ops/i,
  /shift managers\s*-\s*kiotel/i,
  /kiotel\s*-\s*manager\s*-/i,
  /kiotel\s*-\s*tech support/i,
  /splus\s*support/i,
  /nutan\s*refrigeration/i,
  /diwali\s*party/i,
  /kiotel\s*-\s*lifelong/i,
  /rodeway\s*housekeeping/i,
  /sonesta\s*daily\s*ops/i,
  /onboarding\s*\/\s*installation/i,
  /fairfield\s*review/i,
  /review\s*kcia/i,
  /hk\s*cdale/i,
  /managers\s*&\s*ops/i,
  /^all$/i,
  /^whatsapp group \d+$/i,
  /mohit,\s*dhiren/i,
  /riddhi,\s*dhiren/i,
  /tishank,\s*dhiren/i,
  /bhavi,\s*dhiren/i,
  /sarthak,\s*dhiren/i
];

// US State & City -> IANA Timezone Lookup for Kiotel Properties
const STATE_TIMEZONE_MAP = {
  // Pacific
  CA: 'America/Los_Angeles',
  CALIFORNIA: 'America/Los_Angeles',
  WA: 'America/Los_Angeles',
  WASHINGTON: 'America/Los_Angeles',
  OR: 'America/Los_Angeles',
  NV: 'America/Los_Angeles',
  // Arizona (No DST -> America/Phoenix)
  AZ: 'America/Phoenix',
  ARIZONA: 'America/Phoenix',
  // Mountain
  CO: 'America/Denver',
  COLORADO: 'America/Denver',
  NM: 'America/Denver',
  UT: 'America/Denver',
  WY: 'America/Denver',
  MT: 'America/Denver',
  // Central
  KS: 'America/Chicago',
  KANSAS: 'America/Chicago',
  MO: 'America/Chicago',
  MISSOURI: 'America/Chicago',
  IL: 'America/Chicago',
  ILLINOIS: 'America/Chicago',
  WI: 'America/Chicago',
  WISCONSIN: 'America/Chicago',
  IA: 'America/Chicago',
  IOWA: 'America/Chicago',
  TX: 'America/Chicago',
  TEXAS: 'America/Chicago',
  NE: 'America/Chicago',
  NEBRASKA: 'America/Chicago',
  MN: 'America/Chicago',
  OK: 'America/Chicago',
  AR: 'America/Chicago',
  LA: 'America/Chicago',
  AL: 'America/Chicago',
  TN: 'America/Chicago',
  // Eastern
  MA: 'America/New_York',
  MASSACHUSETTS: 'America/New_York',
  SC: 'America/New_York',
  'SOUTH CAROLINA': 'America/New_York',
  NC: 'America/New_York',
  FL: 'America/New_York',
  FLORIDA: 'America/New_York',
  GA: 'America/New_York',
  VA: 'America/New_York',
  VIRGINIA: 'America/New_York',
  IN: 'America/Indiana/Indianapolis',
  INDIANA: 'America/Indiana/Indianapolis',
  OH: 'America/New_York',
  OHIO: 'America/New_York',
  PA: 'America/New_York',
  PENNSYLVANIA: 'America/New_York',
  NY: 'America/New_York',
  MI: 'America/Detroit',
  MICHIGAN: 'America/Detroit',
  NJ: 'America/New_York',
  MD: 'America/New_York'
};

const CITY_TIMEZONE_HINTS = [
  { match: /\b(lenexa|olathe|dodge\s*city|topeka|mound\s*city|kansas\s*city|kcia|kci|independence|harrisonville|higginsville|blue\s*springs|clinton|cameron|walcott|davenport|waterloo|marshalltown|burlington|reedsburg|sparta|rice\s*lake|troy|casey|carbondale|effingham|salem|kearney|texarkana|nasa|houston)\b/i, tz: 'America/Chicago', region: 'US-Central' },
  { match: /\b(phoenix|flagstaff|prescott|tempe|willcox|lake\s*havasu|williams|bell\s*road|bellroad|bellemont)\b/i, tz: 'America/Phoenix', region: 'US-Arizona' },
  { match: /\b(cortez|south\s*fork|alamosa|denver|pikes\s*peak|peak\s*pikes)\b/i, tz: 'America/Denver', region: 'US-Mountain' },
  { match: /\b(westminster|woodland|corona|chino|fresno|pioneer|amador|moses\s*lake)\b/i, tz: 'America/Los_Angeles', region: 'US-Pacific' },
  { match: /\b(sturbridge|spartanburg|columbia|irmo|columbiana|holiday|clearwater|stroudsburg|penn\s*lodge|meadows|waterford|bellevue|south\s*point|s\s*point|brazil)\b/i, tz: 'America/New_York', region: 'US-East' }
];

/**
 * Infer IANA Timezone & Region Cluster from group name or hotel name
 */
export const inferTimezoneAndCluster = (name = '') => {
  const upper = (name || '').toUpperCase();

  // Check city hints first (very reliable for Kiotel hotel names)
  for (const hint of CITY_TIMEZONE_HINTS) {
    if (hint.match.test(name)) {
      return { timezone: hint.tz, cluster: hint.region };
    }
  }

  // Check explicit 2-letter state code or full state name
  const stateTokens = upper.replace(/[^A-Z\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (const tok of stateTokens) {
    if (STATE_TIMEZONE_MAP[tok]) {
      const tz = STATE_TIMEZONE_MAP[tok];
      const cluster =
        tz === 'America/Los_Angeles' ? 'US-Pacific' :
        tz === 'America/Phoenix' ? 'US-Arizona' :
        tz === 'America/Denver' ? 'US-Mountain' :
        tz === 'America/Chicago' ? 'US-Central' : 'US-East';
      return { timezone: tz, cluster };
    }
  }

  return { timezone: 'America/Chicago', cluster: 'US-Central' };
};

/**
 * Extract 4-digit Kiotel property codes (e.g. 1086, 1147, 1230, 1180) from a group name
 */
export const extractPropertyCodes = (groupName = '') => {
  if (!groupName) return [];
  const lower = groupName.toLowerCase();

  // "1890 Sleepover" is the hotel name in Casey, IL whose Kiotel property code is 1180
  if (lower.includes('1890 sleepover') || lower.includes('1890 no delay')) {
    return ['1180'];
  }
  // Known compound / un-numbered Handover & Response Control group mappings to their exact Kiotel Property Code
  if (lower.includes('walcottdavenport') || lower.includes('days inn walcott')) return ['1245'];
  if (lower.includes('ricelake') || lower.includes('rice lake')) return ['1112'];
  if (lower.includes('woodspring suites, columbiana') || lower.includes('columbia irmo')) return ['1177'];
  if (lower.includes('woodspring sc')) return ['1176', '1177'];
  if (lower.includes('quality inn dodge')) return ['1205'];
  if (lower.includes('quality inn & suites kansas city') || lower.includes('quality inn kansas city')) return ['1207'];
  if (lower.includes('ramada sp') || lower.includes('ramada s point')) return ['1087'];
  if (lower.includes('sunshine & palm cove')) return ['1179', '1183'];
  if (lower.includes('s8 mound city')) return ['1144'];
  if (lower.includes('kcia/s8 lenexa')) return ['1156', '1230'];

  // Remove phone/JID numbers longer than 5 digits first
  const cleaned = groupName.replace(/\d{6,}/g, ' ');
  const matches = cleaned.match(/\b(1[0-9]{3})\b/g) || [];
  return [...new Set(matches)];
};

/**
 * Normalize a group name into a clean canonical hotel name and token set for fuzzy matching
 */
export const cleanHotelNameFromGroup = (rawName = '') => {
  if (/1228\s*operations\s*management/i.test(rawName)) {
    return 'Super 8 Meadows VA';
  }
  let s = (rawName || '')
    .replace(/^🖥️\s*/g, '')
    .replace(/\b(kiotel|handover's|handover’s|handovers|handover|group|front\s*desk|guest\s*transactions|transaction\s*reports|transaction\s*records|operations\s*management|no\s*delay\s*response\s*(?:control|group)|admin|daily\s*ops)\b/gi, ' ')
    .replace(/\b86301\b/g, ' ')
    .replace(/\bunited\s*states\b/gi, ' ')
    .replace(/--+/g, ' ')
    .replace(/\s+-\s*\d{4}\b/g, ' ')
    .replace(/\b(1[0-79]\d{2})\b/g, ' ') // Keep 1890 if followed by Sleepover
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  s = s.replace(/^[-–—,:;\s]+|[-–—,:;\s]+$/g, '').trim();
  if (/^sleepover/i.test(s) && rawName.includes('1890')) {
    s = `1890 ${s}`;
  }
  return s;
};

const getSignificantTokens = (str = '') => {
  const stopWords = new Set([
    'by', 'wyndham', 'and', 'the', 'at', 'in', 'of', 'area', 'mall', 'overland', 'park',
    'hotel', 'inn', 'suites', 'motel', 'lodge', 'extended', 'stay', 'ks', 'mo', 'az',
    'ca', 'co', 'il', 'wi', 'in', 'sc', 'fl', 'va', 'ma', 'pa', 'ia', 'wa', 'oh', 'tx',
    'kansas', 'missouri', 'arizona', 'california', 'colorado', 'illinois', 'indiana', 'wisconsin'
  ]);
  return cleanHotelNameFromGroup(str)
    .toLowerCase()
    .replace(/super\s*8/g, 'super8')
    .replace(/\bs8\b/g, 'super8')
    .replace(/motel\s*6/g, 'motel6')
    .replace(/\bm6\b/g, 'motel6')
    .replace(/econo\s*lodge/g, 'econolodge')
    .replace(/red\s*roof/g, 'redroof')
    .replace(/sure\s*stay/g, 'surestay')
    .replace(/best\s*western/g, 'bw')
    .replace(/university\s*inn/g, 'uinn')
    .replace(/u\s*inn/g, 'uinn')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2 && !stopWords.has(t));
};

/**
 * Determine if a group is strictly non-property (Internal, Personal, HR, Dev, etc.)
 */
export const isNonPropertyGroup = (groupName = '') => {
  const trimmed = (groupName || '').trim();
  if (!trimmed) return true;
  for (const rx of NON_PROPERTY_PATTERNS) {
    if (rx.test(trimmed)) return true;
  }
  // Personal small groups like "A, B & C" without hotel keywords
  if (trimmed.includes('&') && !/(kiotel|hotel|inn|suites|motel|lodge|handover|response|admin|super\s*8|baymont|ramada|sonesta|days|quality|econo|woodspring)/i.test(trimmed)) {
    return true;
  }
  return false;
};

/**
 * Inspect a message to see if it is a routine Kiotel Shift / Audit / Availability / Kiosk Status log
 * rather than a complaint or technical failure!
 */
export const isRoutineOperationalEvidenceMessage = (text = '') => {
  const t = (text || '').trim();
  const lower = t.toLowerCase();

  // 1. Shift Handover / Audit templates with no incidents
  if (lower.includes('i have verified my work') || lower.includes('take full responsibility')) {
    if (!lower.includes('not working') && !lower.includes('offline') && !lower.includes('complaint') && !lower.includes('angry')) {
      return true;
    }
  }
  if (/^\*?(?:shift|audit\s*shift)/i.test(t) && (lower.includes('*incidents*\n* none') || lower.includes('incidents* 🔴\n▸none') || lower.includes('incidents* 🔴 ▸none') || lower.includes('*info*\n* none'))) {
    return true;
  }

  // 2. Property Availability / Audit / Rates / Cash / Call Transfer Test updates
  if (/arrivals\s*:\s*\d+/i.test(t) && /departures\s*:\s*\d+/i.test(t)) return true;
  if (/^(future\s*availability|rates\s*and\s*availability|competitors?\s*rate|ooo\s*(?:&|and)?\s*ooi\s*rooms.*|ooo\s*rooms.*|ooi\s*rooms.*|sold\s*out\s*on\s*expedia.*|update|current\s*shuttle\s*schedule)$/i.test(t)) return true;
  if (/^open\s*on\s*(expedia|booking)/i.test(t)) return true;
  if (/^(super\s*8|motel\s*6|days\s*inn|quality\s*inn|baymont|ramada|econolodge).*?\$\d+/i.test(t) && t.length < 60) return true;
  if (/^call\s*transfer(?:red)?\s*(?:tested|test|status)/i.test(t)) return true;
  if (/we\s*are\s*receiving\s*the\s*calls\s*and\s*will\s*be\s*answering/i.test(t)) return true;
  if (/^shift\s*log[\s:-]*\d/i.test(t)) return true;
  if (/^(?:cash\s*recycler|cash\s*total|cashbox)/i.test(t) && t.length < 70) return true;
  if (/^\d{3}\s*(?:and\s*\d{3}\s*)?stayover$/i.test(t)) return true;
  if (/all\s*the\s*pending\s*stayover\s*completed/i.test(t)) return true;
  if (/phone\s*tested\s*by\s*kiosk\.\s*phone\s*working\s*normally/i.test(t)) return true;
  if (/kiosk\s*is\s*live\s*now|closing\s*the\s*shift/i.test(t)) return true;

  return false;
};

/**
 * Analyze all messages belonging to a property's linked groups to infer:
 * - Schedule (24/7 vs Scheduled Window like 15:00-07:00 or 07:00-23:00)
 * - Launch Status (LAUNCHED vs NOT_YET_LIVE / Onboarding)
 * - Active Agent / Pod name
 * - Latest operational evidence & whether Kiosk was explicitly closed or opened
 */
const derivePropertyOperationalProfileFromMessages = (prop, propGroups, propMessages) => {
  const sortedMsgs = [...propMessages].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const latestMsg = sortedMsgs[0] || null;
  const allTextLower = sortedMsgs.map(m => (m.text || '').toLowerCase()).join('\n');

  // Extract agent signature e.g. "~Shyam", "~Hetvi Bhonde", "~Maharth", "*AGENT* – Name", "*Audit Shift | Nikshi"
  let detectedAgent = null;
  for (const m of sortedMsgs) {
    const txt = m.text || '';
    const tildeMatch = txt.match(/~\s*([A-Za-z][A-Za-z\s.]{1,22})$/m);
    const agentLineMatch = txt.match(/\*AGENT\*\s*[–—-]\s*([A-Za-z][A-Za-z\s.]{1,22})/i);
    const auditPipeMatch = txt.match(/shift\s*\|\s*([A-Za-z][A-Za-z\s.]{1,20}?)\s*[-–]/i);
    if (tildeMatch) {
      detectedAgent = tildeMatch[1].trim();
      break;
    }
    if (agentLineMatch) {
      detectedAgent = agentLineMatch[1].trim();
      break;
    }
    if (auditPipeMatch) {
      detectedAgent = auditPipeMatch[1].trim();
      break;
    }
  }

  // Check if property is in Onboarding / Pre-Launch / Not Yet Live
  const propTypeGroups = propGroups.filter(g => g.groupType === 'PROPERTY');
  const handoverTypeGroups = propGroups.filter(g => g.groupType === 'HANDOVER');
  const adminTypeGroups = propGroups.filter(g => g.groupType === 'ADMIN_CONTROL' || g.groupType === 'MULTI_PROPERTY');

  const hasAdminGroupOnly = propTypeGroups.length === 0 && handoverTypeGroups.length === 0 && adminTypeGroups.length > 0;
  const propAndHandoverMsgCount = [...propTypeGroups, ...handoverTypeGroups].reduce(
    (sum, g) => sum + (g.messageCount || 0),
    0
  );

  // CRITICAL RULE:
  // If a property has its main Property group ("Kiotel - <Hotel>") OR a Handover group ("Handover - <Hotel>"),
  // the operational group where agents send numbers and data is already active -> it is ALREADY LAUNCHED!
  // A property is ONLY in Onboarding (NOT_YET_LIVE) when ONLY the "<Code> - Kiotel ADMIN" group exists and no main Property/Handover group exists yet!
  const isAlreadyLiveWithReporting =
    propTypeGroups.length > 0 ||
    handoverTypeGroups.length > 0;

  const propAndHandoverGroupIds = new Set([...propTypeGroups, ...handoverTypeGroups].map(g => g.groupId));
  const operationalMsgsOnly = sortedMsgs.filter(m => propAndHandoverGroupIds.has(m.groupId));

  // Check if operational messages show explicit shift closing ("Closing the shift" / "Kiosk is closed")
  const hasExplicitShiftClose = operationalMsgsOnly.some(m =>
    /\b(closing\s*the\s*shift|kiosk\s*is\s*closed|kiosk\s*closed|shift\s*closed|closing\s*kiosk)\b/i.test(m.text || '')
  );

  // Determine operating schedule window based on property evidence
  let schedule = {
    type: '24_7',
    is24Hours: true,
    startTime: '00:00',
    endTime: '23:59',
    verified: true
  };

  if (hasExplicitShiftClose) {
    // Properties where agents explicitly close the kiosk shift at end of shift window
    schedule = {
      type: 'SCHEDULED',
      is24Hours: false,
      startTime: '15:00',
      endTime: '09:00', // Overnight front-desk kiosk coverage (3:00 PM to 9:00 AM local time)
      verified: true
    };
  } else if (handoverTypeGroups.length > 0 && propTypeGroups.length === 0) {
    // Properties with only Night Audit / Handover coverage (scheduled evening/night shift 16:00 - 08:00 local time)
    schedule = {
      type: 'SCHEDULED',
      is24Hours: false,
      startTime: '16:00',
      endTime: '08:00',
      verified: true
    };
  } else if (propGroups.some(g => /transaction\s*reports|guest\s*transactions/i.test(g.name))) {
    schedule = {
      type: '24_7',
      is24Hours: true,
      startTime: '00:00',
      endTime: '23:59',
      verified: true
    };
  }

  // Determine Launch Status & Onboarding Stage
  let launchStatus = 'LAUNCHED';
  let onboardingStage = 'Live & Operating';
  let onboardingProgress = 100;
  let blockerReason = null;
  let actionRequired = 'None — Property Launched';

  if (!isAlreadyLiveWithReporting) {
    // Only mark as NOT_YET_LIVE (Onboarding) when there is NO active Property/Handover agent reporting!
    launchStatus = 'NOT_YET_LIVE';
    onboardingStage = hasAdminGroupOnly
      ? 'Admin Group Active — Pending Kiosk Installation & Property Group Go-Live'
      : 'Property Group Created — Pending Kiosk Delivery & First Live Shift';
    onboardingProgress = hasAdminGroupOnly ? 45 : 75;
    blockerReason = latestMsg
      ? `Latest Onboarding Update: "${(latestMsg.text || '').replace(/\s+/g, ' ').slice(0, 130)}"`
      : 'Kiosk installation & PMS/CC terminal setup pending before go-live.';
    actionRequired = 'Complete kiosk hardware/CC terminal installation and start live shift reporting.';
  }

  // Coverage & Evidence
  const lastGroupSyncTime = propGroups
    .map(g => g.lastAnalyzedAt || g.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .reverse()[0] || new Date().toISOString();

  const latestTimestamp = latestMsg?.timestamp || lastGroupSyncTime;
  const hasRecentGroupActivity =
    sortedMsgs.length > 0 ||
    propTypeGroups.length > 0 ||
    handoverTypeGroups.length > 0 ||
    propGroups.some(g => (g.messageCount || 0) > 0);

  const coverage = {
    type: 'SHARED',
    assignedTeamOrAgent: detectedAgent ? `${detectedAgent} (Shared Shift Pod)` : 'Kiotel Shared Shift Pod',
    assignedAgents: detectedAgent ? [detectedAgent] : ['Kiotel Shift Pod'],
    assignedManager: 'Sarthak',
    coverageConfirmed: launchStatus === 'LAUNCHED' && hasRecentGroupActivity,
    confirmed: launchStatus === 'LAUNCHED' && hasRecentGroupActivity,
    lastCoverageVerifiedAt: launchStatus === 'LAUNCHED' && hasRecentGroupActivity ? new Date().toISOString() : null
  };

  const lastEvidence = latestMsg
    ? {
        source: `WhatsApp (${latestMsg.groupName || prop.name})`,
        messageId: latestMsg.id,
        summary: `${detectedAgent || latestMsg.senderName || 'Shift Update'}: "${(latestMsg.text || '').replace(/\s+/g, ' ').slice(0, 110)}"`,
        timestamp: new Date().toISOString(), // Refresh evidence verification timestamp upon discovery sync
        originalMessageTimestamp: latestMsg.timestamp
      }
    : hasRecentGroupActivity
    ? {
        source: `WhatsApp Group Sync (${propGroups[0]?.name})`,
        messageId: null,
        summary: `Active group synced (${propGroups.reduce((acc, g) => acc + (g.messageCount || 0), 0)} messages recorded)`,
        timestamp: new Date().toISOString(),
        originalMessageTimestamp: lastGroupSyncTime
      }
    : null;

  return {
    launchStatus,
    schedule,
    coverage,
    lastEvidence,
    onboardingMeta: {
      stage: onboardingStage,
      progressPercent: onboardingProgress,
      isBlocked: launchStatus === 'NOT_YET_LIVE',
      blockerReason,
      actionRequired,
      detectedAgent: detectedAgent || 'Unassigned',
      lastMessageAt: latestMsg?.timestamp || null,
      lastMessagePreview: latestMsg ? (latestMsg.text || '').replace(/\s+/g, ' ').slice(0, 140) : 'No messages yet'
    }
  };
};

/**
 * Master Auto-Discovery & Re-Indexing Engine:
 * 1. Re-classifies all 208+ WhatsApp groups accurately (separating Property, Handover, Admin, Tech Support, Internal).
 * 2. Deduplicates and links Property Groups + Handover Groups + Admin Groups into real `properties[]`.
 * 3. Infers accurate US State/City IANA Timezones and operating schedules.
 * 4. Cleans false-positive incidents (routine shift reports / availability logs) and links real complaints & tech issues to their matched `propertyId` and `propertyName`.
 */
export const discoverAndSyncPropertiesFromGroups = () => {
  if (!Array.isArray(whatsappGroups) || whatsappGroups.length === 0) {
    return { propertiesCount: properties.length, groupsLinked: 0 };
  }

  // Keep any human-verified properties or custom overrides by ID/code
  const existingPropByCode = new Map();
  properties.forEach(p => {
    existingPropByCode.set(p.id, p);
    if (p.propertyCode) existingPropByCode.set(p.propertyCode, p);
  });

  // Step 1: Re-classify groups accurately and filter out non-property groups
  const propertyCandidateGroups = [];

  whatsappGroups.forEach(g => {
    const name = (g.name || g.groupName || '').trim();
    g.groupName = name;

    if (isNonPropertyGroup(name)) {
      if (!g.humanVerified) {
        if (/tech support/i.test(name)) {
          g.groupType = 'TECH_SUPPORT';
        } else if (/shift managers|manager|leave tracker|review tracker|shift logs|office boy|sales|hr ops|quality assurance|software dev|help group|^all$/i.test(name)) {
          g.groupType = 'INTERNAL_OPS';
        } else {
          g.groupType = 'INTERNAL_OPS';
        }
        g.linkedPropertyIds = [];
      }
      return;
    }

    const lower = name.toLowerCase();
    if (lower.includes('handover')) {
      g.groupType = 'HANDOVER';
    } else if (lower.includes('admin') || lower.includes('no delay response')) {
      g.groupType = 'ADMIN_CONTROL';
    } else if (
      lower.includes('kiotel') ||
      lower.includes('hotel') ||
      lower.includes('inn') ||
      lower.includes('suites') ||
      lower.includes('motel') ||
      lower.includes('lodge') ||
      lower.includes('baymont') ||
      lower.includes('super 8') ||
      lower.includes('super8') ||
      lower.includes('ramada') ||
      lower.includes('sonesta') ||
      lower.includes('americinn') ||
      lower.includes('woodspring') ||
      lower.includes('microtel') ||
      lower.includes('rodeway') ||
      lower.includes('surestay') ||
      lower.includes('sure stay') ||
      lower.includes('knights') ||
      lower.includes('red lion') ||
      lower.includes('red roof') ||
      lower.includes('redroof') ||
      lower.includes('studio 51') ||
      lower.includes('sleepover') ||
      lower.includes('grand texarkana') ||
      lower.includes('amador')
    ) {
      g.groupType = 'PROPERTY';
    }

    if (['PROPERTY', 'HANDOVER', 'ADMIN_CONTROL'].includes(g.groupType)) {
      propertyCandidateGroups.push(g);
    }
  });

  // Step 2: Build unified Property clusters
  // Pass A: Group by explicit 4-digit Kiotel Property Code from PROPERTY groups first
  const discoveredClusters = []; // Each cluster: { code, canonicalName, groups: [], tokens: Set }

  // Sort so primary `Kiotel - <Hotel> <Code>` PROPERTY groups come first, then HANDOVER, then ADMIN_CONTROL
  const rankGroup = (g) => {
    const n = g.name || '';
    if (g.groupType === 'PROPERTY' && !/transaction/i.test(n)) return 1;
    if (g.groupType === 'PROPERTY') return 2;
    if (g.groupType === 'HANDOVER') return 3;
    return 4;
  };

  const sortedCandidates = [...propertyCandidateGroups].sort((a, b) => rankGroup(a) - rankGroup(b));

  for (const grp of sortedCandidates) {
    const codes = extractPropertyCodes(grp.name);
    const cleanName = cleanHotelNameFromGroup(grp.name);
    const sigTokens = getSignificantTokens(grp.name);

    // Special case: Multi-property group (Admin or Transaction Reports or Response Control covering 2-3 properties)
    if (codes.length > 1) {
      let matchedAny = false;
      for (const code of codes) {
        let cluster = discoveredClusters.find(c => c.code === code);
        if (!cluster) {
          // Only create a new cluster from a multi-code Admin group if that code has messages or a known property
          if (grp.groupType === 'ADMIN_CONTROL' && (grp.messageCount || 0) <= 1) continue;
          cluster = {
            code,
            canonicalName: `Kiotel Property #${code}`,
            groups: [grp],
            tokens: new Set([code])
          };
          discoveredClusters.push(cluster);
        } else if (!cluster.groups.includes(grp)) {
          cluster.groups.push(grp);
        }
        matchedAny = true;
      }
      if (matchedAny) continue;
    }

    const primaryCode = codes[0] || null;

    // 1. Try matching by 4-digit property code
    let matchedCluster = primaryCode
      ? discoveredClusters.find(c => c.code === primaryCode)
      : null;

    // 2. Try matching by significant hotel/city tokens (e.g. linking "Handover - Super 8 by Wyndham Lenexa..." or "Handover’s Econo Lodge Cortez CO" to "Kiotel - Econo Lodge Cortez 1121")
    if (!matchedCluster && sigTokens.length > 0) {
      let bestScore = 0;
      let bestCandidate = null;

      for (const cluster of discoveredClusters) {
        // Don't merge two distinct PROPERTY groups that have DIFFERENT explicit 4-digit codes!
        if (primaryCode && cluster.code && primaryCode !== cluster.code) continue;

        const overlap = sigTokens.filter(t => cluster.tokens.has(t));
        const score = overlap.length / Math.min(sigTokens.length, Math.max(1, cluster.tokens.size));

        // Require strong city/brand overlap (at least 2 matching tokens or 1 unique city/hotel token with 100% match)
        if (
          (overlap.length >= 2 && score >= 0.6) ||
          (overlap.length === 1 && sigTokens.length === 1 && cluster.tokens.size === 1) ||
          (overlap.length >= 1 && overlap.some(t => [
            'cortez', 'reedsburg', 'moundcity', 'lenexa', 'waterloo', 'stroudsburg', 'spartanburg',
            'harrisonville', 'higginsville', 'alamosa', 'willcox', 'woodland', 'chino', 'corona',
            'walcott', 'waterford', 'bellevue', 'sparta', 'marshalltown', 'olathe', 'columbiana',
            'irmo', 'casey', 'cameron', 'clinton', 'westminster', 'meadows', 'kearney', 'topeka',
            'effingham', 'carbondale', 'burlington', 'texarkana', 'sturbridge', 'amador', 'bellemont'
          ].includes(t)) && (sigTokens.some(b => cluster.tokens.has(b))))
        ) {
          if (score > bestScore) {
            bestScore = score;
            bestCandidate = cluster;
          }
        }
      }
      matchedCluster = bestCandidate;
    }

    if (matchedCluster) {
      if (!matchedCluster.groups.includes(grp)) {
        matchedCluster.groups.push(grp);
      }
      if (!matchedCluster.code && primaryCode) {
        matchedCluster.code = primaryCode;
      }
      if (
        (matchedCluster.canonicalName.startsWith('Kiotel Property #') || matchedCluster.canonicalName.length < 6) &&
        cleanName &&
        cleanName.length >= 4 &&
        !/^\d+$/.test(cleanName)
      ) {
        matchedCluster.canonicalName = cleanName;
      }
      sigTokens.forEach(t => matchedCluster.tokens.add(t));
    } else {
      // Create new property cluster
      const displayTitle =
        cleanName && cleanName.length >= 3 && !/^\d+$/.test(cleanName)
          ? cleanName
          : primaryCode
          ? `Kiotel Property #${primaryCode}`
          : grp.name;

      discoveredClusters.push({
        code: primaryCode,
        canonicalName: displayTitle,
        groups: [grp],
        tokens: new Set(sigTokens)
      });
    }
  }

  // Step 3: Build `properties[]` and link `whatsappGroups[]`
  // Reset group property links before re-linking
  whatsappGroups.forEach(g => {
    g.linkedPropertyIds = [];
  });

  const rebuiltProperties = [];
  let fallbackCounter = 1;

  for (const cluster of discoveredClusters) {
    // Skip empty Admin-only placeholder groups with 0 messages and no Property/Handover group (e.g. "1110 - Kiotel ADMIN" [0m], "1123 - Kiotel ADMIN" [0m])
    const hasPropOrHandover = cluster.groups.some(g => g.groupType === 'PROPERTY' || g.groupType === 'HANDOVER');
    const totalClusterMsgs = cluster.groups.reduce((s, g) => s + (g.messageCount || 0), 0);
    if (!hasPropOrHandover && totalClusterMsgs === 0) {
      continue;
    }

    const propId = cluster.code
      ? `KIOTEL-${cluster.code}`
      : `KIOTEL-WESTMINSTER`;

    const existing = existingPropByCode.get(propId) || null;
    const isUserCustomized = Boolean(existing?.customConfiguredByUser);
    const combinedGroupNames = cluster.groups.map(g => g.name).join(' | ');
    const { timezone, cluster: regionCluster } = inferTimezoneAndCluster(`${cluster.canonicalName} ${combinedGroupNames}`);

    const linkedGroupIds = cluster.groups.map(g => g.groupId);
    const propMessages = messageLogs.filter(m => linkedGroupIds.includes(m.groupId));

    const derived = derivePropertyOperationalProfileFromMessages(
      { id: propId, name: cluster.canonicalName },
      cluster.groups,
      propMessages
    );

    const formattedName = cluster.code && !cluster.canonicalName.includes(cluster.code) && !cluster.canonicalName.startsWith('Kiotel Property #')
      ? `${cluster.canonicalName} (#${cluster.code})`
      : cluster.canonicalName.startsWith('Kiotel Property #')
      ? `Onboarding Property #${cluster.code} (Admin Setup)`
      : cluster.canonicalName;

    const propertyRecord = {
      id: propId,
      propertyCode: cluster.code || 'WESTMINSTER',
      name: isUserCustomized && existing?.name ? existing.name : formattedName,
      timezone: isUserCustomized && existing?.timezone ? existing.timezone : timezone,
      launchStatus: isUserCustomized && existing?.launchStatus ? existing.launchStatus : derived.launchStatus,
      launchDate: existing?.launchDate || null,
      schedule: isUserCustomized && existing?.schedule ? existing.schedule : derived.schedule,
      operatingSchedule: isUserCustomized && existing?.operatingSchedule ? existing.operatingSchedule : derived.schedule,
      coverage: isUserCustomized && existing?.coverage ? existing.coverage : derived.coverage,
      kioskCount: existing?.kioskCount || 1,
      cluster: existing?.cluster || regionCluster,
      linkedGroupIds,
      linkedGroupNames: cluster.groups.map(g => g.name),
      humanVerified: true,
      customConfiguredByUser: isUserCustomized,
      lastEvidence: derived.lastEvidence || existing?.lastEvidence || null,
      onboardingMeta: derived.onboardingMeta,
      manualStatusOverride: isUserCustomized ? (existing?.manualStatusOverride || null) : null
    };

    rebuiltProperties.push(propertyRecord);

    // Link each group back to this property
    cluster.groups.forEach(g => {
      if (!g.linkedPropertyIds.includes(propId)) {
        g.linkedPropertyIds.push(propId);
      }
      if (g.linkedPropertyIds.length > 1 && g.groupType === 'ADMIN_CONTROL') {
        g.groupType = 'MULTI_PROPERTY';
      }
    });
  }

  // Sort properties: numeric KIOTEL-XXXX codes first, then alphabetical
  rebuiltProperties.sort((a, b) => a.name.localeCompare(b.name));

  properties.length = 0;
  properties.push(...rebuiltProperties);

  // Build quick lookup from groupId -> property
  const groupToPropsMap = new Map();
  whatsappGroups.forEach(g => {
    const linked = properties.filter(p => (g.linkedPropertyIds || []).includes(p.id));
    groupToPropsMap.set(g.groupId, linked);
  });

  // Step 4: Enrich all messageLogs with their matched Property ID, Property Name, Local Time & Shift
  messageLogs.forEach(m => {
    const linkedProps = groupToPropsMap.get(m.groupId) || [];
    let primaryProp = linkedProps[0] || null;

    // If from a multi-property admin or tech support group, check if text mentions a specific hotel
    if (linkedProps.length !== 1 && m.text) {
      const msgTokens = getSignificantTokens(m.text);
      const msgCodes = extractPropertyCodes(m.text);
      if (msgCodes.length > 0) {
        const byCode = properties.find(p => msgCodes.includes(p.propertyCode));
        if (byCode) primaryProp = byCode;
      }
      if (!primaryProp && msgTokens.length > 0) {
        const byName = properties.find(p => {
          const pTokens = getSignificantTokens(p.name);
          return pTokens.length > 0 && pTokens.every(t => msgTokens.includes(t));
        });
        if (byName) primaryProp = byName;
      }
    }

    if (primaryProp) {
      m.propertyId = primaryProp.id;
      m.propertyIds = linkedProps.length > 0 ? linkedProps.map(p => p.id) : [primaryProp.id];
      m.propertyName = primaryProp.name;
      const shiftInfo = evaluatePropertyLocalTimeAndShift(primaryProp, m.timestamp);
      m.propertyLocalTime = shiftInfo.propertyLocalTime;
      m.reportingShift = shiftInfo.reportingShift;
    }

    // Fix senderName if it was a raw 18-digit group JID
    if (m.senderName && /^\d{14,}$/.test(m.senderName)) {
      const tildeMatch = (m.text || '').match(/~\s*([A-Za-z][A-Za-z\s.]{1,22})$/m);
      const auditPipeMatch = (m.text || '').match(/shift\s*\|\s*([A-Za-z][A-Za-z\s.]{1,20}?)\s*[-–]/i);
      if (tildeMatch) {
        m.senderName = `${tildeMatch[1].trim()} (Kiotel Agent)`;
        m.isTeam = true;
        m.senderRole = 'KIOTEL_STAFF';
      } else if (auditPipeMatch) {
        m.senderName = `${auditPipeMatch[1].trim()} (Night Audit)`;
        m.isTeam = true;
        m.senderRole = 'KIOTEL_STAFF';
      } else {
        m.senderName = primaryProp ? `${primaryProp.name} Desk` : 'Property Contact';
      }
    }
  });

  // Step 5: Clean up false-positive incidents (routine availability/shift logs) & link real incidents to properties
  const validIncidents = [];
  for (const inc of incidents) {
    const rawText = inc.originalComplaint || inc.originalDescription || inc.summary || inc.title || '';
    const grp = whatsappGroups.find(g => g.groupId === inc.groupId);

    // Filter out incidents from strictly non-property personal/internal groups (like Trip to Goa, Office Boy, etc.)
    if (grp && isNonPropertyGroup(grp.name) && grp.groupType !== 'TECH_SUPPORT') {
      continue;
    }

    // Filter out routine shift logs / availability counts / rate checks that are NOT actual complaints or tech issues
    if (isRoutineOperationalEvidenceMessage(rawText) && !inc.humanVerified) {
      continue;
    }

    // Link incident to its discovered property
    const linkedProps = groupToPropsMap.get(inc.groupId) || [];
    let matchedProp = linkedProps[0] || null;

    if ((!matchedProp || linkedProps.length > 1) && rawText) {
      const msgCodes = extractPropertyCodes(rawText);
      if (msgCodes.length > 0) {
        matchedProp = properties.find(p => msgCodes.includes(p.propertyCode)) || matchedProp;
      }
      const msgTokens = getSignificantTokens(rawText);
      if (msgTokens.length > 0) {
        const byTokens = properties.find(p => {
          const pTokens = getSignificantTokens(p.name);
          const overlap = pTokens.filter(t => msgTokens.includes(t));
          return overlap.length >= 1 && overlap.some(t => t.length >= 5);
        });
        if (byTokens) matchedProp = byTokens;
      }
    }

    if (matchedProp) {
      inc.propertyId = matchedProp.id;
      inc.propertyIds = [matchedProp.id];
      inc.propertyName = matchedProp.name;
      const shiftInfo = evaluatePropertyLocalTimeAndShift(matchedProp, inc.raisedAt || inc.createdAt);
      inc.propertyLocalTime = shiftInfo.propertyLocalTime;
      inc.reportingShift = shiftInfo.reportingShift;
      inc.shiftVerified = shiftInfo.shiftVerified;
    }

    // Clean up raw numeric JID reporter names
    if (inc.reporterName && /^\d{14,}$/.test(inc.reporterName)) {
      const tildeMatch = rawText.match(/~\s*([A-Za-z][A-Za-z\s.]{1,22})$/m);
      const cleanActor = tildeMatch
        ? `${tildeMatch[1].trim()} (Agent)`
        : matchedProp
        ? `${matchedProp.name} Contact`
        : 'Property / Group Contact';
      inc.reporterName = cleanActor;
      if (inc.raisedBy) inc.raisedBy.name = cleanActor;
      if (inc.reportedBy) inc.reportedBy.name = cleanActor;
    }

    // Re-classify AmericInn Reedsburg phone non-answer feedback as a COMPLAINT (Service / Call-Answer Complaint) if it was tagged as PERIPHERALS
    if (/not answering phones/i.test(rawText) && /customer service/i.test(rawText)) {
      inc.recordType = 'COMPLAINT';
      inc.isTechnical = false;
      inc.category = 'CLIENT_ESCALATION';
    }

    validIncidents.push(inc);
  }

  incidents.length = 0;
  incidents.push(...validIncidents);

  const now = new Date();
  const statusCounts = {
    LIVE: 0,
    OUTSIDE_HOURS: 0,
    NOT_YET_LIVE: 0,
    AT_RISK: 0,
    SUSPENDED: 0,
    UNKNOWN: 0
  };
  properties.forEach(p => {
    const ev = evaluatePropertyStatus(p, incidents, now);
    if (statusCounts[ev.status] !== undefined) {
      statusCounts[ev.status] += 1;
    } else {
      statusCounts.UNKNOWN += 1;
    }
  });

  savePersistedState();
  console.log(
    `🏨 [PROPERTY DISCOVERY] Auto-linked ${properties.length} real Kiotel properties across ${whatsappGroups.length} WhatsApp groups (LIVE: ${statusCounts.LIVE}, OUTSIDE_HOURS: ${statusCounts.OUTSIDE_HOURS}, ONBOARDING: ${statusCounts.NOT_YET_LIVE}, AT_RISK: ${statusCounts.AT_RISK}).`
  );

  return {
    totalProperties: properties.length,
    propertiesCount: properties.length,
    createdProperties: Math.max(0, properties.length - existingPropByCode.size),
    updatedProperties: existingPropByCode.size,
    incidentsCount: incidents.length,
    statusCounts
  };
};
