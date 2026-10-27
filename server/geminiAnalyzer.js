// ================================================================
// 🧠 KIOTEL OPERATIONS INTELLIGENCE — EVIDENCE-BASED ANALYZER
// Computes all 15 Operations Manager Dashboard dimensions (Section 11)
// with 100% traceable record lists and zero fabricated data.
// ================================================================

import {
  whatsappGroups,
  properties,
  incidents,
  messageLogs,
  systemMeta
} from './dataStore.js';
import { evaluatePropertyStatus, PROPERTY_STATUS } from './statusEngine.js';
import { RESOLUTION_STATES } from './incidentEngine.js';

export const formatDurationOpen = (raisedAtIso, resolvedAtIso = null, nowMs = Date.now()) => {
  if (!raisedAtIso) return 'Unknown';
  const startMs = new Date(raisedAtIso).getTime();
  const endMs = resolvedAtIso ? new Date(resolvedAtIso).getTime() : nowMs;
  const diffMin = Math.max(0, Math.floor((endMs - startMs) / 60000));
  if (diffMin < 60) return `${diffMin}m`;
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (hrs < 24) return `${hrs}h ${mins}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
};

export const enrichIncidentDynamicFields = (inc, nowMs = Date.now()) => {
  const isResolved = inc.resolutionState === RESOLUTION_STATES.RESOLVED_VERIFIED;
  const startMs = inc.raisedAt ? new Date(inc.raisedAt).getTime() : nowMs;
  const endMs = isResolved && inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : nowMs;
  const timeOpenMs = Math.max(0, endMs - startMs);
  const deadlineMs = inc.deadline && inc.deadline !== 'UNKNOWN' ? new Date(inc.deadline).getTime() : null;
  const isOverdue = !isResolved && deadlineMs ? nowMs > deadlineMs : !!inc.isOverdue;

  return {
    ...inc,
    severity: inc.severity || inc.seriousness?.severity || 'MEDIUM',
    seriousnessLevel: inc.seriousness?.severity || inc.severity || 'MEDIUM',
    timeOpenMs,
    timeOpenFormatted: formatDurationOpen(inc.raisedAt, isResolved ? inc.resolvedAt : null, nowMs),
    isOverdue
  };
};

export const run24hAiAnalysis = (referenceDate = new Date()) => {
  const nowMs = referenceDate.getTime();
  const twentyFourHoursAgo = nowMs - 24 * 60 * 60 * 1000;
  const fortyEightHoursAgo = nowMs - 48 * 60 * 60 * 1000;
  const lastReviewMs = systemMeta.lastManagerReviewAt
    ? new Date(systemMeta.lastManagerReviewAt).getTime()
    : twentyFourHoursAgo;

  // 1. Evaluate all properties deterministically
  const evaluatedProperties = properties.map(p => ({
    ...p,
    evaluation: evaluatePropertyStatus(p, incidents, referenceDate)
  }));

  const statusBreakdown = {
    [PROPERTY_STATUS.LIVE]: evaluatedProperties.filter(p => p.evaluation.status === PROPERTY_STATUS.LIVE),
    [PROPERTY_STATUS.OUTSIDE_HOURS]: evaluatedProperties.filter(p => p.evaluation.status === PROPERTY_STATUS.OUTSIDE_HOURS),
    [PROPERTY_STATUS.NOT_YET_LIVE]: evaluatedProperties.filter(p => p.evaluation.status === PROPERTY_STATUS.NOT_YET_LIVE),
    [PROPERTY_STATUS.AT_RISK]: evaluatedProperties.filter(p => p.evaluation.status === PROPERTY_STATUS.AT_RISK),
    [PROPERTY_STATUS.SUSPENDED]: evaluatedProperties.filter(p => p.evaluation.status === PROPERTY_STATUS.SUSPENDED),
    [PROPERTY_STATUS.UNKNOWN]: evaluatedProperties.filter(p => p.evaluation.status === PROPERTY_STATUS.UNKNOWN)
  };

  // 2. Group Inventory Analysis
  const unverifiedGroups = whatsappGroups.filter(g => !g.humanVerified);
  const unmappedPropertyGroups = whatsappGroups.filter(
    g => (g.groupType === 'PROPERTY' || g.groupType === 'MULTI_PROPERTY') && (!g.linkedPropertyIds || g.linkedPropertyIds.length === 0)
  );
  const staleGroups = whatsappGroups.filter(g => {
    if (!g.lastAnalyzedAt && !g.lastSyncedAt) return true;
    const t = new Date(g.lastAnalyzedAt || g.lastSyncedAt).getTime();
    return nowMs - t > 24 * 60 * 60 * 1000 || !g.humanVerified;
  });

  // 3. Enrich Incidents & Separate Complaints vs Technical Issues (Sections 4, 5, 11)
  const enrichedIncidents = incidents.map(inc => enrichIncidentDynamicFields(inc, nowMs));

  const allComplaints = enrichedIncidents.filter(i => i.recordType === 'COMPLAINT' || !i.isTechnical);
  const allTechIssues = enrichedIncidents.filter(i => i.recordType === 'TECH_ISSUE' || i.isTechnical);

  const complaints24h = allComplaints.filter(i => new Date(i.raisedAt).getTime() >= twentyFourHoursAgo);
  const complaints48h = allComplaints.filter(i => new Date(i.raisedAt).getTime() >= fortyEightHoursAgo);
  const openComplaints = allComplaints.filter(i => i.resolutionState !== RESOLUTION_STATES.RESOLVED_VERIFIED);
  const openTechIssues = allTechIssues.filter(i => i.resolutionState !== RESOLUTION_STATES.RESOLVED_VERIFIED);

  const unresolvedIncidents = enrichedIncidents.filter(inc => inc.resolutionState !== RESOLUTION_STATES.RESOLVED_VERIFIED);
  const awaitingResponseIncidents = enrichedIncidents.filter(
    inc => inc.resolutionState === RESOLUTION_STATES.AWAITING_RESPONSE || inc.resolutionState === RESOLUTION_STATES.REPORTED
  );
  const superficialAckOnlyIncidents = enrichedIncidents.filter(
    inc =>
      inc.resolutionState === RESOLUTION_STATES.RESPONSE_PROVIDED_ACTION_PENDING ||
      inc.resolutionState === RESOLUTION_STATES.ACKNOWLEDGED
  );
  const criticalOrHighUnresolved = unresolvedIncidents.filter(
    inc => inc.severity === 'CRITICAL' || inc.severity === 'HIGH'
  );
  const unassignedIncidents = unresolvedIncidents.filter(
    inc => !inc.actionAssignedTo || inc.actionAssignedTo === 'UNASSIGNED' || inc.assignedTechnician?.startsWith('Unassigned')
  );
  const shiftCarryoverIncidents = unresolvedIncidents.filter(
    inc => inc.carriedOverShift || inc.passedToNextShift || inc.timeOpenMs > 8 * 60 * 60 * 1000
  );
  const overdueIncidents = unresolvedIncidents.filter(inc => inc.isOverdue);
  const repeatedAndRecurringIncidents = enrichedIncidents.filter(
    inc => inc.isRepeated || inc.isRecurring || (inc.reopenCount && inc.reopenCount > 0)
  );
  const recentlyResolvedIncidents = enrichedIncidents.filter(
    inc => inc.resolutionState === RESOLUTION_STATES.RESOLVED_VERIFIED && new Date(inc.latestUpdateAt).getTime() >= fortyEightHoursAgo
  );
  const reopenedIncidents = enrichedIncidents.filter(
    inc => inc.resolutionState === RESOLUTION_STATES.REOPENED || (inc.reopenCount && inc.reopenCount > 0)
  );

  const managerAttentionMessages = messageLogs.filter(
    m => m.analysis?.importance?.level === 'HIGH'
  ).slice(0, 50);

  // 4. Changes Since Last Review
  const newMessagesSinceReview = messageLogs.filter(
    m => new Date(m.timestamp).getTime() >= lastReviewMs
  );
  const newIncidentsSinceReview = enrichedIncidents.filter(
    inc => new Date(inc.raisedAt).getTime() >= lastReviewMs
  );
  const resolvedSinceReview = enrichedIncidents.filter(
    inc => inc.resolutionState === RESOLUTION_STATES.RESOLVED_VERIFIED && new Date(inc.latestUpdateAt).getTime() >= lastReviewMs
  );

  // 5. Coverage Breakdown
  const dedicatedProperties = properties.filter(p => p.coverage?.type === 'DEDICATED');
  const sharedProperties = properties.filter(p => p.coverage?.type === 'SHARED');
  const unknownCoverageProperties = properties.filter(p => !p.coverage?.type || p.coverage?.type === 'UNKNOWN' || !p.coverage?.coverageConfirmed);

  // 6. Generate Actionable Operations Manager Checklist
  const opsActionItems = [];
  if (awaitingResponseIncidents.length > 0) {
    opsActionItems.push(`Respond to ${awaitingResponseIncidents.length} unanswered property/owner message(s) awaiting initial response.`);
  }
  if (superficialAckOnlyIncidents.length > 0) {
    opsActionItems.push(`Follow up on ${superficialAckOnlyIncidents.length} incident(s) where staff replied ("Okay/Checking") but action is still pending.`);
  }
  if (openTechIssues.length > 0) {
    opsActionItems.push(`Review ${openTechIssues.length} open Technical Issue(s) in the Technical Issues Register (${openTechIssues.filter(t => t.affectsCheckIn).length} affecting check-in).`);
  }
  if (unassignedIncidents.length > 0) {
    opsActionItems.push(`Assign an owner/technician to ${unassignedIncidents.length} unassigned open incident(s).`);
  }
  if (unverifiedGroups.length > 0) {
    opsActionItems.push(`Verify ${unverifiedGroups.length} imported WhatsApp group profile(s) and confirm their property associations.`);
  }
  if (statusBreakdown[PROPERTY_STATUS.UNKNOWN].length > 0) {
    opsActionItems.push(`Complete schedule, timezone, and coverage verification for ${statusBreakdown[PROPERTY_STATUS.UNKNOWN].length} property(ies) currently marked Unknown.`);
  }

  const executiveBrief =
    properties.length === 0 && whatsappGroups.length === 0
      ? 'Zero properties or WhatsApp groups imported yet. Connect your WhatsApp account or use the Test Sandbox to begin real-time operational intelligence.'
      : `Monitoring ${whatsappGroups.length} WhatsApp groups (${unverifiedGroups.length} unverified) and ${properties.length} properties: ${statusBreakdown[PROPERTY_STATUS.LIVE].length} Live, ${statusBreakdown[PROPERTY_STATUS.AT_RISK].length} At Risk, ${statusBreakdown[PROPERTY_STATUS.OUTSIDE_HOURS].length} Outside Hours, ${statusBreakdown[PROPERTY_STATUS.NOT_YET_LIVE].length} Not Yet Live, ${statusBreakdown[PROPERTY_STATUS.SUSPENDED].length} Suspended, and ${statusBreakdown[PROPERTY_STATUS.UNKNOWN].length} Unknown/Needs Verification. Currently tracking ${openComplaints.length} open complaints and ${openTechIssues.length} open technical issues.`;

  return {
    generatedAt: referenceDate.toISOString(),
    lastManagerReviewAt: systemMeta.lastManagerReviewAt,
    executiveBrief,
    deltaSinceLastReview: {
      lastReviewedAt: systemMeta.lastManagerReviewAt,
      lastReviewedBy: systemMeta.lastReviewedBy || 'Operations Manager',
      newMessagesCount: newMessagesSinceReview.length,
      newIncidentsCount: newIncidentsSinceReview.length,
      resolvedSinceReviewCount: resolvedSinceReview.length
    },
    propertyStatusBreakdown: {
      LIVE: { count: statusBreakdown[PROPERTY_STATUS.LIVE].length, items: statusBreakdown[PROPERTY_STATUS.LIVE] },
      AT_RISK: { count: statusBreakdown[PROPERTY_STATUS.AT_RISK].length, items: statusBreakdown[PROPERTY_STATUS.AT_RISK] },
      OUTSIDE_HOURS: { count: statusBreakdown[PROPERTY_STATUS.OUTSIDE_HOURS].length, items: statusBreakdown[PROPERTY_STATUS.OUTSIDE_HOURS] },
      NOT_YET_LIVE: { count: statusBreakdown[PROPERTY_STATUS.NOT_YET_LIVE].length, items: statusBreakdown[PROPERTY_STATUS.NOT_YET_LIVE] },
      SUSPENDED: { count: statusBreakdown[PROPERTY_STATUS.SUSPENDED].length, items: statusBreakdown[PROPERTY_STATUS.SUSPENDED] },
      UNKNOWN: { count: statusBreakdown[PROPERTY_STATUS.UNKNOWN].length, items: statusBreakdown[PROPERTY_STATUS.UNKNOWN] }
    },
    coverageBreakdown: {
      dedicatedCount: dedicatedProperties.length,
      sharedCount: sharedProperties.length,
      unverifiedCoverageCount: unknownCoverageProperties.length
    },
    groupVerificationSummary: {
      totalGroups: whatsappGroups.length,
      verifiedGroups: whatsappGroups.length - unverifiedGroups.length,
      unverifiedGroups: unverifiedGroups.length,
      staleGroups: staleGroups.length
    },
    awaitingResponseList: awaitingResponseIncidents,
    actionPendingAfterAckList: superficialAckOnlyIncidents,
    criticalAndHighIncidents: criticalOrHighUnresolved,
    highImportanceMessages: managerAttentionMessages,
    opsActionItems,

    // Section 11: 15-Dimension Operations Manager Dashboard Counts & Traceable Lists
    counts: {
      totalWhatsappGroups: whatsappGroups.length,
      unverifiedGroupsCount: unverifiedGroups.length,
      unmappedPropertyGroupsCount: unmappedPropertyGroups.length,
      staleGroupsCount: staleGroups.length,
      totalProperties: properties.length,
      liveCount: statusBreakdown[PROPERTY_STATUS.LIVE].length,
      outsideHoursCount: statusBreakdown[PROPERTY_STATUS.OUTSIDE_HOURS].length,
      notYetLiveCount: statusBreakdown[PROPERTY_STATUS.NOT_YET_LIVE].length,
      atRiskCount: statusBreakdown[PROPERTY_STATUS.AT_RISK].length,
      suspendedCount: statusBreakdown[PROPERTY_STATUS.SUSPENDED].length,
      unknownStatusCount: statusBreakdown[PROPERTY_STATUS.UNKNOWN].length,
      complaints24hCount: complaints24h.length,
      complaints48hCount: complaints48h.length,
      openComplaintsCount: openComplaints.length,
      openTechIssuesCount: openTechIssues.length,
      unresolvedIncidentsCount: unresolvedIncidents.length,
      awaitingResponseCount: awaitingResponseIncidents.length,
      superficialAckPendingActionCount: superficialAckOnlyIncidents.length,
      criticalOrHighCount: criticalOrHighUnresolved.length,
      unassignedIncidentsCount: unassignedIncidents.length,
      shiftCarryoverCount: shiftCarryoverIncidents.length,
      overdueIncidentsCount: overdueIncidents.length,
      repeatedAndRecurringCount: repeatedAndRecurringIncidents.length,
      recentlyResolvedCount: recentlyResolvedIncidents.length,
      reopenedIncidentsCount: reopenedIncidents.length,
      dedicatedCoverageCount: dedicatedProperties.length,
      sharedCoverageCount: sharedProperties.length,
      unknownCoverageCount: unknownCoverageProperties.length,
      newIncidentsSinceReviewCount: newIncidentsSinceReview.length,
      resolvedSinceReviewCount: resolvedSinceReview.length
    },
    traceableLists: {
      liveProperties: statusBreakdown[PROPERTY_STATUS.LIVE].map(p => ({ id: p.id, name: p.name, reason: p.evaluation.reason })),
      atRiskProperties: statusBreakdown[PROPERTY_STATUS.AT_RISK].map(p => ({ id: p.id, name: p.name, reason: p.evaluation.reason })),
      outsideHoursProperties: statusBreakdown[PROPERTY_STATUS.OUTSIDE_HOURS].map(p => ({ id: p.id, name: p.name, reason: p.evaluation.reason })),
      notYetLiveProperties: statusBreakdown[PROPERTY_STATUS.NOT_YET_LIVE].map(p => ({ id: p.id, name: p.name, reason: p.evaluation.reason })),
      suspendedProperties: statusBreakdown[PROPERTY_STATUS.SUSPENDED].map(p => ({ id: p.id, name: p.name, reason: p.evaluation.reason })),
      unknownProperties: statusBreakdown[PROPERTY_STATUS.UNKNOWN].map(p => ({ id: p.id, name: p.name, reason: p.evaluation.reason, missingInfo: p.evaluation.missingInfo })),
      complaints24h,
      complaints48h,
      openComplaints,
      openTechIssues,
      awaitingResponseIncidents,
      superficialAckOnlyIncidents,
      criticalOrHighUnresolved,
      unassignedIncidents,
      shiftCarryoverIncidents,
      overdueIncidents,
      repeatedAndRecurringIncidents,
      recentlyResolvedIncidents,
      reopenedIncidents,
      staleGroups,
      managerAttentionMessages
    }
  };
};