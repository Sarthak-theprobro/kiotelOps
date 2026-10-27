import React from 'react';
import { Sparkles, Copy, Check } from 'lucide-react';

export default function HandoversTab({
  isDarkMode,
  handovers,
  copiedHandoverId,
  onGenerateHandover,
  onCopyHandover
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold">3x Daily Shift Handovers</h2>
          <p className="text-xs text-slate-500">Automated shift reports generated at 07:00, 15:00, and 23:00.</p>
        </div>
        <button 
          onClick={onGenerateHandover} 
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" /> Generate Current Shift Report
        </button>
      </div>

      <div className="space-y-4">
        {handovers.map(h => (
          <div key={h.id} className={`border rounded-xl p-5 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base">{h.shift}</span>
                <span className="text-xs text-slate-400">📅 {h.date}</span>
              </div>
              <button 
                onClick={() => onCopyHandover(h.whatsappText, h.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 text-xs font-semibold hover:bg-blue-100 transition-all"
              >
                {copiedHandoverId === h.id ? (
                  <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> Copy 1-Click WhatsApp</>
                )}
              </button>
            </div>

            <pre className="p-3 rounded-lg font-mono text-xs whitespace-pre-wrap bg-slate-900 text-slate-100 border border-slate-800">
              {h.whatsappText || h.summary}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
