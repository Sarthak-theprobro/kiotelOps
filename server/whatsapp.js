// ================================================================
// 📱 KIOTEL OPERATIONS INTELLIGENCE — WHATSAPP CONNECTOR (BAILEYS)
// Accurate group synchronization, history ingestion, and safety-gated sending.
// ================================================================

import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { processIncomingMessage } from './slaEngine.js';
import { classifyWhatsAppGroup } from './incidentEngine.js';
import { discoverAndSyncPropertiesFromGroups } from './propertyDiscovery.js';
import { 
  whatsappGroups, 
  properties, 
  teamRoster, 
  systemMeta, 
  logHumanAction, 
  savePersistedState 
} from './dataStore.js';
import { broadcast } from './index.js';

const AUTH_DIR = path.resolve('auth_info_baileys');

let connectionState = 'DISCONNECTED';
let sock = null;
let currentQrDataUrl = null;
let rawQrString = null;
let qrGeneratedAt = null;
let activeAccount = null;
let isInitializing = false;
let reconnectTimer = null;

const FALLBACK_BAILEYS_VERSION = [2, 3000, 1043857760];

/**
 * Sync all real WhatsApp groups into `whatsappGroups[]` (NOT `properties[]`!).
 * Does NOT assume 1 group = 1 live property.
 */
export const syncAllWhatsAppGroups = async () => {
  if (!sock || connectionState !== 'CONNECTED') return;
  try {
    console.log('📡 [WHATSAPP] Fetching participating WhatsApp groups...');
    const groups = await sock.groupFetchAllParticipating();
    const groupList = Object.values(groups || {});
    const nowIso = new Date().toISOString();

    if (groupList.length > 0) {
      const currentAccountGroupIds = new Set(groupList.map(g => g.id));
      // Keep only groups that belong to the currently connected user's WhatsApp account (supports Sarthak, Vikas, or Dhiren having more or less groups!)
      const retained = whatsappGroups.filter(wg => currentAccountGroupIds.has(wg.groupId));
      whatsappGroups.length = 0;
      whatsappGroups.push(...retained);
    }

    groupList.forEach((g) => {
      let existing = whatsappGroups.find(wg => wg.groupId === g.id);
      const participantList = (g.participants || []).map(p => ({
        jid: p.id,
        phone: p.id.split('@')[0],
        admin: p.admin || null
      }));

      if (!existing) {
        const inferred = classifyWhatsAppGroup(g.subject || '', []);
        existing = {
          groupId: g.id,
          name: g.subject || `WhatsApp Group ${g.id.split('@')[0]}`,
          participantCount: participantList.length,
          participants: participantList,
          groupType: inferred.groupType,
          linkedPropertyIds: [],
          humanVerified: false,
          classificationSource: 'INFERRED',
          classificationConfidence: inferred.confidence,
          relevanceReason: inferred.relevanceReason,
          contacts: { owners: [], hotelManagers: [], kiotelStaff: [] },
          isActive: true,
          lastSyncedAt: nowIso,
          lastAnalyzedAt: nowIso,
          messageCount: 0
        };
        whatsappGroups.push(existing);
      } else {
        existing.name = g.subject || existing.name;
        existing.participantCount = participantList.length;
        existing.participants = participantList;
        existing.lastSyncedAt = nowIso;
      }
    });

    systemMeta.lastFullSyncAt = nowIso;
    const discoverySummary = discoverAndSyncPropertiesFromGroups();
    savePersistedState();

    console.log(`✅ [WHATSAPP] Synced ${whatsappGroups.length} WhatsApp group profiles (Discovered & Linked Properties: ${properties.length}).`);
    broadcast('GROUPS_SYNCED', {
      totalGroups: whatsappGroups.length,
      totalProperties: properties.length,
      discoverySummary
    });
  } catch (err) {
    console.error('Error syncing WhatsApp groups:', err.message);
  }
};

/**
 * Initialize WhatsApp Socket Connection
 */
