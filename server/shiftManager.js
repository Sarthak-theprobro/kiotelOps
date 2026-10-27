// ================================================================
// 📋 KIOTEL OPERATIONS INTELLIGENCE — SHIFT SCHEDULER & HANDOVER
// ================================================================

import cron from 'node-cron';
import { shiftHandovers, incidents, messageLogs, properties } from './dataStore.js';
import { evaluatePropertyStatus, PROPERTY_STATUS } from './statusEngine.js';
import { RESOLUTION_STATES } from './incidentEngine.js';
import { broadcast } from './index.js';

export const getCurrentShift = () => {
  const currentHour = new Date().getHours();

  if (currentHour >= 7 && currentHour < 15) {
    return { name: 'Morning Shift', timing: '07:00 - 15:00', code: 'MORNING', lead: 'Morning Shift Lead' };
  } else if (currentHour >= 15 && currentHour < 23) {
    return { name: 'Evening Shift', timing: '15:00 - 23:00', code: 'EVENING', lead: 'Evening Shift Lead' };
  } else {
    return { name: 'Night Shift', timing: '23:00 - 07:00', code: 'NIGHT', lead: 'Night Shift Lead' };
  }
};

export const generateShiftHandover = (shiftLeadName = null) => {
  const currentShift = getCurrentShift();
  const lead = shiftLeadName || currentShift.lead;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const evaluatedProps = properties.map(p => ({
    ...p,
    evaluation: evaluatePropertyStatus(p, incidents, now)
  }));

  const liveCount = evaluatedProps.filter(p => p.evaluation.status === PROPERTY_STATUS.LIVE).length;
  const outsideHoursCount = evaluatedProps.filter(p => p.evaluation.status === PROPERTY_STATUS.OUTSIDE_HOURS).length;
  const atRiskCount = evaluatedProps.filter(p => p.evaluation.status === PROPERTY_STATUS.AT_RISK).length;
  const unknownCount = evaluatedProps.filter(p => p.evaluation.status === PROPERTY_STATUS.UNKNOWN).length;

  const unresolvedIncidents = incidents.filter(i => i.resolutionState !== RESOLUTION_STATES.RESOLVED_VERIFIED);
  const awaitingResponse = incidents.filter(i => i.resolutionState === RESOLUTION_STATES.AWAITING_RESPONSE);
  const carryoverItems = unresolvedIncidents.map(
    i => `• [${i.seriousness?.severity || 'MEDIUM'}] ${i.propertyName}: "${i.title}" (State: ${i.resolutionState.replace(/_/g, ' ')})`
  );

  const whatsappFormattedText = `
🏨 *KIOTEL OPERATIONS SHIFT HANDOVER REPORT*
📅 *Date:* ${dateStr} | ⏰ *Shift:* ${currentShift.name} (${currentShift.timing})
👤 *Prepared By:* ${lead}
━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *VERIFIED PROPERTY STATUS BREAKDOWN (${properties.length} Total):*
• 🟢 Verified Live / Operating: ${liveCount}
• 🌙 Outside Operating Hours: ${outsideHoursCount}
• 🚨 At Risk (Active Issue/Gap): ${atRiskCount}
• ❓ Unknown / Needs Verification: ${unknownCount}

⚠️ *UNRESOLVED INCIDENTS PASSED TO NEXT SHIFT (${unresolvedIncidents.length}):*
${carryoverItems.length > 0 ? carryoverItems.join('\n') : '• Zero unresolved incidents carried over.'}

⏳ *AWAITING INITIAL RESPONSE:* ${awaitingResponse.length}
📨 *Messages Analyzed:* ${messageLogs.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━
_Generated from verified operational records_
`.trim();

  const newHandover = {
    id: `HANDOVER-${dateStr}-${currentShift.code}-${Date.now().toString().slice(-4)}`,
    shift: `${currentShift.name} (${currentShift.timing})`,
    date: dateStr,
    shiftLead: lead,
    totalMessages: messageLogs.length,
    unresolvedCount: unresolvedIncidents.length,
    awaitingResponseCount: awaitingResponse.length,
    atRiskPropertiesCount: atRiskCount,
    status: 'COMPLETED',
    whatsappText: whatsappFormattedText,
    createdAt: now.toISOString()
  };

  shiftHandovers.unshift(newHandover);
  broadcast('SHIFT_HANDOVER_GENERATED', newHandover);
  return newHandover;
};

export const initShiftCron = () => {
  cron.schedule('0 15 * * *', () => generateShiftHandover('Morning Shift Handover'));
  cron.schedule('0 23 * * *', () => generateShiftHandover('Evening Shift Handover'));
  cron.schedule('0 7 * * *', () => generateShiftHandover('Night Shift Handover'));
  console.log('⏰ Shift Handover Cron Scheduler Initialized (07:00, 15:00, 23:00)');
};