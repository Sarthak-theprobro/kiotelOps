import React, { useState, useEffect } from 'react';
import { 
  Hotel, BellRing, Sparkles, Brain, FolderGit2, ShieldCheck, 
  MessageSquare, FileSpreadsheet, Wrench, Rocket 
} from 'lucide-react';

// Subcomponents
import Toast from './components/Toast';
import Header from './components/Header';
import KpiGrid from './components/KpiGrid';
import GlanceLockscreen from './components/GlanceLockscreen';
import LoginScreen from './components/LoginScreen';

// Tabs
import AiHubTab from './components/tabs/AiHubTab';
import ComplaintsTab from './components/tabs/ComplaintsTab';
import TechWarRoomTab from './components/tabs/TechWarRoomTab';
import SlaRadarTab from './components/tabs/SlaRadarTab';
import PropertiesTab from './components/tabs/PropertiesTab';
import OnboardingTab from './components/tabs/OnboardingTab';
import GroupsTab from './components/tabs/GroupsTab';
import HandoversTab from './components/tabs/HandoversTab';
import StreamTab from './components/tabs/StreamTab';
import AdminTab from './components/tabs/AdminTab';

// Modals
import ReplyModal from './components/modals/ReplyModal';
import SosModal from './components/modals/SosModal';
import SimulatorModal from './components/modals/SimulatorModal';
import QrModal from './components/modals/QrModal';
import { apiUrl, getWsUrl } from './config';

const DEFAULT_EXECUTIVE_PIN = "2026";