export const connectToWhatsApp = async (forceFresh = false) => {
  if (isInitializing) return;
  if (connectionState === 'CONNECTED' && sock && !forceFresh) return;

  isInitializing = true;
  connectionState = 'CONNECTING';
  broadcast('WHATSAPP_STATUS_CHANGED', getWhatsAppStatus());

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  try {
    if (forceFresh) {
      if (sock) {
        try {
          sock.ev.removeAllListeners('connection.update');
          sock.ev.removeAllListeners('messages.upsert');
          sock.ev.removeAllListeners('messaging-history.set');
          sock.end(undefined);
        } catch (e) {}
        sock = null;
      }
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      }
      currentQrDataUrl = null;
      rawQrString = null;
      qrGeneratedAt = null;
      activeAccount = null;
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    let version = FALLBACK_BAILEYS_VERSION;
    try {
      const vResult = await fetchLatestBaileysVersion();
      if (vResult?.version) version = vResult.version;
    } catch (e) {}

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      connectTimeoutMs: 20000,
      keepAliveIntervalMs: 25000,
      defaultQueryTimeoutMs: 20000,
      syncFullHistory: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        rawQrString = qr;
        qrGeneratedAt = Date.now();
        try {
          currentQrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
          connectionState = 'WAITING_FOR_SCAN';
          broadcast('WHATSAPP_QR_UPDATED', { qrCode: currentQrDataUrl, generatedAt: qrGeneratedAt });
          broadcast('WHATSAPP_STATUS_CHANGED', getWhatsAppStatus());
        } catch (err) {
          console.error('Error generating QR DataURL:', err);
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        currentQrDataUrl = null;
        rawQrString = null;

        if (statusCode === DisconnectReason.loggedOut) {
          connectionState = 'DISCONNECTED';
          activeAccount = null;
          if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          }
          broadcast('WHATSAPP_DISCONNECTED', { reason: 'LOGGED_OUT' });
          broadcast('WHATSAPP_STATUS_CHANGED', getWhatsAppStatus());
        } else if (statusCode === DisconnectReason.timedOut || statusCode === 408) {
          connectionState = 'QR_EXPIRED';
          broadcast('WHATSAPP_STATUS_CHANGED', getWhatsAppStatus());
        } else {
          connectionState = 'CONNECTION_FAILED';
          broadcast('WHATSAPP_STATUS_CHANGED', getWhatsAppStatus());
          reconnectTimer = setTimeout(() => connectToWhatsApp(false), 4000);
        }
      } else if (connection === 'open') {
        connectionState = 'CONNECTED';
        currentQrDataUrl = null;
        rawQrString = null;
        qrGeneratedAt = null;
        activeAccount = sock.user?.name || sock.user?.id?.split(':')[0] || 'Authenticated Account';
        console.log(`✅ [WHATSAPP] CONNECTED! Account: ${activeAccount}`);
        broadcast('WHATSAPP_CONNECTED', { status: 'ONLINE', account: activeAccount });
        broadcast('WHATSAPP_STATUS_CHANGED', getWhatsAppStatus());

        await syncAllWhatsAppGroups();
      }
    });

    // Ingest historical message bundles provided by WhatsApp Multi-Device on initial sync
    sock.ev.on('messaging-history.set', async ({ messages: histMessages = [] }) => {
      try {
        let ingestedCount = 0;
        for (const msg of histMessages.slice(-5000)) {
          if (!msg || !msg.message || !msg.key?.remoteJid) continue;
          const remoteJid = msg.key.remoteJid;
          if (!remoteJid.endsWith('@g.us')) continue;

          const text = msg.message.conversation ||
                       msg.message.extendedTextMessage?.text ||
                       msg.message.imageMessage?.caption || '';
          if (!text) continue;

          const senderPhone = (msg.key.participant || remoteJid).split('@')[0];
          const fromMe = !!msg.key.fromMe;
          const senderName = fromMe ? (activeAccount || 'Kiotel Staff') : (msg.pushName || senderPhone);
          const timestamp = msg.messageTimestamp
            ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
            : new Date().toISOString();

          processIncomingMessage({
            id: msg.key.id || `HIST-${Date.now()}-${ingestedCount}`,
            groupId: remoteJid,
            senderPhone: `+${senderPhone}`,
            senderName,
            text,
            fromMe,
            timestamp
          });
          ingestedCount++;
        }
        if (ingestedCount > 0) {
          console.log(`📥 [WHATSAPP HISTORY] Ingested ${ingestedCount} recent group messages.`);
          discoverAndSyncPropertiesFromGroups();
          broadcast('HISTORY_SYNCED', { count: ingestedCount, totalProperties: properties.length });
        }
      } catch (err) {
        console.error('Error processing history sync:', err.message);
      }
    });

    // Ingest live incoming & outgoing WhatsApp messages
    sock.ev.on('messages.upsert', async (m) => {
      try {
        for (const msg of m.messages || []) {
          if (!msg || !msg.message) continue;

          const remoteJid = msg.key.remoteJid;
          if (!remoteJid || remoteJid === 'status@broadcast') continue;

          const fromMe = !!msg.key.fromMe;
          const text = msg.message.conversation || 
                       msg.message.extendedTextMessage?.text || 
                       msg.message.imageMessage?.caption || 
                       msg.message.videoMessage?.caption || '';

          if (!text) continue;

          const senderPhone = (msg.key.participant || remoteJid).split('@')[0];
          const senderName = fromMe ? (activeAccount || 'Kiotel Ops') : (msg.pushName || senderPhone);

          let groupSubject = null;
          if (remoteJid.endsWith('@g.us') && !whatsappGroups.some(g => g.groupId === remoteJid)) {
            const meta = await sock.groupMetadata(remoteJid).catch(() => null);
            groupSubject = meta?.subject || null;
          }

          processIncomingMessage({
            id: msg.key.id || `MSG-${Date.now()}`,
            groupId: remoteJid,
            groupSubject,
            senderPhone: `+${senderPhone}`,
            senderName,
            text,
            fromMe,
            timestamp: msg.messageTimestamp 
              ? new Date(Number(msg.messageTimestamp) * 1000).toISOString() 
              : new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Error processing incoming WhatsApp message:', err);
      }
    });

  } catch (err) {
    console.error('Error initializing WhatsApp socket:', err);
    connectionState = 'CONNECTION_FAILED';
    broadcast('WHATSAPP_STATUS_CHANGED', getWhatsAppStatus());
  } finally {
    isInitializing = false;
  }
};

export const getPairingQR = () => ({
  state: connectionState,
  qrCode: currentQrDataUrl,
  generatedAt: qrGeneratedAt,
  activeAccount
});

export const requestPhoneNumberPairing = async (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { success: false, error: 'Phone number is required.' };
  }
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return { success: false, error: 'Enter 10-15 digits including country code (e.g., 919811100001).' };
  }
  if (connectionState === 'CONNECTED') {
    return { success: false, error: 'WhatsApp is already connected.' };
  }
  if (!sock) {
    await connectToWhatsApp(true);
    await new Promise(r => setTimeout(r, 1500));
  }
  try {
    const rawCode = await sock.requestPairingCode(cleanPhone);
    const formattedCode = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;
    return {
      success: true,
      code: rawCode,
      formattedCode,
      phoneNumber: cleanPhone,
      instructions: 'Open WhatsApp > Linked Devices > Link with phone number instead > Enter this code.'
    };
  } catch (err) {
    return { success: false, error: err.message || 'Could not generate pairing code.' };
  }
};

