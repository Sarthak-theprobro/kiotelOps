import React, { useState } from 'react';
import { 
  Wrench, Copy, Download, Search, Filter, ArrowUpDown, 
  X, Edit3, AlertTriangle, CheckCircle2, Plus 
} from 'lucide-react';

const LIFECYCLE_STATES = [
  { id: 'ALL', label: 'All Statuses' },
  { id: 'AWAITING_RESPONSE', label: '🔴 Awaiting Response' },
  { id: 'RESPONSE_PROVIDED_ACTION_PENDING', label: '🟠 Acknowledged • Action Pending' },
  { id: 'ACTION_IN_PROGRESS', label: '🔵 Troubleshooting In Progress' },
  { id: 'WAITING_EXTERNAL', label: '🟡 Waiting on Property / Vendor / ISP' },
  { id: 'AWAITING_CONFIRMATION', label: '🟣 Awaiting Confirmation' },
  { id: 'REOPENED', label: '🚨 Reopened (Recurring Failure)' },
  { id: 'RESOLVED_VERIFIED', label: '🟢 Resolved (Verified Evidence)' },
  { id: 'UNABLE_TO_VERIFY', label: '⚪ Unable to Verify' }
];

const EQUIPMENT_SYSTEMS = [
  'ALL',
  'Kiosk Terminal / Kiosk Software',
  'Encoder / ID Scanner',
  'Printer / Cash & Card Dispenser',
  'Router / Network Connectivity',
  'Tablet / PC / Audio-Video Peripheral',
  'PMS Integration / Reservations Software',
  'Login / Access / Configuration'
];

