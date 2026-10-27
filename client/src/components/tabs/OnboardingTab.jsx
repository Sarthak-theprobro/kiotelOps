import React, { useState, useMemo } from 'react';
import {
  Rocket,
  Search,
  Download,
  Copy,
  Check,
  Table2,
  CheckCircle2,
  Clock,
  FolderGit2,
  MapPin,
  Settings,
  Plus
} from 'lucide-react';

export default function OnboardingTab({
  isDarkMode,
  properties = [],
  groups = [],
  currentUser = 'Operations Manager',
  onSaveProperty,
  onNavigateToProperties
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [clusterFilter, setClusterFilter] = useState('ALL');
  const [copiedTable, setCopiedTable] = useState(false);

  // All properties that are currently NOT_YET_LIVE / Onboarding
  const onboardingProperties = useMemo(() => {
    return properties.filter(p => {
      const st = p.evaluation?.status || p.operationalStatus || p.launchStatus;
      return st === 'NOT_YET_LIVE' || p.launchStatus === 'NOT_YET_LIVE';
    });
  }, [properties]);

  const clusters = useMemo(() => {
    const set = new Set(['ALL']);
    onboardingProperties.forEach(p => {
      if (p.cluster) set.add(p.cluster);
    });
    return Array.from(set);
  }, [onboardingProperties]);

  const filteredList = useMemo(() => {
    return onboardingProperties.filter(p => {
      if (clusterFilter !== 'ALL' && p.cluster !== clusterFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchId = (p.id || '').toLowerCase().includes(q);
        const matchCode = (p.propertyCode || '').toLowerCase().includes(q);
        const matchTz = (p.timezone || '').toLowerCase().includes(q);
        if (!matchName && !matchId && !matchCode && !matchTz) return false;
      }
      return true;
    });
  }, [onboardingProperties, clusterFilter, searchQuery]);

  const getRowsForExport = () => {
    const headers = [
      'Property ID',
      'Property Code',
      'Hotel / Property Name',
      'Region / Cluster',
      'IANA Timezone',
      'Property Local Time',
      'Launch Status',
      'Planned Operating Schedule',
      'Coverage Mode',
      'Linked WA Groups Count',
      'Linked WA Group Names',
      'Onboarding Reason / Blocker',
      'Latest Evidence / Activity'
    ];

    const rows = filteredList.map(p => {
      const evalObj = p.evaluation || {};
      const sched = p.operatingSchedule || p.schedule || {};
      const schedStr = sched.is24Hours || sched.type === '24_7'
        ? '24/7 Operating'
        : `${sched.startTime || '15:00'} - ${sched.endTime || '07:00'}`;
      const linkedGroups = groups.filter(
        g => (p.linkedGroupIds || []).includes(g.groupId) || (g.linkedPropertyIds || []).includes(p.id)
      );
      const groupNames = linkedGroups.map(g => g.name || g.groupName).join(' | ');

      return [
        p.id || '',
        p.propertyCode || 'N/A',
        p.name || '',
        p.cluster || 'US',
        p.timezone || 'America/New_York',
        evalObj.localTime || '',
        'NOT YET LIVE (ONBOARDING)',
        schedStr,
        p.coverage?.type || 'SHARED',
        linkedGroups.length,
        groupNames || 'None',
        evalObj.reason || 'Awaiting first operational shift / kiosk go-live',
        p.latestEvidence?.summary || p.lastEvidence?.summary || 'WhatsApp group created; awaiting live shift activity'
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
    a.download = `Kiotel_Onboarding_Pending_Properties_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMarkLaunched = async (prop, is24Hours = true) => {
    if (!onSaveProperty) return;
    await onSaveProperty(prop.id, {
      name: prop.name,
      timezone: prop.timezone || 'America/New_York',
      launchStatus: 'LAUNCHED',
      operatingSchedule: {
        type: is24Hours ? '24_7' : 'SCHEDULED',
        is24Hours,
        startTime: is24Hours ? '00:00' : '15:00',
        endTime: is24Hours ? '23:59' : '07:00',
        overnight: !is24Hours,
        verified: true
      },
      coverage: {
        type: prop.coverage?.type || 'SHARED',
        assignedAgents: prop.coverage?.assignedAgents || ['Shared Kiotel Shift Team'],
        confirmed: true,
        coverageConfirmed: true,
        lastConfirmedAt: new Date().toISOString()
      },
      humanVerified: true,
      updatedBy: currentUser,
      evidenceNote: `Marked Launched & Live by ${currentUser}`
    });
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className={`border rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 ${
        isDarkMode
          ? 'bg-slate-900/90 border-indigo-500/30 shadow-lg shadow-indigo-950/20'
          : 'bg-white border-slate-300 shadow-md'
      }`}>
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
            <Rocket className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                Onboarding & Pending Go-Live Properties Register
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40">
                {filteredList.length} Pending Go-Live
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Excel-ready spreadsheet of properties whose WhatsApp groups exist but have not yet started live kiosk shift operations. Copy directly into Excel/Google Sheets or mark properties Live in one click.
            </p>
          </div>
        </div>

        {/* Excel Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyForExcel}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all ${
              copiedTable
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                : isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
            }`}
          >
            {copiedTable ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-indigo-500" />}
            {copiedTable ? 'Copied for Excel / Sheets!' : 'Copy Table for Excel'}
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md"
          >
            <Download className="w-4 h-4" /> Export Excel CSV
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
        isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-300 shadow-sm'
      }`}>
        <div className={`flex items-center gap-2 flex-1 min-w-[240px] max-w-md border px-3 py-1.5 rounded-lg ${
          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
        }`}>
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search onboarding property by name, 4-digit code, or timezone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none w-full font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-slate-600 dark:text-slate-400 font-bold">Region:</span>
          {clusters.map(c => (
            <button
              key={c}
              onClick={() => setClusterFilter(c)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                clusterFilter === c
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isDarkMode
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Excel-Style Spreadsheet Table */}
      <div className={`border rounded-2xl overflow-hidden ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-300 shadow-md'
      }`}>
        <div className={`px-4 py-2.5 border-b flex items-center justify-between text-xs font-extrabold ${
          isDarkMode ? 'bg-slate-950/90 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-800'
        }`}>
          <div className="flex items-center gap-2">
            <Table2 className="w-4 h-4 text-indigo-500" />
            <span>ONBOARDING & PENDING GO-LIVE REGISTER ({filteredList.length} ROWS)</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Click &ldquo;Launch 24/7&rdquo; or &ldquo;Launch Night Shift&rdquo; when property goes live
          </span>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              No Pending Onboarding Properties Match This Filter
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto mt-1">
              All discovered properties matching your filter are already marked as Launched.
            </p>
          </div>
        ) : (
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
                  <th className="py-3 px-3 border-r border-slate-300/60 dark:border-slate-800 whitespace-nowrap">Timezone & Local Time</th>
                  <th className="py-3 px-3 border-r border-slate-300/60 dark:border-slate-800 whitespace-nowrap">Status</th>
                  <th className="py-3 px-3 border-r border-slate-300/60 dark:border-slate-800 min-w-[200px]">Linked WhatsApp Groups</th>
                  <th className="py-3 px-3 border-r border-slate-300/60 dark:border-slate-800 min-w-[220px]">Onboarding Status / Evidence</th>
                  <th className="py-3 px-3 whitespace-nowrap text-right">Quick Go-Live Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {filteredList.map((prop, idx) => {
                  const evalObj = prop.evaluation || {};
                  const linkedGroups = groups.filter(
                    g => (prop.linkedGroupIds || []).includes(g.groupId) || (g.linkedPropertyIds || []).includes(prop.id)
                  );

                  return (
                    <tr
                      key={prop.id}
                      className={`transition-colors ${
                        isDarkMode ? 'hover:bg-slate-800/50 text-slate-200' : 'hover:bg-indigo-50/40 text-slate-900'
                      }`}
                    >
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 text-center font-mono font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 font-mono font-extrabold whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                          {prop.propertyCode ? `#${prop.propertyCode}` : prop.id}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">
                        <div className="font-extrabold text-slate-900 dark:text-white">{prop.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-indigo-500" />
                          <span>{prop.cluster || 'US Region'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 whitespace-nowrap">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{prop.timezone || 'America/New_York'}</div>
                        {evalObj.localTime && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-500" /> Local: <b>{evalObj.localTime}</b>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40">
                          🚀 NOT YET LIVE (ONBOARDING)
                        </span>
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">
                        <div className="flex flex-wrap gap-1">
                          {linkedGroups.length === 0 ? (
                            <span className="text-[11px] text-slate-400">No group linked</span>
                          ) : (
                            linkedGroups.map(g => (
                              <span
                                key={g.groupId}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  isDarkMode
                                    ? 'bg-slate-800 text-slate-300 border-slate-700'
                                    : 'bg-slate-100 text-slate-800 border-slate-300'
                                }`}
                              >
                                {g.name} ({g.messageCount || 0} msgs)
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800/80">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {evalObj.reason || 'WhatsApp group created; awaiting live kiosk launch'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {prop.lastEvidence?.summary || 'No shift handover or check-in messages recorded yet'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleMarkLaunched(prop, true)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] shadow-sm"
                            title="Mark property as Launched with 24/7 coverage"
                          >
                            🟢 Launch 24/7
                          </button>
                          <button
                            onClick={() => handleMarkLaunched(prop, false)}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-[11px] shadow-sm"
                            title="Mark property as Launched with Evening/Night Scheduled hours (15:00 - 07:00)"
                          >
                            🌙 Launch Scheduled
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
