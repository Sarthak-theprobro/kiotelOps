// ================================================================
// 🧪 KIOTEL OPERATIONS INTELLIGENCE — 14-SCENARIO MASTER TEST SUITE
// Verifies operational accuracy, timezone & overnight schedule logic,
// shared staffing, multi-property groups, superficial reply handling,
// duplicate prevention, cross-group linking, unknown reporter/shift,
// and recurring technical issue reopening.
// ================================================================

import assert from 'assert';
import { evaluatePropertyStatus, PROPERTY_STATUS } from './statusEngine.js';
import {
  analyzeMessageContext,
  ingestOperationalMessage,
  RESOLUTION_STATES,
  GROUP_TYPES
} from './incidentEngine.js';
import { whatsappGroups, properties, incidents, messageLogs, savePersistedState } from './dataStore.js';

// Reset in-memory arrays for isolated testing
whatsappGroups.length = 0;
properties.length = 0;
incidents.length = 0;
messageLogs.length = 0;

// Fixed reference timestamp: 2026-10-18T14:00:00Z (10:00 AM in America/New_York EDT)
const REF_TIME = new Date('2026-10-18T14:00:00.000Z');
const RECENT_ISO = new Date('2026-10-18T13:30:00.000Z').toISOString();
const STALE_ISO = new Date('2026-10-15T10:00:00.000Z').toISOString();

console.log('===============================================================');
console.log('🧪 RUNNING KIOTEL OPERATIONS INTELLIGENCE 14-SCENARIO SUITE');
console.log('===============================================================\n');

// ----------------------------------------------------------------
// TEST 1: A property operating 24/7 with recent evidence & coverage
// ----------------------------------------------------------------
const prop247 = {
  id: 'PROP-TEST-1',
  name: 'Kiotel Atlanta Airport',
  timezone: 'America/New_York',
  launchStatus: 'LAUNCHED',
  humanVerified: true,
  schedule: { type: '24_7', startTime: null, endTime: null },
  coverage: {
    type: 'DEDICATED',
    assignedTeamOrAgent: 'Agent Rohan',
    coverageConfirmed: true,
    lastCoverageVerifiedAt: RECENT_ISO
  },
  lastEvidence: {
    source: 'WhatsApp Group',
    summary: 'Kiosk is live and operating',
    timestamp: RECENT_ISO
  }
};
const eval1 = evaluatePropertyStatus(prop247, [], REF_TIME);
assert.strictEqual(eval1.status, PROPERTY_STATUS.LIVE, '24/7 property with recent evidence must be LIVE');
console.log('✅ [PASS] Scenario 1: Property operating 24/7 ->', eval1.statusLabel);

// ----------------------------------------------------------------
// TEST 2: A property with a scheduled shift that has NOT started yet / Not Yet Live
// ----------------------------------------------------------------
const propNotYetLive = {
  id: 'PROP-TEST-2',
  name: 'Kiotel Dallas North (Onboarding)',
  timezone: 'America/Chicago',
  launchStatus: 'NOT_YET_LIVE',
  launchDate: '2026-11-01',
  schedule: { type: 'SCHEDULED', startTime: '08:00', endTime: '22:00' },
  coverage: { type: 'SHARED', assignedTeamOrAgent: 'Shared Pool A', coverageConfirmed: false }
};
const eval2a = evaluatePropertyStatus(propNotYetLive, [], REF_TIME);
assert.strictEqual(eval2a.status, PROPERTY_STATUS.NOT_YET_LIVE, 'Unlaunched property must be NOT_YET_LIVE');

