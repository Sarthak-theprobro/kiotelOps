import React, { useState } from 'react';
import { 
  RefreshCw, CheckCircle2, Send, Clock, ShieldAlert, Eye, Filter, 
  MessageSquare, Check, AlertTriangle, Edit3, X 
} from 'lucide-react';

const RESOLUTION_STATES = [
  { id: 'ALL', label: 'All States' },
  { id: 'AWAITING_RESPONSE', label: '🔴 Awaiting Response' },
  { id: 'RESPONSE_PROVIDED_ACTION_PENDING', label: '🟠 Reply Sent • Action Pending' },
  { id: 'ACTION_IN_PROGRESS', label: '🔵 Action In Progress' },
  { id: 'AWAITING_CONFIRMATION', label: '🟣 Awaiting Confirmation' },
  { id: 'RESOLVED_VERIFIED', label: '🟢 Resolved / Verified' },
  { id: 'UNABLE_TO_DETERMINE', label: '⚪ Unable to Determine' }
];

const SEVERITIES = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const CATEGORIES = ['ALL', 'KIOSK', 'PMS', 'STAFFING', 'HANDOVER', 'GUEST_SUPPORT', 'GENERAL'];

export default function SlaRadarTab({
  isDarkMode,
  incidents = [],
  properties = [],
  groups = [],
  currentUser,
  onRefresh,
  onOpenSimModal,
  onReplyIncident,
  onUpdateIncident
}) {
  const [stateFilter, setStateFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [propertyFilter, setPropertyFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');

  const filteredIncidents = incidents.filter((inc) => {
    if (stateFilter !== 'ALL' && inc.resolutionState !== stateFilter) return false;
    if (severityFilter !== 'ALL' && inc.seriousness !== severityFilter) return false;
    if (categoryFilter !== 'ALL' && inc.category !== categoryFilter) return false;
    if (propertyFilter !== 'ALL' && inc.propertyId !== propertyFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSummary = (inc.summary || '').toLowerCase().includes(q);
      const matchProp = (inc.propertyName || '').toLowerCase().includes(q);
      const matchGroup = (inc.groupName || '').toLowerCase().includes(q);
      const matchSender = (inc.reportedBy?.name || '').toLowerCase().includes(q);
      if (!matchSummary && !matchProp && !matchGroup && !matchSender) return false;
    }
    return true;
  });

  const handleStateOverride = async (incidentId, newState, newSeriousness) => {
    if (!onUpdateIncident) return;
    await onUpdateIncident(incidentId, {
      resolutionState: newState,
      seriousness: newSeriousness,
      resolutionReason: overrideReason.trim() || `Manually updated to ${newState} by ${currentUser}`,
      updatedBy: currentUser
    });
    setOverrideReason('');
    if (selectedIncident && selectedIncident.id === incidentId) {
      setSelectedIncident(prev => ({
        ...prev,
        resolutionState: newState || prev.resolutionState,
        seriousness: newSeriousness || prev.seriousness
      }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping"></span>
            Contextual Incident & Unanswered Message Radar ({filteredIncidents.length})
          </h2>
          <p className="text-xs text-slate-500">
            Tracks all 6 resolution states — superficial replies ("Okay", "Checking") move to <b>Action Pending</b> and never prematurely close an incident.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onOpenSimModal}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5 text-blue-500" /> Test Message Scenario
          </button>
          <button 
            onClick={onRefresh} 
            className="p-2 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 shadow-sm"
            title="Refresh Incidents"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className={`p-3.5 rounded-xl border space-y-3 ${
        isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by message text, property, group, or sender..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`flex-1 min-w-[200px] text-xs px-3 py-1.5 rounded-lg border focus:outline-none ${
              isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          />

          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border ${
              isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <option value="ALL">All Properties</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border ${
              isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            {SEVERITIES.map(s => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Severities' : `Severity: ${s}`}</option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border ${
              isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : `Category: ${c}`}</option>
            ))}
          </select>
        </div>

        {/* 6 Resolution States Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {RESOLUTION_STATES.map((st) => (
            <button
              key={st.id}
              onClick={() => setStateFilter(st.id)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                stateFilter === st.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Incidents Grid */}
      {filteredIncidents.length === 0 ? (
        <div className={`border border-dashed rounded-2xl p-10 text-center ${
          isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
        }`}>
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-sm sm:text-base font-bold">No Incidents Match Current Filter</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            All monitored WhatsApp groups and properties are clear for this filter view, or no messages have triggered an incident yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredIncidents.map((inc) => {
            const isAwaiting = inc.resolutionState === 'AWAITING_RESPONSE';
            const isActionPending = inc.resolutionState === 'RESPONSE_PROVIDED_ACTION_PENDING';
            const isResolved = inc.resolutionState === 'RESOLVED_VERIFIED';

            const deadlineMs = inc.deadline ? new Date(inc.deadline).getTime() : 0;
            const remainingSec = deadlineMs ? Math.max(0, Math.round((deadlineMs - Date.now()) / 1000)) : 0;
            const mins = Math.floor(remainingSec / 60);
            const secs = remainingSec % 60;

            return (
              <div
                key={inc.id}
                className={`border-2 rounded-2xl p-4 shadow-sm flex flex-col justify-between transition-all ${
                  isResolved
                    ? 'border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/10'
                    : isAwaiting && inc.isOverdue
                    ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/30'
                    : isAwaiting
                    ? 'border-amber-500 bg-amber-50/30 dark:bg-amber-950/20'
                    : isActionPending
                    ? 'border-orange-500/70 bg-orange-50/20 dark:bg-orange-950/20'
                    : isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="space-y-2.5">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        inc.seriousness === 'CRITICAL' ? 'bg-rose-600 text-white' :
                        inc.seriousness === 'HIGH' ? 'bg-amber-500 text-white' :
                        inc.seriousness === 'MEDIUM' ? 'bg-blue-600 text-white' :
                        'bg-slate-600 text-white'
                      }`}>
                        {inc.seriousness}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {inc.category}
                      </span>
                    </div>

                    {isAwaiting && deadlineMs > 0 && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white flex items-center gap-1 ${
                        inc.isOverdue || remainingSec === 0 ? 'bg-rose-600' : 'bg-amber-500'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {inc.isOverdue || remainingSec === 0 ? 'OVERDUE (>5m)' : `${mins}:${secs.toString().padStart(2, '0')}`}
                      </span>
                    )}
                  </div>

                  {/* Property & Group */}
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {inc.propertyName || 'Unmapped Group Incident'}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">
                      Group: <b>{inc.groupName}</b> {inc.propertyId ? `(${inc.propertyId})` : ''}
                    </p>
                  </div>

                  {/* Resolution State Badge */}
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px]">
                    <span className="font-bold block text-blue-600 dark:text-blue-400">
                      State: {inc.resolutionState}
                    </span>
                    <span className="text-slate-500 text-[10px] block mt-0.5">
                      {inc.resolutionReason}
                    </span>
                  </div>

                  {/* Original Triggering Message */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono">
                    <span className="text-[10px] font-sans font-bold text-slate-400 block mb-0.5">
                      {inc.reportedBy?.name} ({inc.reportedBy?.role}) • {new Date(inc.createdAt).toLocaleTimeString()}
                    </span>
                    "{inc.summary}"
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedIncident(inc)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-500" />
                    <span>Evidence ({inc.supportingMessages?.length || 1})</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {!isResolved && (
                      <button
                        onClick={() => handleStateOverride(inc.id, 'RESOLVED_VERIFIED')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
                        title="Verify and mark this incident as resolved"
                      >
                        <Check className="w-3.5 h-3.5" /> Verify Resolved
                      </button>
                    )}
                    {onReplyIncident && (
                      <button
                        onClick={() => onReplyIncident({
                          ...inc,
                          groupId: inc.sourceGroupId,
                          ownerName: inc.reportedBy?.name,
                          messageText: inc.summary
                        }, '')}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                      >
                        Reply
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Supporting Evidence & Human Override Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-mono font-bold text-blue-500">{selectedIncident.id}</span>
                <h3 className="text-base font-extrabold">{selectedIncident.propertyName} — Incident Evidence & Override</h3>
                <p className="text-xs text-slate-400">Source Group: {selectedIncident.groupName} ({selectedIncident.sourceGroupId})</p>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 4-Dimension Classification Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Importance</span>
                <b className="text-indigo-500">{selectedIncident.importance}</b>
                <span className="text-[10px] text-slate-500 block mt-0.5">{selectedIncident.importanceReason}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Seriousness</span>
                <b className="text-rose-500">{selectedIncident.seriousness} ({selectedIncident.category})</b>
                <span className="text-[10px] text-slate-500 block mt-0.5">{selectedIncident.seriousnessReason}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Expected Responder</span>
                <b className="text-blue-500">{selectedIncident.expectedResponder}</b>
                <span className="text-[10px] text-slate-500 block mt-0.5">Action: {selectedIncident.actionType}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block">Current Resolution State</span>
                <b className="text-amber-500">{selectedIncident.resolutionState}</b>
                <span className="text-[10px] text-slate-500 block mt-0.5">{selectedIncident.resolutionReason}</span>
              </div>
            </div>

            {/* Supporting Conversation Timeline */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Supporting WhatsApp Message Timeline ({selectedIncident.supportingMessages?.length || 0} messages)
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                {(selectedIncident.supportingMessages || []).map((m, idx) => (
                  <div key={m.messageId || idx} className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {m.senderName} ({m.senderRole})
                      </span>
                      <span className="font-mono">{new Date(m.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="font-mono text-slate-800 dark:text-slate-200">"{m.text}"</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Human Manager State & Severity Override Controls */}
            <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-3 text-xs">
              <h4 className="font-bold text-blue-400 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4" /> Operations Manager Override (Persisted to Audit Log)
              </h4>
              <input
                type="text"
                placeholder="Optional note / reason for state change (e.g., Confirmed kiosk rebooted on call with owner)..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
              <div className="flex flex-wrap gap-1.5">
                {RESOLUTION_STATES.filter(s => s.id !== 'ALL').map((st) => (
                  <button
                    key={st.id}
                    onClick={() => handleStateOverride(selectedIncident.id, st.id, selectedIncident.seriousness)}
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] border transition-all ${
                      selectedIncident.resolutionState === st.id
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Set: {st.label}
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
