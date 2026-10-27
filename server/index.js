// ================================================================
// 🏨 KIOTEL OPERATIONS INTELLIGENCE — MASTER BACKEND SERVER
// ================================================================

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';

import {
  whatsappGroups,
  properties,
  incidents,
  messageLogs,
  shiftHandovers,
  teamRoster,
  auditLogs,
  systemMeta,
  savePersistedState,
  logHumanAction
} from './dataStore.js';
import { evaluatePropertyStatus, PROPERTY_STATUS } from './statusEngine.js';
import { RESOLUTION_STATES } from './incidentEngine.js';
import { discoverAndSyncPropertiesFromGroups } from './propertyDiscovery.js';
import { run24hAiAnalysis, enrichIncidentDynamicFields } from './geminiAnalyzer.js';
import { startSlaWatchdog, processIncomingMessage } from './slaEngine.js';
import { getCurrentShift, generateShiftHandover, initShiftCron } from './shiftManager.js';
import {
  connectToWhatsApp,
  getPairingQR,
  requestPhoneNumberPairing,
  resetWhatsAppSession,
  logoutWhatsAppSession,
  syncAllWhatsAppGroups,
  sendWhatsAppMessage,
  getWhatsAppStatus,
  injectMessage
} from './whatsapp.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

export const broadcast = (type, data) => {
  const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'INITIAL_STATE',
    data: {
      currentShift: getCurrentShift(),
      whatsappStatus: getWhatsAppStatus()
    }
  }));
});

/**
 * Helper to normalize schedule & coverage fields whether submitted by UI or API
 */
const normalizeScheduleInput = (body = {}, existingSchedule = null) => {
  const opSched = body.operatingSchedule || body.schedule;
  if (opSched) {
    const is24 = opSched.is24Hours === true || opSched.type === '24_7';
    const type = is24 ? '24_7' : (opSched.type || (opSched.verified ? 'SCHEDULED' : 'UNKNOWN'));
    return {
      type,
      is24Hours: is24,
      startTime: is24 ? '00:00' : (opSched.startTime || existingSchedule?.startTime || '07:00'),
      endTime: is24 ? '23:59' : (opSched.endTime || existingSchedule?.endTime || '23:00'),
      verified: opSched.verified !== undefined ? !!opSched.verified : type !== 'UNKNOWN'
    };
  }
  if (body.scheduleType) {
    const is24 = body.scheduleType === '24_7';
    return {
      type: body.scheduleType,
      is24Hours: is24,
      startTime: is24 ? '00:00' : (body.startTime || '07:00'),
      endTime: is24 ? '23:59' : (body.endTime || '23:00'),
      verified: body.scheduleType !== 'UNKNOWN'
    };
  }
  return existingSchedule || { type: 'UNKNOWN', is24Hours: false, startTime: null, endTime: null, verified: false };
};

const normalizeCoverageInput = (body = {}, existingCoverage = null, nowIso = new Date().toISOString()) => {
  const cov = body.coverage;
  if (cov) {
    const confirmed = cov.confirmed !== undefined ? !!cov.confirmed : !!cov.coverageConfirmed;
    const agentsList = Array.isArray(cov.assignedAgents)
      ? cov.assignedAgents
      : cov.assignedTeamOrAgent
      ? [cov.assignedTeamOrAgent]
      : existingCoverage?.assignedAgents || [];
    const teamStr = cov.assignedTeamOrAgent || agentsList.join(', ') || (cov.type === 'SHARED' ? 'Shared Shift Pod' : 'Dedicated Agent');
    return {
      type: cov.type || existingCoverage?.type || 'SHARED',
      assignedTeamOrAgent: teamStr,
      assignedAgents: agentsList,
      assignedManager: cov.assignedManager || existingCoverage?.assignedManager || 'Sarthak',
      coverageConfirmed: confirmed,
      confirmed,
      lastCoverageVerifiedAt: confirmed ? (cov.lastConfirmedAt || nowIso) : existingCoverage?.lastCoverageVerifiedAt || null
    };
  }
  if (body.coverageType) {
    const confirmed = body.coverageConfirmed !== undefined ? !!body.coverageConfirmed : true;
    const teamStr = body.assignedTeamOrAgent || (body.coverageType === 'SHARED' ? 'Shared Shift Pod' : 'Dedicated Agent');
    return {
      type: body.coverageType,
      assignedTeamOrAgent: teamStr,
      assignedAgents: [teamStr],
      assignedManager: body.assignedManager || 'Sarthak',
      coverageConfirmed: confirmed,
      confirmed,
      lastCoverageVerifiedAt: confirmed ? nowIso : null
    };
  }
  return existingCoverage || {
    type: 'UNKNOWN',
    assignedTeamOrAgent: null,
    assignedAgents: [],
    assignedManager: null,
    coverageConfirmed: false,
    confirmed: false,
    lastCoverageVerifiedAt: null
  };
};

