import React, { useState } from 'react';
import { 
  FileSpreadsheet, Copy, Download, Search, Filter, ArrowUpDown, 
  Eye, CheckCircle2, AlertTriangle, Clock, RotateCcw, Send, X, Edit3 
} from 'lucide-react';

const LIFECYCLE_STATES = [
  { id: 'ALL', label: 'All Statuses' },
  { id: 'AWAITING_RESPONSE', label: '🔴 Awaiting Response' },
  { id: 'RESPONSE_PROVIDED_ACTION_PENDING', label: '🟠 Acknowledged • Action Pending' },
  { id: 'ACTION_IN_PROGRESS', label: '🔵 Action In Progress' },
  { id: 'WAITING_EXTERNAL', label: '🟡 Waiting on Property / Vendor' },
  { id: 'AWAITING_CONFIRMATION', label: '🟣 Awaiting Confirmation' },
  { id: 'REOPENED', label: '🚨 Reopened (Recurring)' },
  { id: 'RESOLVED_VERIFIED', label: '🟢 Resolved (Verified Evidence)' },
  { id: 'UNABLE_TO_VERIFY', label: '⚪ Unable to Verify' }
];

const SEVERITY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export default function ComplaintsTab({
  isDarkMode,
  complaints = [],
  properties = [],
  currentUser,
  onUpdateIncident,
  onOpenReply,
  onOpenSimModal
}) {
  const [dateRange, setDateRange] = useState('ALL'); // '24H' | '48H' | '7D' | 'ALL'
  const [propertyFilter, setPropertyFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('OLDEST_UNRESOLVED'); // 'OLDEST_UNRESOLVED' | 'NEWEST' | 'SEVERITY' | 'TIME_OPEN'
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedTable, setCopiedTable] = useState(false);

  // Selected row for full history modal
  const [selectedRow, setSelectedRow] = useState(null);
  const [overrideNote, setOverrideNote] = useState('');
  const [assigneeInput, setAssigneeInput] = useState('');

  const nowMs = Date.now();

  const filteredRows = complaints
    .filter((item) => {
      const raisedMs = item.raisedAt ? new Date(item.raisedAt).getTime() : nowMs;
      if (dateRange === '24H' && nowMs - raisedMs > 24 * 60 * 60 * 1000) return false;
      if (dateRange === '48H' && nowMs - raisedMs > 48 * 60 * 60 * 1000) return false;
      if (dateRange === '7D' && nowMs - raisedMs > 7 * 24 * 60 * 60 * 1000) return false;

      if (propertyFilter !== 'ALL' && item.propertyId !== propertyFilter) return false;
      if (shiftFilter !== 'ALL') {
        const shiftStr = (item.reportingShift || 'Unknown').toLowerCase();
        if (!shiftStr.includes(shiftFilter.toLowerCase())) return false;
      }
      const sev = item.severity || item.seriousness?.severity || 'MEDIUM';
      if (severityFilter !== 'ALL' && sev !== severityFilter) return false;
      if (statusFilter !== 'ALL' && item.resolutionState !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (assigneeFilter !== 'ALL') {
        const assigned = item.actionAssignedTo || 'UNASSIGNED';
        if (assigneeFilter === 'UNASSIGNED' && assigned !== 'UNASSIGNED') return false;
        if (assigneeFilter === 'ASSIGNED' && assigned === 'UNASSIGNED') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = [
          item.id,
          item.propertyName,
          item.originalComplaint,
          item.summary,
          item.raisedBy?.name,
          item.groupName,
          item.latestUpdate,
          item.resolutionEvidence
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
      if (sortBy === 'NEWEST') {
        return bTime - aTime;
      }
      if (sortBy === 'SEVERITY') {
        if (bSev !== aSev) return bSev - aSev;
        return aTime - bTime;
      }
      if (sortBy === 'TIME_OPEN') {
        return (b.timeOpenMs || 0) - (a.timeOpenMs || 0);
      }
      return bTime - aTime;
    });

  // Format rows for Excel / Google Sheets TSV Copy & CSV Export
  const buildSpreadsheetHeaders = () => [
    'Complaint ID',
    'Property Name',
    'Original Complaint',
    'Current Summary & Impact',
    'Raised By',
    'Original Timestamp',
    'Property Local Time',
    'Reporting Shift',
    'WhatsApp Group(s)',
    'Source Msg Ref',
    'Severity',
    'Expected Responder',
    'Assigned To',
    'Response Given?',
    'Action Pending?',
    'Current Status',
    'Latest Update',
    'Last Updated By',
    'Last Updated At',
    'Time Open',
    'Resolution Evidence / Unconfirmed Reason'
  ];

  const buildRowCells = (r) => [
    r.id || '',
    r.propertyName || 'Unmapped',
    (r.originalComplaint || r.title || '').replace(/[\r\n\t]+/g, ' '),
    (r.businessImpact || r.summary || '').replace(/[\r\n\t]+/g, ' '),
    r.raisedBy?.name || 'Unknown',
    r.raisedAt ? new Date(r.raisedAt).toLocaleString() : '',
    r.propertyLocalTime || 'Unknown',
    r.reportingShift || 'Unknown',
    (r.sourceGroups || [{ groupName: r.groupName }]).map(g => g.groupName).join(' + '),
    r.sourceMessageId || '',
    r.severity || r.seriousness?.severity || 'MEDIUM',
    r.expectedResponder || 'UNASSIGNED',
    r.actionAssignedTo || 'UNASSIGNED',
    r.responseGiven ? 'Yes' : 'No',
    r.actionPending !== false && r.resolutionState !== 'RESOLVED_VERIFIED' ? 'Yes' : 'No',
    r.resolutionState || 'AWAITING_RESPONSE',
    (r.latestUpdate || '').replace(/[\r\n\t]+/g, ' '),
    r.lastUpdatedBy || 'Unknown',
    r.latestUpdateAt ? new Date(r.latestUpdateAt).toLocaleString() : '',
    r.timeOpenFormatted || '0m',
    (r.resolutionEvidence || '').replace(/[\r\n\t]+/g, ' ')
  ];

  const handleCopyForExcel = () => {
    const headers = buildSpreadsheetHeaders().join('\t');
    const rows = filteredRows.map(r => buildRowCells(r).join('\t'));
    const tsv = [headers, ...rows].join('\n');
    navigator.clipboard.writeText(tsv);
    setCopiedTable(true);
    setTimeout(() => setCopiedTable(false), 2500);
  };

  const handleExportCsv = () => {
    const headers = buildSpreadsheetHeaders();
    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      headers.map(escapeCsv).join(','),
      ...filteredRows.map(r => buildRowCells(r).map(escapeCsv).join(','))
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Kiotel_Property_Complaints_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApplyOverride = async (newState) => {
    if (!selectedRow || !onUpdateIncident) return;
    await onUpdateIncident(selectedRow.id, {
      resolutionState: newState || selectedRow.resolutionState,
      resolutionEvidence: overrideNote.trim() || selectedRow.resolutionEvidence,
      actionAssignedTo: assigneeInput.trim() || selectedRow.actionAssignedTo,
      updatedBy: currentUser
    });
    setOverrideNote('');
    setSelectedRow(null);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className={`cyber-card border rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 ${
        isDarkMode
          ? 'bg-slate-900/85 border-slate-800 text-white shadow-lg shadow-blue-950/20'
          : 'bg-white/95 border-slate-300 text-slate-900 shadow-md'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                Property Complaints & Service Issues Register ({filteredRows.length})
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Permanent Excel-style register of owner, hotel manager, and front-desk complaints. <b>Every complaint stays logged even after a reply</b> until resolution is verified with evidence.
              </p>
            </div>
          </div>
        </div>

        {/* Excel Copy & CSV Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyForExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            title="Copy spreadsheet rows to clipboard in Tab-Separated format for direct Ctrl+V paste into Excel or Google Sheets"
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
            <Download className="w-3.5 h-3.5 text-blue-500" />
            <span>Export CSV / Excel</span>
          </button>
        </div>
      </div>

      {/* Multi-Column Filter & Sort Toolbar */}
      <div className={`cyber-card border rounded-2xl p-3.5 space-y-3 ${
        isDarkMode ? 'bg-slate-900/80 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900 shadow-sm'
      }`}>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Pills */}
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
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {dr.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className={`flex items-center gap-2 flex-1 min-w-[200px] border px-3 py-1.5 rounded-xl ${
            isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
          }`}>
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by Complaint ID, property, reporter, message, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none w-full"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`px-2.5 py-1.5 rounded-xl border font-semibold ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="OLDEST_UNRESOLVED">Sort: Oldest Unresolved First</option>
              <option value="NEWEST">Sort: Newest Complaint First</option>
              <option value="SEVERITY">Sort: Highest Severity First</option>
              <option value="TIME_OPEN">Sort: Longest Time Open</option>
            </select>
          </div>
        </div>

        {/* Dropdown Filters Row */}
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
            <option value="Unknown">Unknown (Unverified Shift)</option>
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

          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-lg border font-medium ${
              isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            <option value="ALL">All Ownership</option>
            <option value="UNASSIGNED">Unassigned Only</option>
            <option value="ASSIGNED">Assigned Only</option>
          </select>
        </div>
      </div>

      {/* Excel-Style Spreadsheet Data Grid */}
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
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">ID</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Property</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 min-w-[240px]">Original Complaint & Summary</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Raised By</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Timestamp & Local Time</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Shift</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Source Group(s)</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Severity</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Owner / Action</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Replied?</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Status & Evidence</th>
                <th className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">Open Time</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    No property complaints match the current filter. All real complaints from connected WhatsApp groups appear here automatically.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const sev = row.severity || row.seriousness?.severity || 'MEDIUM';
                  const isResolved = row.resolutionState === 'RESOLVED_VERIFIED';
                  const isReopened = row.resolutionState === 'REOPENED';

                  return (
                    <tr
                      key={row.id}
                      onClick={() => {
                        setSelectedRow(row);
                        setAssigneeInput(row.actionAssignedTo !== 'UNASSIGNED' ? row.actionAssignedTo : '');
                      }}
                      className={`cursor-pointer transition-colors ${
                        isDarkMode
                          ? 'hover:bg-blue-950/30 text-slate-200'
                          : 'hover:bg-blue-50/70 text-slate-900'
                      }`}
                    >
                      {/* Complaint ID */}
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        {row.id}
                        {row.isRepeated && (
                          <span className="block text-[9px] text-rose-600 dark:text-rose-400 font-sans">
                            ↻ Repeated ({row.occurrenceCount}x)
                          </span>
                        )}
                      </td>

                      {/* Property */}
                      <td className="py-2.5 px-3 font-bold border-r border-slate-200 dark:border-slate-800">
                        <div className="text-slate-900 dark:text-white">{row.propertyName}</div>
                        {row.propertyId && <span className="text-[10px] font-mono text-slate-500">{row.propertyId}</span>}
                      </td>

                      {/* Original Complaint & Summary */}
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 max-w-xs">
                        <div className="font-mono text-[11px] font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                          "{row.originalComplaint || row.title}"
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-1">
                          Impact: {row.businessImpact || row.summary}
                        </div>
                      </td>

                      {/* Raised By */}
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">{row.raisedBy?.name || 'Unknown'}</div>
                        <span className="text-[10px] text-slate-500">{row.raisedBy?.role || 'UNKNOWN'}</span>
                      </td>

                      {/* Timestamp & Property Local Time */}
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap text-[11px]">
                        <div className="font-mono text-slate-800 dark:text-slate-200">
                          {row.raisedAt ? new Date(row.raisedAt).toLocaleString() : 'N/A'}
                        </div>
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                          Local: {row.propertyLocalTime || 'Unknown'}
                        </div>
                      </td>

                      {/* Shift */}
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap text-[11px]">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {row.reportingShift || 'Unknown'}
                        </span>
                        {row.carriedOverShift && (
                          <span className="block text-[9px] font-bold text-amber-600 dark:text-amber-400">
                            ⚠️ Shift Carryover
                          </span>
                        )}
                      </td>

                      {/* Source Group(s) */}
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-[11px]">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                          {(row.sourceGroups || [{ groupName: row.groupName }]).map(g => g.groupName).join(', ')}
                        </div>
                        <span className="text-[9px] font-mono text-slate-500">
                          Ref: {row.sourceMessageId?.slice(0, 12) || 'N/A'} ({row.supportingMessages?.length || 1} msgs)
                        </span>
                      </td>

                      {/* Severity */}
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          sev === 'CRITICAL' ? 'bg-rose-600 text-white' :
                          sev === 'HIGH' ? 'bg-amber-500 text-white' :
                          sev === 'MEDIUM' ? 'bg-blue-600 text-white' :
                          'bg-slate-600 text-white'
                        }`}>
                          {sev}
                        </span>
                      </td>

                      {/* Expected Responder / Assigned */}
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 text-[11px]">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {row.actionAssignedTo !== 'UNASSIGNED' ? row.actionAssignedTo : 'Unassigned'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Needs: {row.expectedResponder}
                        </div>
                      </td>

                      {/* Response Given / Action Pending */}
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap text-[11px]">
                        <div>
                          Reply: <b className={row.responseGiven ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {row.responseGiven ? 'Yes' : 'No'}
                          </b>
                        </div>
                        <div>
                          Action: <b className={!isResolved ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}>
                            {!isResolved ? 'Pending' : 'Done'}
                          </b>
                        </div>
                      </td>

                      {/* Current Status & Evidence */}
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 max-w-[220px]">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-1 ${
                          isResolved
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-400/40'
                            : isReopened
                            ? 'bg-rose-600 text-white'
                            : row.resolutionState === 'RESPONSE_PROVIDED_ACTION_PENDING' || row.resolutionState === 'ACKNOWLEDGED'
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-400/40'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-400/40'
                        }`}>
                          {row.resolutionState}
                        </span>
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 line-clamp-2">
                          {row.resolutionEvidence}
                        </div>
                      </td>

                      {/* Time Open */}
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap font-mono font-bold text-slate-800 dark:text-slate-200">
                        {row.timeOpenFormatted || '0m'}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedRow(row)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-[11px]"
                            title="Inspect Full History & Evidence"
                          >
                            History
                          </button>
                          {onOpenReply && (
                            <button
                              onClick={() => onOpenReply({
                                ...row,
                                groupId: row.groupId || row.sourceGroupId,
                                ownerName: row.raisedBy?.name || 'Property Contact',
                                messageText: row.originalComplaint || row.summary
                              }, '')}
                              className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px]"
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

      {/* Detailed Incident History & Evidence Drawer/Modal */}
      {selectedRow && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-extrabold text-blue-600 dark:text-blue-400">{selectedRow.id}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    {selectedRow.resolutionState}
                  </span>
                </div>
                <h3 className="text-base font-extrabold mt-0.5">{selectedRow.propertyName} — Complaint Lifecycle & Evidence</h3>
              </div>
              <button onClick={() => setSelectedRow(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block">Raised By</span>
                <b className="text-slate-900 dark:text-white">{selectedRow.raisedBy?.name || 'Unknown'}</b>
                <span className="text-[10px] text-slate-500 block">{selectedRow.raisedBy?.role}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block">Property Local Time & Shift</span>
                <b className="text-slate-900 dark:text-white">{selectedRow.reportingShift || 'Unknown'}</b>
                <span className="text-[10px] text-slate-500 block">{selectedRow.propertyLocalTime}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block">Linked WhatsApp Groups</span>
                <b className="text-blue-600 dark:text-blue-400">
                  {(selectedRow.sourceGroups || [{ groupName: selectedRow.groupName }]).map(g => g.groupName).join(', ')}
                </b>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block">Time Open</span>
                <b className="text-rose-600 dark:text-rose-400 font-mono">{selectedRow.timeOpenFormatted}</b>
                <span className="text-[10px] text-slate-500 block">Last by: {selectedRow.lastUpdatedBy}</span>
              </div>
            </div>

            {/* Supporting Messages Across Groups */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Supporting WhatsApp Messages ({selectedRow.supportingMessages?.length || 0})
              </h4>
              <div className="space-y-2 max-h-52 overflow-y-auto p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                {(selectedRow.supportingMessages || []).map((m, idx) => (
                  <div key={m.id || idx} className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {m.senderName} ({m.senderRole || (m.isTeam ? 'KIOTEL_STAFF' : 'PROPERTY')}) • Group: {m.groupName || selectedRow.groupName}
                      </span>
                      <span className="font-mono">{new Date(m.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="font-mono text-slate-800 dark:text-slate-200">"{m.text}"</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Manager Override & Assignment Controls */}
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/30 space-y-3 text-xs">
              <h4 className="font-extrabold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4" /> Update Ownership, Evidence & Lifecycle State
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  placeholder="Assigned Owner / Agent (e.g., Siddharth / Shift Lead)..."
                  value={assigneeInput}
                  onChange={(e) => setAssigneeInput(e.target.value)}
                  className={`px-3 py-2 rounded-lg border text-xs ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
                <input
                  type="text"
                  placeholder="Resolution evidence or reason resolution is unconfirmed..."
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  className={`px-3 py-2 rounded-lg border text-xs ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LIFECYCLE_STATES.filter(s => s.id !== 'ALL').map(st => (
                  <button
                    key={st.id}
                    onClick={() => handleApplyOverride(st.id)}
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] border transition-all ${
                      selectedRow.resolutionState === st.id
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {st.label}
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