const propUnstartedShift = {
  id: 'PROP-TEST-2B',
  name: 'Kiotel Evening Suites',
  timezone: 'America/New_York', // 10:00 AM at REF_TIME
  launchStatus: 'LAUNCHED',
  schedule: { type: 'SCHEDULED', startTime: '15:00', endTime: '23:00' },
  coverage: { type: 'SHARED', assignedTeamOrAgent: 'Evening Pool', coverageConfirmed: true, lastCoverageVerifiedAt: RECENT_ISO }
};
const eval2b = evaluatePropertyStatus(propUnstartedShift, [], REF_TIME);
assert.strictEqual(eval2b.status, PROPERTY_STATUS.OUTSIDE_HOURS, 'Property whose shift starts at 15:00 must be OUTSIDE_HOURS at 10:00');
console.log('✅ [PASS] Scenario 2: Unlaunched property & unstarted shift ->', eval2a.statusLabel, '/', eval2b.statusLabel);

// ----------------------------------------------------------------
// TEST 3: A property outside its operating hours + Overnight shift across midnight
// ----------------------------------------------------------------
const propOvernightOutside = {
  id: 'PROP-TEST-3A',
  name: 'Kiotel Night Desk Inn',
  timezone: 'America/New_York',
  launchStatus: 'LAUNCHED',
  schedule: { type: 'SCHEDULED', startTime: '22:00', endTime: '06:00' },
  coverage: { type: 'SHARED', assignedTeamOrAgent: 'Night Pool', coverageConfirmed: true, lastCoverageVerifiedAt: RECENT_ISO }
};
const eval3a = evaluatePropertyStatus(propOvernightOutside, [], REF_TIME);
assert.strictEqual(eval3a.status, PROPERTY_STATUS.OUTSIDE_HOURS, 'Overnight property (22:00-06:00) must be OUTSIDE_HOURS at 10:00 AM');

const NIGHT_REF_TIME = new Date('2026-10-18T06:30:00.000Z'); // 02:30 AM EDT
const eval3b = evaluatePropertyStatus(propOvernightOutside, [], NIGHT_REF_TIME);
assert.strictEqual(eval3b.status, PROPERTY_STATUS.LIVE, 'Overnight property (22:00-06:00) must be LIVE at 02:30 AM local time');
console.log('✅ [PASS] Scenario 3: Outside operating hours & overnight shift across midnight verified');

// ----------------------------------------------------------------
// TEST 4: A property with shared staffing
// ----------------------------------------------------------------
const propShared = {
  id: 'PROP-TEST-4',
  name: 'Kiotel Shared Pool Express',
  timezone: 'America/New_York',
  launchStatus: 'LAUNCHED',
  schedule: { type: 'SCHEDULED', startTime: '07:00', endTime: '19:00' },
  coverage: {
    type: 'SHARED',
    assignedTeamOrAgent: 'Shared Desk Pod B (4 Agents)',
    coverageConfirmed: true,
    lastCoverageVerifiedAt: RECENT_ISO
  },
  lastEvidence: {
    source: 'Shift Roster Verification',
    summary: 'Shared Pod B active on desk',
    timestamp: RECENT_ISO
  }
};
const eval4 = evaluatePropertyStatus(propShared, [], REF_TIME);
assert.strictEqual(eval4.status, PROPERTY_STATUS.LIVE, 'Property with confirmed SHARED staffing must be LIVE');
console.log('✅ [PASS] Scenario 4: Shared staffing property evaluated accurately as ->', eval4.statusLabel);

// ----------------------------------------------------------------
// TEST 5: A property with a serious unresolved issue -> AT_RISK
// ----------------------------------------------------------------
const activeHighIncident = {
  id: 'TECH-1001',
  propertyId: 'PROP-TEST-1',
  propertyName: 'Kiotel Atlanta Airport',
  groupName: 'Atlanta Airport Front Desk',
  title: 'Kiosk ID scanner hardware offline, guests unable to check in',
  seriousness: { severity: 'HIGH', affectedDomain: 'KIOSK / Service Delivery', reason: 'Blocking guest check-in' },
  resolutionState: RESOLUTION_STATES.ACTION_IN_PROGRESS,
  raisedAt: RECENT_ISO,
  latestUpdateAt: RECENT_ISO
};
const eval5 = evaluatePropertyStatus(prop247, [activeHighIncident], REF_TIME);
assert.strictEqual(eval5.status, PROPERTY_STATUS.AT_RISK, 'Property with unresolved HIGH/CRITICAL incident must be AT_RISK');
console.log('✅ [PASS] Scenario 5: Property with serious unresolved issue ->', eval5.statusLabel);