// ================================================================
// 🌐 REST API ENDPOINTS
// ================================================================

// 1. Health & Complete Operational Overview
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    version: '3.2.0',
    currentShift: getCurrentShift(),
    whatsappStatus: getWhatsAppStatus(),
    totalGroups: whatsappGroups.length,
    totalProperties: properties.length,
    totalIncidents: incidents.length,
    uptimeSeconds: process.uptime()
  });
});

// 2. Evaluated Properties with 6-Status Evidence Breakdown & Status Counts
app.get('/api/properties', (req, res) => {
  const now = new Date();
  const statusCounts = {
    LIVE: 0,
    AT_RISK: 0,
    OUTSIDE_HOURS: 0,
    NOT_YET_LIVE: 0,
    SUSPENDED: 0,
    UNKNOWN: 0
  };

  const evaluated = properties.map(p => {
    const evaluation = evaluatePropertyStatus(p, incidents, now);
    if (statusCounts[evaluation.status] !== undefined) {
      statusCounts[evaluation.status] += 1;
    } else {
      statusCounts.UNKNOWN += 1;
    }
    return {
      ...p,
      operatingSchedule: p.schedule || p.operatingSchedule,
      latestEvidence: evaluation.latestEvidence || p.lastEvidence,
      operationalStatus: evaluation.status,
      evaluation
    };
  });

  res.json({
    total: evaluated.length,
    statusCounts,
    properties: evaluated
  });
});