export const logoutWhatsAppSession = async () => {
  console.log('🚪 [WHATSAPP] Performing complete WhatsApp logout...');
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {}
  }
  await connectToWhatsApp(true);
  return getWhatsAppStatus();
};

export const resetWhatsAppSession = async () => {
  await connectToWhatsApp(true);
  return getWhatsAppStatus();
};

/**
 * Safety-Shielded Outbound WhatsApp Dispatch
 * Never sends autonomously; validates human approval, group authorization, and property mapping.
 */
export const sendWhatsAppMessage = async ({
  recipientJid,
  text,
  approvedBy,
  propertyId,
  explicitHumanConfirmation = false,
  isSimulation = false
}) => {
  if (isSimulation) {
    return { success: true, mode: 'SIMULATION', message: 'Simulated locally. No external WhatsApp message sent.' };
  }

  if (!text || !text.trim()) {
    return { success: false, error: 'Message text cannot be empty.' };
  }

  if (!approvedBy || !explicitHumanConfirmation) {
    return {
      success: false,
      error: 'Safety Block: Explicit human approval (approvedBy + explicitHumanConfirmation) is required before any WhatsApp message can be sent.'
    };
  }

  if (!recipientJid) {
    return { success: false, error: 'Safety Block: Missing recipient group/JID.' };
  }

  // Verify group exists in known whatsappGroups
  const targetGroup = whatsappGroups.find(g => g.groupId === recipientJid);
  if (!targetGroup) {
    return {
      success: false,
      error: `Safety Block: Destination "${recipientJid}" is not a recognized WhatsApp group in your synced inventory.`
    };
  }

  // Verify property mapping if propertyId is specified
  if (propertyId) {
    const targetProperty = properties.find(p => p.id === propertyId);
    if (!targetProperty) {
      return {
        success: false,
        error: `Safety Block: Property "${propertyId}" does not exist.`
      };
    }
    const isLinked =
      (targetGroup.linkedPropertyIds && targetGroup.linkedPropertyIds.includes(propertyId)) ||
      (targetProperty.linkedGroupIds && targetProperty.linkedGroupIds.includes(recipientJid));
    if (!isLinked) {
      return {
        success: false,
        error: `Safety Block: Cross-property protection! Group "${targetGroup.name}" is not verified as linked to property "${targetProperty.name}". Verify the mapping first.`
      };
    }
  }

  if (connectionState !== 'CONNECTED' || !sock) {
    return {
      success: false,
      error: 'WhatsApp is currently disconnected. Copy the draft below to send manually.',
      isConnected: false,
      copyableDraft: text
    };
  }

  try {
    const result = await sock.sendMessage(recipientJid, { text });

    logHumanAction('WHATSAPP_MESSAGE_SENT', approvedBy, {
      recipientJid,
      groupName: targetGroup.name,
      propertyId: propertyId || null,
      text,
      messageId: result?.key?.id
    });

    processIncomingMessage({
      id: result?.key?.id || `OUT-${Date.now()}`,
      groupId: recipientJid,
      groupSubject: targetGroup.name,
      senderPhone: '+919900000002',
      senderName: approvedBy,
      text,
      fromMe: true
    });

    return {
      success: true,
      mode: 'REAL',
      messageId: result?.key?.id,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return { success: false, error: err.message, copyableDraft: text };
  }
};

export const getWhatsAppStatus = () => ({
  state: connectionState,
  isConnected: connectionState === 'CONNECTED',
  qrCode: currentQrDataUrl,
  qrGeneratedAt,
  activeAccount,
  syncedGroupsCount: whatsappGroups.length,
  verifiedPropertiesCount: properties.length,
  lastFullSyncAt: systemMeta.lastFullSyncAt,
  syncNote: systemMeta.whatsappSyncHistoryLimitNote
});

export const injectMessage = (msg) => processIncomingMessage(msg);