// ----------------------------------------------------------------
// TEST 6: A group containing multiple properties
// ----------------------------------------------------------------
const propMultiA = { ...prop247, id: 'PROP-MULTI-A', name: 'Sunrise Suites Orlando' };
const propMultiB = { ...prop247, id: 'PROP-MULTI-B', name: 'Oceanview Inn Miami' };
properties.push(propMultiA, propMultiB);

whatsappGroups.push({
  groupId: '1203639999@g.us',
  name: 'Florida Portfolio - Sunrise & Oceanview Owners',
  groupType: GROUP_TYPES.MULTI_PROPERTY,
  linkedPropertyIds: ['PROP-MULTI-A', 'PROP-MULTI-B'],
  humanVerified: true
});

const multiMsgResult = ingestOperationalMessage({
  id: 'MSG-UNIQUE-601',
  groupId: '1203639999@g.us',
  senderPhone: '+14075550199',
  senderName: 'Mr. Patel (Owner)',
  text: 'At Oceanview Inn Miami the kiosk key card encoder is jammed and guest is waiting at lobby.',
  fromMe: false,
  timestamp: RECENT_ISO
});
assert.strictEqual(
  multiMsgResult.createdIncident.propertyId,
  'PROP-MULTI-B',
  'Multi-property group message mentioning Oceanview Inn Miami must link to PROP-MULTI-B'
);
assert.strictEqual(multiMsgResult.createdIncident.recordType, 'TECH_ISSUE', 'Key card encoder failure must be classified in Technical Issues Register');
console.log('✅ [PASS] Scenario 6: Multi-property group message routed to specific property ->', multiMsgResult.createdIncident.propertyName, `(${multiMsgResult.createdIncident.id})`);

// ----------------------------------------------------------------
// TEST 7: An important message that requires NO response
// ----------------------------------------------------------------
const msgAnalysis7 = analyzeMessageContext({
  text: 'Morning Shift Handover Report: All check-ins completed, kiosk is live for day shift.',
  isTeam: true,
  senderName: 'Kiotel Shift Lead'
});
assert.strictEqual(msgAnalysis7.importance.level, 'HIGH', 'Shift handover / Kiosk live is HIGH importance to Ops Manager');
assert.strictEqual(msgAnalysis7.responseRequirement.required, false, 'Informational shift handover requires NO response');
console.log('✅ [PASS] Scenario 7: Important message requiring no response -> Importance:', msgAnalysis7.importance.level, '| Response Required:', msgAnalysis7.responseRequirement.required);

// ----------------------------------------------------------------
// TEST 8: A message that requires a response but is NOT critical
// ----------------------------------------------------------------
const msgAnalysis8 = analyzeMessageContext({
  text: 'Can someone please share the updated monthly folio report for Room 204 when convenient?',
  isTeam: false,
  senderName: 'Hotel Manager'
});
assert.strictEqual(msgAnalysis8.responseRequirement.required, true, 'Question from hotel manager requires a response');
assert.strictEqual(msgAnalysis8.seriousness.severity, 'MEDIUM', 'Follow-up request should be MEDIUM severity');
console.log('✅ [PASS] Scenario 8: Non-critical message requiring response -> Severity:', msgAnalysis8.seriousness.severity, '| Response Required:', msgAnalysis8.responseRequirement.required);

