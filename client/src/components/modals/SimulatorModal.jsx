import React from 'react';
import { Send, FlaskConical, AlertCircle } from 'lucide-react';

export default function SimulatorModal({
  showSimModal,
  isDarkMode,
  properties,
  simPropId,
  setSimPropId,
  simType,
  setSimType,
  simText,
  setSimText,
  onClose,
  onSimulate
}) {
  if (!showSimModal) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className={`border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Internal Operations Simulator</h3>
              <p className="text-[11px] text-slate-500">Dry-run test lab for SLA watchdog & keywords</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-200 text-sm p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Safety Notice Banner */}
        <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-[11px] text-blue-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span><b>Dry-Run Mode:</b> Injects test scenarios into the local radar without contacting external WhatsApp numbers.</span>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Target Test Property:</label>
            <select 
              value={simPropId} 
              onChange={(e) => setSimPropId(e.target.value)}
              className={`w-full border rounded-xl p-2.5 font-medium ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
            >
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.id} — {p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Select Test Scenario:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setSimType('OWNER_QUERY'); setSimText('Guest at Kiosk 1 says payment timed out! Please assist.'); }}
                className={`p-2.5 rounded-xl border text-left font-semibold text-[11px] transition-all ${
                  simType === 'OWNER_QUERY' 
                    ? 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20' 
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                🚨 Owner Query (Starts 5m SLA)
              </button>
              <button
                type="button"
                onClick={() => { setSimType('KIOSK_LIVE'); setSimText('Kiosk is live and operational for today.'); }}
                className={`p-2.5 rounded-xl border text-left font-semibold text-[11px] transition-all ${
                  simType === 'KIOSK_LIVE' 
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20' 
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                🟢 Agent: "Kiosk Live"
              </button>
              <button
                type="button"
                onClick={() => { setSimType('KIOSK_CLOSED'); setSimText('Kiosk closed for the day. Shift ended.'); }}
                className={`p-2.5 rounded-xl border text-left font-semibold text-[11px] transition-all ${
                  simType === 'KIOSK_CLOSED' 
                    ? 'bg-slate-200 border-slate-400 text-slate-900 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 ring-2 ring-slate-500/20' 
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                🌙 Agent: "Kiosk Closed"
              </button>
              <button
                type="button"
                onClick={() => { setSimType('TECH_BUG'); setSimText('Passport scanner jammed on Kiosk 2. Remote reboot failed.'); }}
                className={`p-2.5 rounded-xl border text-left font-semibold text-[11px] transition-all ${
                  simType === 'TECH_BUG' 
                    ? 'bg-indigo-100 border-indigo-400 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/20' 
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                🔧 Hardware Fault / Tech Bug
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Simulated WhatsApp Text:</label>
            <textarea 
              rows={2} 
              value={simText} 
              onChange={(e) => setSimText(e.target.value)}
              className={`w-full border rounded-xl p-2.5 font-mono text-xs focus:outline-none focus:border-blue-500 ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button 
            onClick={onClose} 
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold"
          >
            Cancel
          </button>
          <button 
            onClick={onSimulate} 
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Inject Test Scenario
          </button>
        </div>
      </div>
    </div>
  );
}
