import React from 'react';
import { 
  Brain, Sparkles, AlertCircle, ListTodo, CheckCircle2, Clock, 
  ShieldAlert, Users, FolderGit2, Eye, ArrowRight, HelpCircle, 
  FileSpreadsheet, Wrench, RotateCcw, Flame 
} from 'lucide-react';

export default function AiHubTab({
  isDarkMode,
  aiAnalysis,
  isAnalyzing,
  onRunAiAudit,
  onMarkReviewed,
  onNavigateTab,
  onOpenReply
}) {
  const delta = aiAnalysis?.deltaSinceLastReview || {};
  const counts = aiAnalysis?.counts || {};
  const statusBreakdown = aiAnalysis?.propertyStatusBreakdown || {};
  const coverageBreakdown = aiAnalysis?.coverageBreakdown || {};
  const groupSummary = aiAnalysis?.groupVerificationSummary || {};
  const awaitingReplyList = aiAnalysis?.awaitingResponseList || [];
  const superficialAckList = aiAnalysis?.actionPendingAfterAckList || [];
  const highImportanceMsgs = aiAnalysis?.highImportanceMessages || [];
  const opsActions = aiAnalysis?.opsActionItems || [];

  // Section 11: 15-Dimension Operations Manager Dashboard Tiles
  const managerOverviewMetrics = [
    {
      label: 'New Complaints (24h / 48h)',
      value: `${counts.complaints24hCount || 0} / ${counts.complaints48hCount || 0}`,
      sub: 'Owner & property concerns',
      color: 'text-amber-600 dark:text-amber-400',
      tab: 'complaints'
    },
    {
      label: 'Open Unresolved Complaints',
      value: counts.openComplaintsCount || 0,
      sub: 'Includes replied but unverified',
      color: (counts.openComplaintsCount || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600',
      tab: 'complaints'
    },
    {
      label: 'Open Technical Issues',
      value: counts.openTechIssuesCount || 0,
      sub: 'Kiosks, scanners, routers, PMS',
      color: (counts.openTechIssuesCount || 0) > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600',
      tab: 'tech'
    },
    {
      label: 'Critical & High Severity',
      value: counts.criticalOrHighCount || 0,
      sub: 'Active service-impacting issues',
      color: (counts.criticalOrHighCount || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400',
      tab: 'radar'
    },
    {
      label: 'Unassigned Incidents',
      value: counts.unassignedIncidentsCount || 0,
      sub: 'Needs owner / technician',
      color: (counts.unassignedIncidentsCount || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600',
      tab: 'complaints'
    },
    {
      label: 'Shift Carryover Issues',
      value: counts.shiftCarryoverCount || 0,
      sub: 'Unresolved across shifts',
      color: (counts.shiftCarryoverCount || 0) > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400',
      tab: 'handovers'
    },
    {
      label: 'Overdue Deadlines (>5m)',
      value: counts.overdueIncidentsCount || 0,
      sub: 'Missed response SLA window',
      color: (counts.overdueIncidentsCount || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600',
      tab: 'radar'
    },
    {
      label: 'Repeated & Reopened Issues',
      value: `${counts.repeatedAndRecurringCount || 0} (${counts.reopenedIncidentsCount || 0} Reopened)`,
      sub: 'Recurring property/tech faults',
      color: (counts.repeatedAndRecurringCount || 0) > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-slate-600 dark:text-slate-400',
      tab: 'tech'
    },
    {
      label: 'Recent Verified Resolutions',
      value: counts.recentlyResolvedCount || 0,
      sub: 'Closed with supporting evidence',
      color: 'text-emerald-600 dark:text-emerald-400',
      tab: 'radar'
    },
    {
      label: 'Stale / Unverified WA Groups',
      value: `${counts.unverifiedGroupsCount || 0} / ${counts.staleGroupsCount || 0}`,
      sub: 'Needs mapping or sync review',
      color: (counts.unverifiedGroupsCount || 0) > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600',
      tab: 'groups'
    }
  ];

  return (
    <div className="space-y-5">
      {/* 1. Futuristic Executive Command Brief Banner (High-Contrast in both Light & Dark Mode) */}
      <div className={`cyber-card flex flex-wrap items-center justify-between gap-4 border p-5 rounded-2xl shadow-lg ${
        isDarkMode
          ? 'bg-gradient-to-r from-slate-900 via-blue-950/90 to-indigo-950/90 border-blue-500/40 text-white'
          : 'bg-gradient-to-r from-white via-blue-50/90 to-indigo-50/90 border-blue-300 text-slate-900'
      }`}>
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
              <Brain className="w-5 h-5" />
            </div>
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Kiotel Operations Manager Command Intelligence
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-500/30">
              100% Evidence-Backed • Zero Fabricated Data
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            {aiAnalysis?.executiveBrief || "Connect your WhatsApp or verify imported groups to evaluate real-time property operational status, complaints, technical issues, and shift coverage."}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-600 dark:text-slate-400">
            <span>
              Last Review Checkpoint: <b className="text-slate-900 dark:text-slate-100">{delta.lastReviewedAt ? new Date(delta.lastReviewedAt).toLocaleString() : 'Not set yet'}</b>
            </span>
            <span>•</span>
            <span className="text-blue-700 dark:text-amber-300 font-bold">
              Delta Since Review: +{delta.newMessagesCount || 0} msgs • +{delta.newIncidentsCount || 0} incidents • +{delta.resolvedSinceReviewCount || 0} verified resolved
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onMarkReviewed && (
            <button
              onClick={onMarkReviewed}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
              title="Set review checkpoint to now so future deltas only show new changes"
            >
              <Eye className="w-4 h-4" />
              <span>Mark Reviewed Now</span>
            </button>
          )}
          <button 
            onClick={onRunAiAudit} 
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 text-amber-300 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Syncing Intelligence...' : 'Refresh Intelligence'}</span>
          </button>
        </div>
      </div>

      {/* 2. Section 11: 10-Tile Operational Accountability Sub-Grid (Complements the 8-Card Property Status KPI Grid above) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {managerOverviewMetrics.map((m, idx) => (
          <div
            key={idx}
            onClick={() => onNavigateTab && onNavigateTab(m.tab)}
            className={`cyber-card border rounded-xl p-3 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md ${
              isDarkMode
                ? 'bg-slate-900/80 border-slate-800 hover:border-blue-500/50 text-white'
                : 'bg-white border-slate-300 hover:border-blue-500 text-slate-900 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-400">
              <span className="truncate">{m.label}</span>
              <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
            </div>
            <div className={`text-base sm:text-lg font-extrabold my-0.5 ${m.color}`}>
              {m.value}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {m.sub}
            </div>
          </div>
        ))}
      </div>

      {/* 3. Unverified Groups / Missing Property Verification Alert */}
      {(groupSummary.unverifiedGroups > 0 || (statusBreakdown.UNKNOWN?.count || 0) > 0) && (
        <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
          isDarkMode
            ? 'bg-amber-950/30 border-amber-700/60 text-amber-100'
            : 'bg-amber-50 border-amber-300 text-amber-950 shadow-sm'
        }`}>
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <h3 className="font-extrabold text-amber-950 dark:text-amber-200">
                Verification Guardrail Active: WhatsApp Groups Are Never Assumed to Be "Live Properties"
              </h3>
              <p className="text-amber-900 dark:text-amber-300/90">
                Imported WhatsApp groups (<b>{groupSummary.totalGroups || 0} total</b>, <b>{groupSummary.unverifiedGroups || 0} unverified</b>) and properties missing verified operating hours, timezones, or shift coverage (<b>{statusBreakdown.UNKNOWN?.count || 0} properties</b>) remain in <b>Unknown / Needs Verification</b> until verified.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab && onNavigateTab('groups')}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
            >
              <FolderGit2 className="w-3.5 h-3.5" /> Verify Groups ({groupSummary.unverifiedGroups || 0})
            </button>
            <button
              onClick={() => onNavigateTab && onNavigateTab('properties', 'UNKNOWN')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
            >
              Configure Properties ({statusBreakdown.UNKNOWN?.count || 0})
            </button>
          </div>
        </div>
      )}

      {/* 4. Main 3-Column Operations Intelligence Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT & CENTER (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Section A: Awaiting Initial Response */}
          <div className={`cyber-card border rounded-2xl p-4 space-y-3 ${
            isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="w-4 h-4" />
                1. Owners, Managers & Staff Awaiting Initial Response ({awaitingReplyList.length})
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onNavigateTab && onNavigateTab('complaints')}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  Complaints Sheet <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onNavigateTab && onNavigateTab('tech')}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  Tech Issues Sheet <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {awaitingReplyList.length === 0 ? (
              <div className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>No unanswered hotel owner, manager, or technical queries waiting for an initial response.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {awaitingReplyList.slice(0, 8).map((inc) => (
                  <div key={inc.id} className={`p-3.5 rounded-xl border space-y-2 ${
                    isDarkMode
                      ? 'border-rose-900/60 bg-rose-950/20 text-slate-100'
                      : 'border-rose-300 bg-rose-50/60 text-slate-900'
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-extrabold text-blue-600 dark:text-blue-400">{inc.id}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inc.severity === 'CRITICAL' ? 'bg-rose-600 text-white' :
                          inc.severity === 'HIGH' ? 'bg-amber-500 text-white' :
                          'bg-blue-600 text-white'
                        }`}>
                          {inc.severity} • {inc.equipmentSystem || inc.category}
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{inc.propertyName}</span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400">({inc.groupName})</span>
                      </div>
                      <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 font-bold">
                        {inc.isOverdue ? '🚨 OVERDUE (>5m)' : `Open: ${inc.timeOpenFormatted || '0m'}`}
                      </span>
                    </div>
                    <p className={`text-xs font-mono p-2.5 rounded-lg border ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                    }`}>
                      "{inc.originalComplaint || inc.summary}"
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-700 dark:text-slate-400">
                      <span>
                        👤 Raised by: <b>{inc.raisedBy?.name || 'Unknown'}</b> • Shift: <b>{inc.reportingShift || 'Unknown'}</b> • Needs: <b>{inc.expectedResponder}</b>
                      </span>
                      {onOpenReply && (
                        <button
                          onClick={() => onOpenReply(inc, 'We are checking this right now and will confirm once resolved.')}
                          className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm"
                        >
                          Draft & Authorize Reply
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section B: Superficial Reply Provided — Action Still Pending! */}
          <div className={`cyber-card border rounded-2xl p-4 space-y-3 ${
            isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
          }`}>
            <div>
              <h3 className="text-sm font-extrabold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
                2. Replied ("Okay / Noted / Checking"), But Action & Resolution Still Pending ({superficialAckList.length})
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Superficial acknowledgments never mark an incident resolved. These remain open until verified with evidence.
              </p>
            </div>

            {superficialAckList.length === 0 ? (
              <div className={`p-4 rounded-xl border text-xs ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                Zero incidents stuck in superficial acknowledgment state.
              </div>
            ) : (
              <div className="space-y-2.5">
                {superficialAckList.map((inc) => (
                  <div key={inc.id} className={`p-3.5 rounded-xl border space-y-2 ${
                    isDarkMode
                      ? 'border-amber-800/60 bg-amber-950/20 text-slate-100'
                      : 'border-amber-300 bg-amber-50/70 text-slate-900'
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-extrabold text-blue-600 dark:text-blue-400">{inc.id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40">
                          ACKNOWLEDGED • ACTION PENDING
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{inc.propertyName}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                        Open: {inc.timeOpenFormatted || '0m'}
                      </span>
                    </div>
                    <p className={`text-xs font-mono p-2 rounded-lg border ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                    }`}>
                      Issue: "{inc.originalComplaint || inc.summary}"
                    </p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                      ⚠️ <b>Why still open:</b> {inc.resolutionEvidence || inc.resolutionReason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section C: High-Importance Operational Messages */}
          <div className={`cyber-card border rounded-2xl p-4 space-y-3 ${
            isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
          }`}>
            <h3 className="text-sm font-extrabold flex items-center gap-2 text-slate-900 dark:text-white">
              <AlertCircle className="w-4 h-4 text-indigo-500" />
              3. High-Importance Operational Messages ({highImportanceMsgs.length})
            </h3>
            {highImportanceMsgs.length === 0 ? (
              <div className={`p-4 rounded-xl border text-xs ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                No high-importance messages logged yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {highImportanceMsgs.slice(0, 12).map((msg) => (
                  <div key={msg.id} className={`p-3 rounded-xl border text-xs space-y-1 ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {msg.propertyName || msg.groupName} • {msg.senderName} ({msg.senderRole})
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="font-mono text-slate-900 dark:text-slate-100">"{msg.text}"</p>
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 flex flex-wrap gap-2 pt-0.5">
                      <span>Importance: <b>{msg.analysis?.importance?.level}</b> ({msg.analysis?.importance?.reason})</span>
                      <span>•</span>
                      <span>Severity: <b>{msg.analysis?.seriousness?.severity || msg.analysis?.seriousness?.level}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (4 cols): Action Items, Coverage Breakdown, Status Summary */}
        <div className="lg:col-span-4 space-y-5">
          {/* Ops Manager Action Items */}
          <div className={`cyber-card border rounded-2xl p-4 space-y-3 ${
            isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
          }`}>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <ListTodo className="w-4 h-4" /> Ops Manager Action Checklist
            </h3>
            {opsActions.length === 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">No immediate operational blockers detected.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {opsActions.map((action, i) => (
                  <div key={i} className={`flex items-start gap-2 p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    <span className="text-blue-600 dark:text-blue-400 font-extrabold">{i + 1}.</span>
                    <span className="leading-snug font-medium">{action}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Staffing & Coverage Breakdown */}
          <div className={`cyber-card border rounded-2xl p-4 space-y-3 ${
            isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
          }`}>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Property Coverage Arrangement
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Shared staffing is evaluated against the assigned shift schedule — never penalized for not having a dedicated agent.
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{coverageBreakdown.dedicatedCount || 0}</div>
                <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Dedicated</div>
              </div>
              <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400">{coverageBreakdown.sharedCount || 0}</div>
                <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Shared Pod</div>
              </div>
              <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400">{coverageBreakdown.unverifiedCoverageCount || 0}</div>
                <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Unconfirmed</div>
              </div>
            </div>
          </div>

          {/* 6-Status Traceability Summary */}
          <div className={`cyber-card border rounded-2xl p-4 space-y-2.5 ${
            isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
          }`}>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              6-Status Property Verification Matrix
            </h3>
            <div className="space-y-1.5 text-xs">
              {[
                { key: 'LIVE', label: '🟢 Live / Operating', color: 'text-emerald-600 dark:text-emerald-400' },
                { key: 'AT_RISK', label: '🚨 At Risk', color: 'text-rose-600 dark:text-rose-400' },
                { key: 'OUTSIDE_HOURS', label: '🌙 Outside Operating Hours', color: 'text-blue-600 dark:text-blue-400' },
                { key: 'NOT_YET_LIVE', label: '🚀 Not Yet Live', color: 'text-indigo-600 dark:text-indigo-400' },
                { key: 'SUSPENDED', label: '⛔ Not Operational / Suspended', color: 'text-slate-600 dark:text-slate-400' },
                { key: 'UNKNOWN', label: '❓ Unknown / Needs Verification', color: 'text-amber-600 dark:text-amber-400' }
              ].map((st) => (
                <div
                  key={st.key}
                  onClick={() => onNavigateTab && onNavigateTab('properties', st.key)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                    isDarkMode
                      ? 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-200'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <span className="font-semibold">{st.label}</span>
                  <span className={`font-extrabold ${st.color}`}>
                    {statusBreakdown[st.key]?.count || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