export default function App() {
  // Session & Authentication State: 'ACTIVE' | 'LOCKED' | 'LOGGED_OUT'
  const [sessionState, setSessionState] = useState(() => {
    const savedState = sessionStorage.getItem('kiotel_session_state');
    return savedState || 'ACTIVE';
  });

  const [currentUser, setCurrentUser] = useState(() => {
    return sessionStorage.getItem('kiotel_auth_user') || 'Sarthak (Ops Manager)';
  });

  const [executivePin, setExecutivePin] = useState(() => {
    return localStorage.getItem('kiotel_exec_pin') || DEFAULT_EXECUTIVE_PIN;
  });

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Toast notification state
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(prev => (prev?.message === message ? null : prev)), 4000);
  };

  // Theme & Audio state (Syncs Tailwind 'dark' class on <html> so Light Mode & Dark Mode both have 100% crisp contrast!)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('kiotel_theme_dark');
    return saved !== null ? saved === 'true' : true;
  });
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('kiotel_theme_dark', String(isDarkMode));
  }, [isDarkMode]);

  // Active navigation tab & filter states
  const [activeTab, setActiveTab] = useState('ai_hub');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // v3.2 Data states (Zero fabricated data)
  const [properties, setProperties] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [groups, setGroups] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [techIssues, setTechIssues] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [team, setTeam] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [currentShift, setCurrentShift] = useState({ name: 'Operations Shift', timing: '24/7 Coverage' });
  const [isWaConnected, setIsWaConnected] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // UI / Copy states
  const [copiedHandoverId, setCopiedHandoverId] = useState(null);
  const [copiedSosText, setCopiedSosText] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Modals state
  const [activeSosAlert, setActiveSosAlert] = useState(null);
  const [replyTicket, setReplyTicket] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');

  // Simulator Modal State
  const [showSimModal, setShowSimModal] = useState(false);
  const [simPropId, setSimPropId] = useState('');
  const [simSenderName, setSimSenderName] = useState('Hotel Manager');
  const [simSenderPhone, setSimSenderPhone] = useState('+15550199');
  const [simText, setSimText] = useState('Guest at Kiosk 1 says check-in payment timed out! Please assist.');
  const [simType, setSimType] = useState('OWNER_QUERY');

  // QR Modal State
  const [showQrModal, setShowQrModal] = useState(false);

  // 🔊 Audio Synthesizer
  const playChime = (type = 'warning') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'breach') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(440, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {
      // Audio blocked by browser autoplay policy
    }
  };

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch all v3.2 backend data
  const fetchData = async () => {
    try {
      const [
        resHealth,
        resProps,
        resGroups,
        resIncidents,
        resComplaints,
        resTech,
        resShifts,
        resTeam,
        resMsgs,
        resWa,
        resAi,
        resAudit
      ] = await Promise.all([
        fetch(apiUrl('/api/health')).then(r => r.json()).catch(() => null),
        fetch(apiUrl('/api/properties')).then(r => r.json()).catch(() => ({ properties: [], statusCounts: {} })),
        fetch(apiUrl('/api/groups')).then(r => r.json()).catch(() => ({ groups: [] })),
        fetch(apiUrl('/api/incidents')).then(r => r.json()).catch(() => ({ incidents: [] })),
        fetch(apiUrl('/api/complaints')).then(r => r.json()).catch(() => ({ complaints: [] })),
        fetch(apiUrl('/api/tech-support')).then(r => r.json()).catch(() => ({ issues: [] })),
        fetch(apiUrl('/api/shifts')).then(r => r.json()).catch(() => ({ handovers: [] })),
        fetch(apiUrl('/api/team')).then(r => r.json()).catch(() => ({ team: [] })),
        fetch(apiUrl('/api/messages')).then(r => r.json()).catch(() => ({ messages: [] })),
        fetch(apiUrl('/api/whatsapp/status')).then(r => r.json()).catch(() => ({ connected: false })),
        fetch(apiUrl('/api/ai-analyze-24h')).then(r => r.json()).catch(() => null),
        fetch(apiUrl('/api/audit-logs')).then(r => r.json()).catch(() => ({ logs: [] }))
      ]);

      if (resHealth?.currentShift) setCurrentShift(resHealth.currentShift);
      if (resProps?.properties) {
        setProperties(resProps.properties);
        if (!simPropId && resProps.properties.length > 0) {
          setSimPropId(resProps.properties[0].id);
        }
      }
      if (resProps?.statusCounts) setStatusCounts(resProps.statusCounts);
      if (resGroups?.groups) setGroups(resGroups.groups);
      if (resIncidents?.incidents) setIncidents(resIncidents.incidents);
      if (resComplaints?.complaints) setComplaints(resComplaints.complaints);
      if (resTech?.issues) setTechIssues(resTech.issues);
      if (resShifts?.handovers) setHandovers(resShifts.handovers);
      if (resTeam?.team) setTeam(resTeam.team);
      if (resMsgs?.messages) setMessages(resMsgs.messages);
      if (resWa?.connected !== undefined) setIsWaConnected(resWa.connected);
      if (resAi) setAiAnalysis(resAi);
      if (resAudit?.logs) setAuditLogs(resAudit.logs);
    } catch (err) {
      console.error('Error fetching operational intelligence data:', err);
    }
  };

  // Run Fresh Intelligence Audit
  const handleRunAiAudit = async () => {
    setIsAnalyzing(true);
    try {
      await fetchData();
      showToast('⚡ Operational Intelligence refreshed from verified evidence!', 'success');
    } catch (e) {
      showToast('Failed to refresh analysis', 'error');
    } finally {
      setTimeout(() => setIsAnalyzing(false), 400);
    }
  };

  // Mark Review Checkpoint ("What changed since last review")
  const handleMarkReviewed = async () => {
    try {
      await fetch(apiUrl('/api/review-checkpoint'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewedBy: currentUser })
      });
      await fetchData();
      showToast('✅ Review checkpoint saved! Future deltas will compare against now.', 'success');
    } catch (err) {
      showToast('Failed to save review checkpoint', 'error');
    }
  };

  // WebSocket live updates
  useEffect(() => {
    fetchData();

    const ws = new WebSocket(getWsUrl());
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'INCIDENT_CREATED' || payload.type === 'TICKET_CREATED') {
          playChime('warning');
          fetchData();
          showToast(`🚨 New Incident Logged: ${payload.data?.propertyName || payload.data?.groupName || 'Operations'}`, 'info');
        } else if (payload.type === 'INCIDENT_OVERDUE' || payload.type === 'SLA_BREACH_ALERT') {
          playChime('breach');
          fetchData();
          showToast(`⚠️ Unanswered Query Overdue (>5m): ${payload.data?.propertyName || 'Check Incident Radar'}`, 'error');
        } else if (payload.type === 'WHATSAPP_CONNECTED') {
          setIsWaConnected(true);
          fetchData();
          showToast('🟢 WhatsApp Multi-Device Connected! Importing groups...', 'success');
        } else if (payload.type === 'WHATSAPP_DISCONNECTED') {
          setIsWaConnected(false);
          fetchData();
        } else if (
          [
            'GROUPS_SYNCED',
            'GROUP_UPDATED',
            'PROPERTY_CREATED',
            'PROPERTY_UPDATED',
            'INCIDENT_UPDATED',
            'NEW_MESSAGE',
            'SHIFT_HANDOVER_GENERATED',
            'REVIEW_CHECKPOINT_UPDATED'
          ].includes(payload.type)
        ) {
          fetchData();
        }
      } catch (e) {
        console.error(e);
      }
    };

    return () => ws.close();
  }, [soundEnabled]);

  // Auth & Session PIN Verification
  const handlePinSubmit = (e) => {
    e.preventDefault();
    // When fully logged out, passcode alone MUST NOT allow entry without scanning the WhatsApp QR code first!
    if (sessionState === 'LOGGED_OUT' && !isWaConnected) {
      setPinError('⚠️ Logged Out: Passcode alone cannot sign in after full logout. You must scan the WhatsApp QR code first.');
      handleOpenQR();
      return;
    }
    if (pinInput === executivePin) {
      setSessionState('ACTIVE');
      sessionStorage.setItem('kiotel_session_state', 'ACTIVE');
      sessionStorage.setItem('kiotel_auth_user', currentUser);
      setPinError('');
      setPinInput('');
      showToast(`🔓 Session unlocked for ${currentUser}.`, 'success');
    } else {
      setPinError('Incorrect 4-Digit Security PIN. Please try again.');
      setPinInput('');
    }
  };

  // 🔒 End Session (Break Lock — Keeps background WhatsApp & monitoring running, requires PIN to resume)
  const handleLockScreen = () => {
    setSessionState('LOCKED');
    sessionStorage.setItem('kiotel_session_state', 'LOCKED');
    setPinInput('');
    setPinError('');
    showToast('🔒 Session Ended (Break Lock active). Background monitoring continues; enter PIN to unlock.', 'info');
  };

  // 🚪 Full Logout (Signs out AND completely disconnects the active WhatsApp session)
  const handleFullLogout = async () => {
    try {
      await fetch(apiUrl('/api/whatsapp/logout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: currentUser })
      });
    } catch (e) {
      console.error('Error disconnecting WhatsApp on logout:', e);
    }
    sessionStorage.removeItem('kiotel_auth_user');
    sessionStorage.setItem('kiotel_session_state', 'LOGGED_OUT');
    setIsWaConnected(false);
    setSessionState('LOGGED_OUT');
    setPinInput('');
    setPinError('');
    showToast('👋 Logged out & WhatsApp session disconnected.', 'success');
  };

  // Update Security PIN in Admin
  const handleChangePin = (newPinValue) => {
    setExecutivePin(newPinValue);
    localStorage.setItem('kiotel_exec_pin', newPinValue);
    showToast('🔐 Executive Security PIN updated!', 'success');
  };

  // KPI Card Click Drill-down
  const handleKpiClick = (key) => {
    if (key === 'NOT_YET_LIVE') {
      setActiveTab('onboarding');
    } else if (['LIVE', 'AT_RISK', 'OUTSIDE_HOURS', 'SUSPENDED', 'UNKNOWN'].includes(key)) {
      setActiveTab('properties');
      setStatusFilter(key);
    } else if (key === 'AWAITING_RESPONSE') {
      setActiveTab('radar');
    } else if (key === 'GROUPS_VERIFY') {
      setActiveTab('groups');
    }
  };

  const handleRediscoverProperties = async () => {
    try {
      const res = await fetch(apiUrl('/api/properties/discover'), { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(
          `🔍 Synced ${data.totalProperties} properties (${data.statusCounts?.LIVE || 0} Live, ${data.statusCounts?.OUTSIDE_HOURS || 0} Closed/Outside Hours, ${data.statusCounts?.NOT_YET_LIVE || 0} Onboarding)!`,
          'success'
        );
        fetchData();
      }
    } catch (err) {
      showToast('Failed to re-discover properties from WhatsApp groups', 'error');
    }
  };

  // Property Create / Update Handlers
  const handleSaveProperty = async (propId, updates) => {
    try {
      const res = await fetch(apiUrl(`/api/properties/${encodeURIComponent(propId)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Property "${data.property.name}" verified & saved!`, 'success');
        fetchData();
      }
    } catch (err) {
      showToast('Failed to update property', 'error');
    }
  };

  const handleCreateProperty = async (payload) => {
    try {
      const res = await fetch(apiUrl('/api/properties'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Property "${data.property.name}" created!`, 'success');
        fetchData();
      }
    } catch (err) {
      showToast('Failed to create property', 'error');
    }
  };

  // Group Update & Sync Handlers
  const handleUpdateGroup = async (groupId, updates) => {
    try {
      const res = await fetch(apiUrl(`/api/groups/${encodeURIComponent(groupId)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Group profile "${data.group.groupName}" verified & saved!`, 'success');
        fetchData();
      }
    } catch (err) {
      showToast('Failed to update group profile', 'error');
    }
  };

  const handleSyncGroups = async () => {
    try {
      const res = await fetch(apiUrl('/api/whatsapp/sync-groups'), { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`🔄 Synced ${data.syncedCount} WhatsApp groups (${data.totalGroups} total)!`, 'success');
        fetchData();
      } else {
        showToast(data.error || 'WhatsApp not connected for group sync.', 'error');
      }
    } catch (err) {
      showToast('Failed to sync WhatsApp groups', 'error');
    }
  };

  // Incident Update Handler
  const handleUpdateIncident = async (incidentId, updates) => {
    try {
      const res = await fetch(apiUrl(`/api/incidents/${encodeURIComponent(incidentId)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Record ${incidentId} updated to ${data.incident.resolutionState}!`, 'success');
        fetchData();
      }
    } catch (err) {
      showToast('Failed to update incident state', 'error');
    }
  };

  // Add Team Member Handler
  const handleAddTeamMember = async (memberPayload) => {
    try {
      const res = await fetch(apiUrl('/api/team'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberPayload)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Added ${data.member.name} to Kiotel Roster!`, 'success');
        fetchData();
      }
    } catch (err) {
      showToast('Failed to add team member', 'error');
    }
  };

  // Polish Draft Message
  const polishDraftMessage = () => {
    if (!replyDraft.trim()) return;
    const lower = replyDraft.toLowerCase();
    let polished = replyDraft;

    if (lower.includes('kiosk ok') || lower.includes('reset done') || lower.includes('done')) {
      polished = "We have remotely rebooted the kiosk and verified system health. Guest check-in is now operational.";
    } else if (lower.includes('checking') || lower.includes('look into it') || lower.includes('wait')) {
      polished = "Acknowledged. Our technical support team is actively investigating this issue now and will confirm once resolved.";
    } else {
      polished = replyDraft.charAt(0).toUpperCase() + replyDraft.slice(1);
      if (!polished.endsWith('.')) polished += '.';
    }
    setReplyDraft(polished);
    showToast('✨ Draft polished!', 'success');
  };

  // Simulate WhatsApp message (Local Test Lab)
  const handleSimulate = async () => {
    const targetProp = properties.find(p => p.id === simPropId) || properties[0];
    const targetGroupId = targetProp?.linkedGroupIds?.[0] || groups[0]?.groupId || '1203630001@g.us';
    const targetGroupName = targetProp ? `${targetProp.name} Operations` : (groups[0]?.groupName || 'Test Hotel Operations Group');

    let senderPhone = simSenderPhone;
    let senderName = simSenderName;
    let senderRole = 'HOTEL_MANAGER';

    if (simType === 'KIOSK_LIVE' || simType === 'KIOSK_CLOSED') {
      senderPhone = '+919900000002';
      senderName = currentUser;
      senderRole = 'KIOTEL_AGENT';
    } else if (simType === 'TECH_BUG') {
      senderPhone = '+919900000099';
      senderName = 'Hotel Front Desk Manager';
      senderRole = 'HOTEL_MANAGER';
    }

    try {
      await fetch(apiUrl('/api/simulate-message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: targetGroupId,
          groupName: targetGroupName,
          senderPhone,
          senderName,
          senderRole,
          text: simText
        })
      });
      setShowSimModal(false);
      showToast('🧪 Test scenario injected into local analysis engine!', 'success');
      fetchData();
    } catch (err) {
      showToast('Error injecting test scenario.', 'error');
    }
  };

  // Generate shift handover report
  const handleGenerateHandover = async () => {
    try {
      const res = await fetch(apiUrl('/api/shifts/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftLeadName: currentUser })
      });
      const data = await res.json();
      if (data.success) {
        showToast('📋 Shift handover report generated from live verified state!', 'success');
        fetchData();
        setActiveTab('handovers');
      }
    } catch (err) {
      showToast('Error generating handover', 'error');
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedHandoverId(id);
    showToast('📋 Copied report to clipboard!', 'success');
    setTimeout(() => setCopiedHandoverId(null), 2000);
  };

  const handleOpenQR = async () => {
    setShowQrModal(true);
    try {
      await fetch(apiUrl('/api/whatsapp/pair'), { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  // Derived KPI metrics
  const awaitingResponseCount = incidents.filter(i => i.resolutionState === 'AWAITING_RESPONSE').length;
  const actionPendingCount = incidents.filter(i => i.resolutionState === 'RESPONSE_PROVIDED_ACTION_PENDING' || i.resolutionState === 'ACKNOWLEDGED').length;
  const openComplaintsCount = complaints.filter(c => c.resolutionState !== 'RESOLVED_VERIFIED').length;
  const openTechCount = techIssues.filter(t => t.resolutionState !== 'RESOLVED_VERIFIED').length;
  const unverifiedGroupsCount = groups.filter(g => !g.humanVerified).length;
  const verifiedPropertiesCount = properties.filter(p => p.humanVerified).length;

  // ================================================================
  // 🔒 1. END SESSION / BREAK LOCK VIEW (Requires 4-Digit PIN)
  // ================================================================
  if (sessionState === 'LOCKED') {
    return (
      <>
        <Toast toast={toast} onClose={() => setToast(null)} />
        <GlanceLockscreen 
          currentUser={currentUser}
          currentShift={currentShift}
          currentTime={currentTime}
          properties={properties}
          tickets={incidents.filter(i => i.resolutionState === 'AWAITING_RESPONSE')}
          techIssues={incidents.filter(i => i.resolutionState !== 'RESOLVED_VERIFIED')}
          isWaConnected={isWaConnected}
          pinInput={pinInput}
          setPinInput={setPinInput}
          pinError={pinError}
          onPinSubmit={handlePinSubmit}
          onOpenQr={handleOpenQR}
          onFullLogout={handleFullLogout}
        />
        <QrModal 
          showQrModal={showQrModal} 
          isDarkMode={true} 
          onClose={() => setShowQrModal(false)} 
        />
      </>
    );
  }

  // ================================================================
  // 🚪 2. FULL LOGOUT VIEW (Clean Login Screen + Requires 4-Digit PIN)
  // ================================================================
  if (sessionState === 'LOGGED_OUT') {
    return (
      <>
        <Toast toast={toast} onClose={() => setToast(null)} />
        <LoginScreen 
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          pinInput={pinInput}
          setPinInput={setPinInput}
          pinError={pinError}
          onLoginSubmit={handlePinSubmit}
          onOpenQr={handleOpenQR}
          currentShift={currentShift}
          currentTime={currentTime}
          isWaConnected={isWaConnected}
        />
        <QrModal 
          showQrModal={showQrModal} 
          isDarkMode={true} 
          onClose={() => setShowQrModal(false)} 
        />
      </>
    );
  }

  // ================================================================
  // 🖥️ 3. MAIN UNLOCKED OPERATIONS INTELLIGENCE DASHBOARD
  // ================================================================
  return (
    <div className={`min-h-screen transition-colors duration-200 flex flex-col pb-16 sm:pb-0 ${
      isDarkMode ? 'dark futuristic-bg-dark text-slate-100' : 'futuristic-bg-light text-slate-900'
    }`}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* 1. Header */}
      <Header 
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        currentShift={currentShift}
        currentTime={currentTime}
        isWaConnected={isWaConnected}
        groupsCount={groups.length}
        verifiedPropertiesCount={verifiedPropertiesCount}
        onOpenSimModal={() => setShowSimModal(true)}
        onOpenQrModal={handleOpenQR}
        onOpenAdminTab={() => setActiveTab('admin')}
        onLockScreen={handleLockScreen}
        onLogout={handleFullLogout}
      />

      {/* 2. 8-Card Traceable KPI Grid (6 Property Statuses + Incidents + WA Groups) */}
      <KpiGrid 
        isDarkMode={isDarkMode}
        activeTab={activeTab}
        statusFilter={statusFilter}
        statusCounts={statusCounts}
        awaitingResponseCount={awaitingResponseCount}
        actionPendingCount={actionPendingCount}
        unverifiedGroupsCount={unverifiedGroupsCount}
        totalGroupsCount={groups.length}
        onKpiClick={handleKpiClick}
      />

      {/* 3. Navigation Tabs Bar (Scrollable on Mobile & Desktop) */}
      <div className={`flex px-3 sm:px-6 border-b items-center gap-3 sm:gap-4 text-xs sm:text-sm font-bold overflow-x-auto backdrop-blur-md ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/95 border-slate-300 shadow-sm'
      }`}>
        <button onClick={() => setActiveTab('ai_hub')} className={`py-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${activeTab === 'ai_hub' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
          <Brain className="w-4 h-4 text-indigo-500" /> Ops Command Brief
        </button>

        <button onClick={() => setActiveTab('complaints')} className={`py-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${activeTab === 'complaints' ? 'border-amber-600 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
          <FileSpreadsheet className="w-4 h-4 text-amber-500" /> Property Complaints Register
          {openComplaintsCount > 0 && (
            <span className="px-1.5 rounded-full bg-amber-600 text-white font-extrabold text-[11px]">
              {openComplaintsCount}
            </span>
          )}
        </button>

        <button onClick={() => setActiveTab('tech')} className={`py-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${activeTab === 'tech' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
          <Wrench className="w-4 h-4 text-indigo-500" /> Technical Issues Register
          {openTechCount > 0 && (
            <span className="px-1.5 rounded-full bg-indigo-600 text-white font-extrabold text-[11px]">
              {openTechCount}
            </span>
          )}
        </button>

        <button onClick={() => setActiveTab('radar')} className={`py-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${activeTab === 'radar' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
          <BellRing className="w-4 h-4 text-rose-500" /> Unanswered & SLA Radar
          {(awaitingResponseCount + actionPendingCount) > 0 && (
            <span className="px-1.5 rounded-full bg-rose-600 text-white font-extrabold text-[11px]">
              {awaitingResponseCount + actionPendingCount}
            </span>
          )}
        </button>

        <button onClick={() => { setActiveTab('properties'); setStatusFilter('ALL'); }} className={`py-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${activeTab === 'properties' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
          <Hotel className="w-4 h-4 text-emerald-500" /> Properties Matrix ({properties.length})
        </button>

        <button onClick={() => setActiveTab('onboarding')} className={`py-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${activeTab === 'onboarding' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
          <Rocket className="w-4 h-4 text-indigo-500" /> Onboarding Pending ({statusCounts.NOT_YET_LIVE || 0})
        </button>

        <button onClick={() => setActiveTab('groups')} className={`py-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${activeTab === 'groups' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
          <FolderGit2 className="w-4 h-4 text-blue-500" /> WA Groups ({groups.length})
          {unverifiedGroupsCount > 0 && (
            <span className="px-1.5 rounded-full bg-amber-500 text-white font-extrabold text-[11px]">
              {unverifiedGroupsCount}
            </span>
          )}
        </button>

        <button onClick={() => setActiveTab('handovers')} className={`py-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${activeTab === 'handovers' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
          <Sparkles className="w-4 h-4 text-purple-500" /> Shift Handovers
        </button>

        <button onClick={() => setActiveTab('stream')} className={`py-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${activeTab === 'stream' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
          <MessageSquare className="w-4 h-4 text-cyan-500" /> Stream ({messages.length})
        </button>

        <button onClick={() => setActiveTab('admin')} className={`py-3 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${activeTab === 'admin' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
          <ShieldCheck className="w-4 h-4 text-emerald-500" /> Admin & Audit
        </button>
      </div>

      {/* 4. Active Tab Content Area */}
      <main className="flex-1 p-4 sm:p-6">
        {activeTab === 'ai_hub' && (
          <AiHubTab 
            isDarkMode={isDarkMode}
            aiAnalysis={aiAnalysis}
            isAnalyzing={isAnalyzing}
            onRunAiAudit={handleRunAiAudit}
            onMarkReviewed={handleMarkReviewed}
            onNavigateTab={(tab, filter) => {
              setActiveTab(tab);
              if (filter) setStatusFilter(filter);
            }}
            onOpenReply={(inc, defaultText) => {
              setReplyTicket({
                ...inc,
                groupId: inc.groupId || inc.sourceGroupId,
                ownerName: inc.raisedBy?.name || inc.reportedBy?.name,
                messageText: inc.originalComplaint || inc.summary
              });
              setReplyDraft(defaultText || '');
            }}
          />
        )}

        {activeTab === 'complaints' && (
          <ComplaintsTab 
            isDarkMode={isDarkMode}
            complaints={complaints}
            properties={properties}
            currentUser={currentUser}
            onUpdateIncident={handleUpdateIncident}
            onOpenReply={(inc, defaultText) => {
              setReplyTicket(inc);
              setReplyDraft(defaultText || '');
            }}
            onOpenSimModal={() => setShowSimModal(true)}
          />
        )}

        {activeTab === 'tech' && (
          <TechWarRoomTab 
            isDarkMode={isDarkMode}
            techIssues={techIssues}
            properties={properties}
            currentUser={currentUser}
            onUpdateIncident={handleUpdateIncident}
            onOpenReply={(inc, defaultText) => {
              setReplyTicket(inc);
              setReplyDraft(defaultText || '');
            }}
            onOpenLogIssue={() => {
              setShowSimModal(true);
              setSimType('TECH_BUG');
              setSimText('Key card encoder and passport ID scanner offline on Kiosk 1. Guest check-in blocked.');
            }}
          />
        )}

        {activeTab === 'radar' && (
          <SlaRadarTab 
            isDarkMode={isDarkMode}
            incidents={incidents}
            properties={properties}
            groups={groups}
            currentUser={currentUser}
            onRefresh={fetchData}
            onOpenSimModal={() => setShowSimModal(true)}
            onReplyIncident={(inc, defaultText) => {
              setReplyTicket(inc);
              setReplyDraft(defaultText || '');
            }}
            onUpdateIncident={handleUpdateIncident}
          />
        )}

        {activeTab === 'properties' && (
          <PropertiesTab 
            isDarkMode={isDarkMode}
            properties={properties}
            groups={groups}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            currentUser={currentUser}
            onSaveProperty={handleSaveProperty}
            onCreateProperty={handleCreateProperty}
            onRediscoverProperties={handleRediscoverProperties}
          />
        )}

        {activeTab === 'onboarding' && (
          <OnboardingTab
            isDarkMode={isDarkMode}
            properties={properties}
            groups={groups}
            currentUser={currentUser}
            onSaveProperty={handleSaveProperty}
            onNavigateToProperties={(filter) => {
              setActiveTab('properties');
              if (filter) setStatusFilter(filter);
            }}
          />
        )}

        {activeTab === 'groups' && (
          <GroupsTab 
            isDarkMode={isDarkMode}
            groups={groups}
            properties={properties}
            currentUser={currentUser}
            onSyncGroups={handleSyncGroups}
            onUpdateGroup={handleUpdateGroup}
          />
        )}

        {activeTab === 'handovers' && (
          <HandoversTab 
            isDarkMode={isDarkMode}
            handovers={handovers}
            copiedHandoverId={copiedHandoverId}
            onGenerateHandover={handleGenerateHandover}
            onCopyHandover={copyToClipboard}
          />
        )}

        {activeTab === 'stream' && (
          <StreamTab 
            isDarkMode={isDarkMode}
            messages={messages}
          />
        )}

        {activeTab === 'admin' && (
          <AdminTab 
            isDarkMode={isDarkMode}
            currentUser={currentUser}
            team={team}
            auditLogs={auditLogs}
            onAddTeamMember={handleAddTeamMember}
            onChangePin={handleChangePin}
            onSyncGroups={handleSyncGroups}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className={`sm:hidden fixed bottom-0 left-0 right-0 border-t z-50 flex items-center justify-around py-2 ${
        isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-300 shadow-lg'
      }`}>
        <button onClick={() => setActiveTab('ai_hub')} className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${activeTab === 'ai_hub' ? 'text-blue-600' : 'text-slate-500'}`}>
          <Brain className="w-4 h-4" /> Brief
        </button>
        <button onClick={() => setActiveTab('complaints')} className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${activeTab === 'complaints' ? 'text-amber-600' : 'text-slate-500'}`}>
          <FileSpreadsheet className="w-4 h-4" /> Complaints
        </button>
        <button onClick={() => setActiveTab('tech')} className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${activeTab === 'tech' ? 'text-indigo-600' : 'text-slate-500'}`}>
          <Wrench className="w-4 h-4" /> Tech
        </button>
        <button onClick={() => { setActiveTab('properties'); setStatusFilter('ALL'); }} className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${activeTab === 'properties' ? 'text-blue-600' : 'text-slate-500'}`}>
          <Hotel className="w-4 h-4" /> Properties
        </button>
        <button onClick={() => setActiveTab('groups')} className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${activeTab === 'groups' ? 'text-blue-600' : 'text-slate-500'}`}>
          <FolderGit2 className="w-4 h-4" /> Groups
        </button>
      </nav>

      {/* 5. Modals */}
      <ReplyModal 
        isDarkMode={isDarkMode}
        replyTicket={replyTicket}
        replyDraft={replyDraft}
        setReplyDraft={setReplyDraft}
        currentUser={currentUser}
        isWaConnected={isWaConnected}
        onClose={() => setReplyTicket(null)}
        onPolishDraft={polishDraftMessage}
        onConfirmSend={() => {
          setReplyTicket(null);
          setReplyDraft('');
          showToast(`✅ Authorized WhatsApp message dispatched & logged!`, 'success');
          fetchData();
        }}
        onCopyDraft={(text) => {
          navigator.clipboard.writeText(text);
          showToast('📋 Draft copied to clipboard!', 'info');
          setReplyTicket(null);
        }}
      />

      <SosModal 
        activeSosAlert={activeSosAlert}
        copiedSosText={copiedSosText}
        onCopySos={() => {
          navigator.clipboard.writeText(activeSosAlert.alertMessage);
          setCopiedSosText(true);
          showToast('🚨 Copied Alert to clipboard!', 'error');
          setTimeout(() => setCopiedSosText(false), 2000);
        }}
        onClose={() => setActiveSosAlert(null)}
      />

      <SimulatorModal 
        showSimModal={showSimModal}
        isDarkMode={isDarkMode}
        properties={properties}
        simPropId={simPropId}
        setSimPropId={setSimPropId}
        simType={simType}
        setSimType={setSimType}
        simText={simText}
        setSimText={setSimText}
        onClose={() => setShowSimModal(false)}
        onSimulate={handleSimulate}
      />

      <QrModal 
        showQrModal={showQrModal}
        isDarkMode={isDarkMode}
        onClose={() => {
          setShowQrModal(false);
          fetchData();
        }}
      />
    </div>
  );
}