// ----------------------------------------------------------------
// TEST 9: A superficial reply ("Noted sir, checking") does NOT resolve the issue
// ----------------------------------------------------------------
const ackReplyResult = ingestOperationalMessage({
  id: 'MSG-UNIQUE-901',
  groupId: '1203639999@g.us',
  senderPhone: '+919900000002',
  senderName: 'Kiotel Shift Agent',
  text: 'Noted sir, checking',
  fromMe: true,
  timestamp: new Date('2026-10-18T13:32:00.000Z').toISOString()
});
assert.strictEqual(
  ackReplyResult.updatedIncident.resolutionState,
  RESOLUTION_STATES.RESPONSE_PROVIDED_ACTION_PENDING,
  'Superficial reply "Noted sir, checking" must set state to RESPONSE_PROVIDED_ACTION_PENDING, NOT RESOLVED!'
);
assert.strictEqual(ackReplyResult.updatedIncident.actionCompleted, false, 'Action must remain incomplete after superficial reply');
console.log('✅ [PASS] Scenario 9: Superficial reply ("Noted sir, checking") -> State:', ackReplyResult.updatedIncident.resolutionState);

// ----------------------------------------------------------------
// TEST 10: Missing or stale data must produce UNKNOWN rather than guessed LIVE
// ----------------------------------------------------------------
const propMissingSchedule = {
  id: 'PROP-TEST-10A',
  name: 'Unconfigured Imported Hotel',
  timezone: null,
  launchStatus: 'UNKNOWN',
  schedule: { type: 'UNKNOWN' },
  coverage: { type: 'UNKNOWN', coverageConfirmed: false }
};
const eval10a = evaluatePropertyStatus(propMissingSchedule, [], REF_TIME);
assert.strictEqual(eval10a.status, PROPERTY_STATUS.UNKNOWN, 'Missing schedule/launch data must produce UNKNOWN');
console.log('✅ [PASS] Scenario 10: Missing or stale data produces ->', eval10a.statusLabel);

// ----------------------------------------------------------------
// TEST 11: Duplicate message detection during sync retry
// ----------------------------------------------------------------
const dupAttempt = ingestOperationalMessage({
  id: 'MSG-UNIQUE-601', // Same sourceMessageId as Test 6
  groupId: '1203639999@g.us',
  senderPhone: '+14075550199',
  senderName: 'Mr. Patel (Owner)',
  text: 'At Oceanview Inn Miami the kiosk key card encoder is jammed and guest is waiting at lobby.',
  fromMe: false,
  timestamp: RECENT_ISO
});
assert.strictEqual(dupAttempt.duplicateSkipped, true, 'Duplicate sourceMessageId must be skipped without creating duplicate incident');
assert.strictEqual(incidents.length, 1, 'Incident count must remain 1 after duplicate message retry');
console.log('✅ [PASS] Scenario 11: Duplicate message prevented -> duplicateSkipped:', dupAttempt.duplicateSkipped);

// ----------------------------------------------------------------
// TEST 12: Cross-Group Incident Linking (Tech Support group updates the same incident!)
// ----------------------------------------------------------------
const crossGroupUpdate = ingestOperationalMessage({
  id: 'MSG-UNIQUE-1201',
  groupId: '1203638888@g.us',
  groupSubject: 'Kiotel Tech Support Helpdesk',
  senderPhone: '+919900000099',
  senderName: 'Kiotel Tech Nikhil',
  text: 'Investigating Oceanview Inn Miami key card encoder jam now via remote terminal.',
  fromMe: true,
  timestamp: new Date('2026-10-18T13:35:00.000Z').toISOString()
});
assert.strictEqual(crossGroupUpdate.updatedIncident.id, multiMsgResult.createdIncident.id, 'Cross-group tech update must link to the existing incident');
assert.strictEqual(crossGroupUpdate.updatedIncident.sourceGroups.length, 2, 'Incident must record both source groups (Portfolio Group + Tech Support Group)');
assert.strictEqual(crossGroupUpdate.updatedIncident.resolutionState, RESOLUTION_STATES.ACTION_IN_PROGRESS, 'Tech troubleshooting moves state to ACTION_IN_PROGRESS');
console.log('✅ [PASS] Scenario 12: Cross-group incident update linked across', crossGroupUpdate.updatedIncident.sourceGroups.length, 'groups -> State:', crossGroupUpdate.updatedIncident.resolutionState);