const SEVERITY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export default function TechWarRoomTab({
  isDarkMode,
  techIssues = [],
  properties = [],
  currentUser,
  onUpdateIncident,
  onOpenReply,
  onOpenLogIssue
}) {
  const [dateRange, setDateRange] = useState('ALL');
  const [propertyFilter, setPropertyFilter] = useState('ALL');
  const [equipmentFilter, setEquipmentFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('OLDEST_UNRESOLVED');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedTable, setCopiedTable] = useState(false);

  // Selected row modal state
  const [selectedTech, setSelectedTech] = useState(null);
  const [techAssignee, setTechAssignee] = useState('');
  const [workaroundInput, setWorkaroundInput] = useState('');
  const [troubleshootingNote, setTroubleshootingNote] = useState('');
  const [pendingInput, setPendingInput] = useState('');
  const [resolutionEvidenceInput, setResolutionEvidenceInput] = useState('');

  const nowMs = Date.now();

  const filteredIssues = techIssues
    .filter((item) => {
      const raisedMs = item.raisedAt ? new Date(item.raisedAt).getTime() : nowMs;
      if (dateRange === '24H' && nowMs - raisedMs > 24 * 60 * 60 * 1000) return false;
      if (dateRange === '48H' && nowMs - raisedMs > 48 * 60 * 60 * 1000) return false;
      if (dateRange === '7D' && nowMs - raisedMs > 7 * 24 * 60 * 60 * 1000) return false;

      if (propertyFilter !== 'ALL' && item.propertyId !== propertyFilter) return false;
      if (equipmentFilter !== 'ALL' && item.equipmentSystem !== equipmentFilter) return false;
      if (shiftFilter !== 'ALL') {
        const shiftStr = (item.reportingShift || 'Unknown').toLowerCase();
        if (!shiftStr.includes(shiftFilter.toLowerCase())) return false;
      }
      const sev = item.severity || item.seriousness?.severity || 'MEDIUM';
      if (severityFilter !== 'ALL' && sev !== severityFilter) return false;
      if (statusFilter !== 'ALL' && item.resolutionState !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = [
          item.id,
          item.propertyName,
          item.equipmentSystem,
          item.originalDescription,
          item.summary,
          item.reporterName,
          item.assignedTechnician,
          item.workaround,
          item.groupName
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aResolved = a.resolutionState === 'RESOLVED_VERIFIED' ? 1 : 0;
      const bResolved = b.resolutionState === 'RESOLVED_VERIFIED' ? 1 : 0;
      const aTime = new Date(a.raisedAt || 0).getTime();
      const bTime = new Date(b.raisedAt || 0).getTime();
      const aSev = SEVERITY_RANK[a.severity || a.seriousness?.severity || 'MEDIUM'] || 1;
      const bSev = SEVERITY_RANK[b.severity || b.seriousness?.severity || 'MEDIUM'] || 1;

      if (sortBy === 'OLDEST_UNRESOLVED') {
        if (aResolved !== bResolved) return aResolved - bResolved;
        return aTime - bTime;
      }
      if (sortBy === 'NEWEST') return bTime - aTime;
      if (sortBy === 'SEVERITY') {
        if (bSev !== aSev) return bSev - aSev;
        return aTime - bTime;
      }
      if (sortBy === 'TIME_OPEN') return (b.timeOpenMs || 0) - (a.timeOpenMs || 0);
      return bTime - aTime;
    });

  const buildSpreadsheetHeaders = () => [
    'Tech Issue ID',
    'Property Name',
    'Equipment / System Affected',
    'Original Issue Description',
    'Reporter Name',
    'Reporter Role',
    'Original Timestamp',
    'Property Local Time',
    'Reporting Shift',
    'Source Group(s)',
    'Source Msg Ref',
    'Severity',
    'Affects Guest Check-In?',
    'Available Workaround',
    'Assigned Technician / Team',
    'Troubleshooting Performed',
    'Current Status',
    'What Remains Pending',
    'Latest Update & By Whom',
    'Time Open',
    'Resolution Evidence & Confirmation'
  ];

  const buildRowCells = (r) => [
    r.id || '',
    r.propertyName || 'Unmapped',
    r.equipmentSystem || r.category || 'Technical System',
    (r.originalDescription || r.title || '').replace(/[\r\n\t]+/g, ' '),
    r.reporterName || r.raisedBy?.name || 'Unknown',
    r.raisedBy?.role || 'UNKNOWN',
    r.raisedAt ? new Date(r.raisedAt).toLocaleString() : '',
    r.propertyLocalTime || 'Unknown',
    r.reportingShift || 'Unknown',
    (r.sourceGroups || [{ groupName: r.groupName }]).map(g => g.groupName).join(' + '),
    r.sourceMessageId || '',
    r.severity || r.seriousness?.severity || 'MEDIUM',
    r.affectsCheckIn ? 'YES (Check-In Impacted)' : 'No',
    (r.workaround || 'None recorded').replace(/[\r\n\t]+/g, ' '),
    r.assignedTechnician || r.actionAssignedTo || 'Unassigned',
    ((r.troubleshootingLog || []).join(' | ') || 'Pending tech log').replace(/[\r\n\t]+/g, ' '),
    r.resolutionState || 'AWAITING_RESPONSE',
    (r.pendingItems || 'Pending verification').replace(/[\r\n\t]+/g, ' '),
    `${r.lastUpdatedBy || 'Unknown'} (${r.latestUpdateAt ? new Date(r.latestUpdateAt).toLocaleTimeString() : ''})`,
    r.timeOpenFormatted || '0m',
    `${r.confirmationStatus || 'UNCONFIRMED'}: ${(r.resolutionEvidence || '').replace(/[\r\n\t]+/g, ' ')}`
  ];

  const handleCopyForExcel = () => {
    const headers = buildSpreadsheetHeaders().join('\t');
    const rows = filteredIssues.map(r => buildRowCells(r).join('\t'));
    navigator.clipboard.writeText([headers, ...rows].join('\n'));
    setCopiedTable(true);
    setTimeout(() => setCopiedTable(false), 2500);
  };

  const handleExportCsv = () => {
    const headers = buildSpreadsheetHeaders();
    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      headers.map(escapeCsv).join(','),
      ...filteredIssues.map(r => buildRowCells(r).map(escapeCsv).join(','))
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Kiotel_Technical_Issues_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openTechModal = (row) => {
    setSelectedTech(row);
    setTechAssignee(row.assignedTechnician || '');
    setWorkaroundInput(row.workaround || '');
    setPendingInput(row.pendingItems || '');
    setResolutionEvidenceInput(row.resolutionEvidence || '');
    setTroubleshootingNote('');
  };

  const handleSaveTechUpdate = async (newState) => {
    if (!selectedTech || !onUpdateIncident) return;
    await onUpdateIncident(selectedTech.id, {
      resolutionState: newState || selectedTech.resolutionState,
      assignedTechnician: techAssignee.trim() || selectedTech.assignedTechnician,
      workaround: workaroundInput.trim() || selectedTech.workaround,
      pendingItems: pendingInput.trim() || selectedTech.pendingItems,
      resolutionEvidence: resolutionEvidenceInput.trim() || selectedTech.resolutionEvidence,
      troubleshootingNote: troubleshootingNote.trim(),
      updatedBy: currentUser
    });
    setSelectedTech(null);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className={`cyber-card border rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 ${
        isDarkMode
          ? 'bg-slate-900/85 border-slate-800 text-white shadow-lg shadow-indigo-950/20'
          : 'bg-white/95 border-slate-300 text-slate-900 shadow-md'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Technical Issues Register — Hardware, Kiosks, Network & PMS ({filteredIssues.length})
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Tracks kiosks, encoders, ID scanners, printers, routers, tablets/PCs, and PMS integrations across all groups until verified resolved.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyForExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedTable ? '✅ Copied for Excel / Sheets!' : 'Copy Table for Excel / Sheets'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-indigo-500" />
            <span>Export CSV / Excel</span>
          </button>

          {onOpenLogIssue && (
            <button
              onClick={onOpenLogIssue}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-3.5 h-3.5" /> Test Tech Fault
            </button>
          )}
        </div>
      </div>

      {/* Filters & Sorting Bar */}
      <div className={`cyber-card border rounded-2xl p-3.5 space-y-3 ${
        isDarkMode ? 'bg-slate-900/80 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
      }`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
            {[
              { id: '24H', label: 'Last 24h' },
              { id: '48H', label: 'Last 48h' },
              { id: '7D', label: 'Last 7d' },
              { id: 'ALL', label: 'All History' }
            ].map(dr => (
              <button
                key={dr.id}
                onClick={() => setDateRange(dr.id)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  dateRange === dr.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {dr.label}
              </button>
            ))}
          </div>

          <div className={`flex items-center gap-2 flex-1 min-w-[200px] border px-3 py-1.5 rounded-xl ${
            isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
          }`}>
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Tech ID, equipment, property, technician, or symptom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none w-full"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`px-2.5 py-1.5 rounded-xl border font-semibold ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="OLDEST_UNRESOLVED">Sort: Oldest Unresolved First</option>
              <option value="NEWEST">Sort: Newest Issue First</option>
              <option value="SEVERITY">Sort: Highest Severity First</option>
              <option value="TIME_OPEN">Sort: Longest Time Open</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />

          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-lg border font-medium ${
              isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            <option value="ALL">All Properties</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
            ))}
          </select>

          <select
            value={equipmentFilter}
            onChange={(e) => setEquipmentFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-lg border font-medium ${
              isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            {EQUIPMENT_SYSTEMS.map(eq => (
              <option key={eq} value={eq}>{eq === 'ALL' ? 'All Equipment / Systems' : eq}</option>
            ))}
          </select>

          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-lg border font-medium ${
              isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            <option value="ALL">All Shifts</option>
            <option value="Morning">Morning Shift</option>
            <option value="Evening">Evening Shift</option>
            <option value="Night">Night Shift</option>
            <option value="Unknown">Unknown Shift</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-lg border font-medium ${
              isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-lg border font-medium ${
              isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            {LIFECYCLE_STATES.map(st => (
              <option key={st.id} value={st.id}>{st.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Excel-Style Spreadsheet Table */}
      <div className={`cyber-card border rounded-2xl overflow-hidden shadow-md ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className={`border-b uppercase text-[10px] font-extrabold tracking-wider ${
                isDarkMode
                  ? 'bg-slate-950 text-slate-300 border-slate-800'
                  : 'bg-slate-100 text-slate-800 border-slate-300'
              }`}>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Tech ID</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Property</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Equipment / System</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 min-w-[220px]">Issue Description</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Reporter & Shift</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Source Group(s)</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Severity & Impact</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Assigned Tech</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 min-w-[180px]">Troubleshooting & Workaround</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 min-w-[180px]">Status & Pending</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Open Time</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    No technical issues match the current filter. Hardware, kiosk, scanner, printer, router, and PMS issues from WhatsApp groups appear here automatically.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((row) => {
                  const sev = row.severity || row.seriousness?.severity || 'MEDIUM';
                  const isResolved = row.resolutionState === 'RESOLVED_VERIFIED';
                  const isReopened = row.resolutionState === 'REOPENED';

                  return (
                    <tr
                      key={row.id}
                      onClick={() => openTechModal(row)}
                      className={`cursor-pointer transition-colors ${
                        isDarkMode
                          ? 'hover:bg-indigo-950/30 text-slate-200'
                          : 'hover:bg-indigo-50/70 text-slate-900'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        {row.id}
                        {(row.isRecurring || row.reopenCount > 0) && (
                          <span className="block text-[9px] text-rose-600 dark:text-rose-400 font-sans">
                            ↻ Recurring ({row.reopenCount || row.occurrenceCount}x)
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-bold border-r border-slate-200 dark:border-slate-800">
                        <div className="text-slate-900 dark:text-white">{row.propertyName}</div>
                        <span className="text-[10px] font-mono text-slate-500">{row.propertyLocalTime || 'Local tz unverified'}</span>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">
                        <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-[10px] border border-indigo-300 dark:border-indigo-800">
                          {row.equipmentSystem || row.category}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 max-w-xs">
                        <div className="font-mono text-[11px] font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                          "{row.originalDescription || row.title}"
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Logged: {row.raisedAt ? new Date(row.raisedAt).toLocaleString() : 'N/A'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap text-[11px]">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {row.reporterName || row.raisedBy?.name || 'Unknown'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Shift: {row.reportingShift || 'Unknown'}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-[11px]">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                          {(row.sourceGroups || [{ groupName: row.groupName }]).map(g => g.groupName).join(', ')}
                        </div>
                        <span className="text-[9px] font-mono text-slate-500">
                          {row.supportingMessages?.length || 1} msg(s)
                        </span>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          sev === 'CRITICAL' ? 'bg-rose-600 text-white' :
                          sev === 'HIGH' ? 'bg-amber-500 text-white' :
                          sev === 'MEDIUM' ? 'bg-blue-600 text-white' :
                          'bg-slate-600 text-white'
                        }`}>
                          {sev}
                        </span>
                        <div className={`text-[10px] font-bold mt-1 ${
                          row.affectsCheckIn ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'
                        }`}>
                          {row.affectsCheckIn ? '⚠️ Blocks Check-In' : 'Check-in OK'}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-[11px]">
                        <b className="text-slate-900 dark:text-white">{row.assignedTechnician || 'Unassigned'}</b>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-[10px] max-w-[200px]">
                        <div className="text-slate-700 dark:text-slate-300 line-clamp-1">
                          <b>Workaround:</b> {row.workaround || 'None'}
                        </div>
                        <div className="text-slate-500 line-clamp-2 mt-0.5">
                          <b>Steps:</b> {(row.troubleshootingLog || []).slice(-1)[0] || 'Awaiting tech action'}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 max-w-[200px]">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-1 ${
                          isResolved
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-400/40'
                            : isReopened
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-400/40'
                        }`}>
                          {row.resolutionState}
                        </span>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 line-clamp-2">
                          Pending: {row.pendingItems}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap font-mono font-bold text-slate-800 dark:text-slate-200">
                        {row.timeOpenFormatted || '0m'}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openTechModal(row)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-[11px]"
                          >
                            Log / View
                          </button>
                          {onOpenReply && (
                            <button
                              onClick={() => onOpenReply({
                                ...row,
                                groupId: row.groupId || row.sourceGroupId,
                                ownerName: row.reporterName || 'Property Contact',
                                messageText: row.originalDescription || row.summary
                              }, '')}
                              className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px]"
                            >
                              Reply
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Technical Issue Lifecycle & Troubleshooting Modal */}
      {selectedTech && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-extrabold text-indigo-600 dark:text-indigo-400">{selectedTech.id}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                    {selectedTech.equipmentSystem}
                  </span>
                </div>
                <h3 className="text-base font-extrabold mt-0.5">{selectedTech.propertyName} — Technical Issue Lifecycle</h3>
              </div>
              <button onClick={() => setSelectedTech(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Troubleshooting Log & Supporting Messages */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <h4 className="font-extrabold uppercase text-[10px] text-slate-500">Troubleshooting Performed</h4>
                {(selectedTech.troubleshootingLog || []).length === 0 ? (
                  <p className="text-slate-400 text-[11px]">No troubleshooting steps logged yet.</p>
                ) : (
                  <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                    {selectedTech.troubleshootingLog.map((step, i) => <li key={i}>{step}</li>)}
                  </ul>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 max-h-48 overflow-y-auto">
                <h4 className="font-extrabold uppercase text-[10px] text-slate-500">
                  Cross-Group Message Evidence ({selectedTech.supportingMessages?.length || 0})
                </h4>
                {(selectedTech.supportingMessages || []).map((m, i) => (
                  <div key={i} className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block">
                      {m.senderName} ({m.groupName || selectedTech.groupName}) • {new Date(m.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200">"{m.text}"</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tech Update Form */}
            <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/30 space-y-3 text-xs">
              <h4 className="font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4" /> Record Technician Assignment, Workaround & Troubleshooting
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold block mb-1">Assigned Technician / Team:</label>
                  <input
                    type="text"
                    value={techAssignee}
                    onChange={(e) => setTechAssignee(e.target.value)}
                    placeholder="e.g. Nikhil Verma (Tech Support)"
                    className={`w-full px-3 py-1.5 rounded-lg border ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Available Workaround:</label>
                  <input
                    type="text"
                    value={workaroundInput}
                    onChange={(e) => setWorkaroundInput(e.target.value)}
                    placeholder="e.g. Manual key encoding by front desk"
                    className={`w-full px-3 py-1.5 rounded-lg border ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Add Troubleshooting Step / Result:</label>
                  <input
                    type="text"
                    value={troubleshootingNote}
                    onChange={(e) => setTroubleshootingNote(e.target.value)}
                    placeholder="e.g. Rebooted USB encoder service via AnyDesk"
                    className={`w-full px-3 py-1.5 rounded-lg border ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">What Remains Pending / Resolution Evidence:</label>
                  <input
                    type="text"
                    value={resolutionEvidenceInput}
                    onChange={(e) => setResolutionEvidenceInput(e.target.value)}
                    placeholder="e.g. Test guest check-in completed & verified"
                    className={`w-full px-3 py-1.5 rounded-lg border ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {LIFECYCLE_STATES.filter(s => s.id !== 'ALL').map(st => (
                  <button
                    key={st.id}
                    onClick={() => handleSaveTechUpdate(st.id)}
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] border transition-all ${
                      selectedTech.resolutionState === st.id
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Save as: {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