// Create or Register a Verified Property
app.post('/api/properties', (req, res) => {
  const body = req.body || {};
  const {
    name,
    timezone = 'America/New_York',
    launchStatus = 'LAUNCHED',
    launchDate = null,
    linkedGroupIds = [],
    kioskCount = 1,
    cluster = 'Default',
    actor,
    updatedBy
  } = body;

  const effectiveActor = updatedBy || actor || 'Operations Manager';

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Property name is required.' });
  }

  const nowIso = new Date().toISOString();
  const schedule = normalizeScheduleInput(body, null);
  const coverage = normalizeCoverageInput(body, null, nowIso);

  const newProp = {
    id: `PROP-${String(properties.length + 1).padStart(3, '0')}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
    name: name.trim(),
    timezone,
    launchStatus,
    launchDate,
    schedule,
    operatingSchedule: schedule,
    coverage,
    kioskCount: Number(kioskCount) || 1,
    cluster,
    linkedGroupIds: Array.isArray(linkedGroupIds) ? linkedGroupIds : [],
    humanVerified: true,
    lastEvidence: coverage.coverageConfirmed
      ? {
          source: `Verified by ${effectiveActor}`,
          messageId: null,
          summary: body.evidenceNote || `Property configured & coverage confirmed by ${effectiveActor}`,
          timestamp: nowIso
        }
      : null,
    manualStatusOverride: null
  };

  properties.push(newProp);

  newProp.linkedGroupIds.forEach(gid => {
    const grp = whatsappGroups.find(g => g.groupId === gid);
    if (grp) {
      if (!grp.linkedPropertyIds.includes(newProp.id)) {
        grp.linkedPropertyIds.push(newProp.id);
      }
      grp.humanVerified = true;
      grp.classificationSource = 'HUMAN_VERIFIED';
    }
  });

  logHumanAction('PROPERTY_CREATED', effectiveActor, { propertyId: newProp.id, name: newProp.name });
  broadcast('PROPERTY_UPDATED', newProp);

  const evaluation = evaluatePropertyStatus(newProp, incidents, new Date());
  res.json({
    success: true,
    property: {
      ...newProp,
      operationalStatus: evaluation.status,
      evaluation
    }
  });
});

// Update / Verify a Property Schedule, Coverage, Launch Status, or Override
app.put('/api/properties/:id', (req, res) => {
  const prop = properties.find(p => p.id === req.params.id);
  if (!prop) return res.status(404).json({ success: false, error: 'Property not found.' });

  const body = req.body || {};
  const {
    name,
    timezone,
    launchStatus,
    launchDate,
    linkedGroupIds,
    manualStatusOverride,
    manualOverride,
    confirmEvidenceNow,
    kioskCount,
    cluster,
    actor,
    updatedBy
  } = body;

  const effectiveActor = updatedBy || actor || 'Operations Manager';
  const nowIso = new Date().toISOString();

  if (name !== undefined) prop.name = name;
  if (timezone !== undefined) prop.timezone = timezone;
  if (launchStatus !== undefined) prop.launchStatus = launchStatus;
  if (launchDate !== undefined) prop.launchDate = launchDate;
  if (kioskCount !== undefined) prop.kioskCount = Number(kioskCount) || 1;
  if (cluster !== undefined) prop.cluster = cluster;

  if (body.schedule || body.operatingSchedule || body.scheduleType) {
    const updatedSched = normalizeScheduleInput(body, prop.schedule);
    prop.schedule = updatedSched;
    prop.operatingSchedule = updatedSched;
  }

  if (body.coverage || body.coverageType) {
    const updatedCov = normalizeCoverageInput(body, prop.coverage, nowIso);
    prop.coverage = updatedCov;
    if (updatedCov.coverageConfirmed) {
      prop.lastEvidence = {
        source: `Verified by ${effectiveActor}`,
        messageId: null,
        summary: body.evidenceNote || `Schedule & ${updatedCov.type} coverage verified by ${effectiveActor}`,
        timestamp: nowIso
      };
    }
  }

  if (Array.isArray(linkedGroupIds)) {
    prop.linkedGroupIds = linkedGroupIds;
    whatsappGroups.forEach(g => {
      if (linkedGroupIds.includes(g.groupId)) {
        if (!g.linkedPropertyIds.includes(prop.id)) g.linkedPropertyIds.push(prop.id);
      } else {
        g.linkedPropertyIds = (g.linkedPropertyIds || []).filter(id => id !== prop.id);
      }
    });
  }

  const overrideInput = manualStatusOverride !== undefined ? manualStatusOverride : manualOverride;
  if (overrideInput !== undefined) {
    if (overrideInput && overrideInput.active !== false && overrideInput.status) {
      prop.manualStatusOverride = {
        status: overrideInput.status,
        reason: overrideInput.reason || `Manual status set by ${effectiveActor}`,
        updatedBy: effectiveActor,
        timestamp: nowIso
      };
    } else {
      prop.manualStatusOverride = null;
    }
  }

  if (confirmEvidenceNow) {
    prop.lastEvidence = {
      source: `Human Verification (${effectiveActor})`,
      messageId: null,
      summary: `Operational status & coverage verified by ${effectiveActor}`,
      timestamp: nowIso
    };
    if (prop.coverage) {
      prop.coverage.coverageConfirmed = true;
      prop.coverage.confirmed = true;
      prop.coverage.lastCoverageVerifiedAt = nowIso;
    }
  }

  prop.humanVerified = true;
  prop.customConfiguredByUser = true;
  logHumanAction('PROPERTY_VERIFIED_OR_UPDATED', effectiveActor, { propertyId: prop.id, updates: body });
  broadcast('PROPERTY_UPDATED', prop);

  const evaluation = evaluatePropertyStatus(prop, incidents, new Date());
  res.json({
    success: true,
    property: {
      ...prop,
      operationalStatus: evaluation.status,
      evaluation
    }
  });
});

// 3. WhatsApp Groups Inventory & Verification API
app.get('/api/groups', (req, res) => {
  const normalizedGroups = whatsappGroups.map(g => ({
    ...g,
    groupName: g.groupName || g.name
  }));
  res.json({
    total: normalizedGroups.length,
    groups: normalizedGroups
  });
});

// Verify / Classify a WhatsApp Group & Map to Property(ies)
app.put('/api/groups/:groupId', (req, res) => {
  const decodedId = decodeURIComponent(req.params.groupId);
  const group = whatsappGroups.find(g => g.groupId === decodedId);
  if (!group) return res.status(404).json({ success: false, error: 'WhatsApp group not found.' });

  const {
    groupType,
    linkedPropertyIds,
    relevanceReason,
    contacts,
    createPropertyFromGroup,
    newPropertyConfig,
    actor,
    updatedBy
  } = req.body || {};

  const effectiveActor = updatedBy || actor || 'Operations Manager';

  if (groupType) group.groupType = groupType;
  if (relevanceReason !== undefined) group.relevanceReason = relevanceReason;
  if (contacts !== undefined) group.contacts = { ...group.contacts, ...contacts };

  if (createPropertyFromGroup) {
    const cfg = newPropertyConfig || {};
    const nowIso = new Date().toISOString();
    const createdProp = {
      id: `PROP-${String(properties.length + 1).padStart(3, '0')}`,
      name: cfg.name || group.groupName || group.name,
      timezone: cfg.timezone || null,
      launchStatus: cfg.launchStatus || 'UNKNOWN',
      launchDate: cfg.launchDate || null,
      schedule: cfg.schedule || { type: 'UNKNOWN', startTime: null, endTime: null, verified: false },
      operatingSchedule: cfg.schedule || { type: 'UNKNOWN', startTime: null, endTime: null, verified: false },
      coverage: cfg.coverage || {
        type: 'UNKNOWN',
        assignedTeamOrAgent: null,
        assignedAgents: [],
        assignedManager: null,
        coverageConfirmed: false,
        confirmed: false,
        lastCoverageVerifiedAt: null
      },
      linkedGroupIds: [group.groupId],
      humanVerified: false,
      lastEvidence: cfg.coverage?.coverageConfirmed
        ? { source: `Verified by ${effectiveActor}`, messageId: null, summary: 'Verified during group mapping', timestamp: nowIso }
        : null,
      manualStatusOverride: null
    };
    properties.push(createdProp);
    group.linkedPropertyIds = [createdProp.id];
    group.groupType = 'PROPERTY';
  } else if (Array.isArray(linkedPropertyIds)) {
    group.linkedPropertyIds = linkedPropertyIds;
    properties.forEach(p => {
      if (linkedPropertyIds.includes(p.id)) {
        if (!p.linkedGroupIds.includes(group.groupId)) p.linkedGroupIds.push(group.groupId);
      } else {
        p.linkedGroupIds = (p.linkedGroupIds || []).filter(gid => gid !== group.groupId);
      }
    });
  }

  group.humanVerified = true;
  group.classificationSource = 'HUMAN_VERIFIED';
  group.classificationConfidence = 'HIGH';
  group.groupName = group.groupName || group.name;

  logHumanAction('GROUP_VERIFIED_OR_MAPPED', effectiveActor, {
    groupId: group.groupId,
    groupName: group.name,
    groupType: group.groupType,
    linkedPropertyIds: group.linkedPropertyIds
  });

  broadcast('GROUP_UPDATED', group);
  res.json({ success: true, group, propertiesCount: properties.length });
});

// 4. Actionable Incidents, Complaints Register & Technical Issues Register APIs
app.get('/api/incidents', (req, res) => {
  const nowMs = Date.now();
  const enriched = incidents.map(i => enrichIncidentDynamicFields(i, nowMs));
  res.json({
    total: enriched.length,
    unresolvedCount: enriched.filter(i => i.resolutionState !== RESOLUTION_STATES.RESOLVED_VERIFIED).length,
    incidents: enriched
  });
});

// Section 4: Property Complaints & Service Issues Register
app.get('/api/complaints', (req, res) => {
  const nowMs = Date.now();
  const enriched = incidents
    .map(i => enrichIncidentDynamicFields(i, nowMs))
    .filter(i => i.recordType === 'COMPLAINT' || !i.isTechnical);
  res.json({
    total: enriched.length,
    openCount: enriched.filter(i => i.resolutionState !== RESOLUTION_STATES.RESOLVED_VERIFIED).length,
    complaints: enriched
  });
});

// Section 5: Technical Issues Register
app.get('/api/tech-support', (req, res) => {
  const nowMs = Date.now();
  const enriched = incidents
    .map(i => enrichIncidentDynamicFields(i, nowMs))
    .filter(i => i.recordType === 'TECH_ISSUE' || i.isTechnical || i.category === 'KIOSK' || i.category === 'PMS' || i.category === 'NETWORK');
  res.json({
    total: enriched.length,
    openCount: enriched.filter(i => i.resolutionState !== RESOLUTION_STATES.RESOLVED_VERIFIED).length,
    issues: enriched
  });
});

// Legacy `/api/tickets` alias
app.get('/api/tickets', (req, res) => {
  const nowMs = Date.now();
  const enriched = incidents.map(i => enrichIncidentDynamicFields(i, nowMs));
  res.json({
    pending: enriched.filter(i => i.resolutionState === RESOLUTION_STATES.AWAITING_RESPONSE),
    breached: enriched.filter(i => i.isOverdue && i.resolutionState === RESOLUTION_STATES.AWAITING_RESPONSE),
    resolved: enriched.filter(i => i.resolutionState === RESOLUTION_STATES.RESOLVED_VERIFIED),
    all: enriched
  });
});

// Update / Override an Incident, Complaint, or Technical Issue
app.put('/api/incidents/:id', (req, res) => {
  const inc = incidents.find(i => i.id === req.params.id);
  if (!inc) return res.status(404).json({ success: false, error: 'Incident not found.' });

  const body = req.body || {};
  const {
    resolutionState,
    resolutionEvidence,
    resolutionReason,
    severity,
    seriousness,
    importanceLevel,
    actionAssignedTo,
    assignedTechnician,
    workaround,
    troubleshootingNote,
    pendingItems,
    confirmationStatus,
    passedToNextShift,
    propertyId,
    reportingShift,
    actor,
    updatedBy
  } = body;

  const effectiveActor = updatedBy || actor || 'Operations Manager';
  const nowIso = new Date().toISOString();

  if (resolutionState) {
    inc.resolutionState = resolutionState;
    inc.lifecycleStatus = resolutionState;
    if (resolutionState === RESOLUTION_STATES.RESOLVED_VERIFIED) {
      inc.actionCompleted = true;
      inc.actionPending = false;
      inc.resolvedAt = nowIso;
      inc.confirmationStatus = 'VERIFIED';
      inc.pendingItems = 'None — Verified Resolved';
    } else if (resolutionState === RESOLUTION_STATES.REOPENED) {
      inc.actionCompleted = false;
      inc.actionPending = true;
      inc.resolvedAt = null;
      inc.reopenCount = (inc.reopenCount || 0) + 1;
      inc.isRecurring = true;
    } else {
      inc.actionCompleted = false;
      inc.actionPending = true;
    }
  }

  const evidenceStr = resolutionEvidence !== undefined ? resolutionEvidence : resolutionReason;
  if (evidenceStr !== undefined) {
    inc.resolutionEvidence = evidenceStr;
    inc.resolutionReason = evidenceStr;
  }

  const newSev = severity || (typeof seriousness === 'string' ? seriousness : seriousness?.severity);
  if (newSev) {
    inc.severity = newSev;
    if (inc.seriousness) inc.seriousness.severity = newSev;
  }

  if (importanceLevel && inc.importance) {
    inc.importance.level = importanceLevel;
    inc.importanceLevel = importanceLevel;
  }

  if (actionAssignedTo !== undefined) inc.actionAssignedTo = actionAssignedTo;
  if (assignedTechnician !== undefined) {
    inc.assignedTechnician = assignedTechnician;
    inc.actionAssignedTo = assignedTechnician;
  }
  if (workaround !== undefined) inc.workaround = workaround;
  if (pendingItems !== undefined) inc.pendingItems = pendingItems;
  if (confirmationStatus !== undefined) inc.confirmationStatus = confirmationStatus;
  if (reportingShift !== undefined) inc.reportingShift = reportingShift;
  if (passedToNextShift !== undefined) {
    inc.passedToNextShift = !!passedToNextShift;
    inc.carriedOverShift = !!passedToNextShift;
  }

  if (troubleshootingNote && troubleshootingNote.trim()) {
    inc.troubleshootingLog = [
      ...(inc.troubleshootingLog || []),
      `[${new Date(nowIso).toLocaleTimeString()}] ${effectiveActor}: ${troubleshootingNote.trim()}`
    ];
  }

  if (propertyId !== undefined) {
    inc.propertyId = propertyId;
    const targetProp = properties.find(p => p.id === propertyId);
    if (targetProp) inc.propertyName = targetProp.name;
  }

  inc.humanVerified = true;
  inc.lastUpdatedBy = effectiveActor;
  inc.latestUpdate = `Updated by ${effectiveActor}${resolutionState ? ` -> ${resolutionState}` : ''}${evidenceStr ? `: ${evidenceStr}` : ''}`;
  inc.latestUpdateAt = nowIso;
  inc.updatedAt = nowIso;

  inc.chronologicalHistory = [
    ...(inc.chronologicalHistory || []),
    {
      timestamp: nowIso,
      actor: effectiveActor,
      role: 'OPS_MANAGER',
      groupName: inc.groupName || 'Operations Dashboard',
      action: `Human Update (${inc.resolutionState})`,
      text: evidenceStr || troubleshootingNote || `Updated incident parameters`
    }
  ];

  logHumanAction('INCIDENT_UPDATED', effectiveActor, { incidentId: inc.id, updates: body });
  broadcast('INCIDENT_UPDATED', inc);
  res.json({ success: true, incident: enrichIncidentDynamicFields(inc) });
});

// 5. Mark Operations Manager Review Checkpoint ("What Changed Since Last Review")
app.post('/api/review-checkpoint', (req, res) => {
  const { actor, reviewedBy } = req.body || {};
  const effectiveActor = reviewedBy || actor || 'Operations Manager';
  systemMeta.lastManagerReviewAt = new Date().toISOString();
  systemMeta.lastReviewedBy = effectiveActor;
  logHumanAction('MANAGER_REVIEW_CHECKPOINT', effectiveActor, { timestamp: systemMeta.lastManagerReviewAt });
  broadcast('REVIEW_CHECKPOINT_UPDATED', { lastManagerReviewAt: systemMeta.lastManagerReviewAt });
  res.json({ success: true, lastManagerReviewAt: systemMeta.lastManagerReviewAt });
});

// 6. Team Roster & Roles
app.get('/api/team', (req, res) => {
  res.json({ team: teamRoster });
});

app.post('/api/team', (req, res) => {
  const { name, role, phone, level = 'SHIFT_AGENT', shift = 'ALL', actor, updatedBy } = req.body || {};
  const effectiveActor = updatedBy || actor || 'Operations Manager';
  if (!name) return res.status(400).json({ success: false, error: 'Name is required.' });
  const member = {
    id: `TM-${Date.now().toString().slice(-4)}`,
    name,
    role: role || 'Operations Agent',
    phone: phone || '',
    level,
    shift
  };
  teamRoster.push(member);
  logHumanAction('TEAM_MEMBER_ADDED', effectiveActor, member);
  res.json({ success: true, member, team: teamRoster });
});

// 7. Shift Handovers
app.get('/api/shifts', (req, res) => {
  res.json({
    currentShift: getCurrentShift(),
    handovers: shiftHandovers
  });
});

app.post('/api/shifts/generate', (req, res) => {
  const { shiftLeadName } = req.body || {};
  const handover = generateShiftHandover(shiftLeadName);
  savePersistedState();
  res.json({ success: true, handover });
});

// 8. WhatsApp Status, Pairing & Group Sync
app.get('/api/whatsapp/status', (req, res) => {
  res.json(getWhatsAppStatus());
});

app.post('/api/whatsapp/pair', async (req, res) => {
  const qrData = getPairingQR();
  if (qrData.state === 'DISCONNECTED' || qrData.state === 'CONNECTION_FAILED') {
    connectToWhatsApp(false);
  }
  res.json({ success: true, ...qrData });
});

app.post('/api/whatsapp/pairing-code', async (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ success: false, error: 'Phone number is required.' });
  const result = await requestPhoneNumberPairing(phone);
  res.json(result);
});

app.post('/api/whatsapp/sync-groups', async (req, res) => {
  const beforeCount = whatsappGroups.length;
  await syncAllWhatsAppGroups();
  res.json({
    success: true,
    syncedCount: Math.max(0, whatsappGroups.length - beforeCount),
    totalGroups: whatsappGroups.length
  });
});

app.post('/api/whatsapp/reset-session', async (req, res) => {
  const newStatus = await resetWhatsAppSession();
  res.json({ success: true, status: newStatus });
});

app.post('/api/whatsapp/logout', async (req, res) => {
  const newStatus = await logoutWhatsAppSession();
  res.json({ success: true, status: newStatus });
});

// 9. 🛡️ Safety-Gated WhatsApp Message Dispatch Gateway
app.post('/api/whatsapp/send-message', async (req, res) => {
  const { recipientJid, text, approvedBy, propertyId, explicitHumanConfirmation } = req.body || {};
  const result = await sendWhatsAppMessage({
    recipientJid,
    text,
    approvedBy,
    propertyId,
    explicitHumanConfirmation: !!explicitHumanConfirmation,
    isSimulation: false
  });
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// 10. 🧪 Dry-Run Simulation Endpoint (Never sends real WhatsApp messages)
app.post('/api/simulate-message', (req, res) => {
  const { groupId, groupSubject, groupName, senderPhone, senderName, senderRole, text } = req.body || {};
  if (!groupId || !text) {
    return res.status(400).json({ success: false, error: 'Missing required fields: groupId, text' });
  }
  const result = injectMessage({
    groupId,
    groupSubject: groupSubject || groupName,
    senderPhone: senderPhone || '',
    senderName: senderName || 'Unknown',
    senderRole,
    text
  });
  res.json({ success: true, mode: 'SIMULATION', result });
});

// 11. Raw Message Logs & Audit Trail
app.get('/api/messages', (req, res) => {
  const { groupId, propertyId } = req.query;
  let logs = messageLogs;
  if (groupId) logs = logs.filter(m => m.groupId === groupId);
  if (propertyId) logs = logs.filter(m => m.propertyId === propertyId || (m.propertyIds && m.propertyIds.includes(propertyId)));
  res.json({ messages: logs.slice(0, 300) });
});

app.get('/api/audit-logs', (req, res) => {
  res.json({ logs: auditLogs.slice(0, 200) });
});

// 12. Traceable Operations Intelligence Summary
app.get('/api/ai-analyze-24h', (req, res) => {
  const analysis = run24hAiAnalysis(new Date());
  res.json(analysis);
});

app.get('/api/onboarding', (req, res) => {
  const now = new Date();
  const pipeline = properties
    .filter(p => p.launchStatus === 'NOT_YET_LIVE' || p.manualStatusOverride === 'NOT_YET_LIVE')
    .map(p => {
      const evaluation = evaluatePropertyStatus(p, incidents, now);
      const linkedGroups = whatsappGroups.filter(
        g => (p.linkedGroupIds || []).includes(g.groupId) || (g.linkedPropertyIds || []).includes(p.id)
      );
      return {
        ...p,
        operatingSchedule: p.schedule || p.operatingSchedule,
        latestEvidence: evaluation.latestEvidence || p.lastEvidence,
        operationalStatus: evaluation.status,
        evaluation,
        linkedGroupsSummary: linkedGroups.map(g => ({
          groupId: g.groupId,
          name: g.name,
          groupType: g.groupType,
          messageCount: g.messageCount || 0,
          lastSyncedAt: g.lastSyncedAt
        }))
      };
    });
  res.json({ total: pipeline.length, pipeline });
});

app.post('/api/properties/discover', (req, res) => {
  const summary = discoverAndSyncPropertiesFromGroups();
  broadcast('GROUPS_SYNCED', {
    totalGroups: whatsappGroups.length,
    totalProperties: properties.length,
    discoverySummary: summary
  });
  res.json({ success: true, ...summary });
});

// Serve built production frontend (client/dist) so a single live web URL / LAN IP works on laptops & mobile phones
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// ================================================================
// 🚀 LAUNCH SERVER
// ================================================================
const initialDiscovery = discoverAndSyncPropertiesFromGroups();
console.log(
  `🔍 [AUTO-DISCOVERY] Properties: ${initialDiscovery.totalProperties} (${initialDiscovery.createdProperties} new, ${initialDiscovery.updatedProperties} updated)`
);

function startServer(retryAfterCleanup = true) {
  wss.on('error', () => {
    // Handled by server.on('error')
  });

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && retryAfterCleanup) {
      console.warn(`⚠️ [PORT ${PORT}] Port already in use by a previous process — freeing port ${PORT} automatically...`);
      try {
        const netstatOut = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' });
        const pids = new Set();
        for (const line of netstatOut.split(/\r?\n/)) {
          if (line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/);
            const pid = parseInt(parts[parts.length - 1], 10);
            if (pid && pid !== process.pid) pids.add(pid);
          }
        }
        for (const pid of pids) {
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          } catch (_) {}
        }
      } catch (_) {}
      setTimeout(() => startServer(false), 800);
      return;
    }
    console.error(`❌ Server error on port ${PORT}:`, err.message);
  });

  server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🏨 KIOTEL OPERATIONS INTELLIGENCE ONLINE (v3.2)`);
    console.log(`📡 HTTP Server:     http://localhost:${PORT}`);
    console.log(`⚡ WebSocket Stream: ws://localhost:${PORT}`);
    console.log(`💬 Synced Groups:   ${whatsappGroups.length}`);
    console.log(`🏢 Properties:      ${properties.length}`);
    console.log(`===============================================`);

    startSlaWatchdog();
    initShiftCron();
    connectToWhatsApp(false);
  });
}

startServer(true);