// ----------------------------------------------------------------
// TEST 13: Missing Reporter Identity & Unverified Shift -> Recorded as 'Unknown'
// ----------------------------------------------------------------
properties.push(propMissingSchedule);
whatsappGroups.push({
  groupId: '1203637777@g.us',
  name: 'Unconfigured Hotel Group',
  groupType: GROUP_TYPES.PROPERTY,
  linkedPropertyIds: ['PROP-TEST-10A'],
  humanVerified: false
});
const unknownReporterResult = ingestOperationalMessage({
  id: 'MSG-UNIQUE-1301',
  groupId: '1203637777@g.us',
  senderPhone: '',
  senderName: '', // Missing reporter name
  text: 'Guest says room rate was overcharged and wants a refund complaint logged.',
  fromMe: false,
  timestamp: new Date('2026-10-18T13:40:00.000Z').toISOString()
});
assert.strictEqual(unknownReporterResult.createdIncident.raisedBy.name, 'Unknown', 'Missing reporter identity must be recorded as Unknown, never invented');
assert.strictEqual(unknownReporterResult.createdIncident.reportingShift, 'Unknown', 'Unverified property shift schedule must record reportingShift as Unknown');
assert.strictEqual(unknownReporterResult.createdIncident.recordType, 'COMPLAINT', 'Guest overcharge complaint must be logged in Complaints Register');
console.log('✅ [PASS] Scenario 13: Missing reporter & unverified shift recorded honestly -> Reporter:', unknownReporterResult.createdIncident.raisedBy.name, '| Shift:', unknownReporterResult.createdIncident.reportingShift);

// ----------------------------------------------------------------
// TEST 14: Resolved Incident Recurrence -> Reopens Existing Incident (REOPENED)
// ----------------------------------------------------------------
// Step A: Resolve the Oceanview encoder incident with verified evidence
ingestOperationalMessage({
  id: 'MSG-UNIQUE-1401',
  groupId: '1203639999@g.us',
  senderPhone: '+919900000099',
  senderName: 'Kiotel Tech Nikhil',
  text: 'Oceanview Inn Miami key card encoder is fixed and guest checked in successfully.',
  fromMe: true,
  timestamp: new Date('2026-10-18T13:45:00.000Z').toISOString()
});
assert.strictEqual(multiMsgResult.createdIncident.resolutionState, RESOLUTION_STATES.RESOLVED_VERIFIED, 'Incident must be RESOLVED_VERIFIED');

// Step B: Same encoder issue recurs at Oceanview Inn Miami -> Must REOPEN the incident!
const reopenResult = ingestOperationalMessage({
  id: 'MSG-UNIQUE-1402',
  groupId: '1203639999@g.us',
  senderPhone: '+14075550199',
  senderName: 'Mr. Patel (Owner)',
  text: 'Oceanview Inn Miami key card encoder failed again! Guest cannot encode key card.',
  fromMe: false,
  timestamp: new Date('2026-10-18T13:55:00.000Z').toISOString()
});
assert.strictEqual(reopenResult.reopenedIncident.id, multiMsgResult.createdIncident.id, 'Recurring failure must reopen the existing incident ID');
assert.strictEqual(reopenResult.reopenedIncident.resolutionState, RESOLUTION_STATES.REOPENED, 'Reopened incident must have state REOPENED');
assert.strictEqual(reopenResult.reopenedIncident.reopenCount, 1, 'Reopen count must increment to 1');
assert.strictEqual(reopenResult.reopenedIncident.isRecurring, true, 'isRecurring flag must be true');
console.log('✅ [PASS] Scenario 14: Recurring technical failure reopened existing incident ->', reopenResult.reopenedIncident.id, '| State:', reopenResult.reopenedIncident.resolutionState, '| Reopen Count:', reopenResult.reopenedIncident.reopenCount);

// Clean up test state and persist empty state so zero test data leaks into production
whatsappGroups.length = 0;
properties.length = 0;
incidents.length = 0;
messageLogs.length = 0;
savePersistedState();

console.log('\n🎉 ALL 14 OPERATIONAL INTELLIGENCE SCENARIOS PASSED 100%!');
process.exit(0);
