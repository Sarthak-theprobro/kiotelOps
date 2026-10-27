// ================================================================
// 🏨 KIOTEL OPERATIONS INTELLIGENCE — PERSISTENT DATA STORE
// Separates WhatsApp Groups from Properties, Incidents, and Audit Logs
// ================================================================

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'operationalState.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TMP_STATE_FILE = path.join(os.tmpdir(), 'kiotel_operationalState.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (_) {}

// 0. Multi-User Profiles (3 default users + ability to add new users dynamically)
export const DEFAULT_USERS = [
  { id: 'sarthak', name: 'Sarthak', role: 'Ops Manager', label: 'Sarthak (Ops Manager)' },
  { id: 'vikas', name: 'Vikas', role: 'Ops Manager', label: 'Vikas (Ops Manager)' },
  { id: 'dhiren', name: 'Dhiren', role: 'Director', label: 'Dhiren (Director)' }
];

export const usersList = [...DEFAULT_USERS];
export let activeWorkspaceUserId = 'sarthak';

export const normalizeUserId = (input) => {
  if (!input) return 'sarthak';
  const raw = String(input).trim().toLowerCase();
  if (raw.includes('sarthak')) return 'sarthak';
  if (raw.includes('vikas')) return 'vikas';
  if (raw.includes('dhiren') || raw.includes('dhuren')) return 'dhiren';
  const byLabel = usersList.find(
    u => u.id === raw || u.label.toLowerCase() === raw || u.name.toLowerCase() === raw
  );
  if (byLabel) return byLabel.id;
  return raw.replace(/[^a-z0-9_-]/g, '') || 'sarthak';
};

export const getStateFileForUser = (userId = activeWorkspaceUserId) => {
  const uid = normalizeUserId(userId);
  if (process.env.VERCEL) {
    const tmpFile = uid === 'sarthak' ? TMP_STATE_FILE : path.join(os.tmpdir(), `kiotel_operationalState_${uid}.json`);
    if (fs.existsSync(tmpFile)) return tmpFile;
  }
  return uid === 'sarthak' ? STATE_FILE : path.join(DATA_DIR, `operationalState_${uid}.json`);
};

export const loadUsersList = () => {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        usersList.length = 0;
        usersList.push(
          ...parsed.map(u => ({
            ...u,
            id: u.id === 'dhuren' ? 'dhiren' : u.id,
            name: u.name === 'Dhuren' ? 'Dhiren' : u.name,
            label: (u.label || '').replace(/Dhuren/gi, 'Dhiren')
          }))
        );
      }
    }
  } catch (_) {}
};

export const saveUsersList = () => {
  try {
    const target = process.env.VERCEL ? path.join(os.tmpdir(), 'kiotel_users.json') : USERS_FILE;
    fs.writeFileSync(target, JSON.stringify(usersList, null, 2), 'utf-8');
  } catch (_) {}
};

export const addUserProfile = ({ name, role = 'Operations Manager' }) => {
  const cleanName = String(name || '').trim();
  const cleanRole = String(role || 'Operations Manager').trim();
  if (!cleanName) return null;
  const id = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || `user_${Date.now()}`;
  const label = `${cleanName} (${cleanRole})`;
  let existing = usersList.find(u => u.id === id || u.label.toLowerCase() === label.toLowerCase());
  if (!existing) {
    existing = { id, name: cleanName, role: cleanRole, label };
    usersList.push(existing);
    saveUsersList();
    if (!teamRoster.some(t => t.name.toLowerCase() === cleanName.toLowerCase())) {
      teamRoster.push({
        id: `USR-${Date.now().toString().slice(-4)}`,
        name: cleanName,
        role: cleanRole,
        phone: '',
        level: 'OPS_MANAGER',
        shift: 'ALL'
      });
    }
  }
  return existing;
};

loadUsersList();

// 1. Kiotel Internal Personnel & Roles
export const teamRoster = [
  { id: 'DIR-1', name: 'Dhiren', role: 'Director', phone: '', level: 'EXECUTIVE', shift: 'ALL' },
  { id: 'OPS-1', name: 'Sarthak', role: 'Operations Manager', phone: '', level: 'OPS_MANAGER', shift: 'ALL' },
  { id: 'OPS-2', name: 'Vikas', role: 'Operations Manager', phone: '', level: 'OPS_MANAGER', shift: 'ALL' }
];

// 2. Verified & Imported WhatsApp Groups (Separate from Properties!)
// Each item: {
//   groupId, name, participantCount, participants,
//   groupType: 'PROPERTY' | 'MULTI_PROPERTY' | 'HANDOVER' | 'INTERNAL_OPS' | 'ADMIN_CONTROL' | 'CLIENT_ACCOUNT' | 'UNKNOWN',
//   linkedPropertyIds: [],
//   humanVerified: false,
//   classificationSource: 'INFERRED' | 'HUMAN_VERIFIED',
//   classificationConfidence: 'HIGH' | 'MEDIUM' | 'LOW',
//   relevanceReason: string,
//   contacts: { owners: [], hotelManagers: [], kiotelStaff: [] },
//   isActive: true,
//   lastSyncedAt: ISOString | null,
//   lastAnalyzedAt: ISOString | null,
//   messageCount: 0
// }
export const whatsappGroups = [];

