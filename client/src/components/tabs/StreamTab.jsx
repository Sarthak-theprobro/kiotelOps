import React from 'react';

export default function StreamTab({
  isDarkMode,
  messages = []
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold">Live WhatsApp Operational Stream (All Monitored Groups)</h2>
          <p className="text-xs text-slate-500">
            Displays real-time and synced group messages with 4-dimension operational classification (Importance, Seriousness, Response Needed, Resolution Impact).
          </p>
        </div>
        <span className="text-xs text-slate-500 font-mono">{messages.length} messages captured</span>
      </div>
      <div className={`border rounded-xl divide-y ${isDarkMode ? 'bg-slate-900/60 border-slate-800 divide-slate-800' : 'bg-white border-slate-200 divide-slate-100 shadow-sm'}`}>
        {messages.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No WhatsApp messages ingested yet. Connect your WhatsApp account or use the Test Sandbox button to evaluate messages.
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className="p-3.5 flex flex-wrap items-start justify-between text-xs gap-4">
              <div className="space-y-1 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {m.propertyName || m.groupName || m.groupId}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    m.isTeam 
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' 
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}>
                    {m.senderRole || (m.isTeam ? 'KIOTEL_AGENT' : 'HOTEL_SIDE')}
                  </span>
                  <span className="text-slate-400 text-[11px]">👤 {m.senderName}</span>
                  {m.analysis?.importance?.level && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      m.analysis.importance.level === 'HIGH' ? 'bg-rose-500/15 text-rose-500' :
                      m.analysis.importance.level === 'MEDIUM' ? 'bg-amber-500/15 text-amber-500' :
                      'bg-slate-500/15 text-slate-400'
                    }`}>
                      Importance: {m.analysis.importance.level}
                    </span>
                  )}
                  {m.analysis?.seriousness?.level && m.analysis.seriousness.level !== 'LOW' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-400">
                      {m.analysis.seriousness.level} • {m.analysis.seriousness.category}
                    </span>
                  )}
                </div>
                <p className="font-mono text-slate-700 dark:text-slate-300">{m.text}</p>
                {m.analysis?.importance?.reason && (
                  <p className="text-[10px] text-slate-400">
                    Analysis: {m.analysis.importance.reason}
                  </p>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                {new Date(m.timestamp).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
