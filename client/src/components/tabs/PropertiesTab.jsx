import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Clock,
  HelpCircle,
  Ban,
  Rocket,
  Users,
  X,
  ShieldCheck,
  Table2,
  LayoutGrid,
  Copy,
  Check,
  Download,
  RefreshCw,
  MapPin
} from 'lucide-react';

const STATUS_BADGE_MAP = {
  LIVE: {
    label: '🟢 LIVE / OPERATING NOW',
    cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-400 dark:border-emerald-500/40'
  },
  OUTSIDE_HOURS: {
    label: '🌙 CLOSED / OUTSIDE OPERATING HOURS',
    cls: 'bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-300 border-blue-400 dark:border-blue-500/40'
  },
  NOT_YET_LIVE: {
    label: '🚀 ONBOARDING / NOT YET LIVE',
    cls: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-400 dark:border-indigo-500/40'
  },
  AT_RISK: {
    label: '🚨 AT RISK',
    cls: 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-300 border-rose-400 dark:border-rose-500/40'
  },
  SUSPENDED: {
    label: '⛔ SUSPENDED',
    cls: 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-300 border-slate-400'
  },
  UNKNOWN: {
    label: '❓ NEEDS VERIFICATION',
    cls: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 border-amber-400'
  }
};

export default function PropertiesTab({
  isDarkMode,
  properties = [],
  groups = [],
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  currentUser,
  onSaveProperty,
  onCreateProperty,
  onRediscoverProperties
}) {
  const [coverageFilter, setCoverageFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('TABLE'); // 'TABLE' (Excel-style) or 'GRID'
  const [copiedTable, setCopiedTable] = useState(false);
  const [editingProp, setEditingProp] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formState, setFormState] = useState({
    name: '',
    timezone: 'America/New_York',
    launchStatus: 'LAUNCHED',
    is24Hours: false,
    startTime: '15:00',
    endTime: '07:00',
    scheduleVerified: true,
    coverageType: 'SHARED',
    assignedTeamOrAgents: 'Shared Kiotel Shift Team',
    coverageConfirmed: true,
    kioskCount: 1,
    cluster: 'US-East',
    manualOverrideStatus: ''
  });

  const openEditModal = (prop) => {
    setEditingProp(prop);
    const sched = prop.operatingSchedule || prop.schedule || {};
    setFormState({
      name: prop.name || '',
      timezone: prop.timezone || 'America/New_York',
      launchStatus: prop.launchStatus || 'LAUNCHED',
      is24Hours: Boolean(sched.is24Hours || sched.type === '24_7'),
      startTime: sched.startTime || '15:00',
      endTime: sched.endTime || '07:00',
      scheduleVerified: true,
      coverageType: prop.coverage?.type === 'UNKNOWN' ? 'SHARED' : (prop.coverage?.type || 'SHARED'),
      assignedTeamOrAgents:
        (prop.coverage?.assignedAgents || []).join(', ') ||
        prop.coverage?.assignedTeam ||
        'Shared Kiotel Shift Team',
      coverageConfirmed: true,
      kioskCount: prop.kioskCount || 1,
      cluster: prop.cluster || 'US-East',
      manualOverrideStatus: prop.manualStatusOverride || prop.manualOverride?.status || ''
    });
  };

  const openNewPropertyModal = () => {
    setEditingProp(null);
    setFormState({
      name: '',
      timezone: 'America/New_York',
      launchStatus: 'LAUNCHED',
      is24Hours: true,
      startTime: '00:00',
      endTime: '23:59',
      scheduleVerified: true,
      coverageType: 'SHARED',
      assignedTeamOrAgents: 'Shared 24/7 Pod',
      coverageConfirmed: true,
      kioskCount: 1,
      cluster: 'US-East',
      manualOverrideStatus: ''
    });
    setShowCreateModal(true);
  };

  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: formState.name,
      timezone: formState.timezone,
      launchStatus: formState.launchStatus,
      operatingSchedule: {
        type: formState.is24Hours ? '24_7' : 'SCHEDULED',
        is24Hours: formState.is24Hours,
        startTime: formState.startTime,
        endTime: formState.endTime,
        overnight: !formState.is24Hours && formState.startTime > formState.endTime,
        verified: Boolean(formState.scheduleVerified)
      },
      coverage: {
        type: formState.coverageType,
        assignedAgents: formState.assignedTeamOrAgents.split(',').map(s => s.trim()).filter(Boolean),
        confirmed: Boolean(formState.coverageConfirmed),
        coverageConfirmed: Boolean(formState.coverageConfirmed),
        lastConfirmedAt: new Date().toISOString()
      },
      kioskCount: Number(formState.kioskCount) || 1,
      cluster: formState.cluster,
      humanVerified: true,
      updatedBy: currentUser,
      evidenceNote: `Configured and verified by ${currentUser}`
    };

    if (formState.manualOverrideStatus) {
      payload.manualStatusOverride = formState.manualOverrideStatus;
      payload.manualOverride = {
        active: true,
        status: formState.manualOverrideStatus,
        reason: `Manually set to ${formState.manualOverrideStatus} by ${currentUser}`,
        updatedBy: currentUser,
        updatedAt: new Date().toISOString()
      };
    } else {
      payload.manualStatusOverride = null;
      payload.manualOverride = { active: false };
    }

    if (editingProp) {
      await onSaveProperty(editingProp.id, payload);
      setEditingProp(null);
    } else if (onCreateProperty) {
      await onCreateProperty(payload);
      setShowCreateModal(false);
    }
  };

  // Counts by computed status
  const counts = useMemo(() => ({
    ALL: properties.length,
    LIVE: properties.filter(p => (p.evaluation?.status || p.operationalStatus) === 'LIVE').length,
    OUTSIDE_HOURS: properties.filter(p => (p.evaluation?.status || p.operationalStatus) === 'OUTSIDE_HOURS').length,
    NOT_YET_LIVE: properties.filter(p => (p.evaluation?.status || p.operationalStatus) === 'NOT_YET_LIVE').length,
    AT_RISK: properties.filter(p => (p.evaluation?.status || p.operationalStatus) === 'AT_RISK').length,
    SUSPENDED: properties.filter(p => (p.evaluation?.status || p.operationalStatus) === 'SUSPENDED').length,
    UNKNOWN: properties.filter(p => (p.evaluation?.status || p.operationalStatus) === 'UNKNOWN').length
  }), [properties]);

  const filteredList = useMemo(() => {
    return properties.filter((p) => {
      const st = p.evaluation?.status || p.operationalStatus || 'UNKNOWN';
      if (statusFilter !== 'ALL' && st !== statusFilter) return false;
      if (coverageFilter !== 'ALL' && (p.coverage?.type || 'UNKNOWN') !== coverageFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchId = (p.id || '').toLowerCase().includes(q);
        const matchCode = (p.propertyCode || '').toLowerCase().includes(q);
        const matchTz = (p.timezone || '').toLowerCase().includes(q);
        const matchCluster = (p.cluster || '').toLowerCase().includes(q);
        if (!matchName && !matchId && !matchCode && !matchTz && !matchCluster) return false;
      }
      return true;
    });
  }, [properties, statusFilter, coverageFilter, searchQuery]);

  const getRowsForExport = () => {
    const headers = [
      'Property ID',
      'Property Code',
      'Hotel / Property Name',
      'Current Operational Status',
      'Region / Cluster',
      'IANA Timezone',
      'Property Local Time',
      'Operating Window / Schedule',
      'Coverage Mode',
      'Assigned Agents / Team',
      'Linked WA Groups',
      'Status Basis / Reason',
      'Latest Operational Evidence',
      'Last Evidence Timestamp'
    ];

    const rows = filteredList.map(p => {
      const evalObj = p.evaluation || {};
      const st = evalObj.status || p.operationalStatus || 'UNKNOWN';
      const sched = p.operatingSchedule || p.schedule || {};
      const schedStr = sched.is24Hours || sched.type === '24_7'
        ? '24/7 Operating'
        : `${sched.startTime || '15:00'} - ${sched.endTime || '07:00'}`;
      const agentsStr = (p.coverage?.assignedAgents || []).join(', ') || p.coverage?.assignedTeam || 'Shared Shift Team';
      const ev = p.latestEvidence || p.lastEvidence || {};

      return [
        p.id || '',
        p.propertyCode || 'N/A',
        p.name || '',
        st,
        p.cluster || 'US',
        p.timezone || '',
        evalObj.localTime || '',
        schedStr,
        p.coverage?.type || 'SHARED',
        agentsStr,
        (p.linkedGroupIds || []).length,
        evalObj.reason || '',
        ev.summary || '',
        ev.timestamp ? new Date(ev.timestamp).toLocaleString() : ''
      ];
    });

    return { headers, rows };
  };

  const handleCopyForExcel = () => {
    const { headers, rows } = getRowsForExport();
    const tsv = [
      headers.join('\t'),
      ...rows.map(r => r.map(cell => String(cell ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t'))
    ].join('\n');
    navigator.clipboard.writeText(tsv);
    setCopiedTable(true);
    setTimeout(() => setCopiedTable(false), 2500);
  };

  const handleExportCsv = () => {
    const { headers, rows } = getRowsForExport();
    const escapeCsv = val => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map(r => r.map(escapeCsv).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kiotel_Properties_${statusFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* 4-Card Quick Operational Breakdown Banner (Live vs Closed Outside Hours vs Onboarding vs At Risk) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => setStatusFilter(statusFilter === 'LIVE' ? 'ALL' : 'LIVE')}
          className={`text-left p-4 rounded-2xl border transition-all ${
            statusFilter === 'LIVE'
              ? 'ring-2 ring-emerald-500 bg-emerald-500/15 border-emerald-500'
              : isDarkMode
              ? 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/50'
              : 'bg-white border-slate-300 shadow-sm hover:border-emerald-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              🟢 Live Operating Kiosks Now
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{counts.LIVE}</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
            Currently inside active operating window with verified shift coverage.
          </p>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'OUTSIDE_HOURS' ? 'ALL' : 'OUTSIDE_HOURS')}
          className={`text-left p-4 rounded-2xl border transition-all ${
            statusFilter === 'OUTSIDE_HOURS'
              ? 'ring-2 ring-blue-500 bg-blue-500/15 border-blue-500'
              : isDarkMode
              ? 'bg-slate-900/80 border-slate-800 hover:border-blue-500/50'
              : 'bg-white border-slate-300 shadow-sm hover:border-blue-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              🌙 Closed Right Now (Outside Hours)
            </span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{counts.OUTSIDE_HOURS}</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
            Operational properties whose local shift window has not started yet or has ended.
          </p>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'NOT_YET_LIVE' ? 'ALL' : 'NOT_YET_LIVE')}
          className={`text-left p-4 rounded-2xl border transition-all ${
            statusFilter === 'NOT_YET_LIVE'
              ? 'ring-2 ring-indigo-500 bg-indigo-500/15 border-indigo-500'
              : isDarkMode
              ? 'bg-slate-900/80 border-slate-800 hover:border-indigo-500/50'
              : 'bg-white border-slate-300 shadow-sm hover:border-indigo-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              🚀 Onboarding / Pending Go-Live
            </span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{counts.NOT_YET_LIVE}</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
            WhatsApp group created; awaiting kiosk installation or first live shift.
          </p>
        </button>

        <button
          onClick={() => setStatusFilter(statusFilter === 'AT_RISK' ? 'ALL' : 'AT_RISK')}
          className={`text-left p-4 rounded-2xl border transition-all ${
            statusFilter === 'AT_RISK'
              ? 'ring-2 ring-rose-500 bg-rose-500/15 border-rose-500'
              : isDarkMode
              ? 'bg-slate-900/80 border-slate-800 hover:border-rose-500/50'
              : 'bg-white border-slate-300 shadow-sm hover:border-rose-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              🚨 At Risk / Active Issue
            </span>
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{counts.AT_RISK}</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
            Unresolved technical issue, complaint, or coverage gap affecting operations.
          </p>
        </button>
      </div>

      {/* Top Toolbar */}
      <div className={`flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border ${
        isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
      }`}>
        <div className={`flex items-center gap-2 flex-1 min-w-[220px] max-w-md border px-3 py-1.5 rounded-lg ${
          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
        }`}>
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by hotel name, 4-digit code (e.g. 1230), state, or timezone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none w-full font-medium"
          />
        </div>

        {/* View Toggle + Excel Copy/Export + Add Property */}
        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex items-center rounded-xl p-0.5 border ${
            isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
          }`}>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all ${
                viewMode === 'TABLE'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" /> Excel Table
            </button>
            <button
              onClick={() => setViewMode('GRID')}
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all ${
                viewMode === 'GRID'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
          </div>

          <button
            onClick={handleCopyForExcel}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all ${
              copiedTable
                ? 'bg-emerald-600 text-white border-emerald-500'
                : isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
            }`}
          >
            {copiedTable ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-blue-500" />}
            {copiedTable ? 'Copied for Excel!' : 'Copy for Excel'}
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>

          {onRediscoverProperties && (
            <button
              onClick={onRediscoverProperties}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
                  : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border-cyan-300'
              }`}
              title="Re-scan synced WhatsApp groups & messages to refresh property statuses"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sync from WA
            </button>
          )}

          <button
            onClick={openNewPropertyModal}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Property
          </button>
        </div>
      </div>

      {/* 6 Status Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
        {[
          { id: 'ALL', label: `All Properties (${counts.ALL})` },
          { id: 'LIVE', label: `🟢 Live / Operating Now (${counts.LIVE})` },
          { id: 'OUTSIDE_HOURS', label: `🌙 Closed / Outside Hours (${counts.OUTSIDE_HOURS})` },
          { id: 'NOT_YET_LIVE', label: `🚀 Onboarding / Not Yet Live (${counts.NOT_YET_LIVE})` },
          { id: 'AT_RISK', label: `🚨 At Risk (${counts.AT_RISK})` },
          { id: 'SUSPENDED', label: `⛔ Suspended (${counts.SUSPENDED})` },
          { id: 'UNKNOWN', label: `❓ Needs Verification (${counts.UNKNOWN})` }
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setStatusFilter(s.id)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              statusFilter === s.id
                ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                : isDarkMode
                ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 shadow-sm'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filteredList.length === 0 ? (
        <div className={`border border-dashed rounded-2xl p-10 text-center ${
          isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-300'
        }`}>
          <HelpCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
            No Properties Match This Status Filter
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg mx-auto mt-1">
            Switch the status filter pill above to view all {counts.ALL} discovered Kiotel properties.
          </p>
        </div>
      ) : viewMode === 'TABLE' ? (
        /* Excel-Style Spreadsheet View */
        <div className={`border rounded-2xl overflow-hidden ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300 shadow-md'
        }`}>
          <div className={`px-4 py-2.5 border-b flex items-center justify-between text-xs font-extrabold ${
            isDarkMode ? 'bg-slate-950/90 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-800'
          }`}>
            <div className="flex items-center gap-2">
              <Table2 className="w-4 h-4 text-blue-500" />
              <span>PROPERTIES OPERATIONAL REGISTER ({filteredList.length} ROWS)</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Real-time evaluation across US local timezones, operating schedules & WhatsApp shift evidence
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={`border-b text-[11px] uppercase tracking-wider font-extrabold ${
                  isDarkMode
                    ? 'bg-slate-950 text-slate-300 border-slate-800'
                    : 'bg-slate-200/80 text-slate-800 border-slate-300'
                }`}>
                  <th className="py-3 px-3 border-r border-slate-300/60 dark:border-slate-800 w-10 text-center">#</th>
                  <th className="py-3 px-3 border-r border-slate-300/60 dark:border-slate-800 whitespace-nowrap">Code / ID</th>
                  <th className="py-3 px-3 border-r border-slate-300/60 dark:border-slate-800 min-w-[220px]">Property / Hotel Name</th>
                  <th className="py-3 px-3 border-r border-slate-300/60 dark:border-slate-800 whitespace-nowrap">Real-Time Status</th>
                  <th className="py-3 px-3 border-r border-slate-300/60 dark:border-slate-800 whitespace-nowrap">Local Time & Timezone</th>
                  <th className="py-3 px-3 border-r border-slate-300/60 dark:border-slate-800 whitespace-nowrap">Operating Window</th>
                  <th className="py-3 px-3 border-r border-slate-300/60 dark:border-slate-800 min-w-[160px]">Coverage & Active Agent</th>
                  <th className="py-3 px-3 border-r border-slate-300/60 dark:border-slate-800 min-w-[250px]">Status Basis & Latest WA Evidence</th>
                  <th className="py-3 px-3 whitespace-nowrap text-right">Configure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {filteredList.map((p, idx) => {
                  const evalObj = p.evaluation || {};
                  const st = evalObj.status || p.operationalStatus || 'UNKNOWN';
                  const badge = STATUS_BADGE_MAP[st] || STATUS_BADGE_MAP.UNKNOWN;
                  const sched = p.operatingSchedule || p.schedule || {};
                  const is24h = sched.is24Hours || sched.type === '24_7';
                  const ev = p.latestEvidence || p.lastEvidence;

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isDarkMode ? 'hover:bg-slate-800/50 text-slate-200' : 'hover:bg-blue-50/40 text-slate-900'
                      }`}
                    >
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-center font-mono font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 font-mono font-extrabold whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                          {p.propertyCode ? `#${p.propertyCode}` : p.id}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">
                        <div className="font-extrabold text-slate-900 dark:text-white">{p.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3 h-3 text-blue-500" />
                          <span>{p.cluster || 'US'}</span>
                          <span>•</span>
                          <span>{(p.linkedGroupIds || []).length} WA Group(s)</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border inline-block ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 whitespace-nowrap">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {evalObj.localTime || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {p.timezone || 'America/New_York'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold ${
                          is24h
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300'
                            : 'bg-blue-100 text-blue-900 dark:bg-blue-950/70 dark:text-blue-300'
                        }`}>
                          {is24h ? '24/7 Operating' : `${sched.startTime || '15:00'} - ${sched.endTime || '07:00'}`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {p.coverage?.type || 'SHARED'} ({p.coverage?.confirmed || p.coverage?.coverageConfirmed ? 'Confirmed' : 'Unconfirmed'})
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                          {(p.coverage?.assignedAgents || []).join(', ') || p.coverage?.assignedTeam || 'Shared Shift Team'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {evalObj.reason || 'Evaluated from schedule & group activity'}
                        </div>
                        {ev && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                            Latest: {ev.summary} ({ev.timestamp ? new Date(ev.timestamp).toLocaleString() : ''})
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => openEditModal(p)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[11px] inline-flex items-center gap-1 shadow-sm"
                        >
                          <Settings className="w-3.5 h-3.5" /> Edit / Verify
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map(p => {
            const evalObj = p.evaluation || {};
            const st = evalObj.status || p.operationalStatus || 'UNKNOWN';
            const badge = STATUS_BADGE_MAP[st] || STATUS_BADGE_MAP.UNKNOWN;
            const missingInfo = evalObj.missingInfo || [];
            const sched = p.operatingSchedule || p.schedule || {};

            return (
              <div
                key={p.id}
                className={`border rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-md ${
                  isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-mono font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/40">
                      {p.propertyCode ? `#${p.propertyCode} (${p.id})` : p.id}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">{p.name}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Timezone: <b>{p.timezone || 'Unverified'}</b> {evalObj.localTime ? `(Local: ${evalObj.localTime})` : ''}
                    </p>
                  </div>

                  {/* Schedule & Coverage Box */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-semibold">Operating Window</span>
                      <b className="text-slate-800 dark:text-slate-200">
                        {sched.verified
                          ? (sched.is24Hours || sched.type === '24_7' ? '24/7 Operating' : `${sched.startTime} - ${sched.endTime}`)
                          : '❓ Unverified'}
                      </b>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-semibold">Staffing / Coverage</span>
                      <b className="text-slate-800 dark:text-slate-200">
                        {p.coverage?.type || 'SHARED'} ({p.coverage?.confirmed || p.coverage?.coverageConfirmed ? 'Confirmed' : 'Unconfirmed'})
                      </b>
                    </div>
                  </div>

                  {/* Status Reason & Latest Evidence */}
                  <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] space-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">
                      Status Basis: {evalObj.reason || 'Awaiting verification'}
                    </span>
                    {missingInfo.length > 0 && (
                      <ul className="list-disc list-inside text-[10px] text-amber-700 dark:text-amber-400 space-y-0.5">
                        {missingInfo.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    )}
                    {(p.latestEvidence || p.lastEvidence) && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block pt-1">
                        Latest Evidence: {(p.latestEvidence || p.lastEvidence).summary} ({new Date((p.latestEvidence || p.lastEvidence).timestamp).toLocaleString()})
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    Linked WA Groups: <b>{(p.linkedGroupIds || []).length}</b>
                  </span>
                  <button
                    onClick={() => openEditModal(p)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1"
                  >
                    <Settings className="w-3.5 h-3.5" /> Configure / Verify
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Configure / Create Property Modal */}
      {(editingProp || showCreateModal) && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold">
                  {editingProp ? `Verify & Configure ${editingProp.name}` : 'Add & Verify New Hotel Property'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Establish verified operating schedule, timezone, launch state, and shared/dedicated coverage.
                </p>
              </div>
              <button
                onClick={() => { setEditingProp(null); setShowCreateModal(false); }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Property Name:</label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Launch / Service State:</label>
                  <select
                    value={formState.launchStatus}
                    onChange={(e) => setFormState({ ...formState, launchStatus: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="LAUNCHED">Launched (In Service)</option>
                    <option value="NOT_YET_LIVE">Not Yet Live (Onboarding)</option>
                    <option value="SUSPENDED">Suspended / Paused</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">Property IANA Timezone:</label>
                  <select
                    value={formState.timezone}
                    onChange={(e) => setFormState({ ...formState, timezone: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                    <option value="America/Denver">America/Denver (MST/MDT)</option>
                    <option value="America/Phoenix">America/Phoenix (MST - Arizona)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>

              {/* Operating Schedule */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Operating Hours Schedule</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formState.is24Hours}
                      onChange={(e) => setFormState({ ...formState, is24Hours: e.target.checked })}
                    />
                    <span className="font-semibold">24/7 Coverage</span>
                  </label>
                </div>

                {!formState.is24Hours && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 block">Start Time (supports overnight):</label>
                      <input
                        type="time"
                        value={formState.startTime}
                        onChange={(e) => setFormState({ ...formState, startTime: e.target.value })}
                        className={`w-full px-2.5 py-1.5 rounded border ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block">End Time:</label>
                      <input
                        type="time"
                        value={formState.endTime}
                        onChange={(e) => setFormState({ ...formState, endTime: e.target.value })}
                        className={`w-full px-2.5 py-1.5 rounded border ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Coverage Type */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold block mb-1">Coverage Mode:</label>
                    <select
                      value={formState.coverageType}
                      onChange={(e) => setFormState({ ...formState, coverageType: e.target.value })}
                      className={`w-full px-2.5 py-1.5 rounded border ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                      }`}
                    >
                      <option value="SHARED">Shared Shift Pod / Team</option>
                      <option value="DEDICATED">Dedicated Agent(s)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Assigned Pod / Agent Names:</label>
                    <input
                      type="text"
                      value={formState.assignedTeamOrAgents}
                      onChange={(e) => setFormState({ ...formState, assignedTeamOrAgents: e.target.value })}
                      className={`w-full px-2.5 py-1.5 rounded border ${
                        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={formState.coverageConfirmed}
                    onChange={(e) => setFormState({ ...formState, coverageConfirmed: e.target.checked })}
                  />
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Confirm that required shift coverage is active and verified
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setEditingProp(null); setShowCreateModal(false); }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <ShieldCheck className="w-4 h-4" /> Save & Verify Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
