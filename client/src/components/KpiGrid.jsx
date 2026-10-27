import React from 'react';
import { 
  CheckCircle2, Clock, AlertTriangle, HelpCircle, Ban, Rocket, BellRing, FolderGit2, ArrowUpRight 
} from 'lucide-react';

export default function KpiGrid({
  isDarkMode,
  activeTab,
  statusFilter,
  statusCounts = {},
  awaitingResponseCount = 0,
  actionPendingCount = 0,
  unverifiedGroupsCount = 0,
  totalGroupsCount = 0,
  onKpiClick
}) {
  const cards = [
    {
      key: 'LIVE',
      label: '🟢 Live / Operating',
      count: statusCounts.LIVE || 0,
      subtext: 'Verified active window & coverage',
      color: 'text-emerald-600 dark:text-emerald-400',
      borderActive: 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20',
      icon: CheckCircle2,
      iconColor: 'text-emerald-500',
      isActive: activeTab === 'properties' && statusFilter === 'LIVE'
    },
    {
      key: 'AT_RISK',
      label: '🚨 At Risk',
      count: statusCounts.AT_RISK || 0,
      subtext: 'Active critical/high issue or gap',
      color: (statusCounts.AT_RISK || 0) > 0 ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-slate-500',
      borderActive: 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/40 ring-2 ring-rose-500/20',
      icon: AlertTriangle,
      iconColor: 'text-rose-500',
      isActive: activeTab === 'properties' && statusFilter === 'AT_RISK'
    },
    {
      key: 'OUTSIDE_HOURS',
      label: '🌙 Outside Hours',
      count: statusCounts.OUTSIDE_HOURS || 0,
      subtext: 'Scheduled window currently closed',
      color: 'text-blue-600 dark:text-blue-400',
      borderActive: 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/40 ring-2 ring-blue-500/20',
      icon: Clock,
      iconColor: 'text-blue-500',
      isActive: activeTab === 'properties' && statusFilter === 'OUTSIDE_HOURS'
    },
    {
      key: 'NOT_YET_LIVE',
      label: '🚀 Not Yet Live',
      count: statusCounts.NOT_YET_LIVE || 0,
      subtext: 'Onboarding / future launch',
      color: 'text-indigo-600 dark:text-indigo-400',
      borderActive: 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20',
      icon: Rocket,
      iconColor: 'text-indigo-500',
      isActive: activeTab === 'properties' && statusFilter === 'NOT_YET_LIVE'
    },
    {
      key: 'SUSPENDED',
      label: '⛔ Suspended',
      count: statusCounts.SUSPENDED || 0,
      subtext: 'Verified stopped / paused service',
      color: 'text-slate-600 dark:text-slate-400',
      borderActive: 'border-slate-500 bg-slate-100 dark:bg-slate-800 ring-2 ring-slate-500/20',
      icon: Ban,
      iconColor: 'text-slate-500',
      isActive: activeTab === 'properties' && statusFilter === 'SUSPENDED'
    },
    {
      key: 'UNKNOWN',
      label: '❓ Needs Verification',
      count: statusCounts.UNKNOWN || 0,
      subtext: 'Missing schedule, tz, or coverage',
      color: (statusCounts.UNKNOWN || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500',
      borderActive: 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/40 ring-2 ring-amber-500/20',
      icon: HelpCircle,
      iconColor: 'text-amber-500',
      isActive: activeTab === 'properties' && statusFilter === 'UNKNOWN'
    },
    {
      key: 'AWAITING_RESPONSE',
      label: '⏱️ Awaiting Reply / Action',
      count: awaitingResponseCount + actionPendingCount,
      subtext: `${awaitingResponseCount} unanswered • ${actionPendingCount} action pending`,
      color: (awaitingResponseCount + actionPendingCount) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600',
      borderActive: 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/40 ring-2 ring-rose-500/20',
      icon: BellRing,
      iconColor: 'text-rose-500',
      isActive: activeTab === 'radar'
    },
    {
      key: 'GROUPS_VERIFY',
      label: '💬 WA Groups Directory',
      count: totalGroupsCount,
      subtext: `${unverifiedGroupsCount} unverified groups`,
      color: unverifiedGroupsCount > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600',
      borderActive: 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20',
      icon: FolderGit2,
      iconColor: 'text-indigo-500',
      isActive: activeTab === 'groups'
    }
  ];

  return (
    <section className="px-4 sm:px-6 py-3.5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            onClick={() => onKpiClick(card.key)}
            className={`border rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${
              card.isActive
                ? card.borderActive
                : isDarkMode ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
            }`}
            title={`Click to drill down into ${card.label}`}
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">{card.label}</p>
              <ArrowUpRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
            </div>
            <div className="flex items-baseline justify-between my-1">
              <h3 className={`text-xl font-extrabold ${card.color}`}>{card.count}</h3>
              <Icon className={`w-4 h-4 ${card.iconColor} opacity-80 flex-shrink-0`} />
            </div>
            <span className="text-[9px] text-slate-400 truncate block">{card.subtext}</span>
          </div>
        );
      })}
    </section>
  );
}
