import React from 'react';
import { Hotel, ShieldCheck, Unlock, LogOut, QrCode, Lock } from 'lucide-react';

export default function GlanceLockscreen({
  currentUser,
  currentShift,
  currentTime,
  properties,
  incidents,
  whatsappGroups,
  isWaConnected,
  pinInput,
  setPinInput,
  pinError,
  onPinSubmit,
  onOpenQr,
  onFullLogout
}) {
  const liveCount = properties.filter(p => p.evaluation?.status === 'LIVE').length;
  const outsideCount = properties.filter(p => p.evaluation?.status === 'OUTSIDE_HOURS').length;
  const atRiskCount = properties.filter(p => p.evaluation?.status === 'AT_RISK').length;
  const unknownCount = properties.filter(p => !p.evaluation || p.evaluation?.status === 'UNKNOWN').length;
  const awaitingResponseCount = (incidents || []).filter(i => i.resolutionState === 'AWAITING_RESPONSE').length;
  const unresolvedCount = (incidents || []).filter(i => i.resolutionState !== 'RESOLVED_VERIFIED').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Lockscreen Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Hotel className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-white">
              KIOTEL <span className="text-blue-500">OPERATIONS INTELLIGENCE</span>
            </h1>
            <span className="text-xs text-slate-400">Session Paused (Break Mode) • Background Monitoring Active</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> BACKGROUND WATCHDOG RUNNING
          </span>
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-slate-400 block font-bold uppercase">{currentShift.name}</span>
            <span className="font-mono text-xs text-blue-400 font-bold">{currentTime}</span>
          </div>
        </div>
      </div>

      {/* Main Glance Panel */}
      <div className="max-w-4xl mx-auto w-full my-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Left Side: Live Counters */}
        <div className="md:col-span-7 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
          <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Live Operations Status Glance
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block">🟢 Verified Live</span>
              <span className="text-xl font-bold text-emerald-400">{liveCount}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block">🌙 Outside Hours</span>
              <span className="text-xl font-bold text-slate-300">{outsideCount}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block">🚨 At Risk</span>
              <span className="text-xl font-bold text-rose-400">{atRiskCount}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block">❓ Needs Verification</span>
              <span className="text-xl font-bold text-amber-400">{unknownCount}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block">⏳ Awaiting Reply</span>
              <span className="text-xl font-bold text-amber-400">{awaitingResponseCount}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block">⚠️ Unresolved Issues</span>
              <span className="text-xl font-bold text-indigo-400">{unresolvedCount}</span>
            </div>
          </div>

          <div className="p-3 bg-blue-950/30 border border-blue-900/40 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isWaConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`}></span>
              <span>
                WhatsApp: <b>{isWaConnected ? `🟢 Connected (${(whatsappGroups || []).length} Groups)` : '⚪ Disconnected'}</b>
              </span>
            </div>
            <button 
              onClick={onOpenQr} 
              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] flex items-center gap-1"
            >
              <QrCode className="w-3.5 h-3.5" /> WhatsApp Status
            </button>
          </div>
        </div>

        {/* Right Side: Strict PIN Unlock Box (No bypass button, no visible PIN) */}
        <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="text-center">
            <div className="inline-flex p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 mb-2">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-white">Session Ended (Break Lock)</h3>
            <p className="text-xs text-slate-400">Locked by <b className="text-slate-200">{currentUser}</b></p>
          </div>

          <form onSubmit={onPinSubmit} className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">Enter 4-Digit Security PIN to Resume:</label>
              <input
                type="password"
                maxLength={4}
                placeholder="• • • •"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-xl tracking-widest font-mono text-white focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            {pinError && <p className="text-xs text-rose-400 text-center font-medium">{pinError}</p>}

            <button 
              type="submit" 
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <Unlock className="w-4 h-4" /> Unlock Session
            </button>
          </form>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Protected by PIN</span>
            <button 
              onClick={onFullLogout}
              className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Full Log Out & Disconnect
            </button>
          </div>
        </div>
      </div>

      {/* Bottom info */}
      <div className="text-center text-xs text-slate-600 border-t border-slate-900 pt-3">
        Kiotel Operations Intelligence • Break Lock Active
      </div>
    </div>
  );
}