// 3. Hotel Properties (Distinct from WhatsApp Groups)
// Each item: {
//   id, name,
//   timezone: 'America/New_York' | 'Asia/Kolkata' | etc. (null if unverified),
//   launchStatus: 'LAUNCHED' | 'NOT_YET_LIVE' | 'SUSPENDED' | 'UNKNOWN',
//   launchDate: string | null,
//   schedule: {
//     type: '24_7' | 'SCHEDULED' | 'UNKNOWN',
//     startTime: '07:00' | null, // HH:mm in property's local timezone
//     endTime: '23:00' | null    // HH:mm in property's local timezone (supports overnight e.g. 22:00 to 06:00)
//   },
//   coverage: {
//     type: 'DEDICATED' | 'SHARED' | 'UNKNOWN',
//     assignedTeamOrAgent: string | null,
//     assignedManager: string | null,
//     coverageConfirmed: boolean,
//     lastCoverageVerifiedAt: ISOString | null
//   },
//   linkedGroupIds: [],
//   humanVerified: false,
//   lastEvidence: {
//     source: string,
//     messageId: string | null,
//     summary: string,
//     timestamp: ISOString | null
//   },
//   manualStatusOverride: null // Optional human override with reason
// }
export const properties = [];

// 4. Actionable Incidents & Unanswered Messages
// Each item: {
//   id, propertyId, propertyName, groupId, groupName,
//   title, summary, category: 'KIOSK' | 'PMS' | 'STAFFING' | 'HANDOVER' | 'GUEST_SUPPORT' | 'CLIENT_ESCALATION' | 'OTHER',
//   raisedBy: { name, phone, role: 'OWNER' | 'HOTEL_MANAGER' | 'KIOTEL_STAFF' | 'UNKNOWN' },
//   raisedAt: ISOString,
//   importance: { level: 'HIGH' | 'MEDIUM' | 'LOW', reason: string },
//   seriousness: { severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW', reason: string, affectedDomain: string },
//   responseRequirement: {
//     required: boolean,
//     actionType: 'ANSWER' | 'ACKNOWLEDGE' | 'INVESTIGATE' | 'DECISION' | 'ACTION' | 'NONE',
//     expectedResponder: string | 'UNASSIGNED',
//     deadline: ISOString | 'UNKNOWN',
//     waitingParty: string | null
//   },
//   resolutionState: 'AWAITING_RESPONSE' | 'RESPONSE_PROVIDED_ACTION_PENDING' | 'ACTION_IN_PROGRESS' | 'AWAITING_CONFIRMATION' | 'RESOLVED_VERIFIED' | 'UNABLE_TO_DETERMINE',
//   resolutionEvidence: string | null,
//   acknowledgedBy: string | null,
//   acknowledgedAt: ISOString | null,
//   meaningfulResponseProvided: boolean,
//   actionAssignedTo: string | 'UNASSIGNED',
//   actionCompleted: boolean,
//   passedToNextShift: boolean,
//   humanVerified: boolean,
//   confidence: 'HIGH' | 'MEDIUM' | 'LOW',
//   supportingMessages: [ { id, senderName, senderPhone, isTeam, text, timestamp } ],
//   latestUpdateAt: ISOString
// }
export const incidents = [];

// 5. Raw Message Logs (Traceable Evidence Store)
export const messageLogs = [];

// 6. Shift Handover Records
export const shiftHandovers = [];

// 7. Outbound Dispatch & Human Correction Audit Log
export const auditLogs = [];

// Legacy aliases kept empty/compatible so existing imports never crash
export const tickets = incidents;
export const techSupportIssues = [];
export const onboardingProperties = [];
export const complaintsLog = [];

// Metadata tracking
export const systemMeta = {
  lastFullSyncAt: null,
  lastManagerReviewAt: null,
  whatsappSyncHistoryLimitNote: 'WhatsApp Multi-Device provides live messages from connection time plus limited recent history bundles synced by the primary phone.'
};

/**
 * Helper to identify if a sender is Kiotel Staff
 */
export const findTeamMember = (senderPhone, senderName = '') => {
  if (senderPhone) {
    const clean = senderPhone.replace(/[^0-9]/g, '');
    if (clean) {
      const byPhone = teamRoster.find(m => m.phone && m.phone.replace(/[^0-9]/g, '') === clean);
      if (byPhone) return byPhone;
    }
  }
  if (senderName) {
    const lowerName = senderName.toLowerCase();
    const byName = teamRoster.find(m => lowerName.includes(m.name.toLowerCase()) || lowerName.includes('kiotel'));
    if (byName) return byName;
  }
  return null;
};

