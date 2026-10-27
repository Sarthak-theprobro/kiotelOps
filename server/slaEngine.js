// ================================================================
// ⏱️ KIOTEL OPERATIONS INTELLIGENCE — SLA & ESCALATION BRIDGE
// ================================================================

import { incidents } from './dataStore.js';
import { ingestOperationalMessage, RESOLUTION_STATES } from './incidentEngine.js';
import { broadcast } from './index.js';

const SLA_LIMIT_MS = 5 * 60 * 1000; // 5 minutes for initial response

export const processIncomingMessage = (messageData) => {
  const result = ingestOperationalMessage(messageData);
  if (!result) return null;

  if (result.logEntry) {
    broadcast('NEW_MESSAGE', result.logEntry);
  }
  if (result.createdIncident) {
    broadcast('INCIDENT_CREATED', result.createdIncident);
  }
  if (result.updatedIncident) {
    broadcast('INCIDENT_UPDATED', result.updatedIncident);
  }
  return result;
};

export const startSlaWatchdog = () => {
  setInterval(() => {
    const now = Date.now();
    incidents.forEach(inc => {
      if (inc.resolutionState === RESOLUTION_STATES.AWAITING_RESPONSE) {
        const elapsedMs = now - new Date(inc.raisedAt).getTime();
        if (elapsedMs > SLA_LIMIT_MS && !inc.isOverdue) {
          inc.isOverdue = true;
          broadcast('INCIDENT_OVERDUE', inc);
        }
      }
    });
  }, 15000);
};