export const isKiotelTeamMember = (senderPhone, fromMe = false, senderName = '') => {
  if (fromMe) return true;
  if (senderName && senderName.toLowerCase().includes('kiotel')) return true;
  return !!findTeamMember(senderPhone, senderName);
};

/**
 * Load persisted state from disk on startup
 */
export const loadPersistedState = (userId = activeWorkspaceUserId) => {
  try {
    const uid = normalizeUserId(userId);
    activeWorkspaceUserId = uid;
    const sourceFile = getStateFileForUser(uid);

    // Clear current in-memory workspace before loading target user's state
    whatsappGroups.length = 0;
    properties.length = 0;
    incidents.length = 0;
    messageLogs.length = 0;
    shiftHandovers.length = 0;
    auditLogs.length = 0;
    systemMeta.lastFullSyncAt = null;
    systemMeta.lastManagerReviewAt = null;

    if (!fs.existsSync(sourceFile)) {
      console.log(`👤 [WORKSPACE: ${uid}] Fresh workspace ready (0 groups, 0 properties — pair WhatsApp to sync).`);
      return;
    }
    const raw = fs.readFileSync(sourceFile, 'utf-8');
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed.teamRoster) && parsed.teamRoster.length > 0) {
      teamRoster.length = 0;
      teamRoster.push(
        ...parsed.teamRoster.map(m => ({
          ...m,
          name: m.name === 'Dhuren' ? 'Dhiren' : m.name
        }))
      );
    }
    if (Array.isArray(parsed.whatsappGroups)) {
      whatsappGroups.push(...parsed.whatsappGroups);
    }
    if (Array.isArray(parsed.properties)) {
      properties.push(...parsed.properties);
    }
    if (Array.isArray(parsed.incidents)) {
      incidents.push(...parsed.incidents);
    }
    if (Array.isArray(parsed.messageLogs)) {
      messageLogs.push(...parsed.messageLogs.slice(0, 2000));
    }
    if (Array.isArray(parsed.shiftHandovers)) {
      shiftHandovers.push(...parsed.shiftHandovers);
    }
    if (Array.isArray(parsed.auditLogs)) {
      auditLogs.push(...parsed.auditLogs.slice(0, 500));
    }
    if (parsed.systemMeta) {
      Object.assign(systemMeta, parsed.systemMeta);
    }
    console.log(`💾 [DATA STORE: ${uid}] Loaded persisted state: ${whatsappGroups.length} groups, ${properties.length} properties, ${incidents.length} incidents.`);
  } catch (err) {
    console.error('⚠️ [DATA STORE] Failed to load persisted state:', err.message);
  }
};

/**
 * Save current state to disk for the active user workspace
 */
export const savePersistedState = (userId = activeWorkspaceUserId) => {
  try {
    const uid = normalizeUserId(userId);
    const payload = {
      userId: uid,
      updatedAt: new Date().toISOString(),
      systemMeta,
      teamRoster,
      whatsappGroups,
      properties,
      incidents,
      messageLogs: messageLogs.slice(0, 2000),
      shiftHandovers: shiftHandovers.slice(0, 100),
      auditLogs: auditLogs.slice(0, 500)
    };
    const targetFile = process.env.VERCEL
      ? (uid === 'sarthak' ? TMP_STATE_FILE : path.join(os.tmpdir(), `kiotel_operationalState_${uid}.json`))
      : (uid === 'sarthak' ? STATE_FILE : path.join(DATA_DIR, `operationalState_${uid}.json`));
    fs.writeFileSync(targetFile, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    try {
      fs.writeFileSync(TMP_STATE_FILE, JSON.stringify({ updatedAt: new Date().toISOString() }), 'utf-8');
    } catch (_) {}
  }
};

/**
 * Switch the active operational workspace to a specific user (Sarthak, Vikas, Dhiren, or any newly added user)
 */
export const switchUserWorkspace = (targetUserIdOrLabel) => {
  const nextUid = normalizeUserId(targetUserIdOrLabel);
  if (nextUid !== activeWorkspaceUserId) {
    savePersistedState(activeWorkspaceUserId);
  }
  loadPersistedState(nextUid);
  return {
    activeUserId: activeWorkspaceUserId,
    groupsCount: whatsappGroups.length,
    propertiesCount: properties.length,
    incidentsCount: incidents.length
  };
};

/**
 * Record a human verification or correction in the audit log and persist
 */
export const logHumanAction = (actionType, actor, details) => {
  const entry = {
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actionType,
    actor: actor || 'Operations Manager',
    details,
    timestamp: new Date().toISOString()
  };
  auditLogs.unshift(entry);
  savePersistedState();
  return entry;
};

// Load on module initialization
loadPersistedState();