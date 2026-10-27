import React from 'react';
import { 
  Hotel, Clock, Volume2, VolumeX, Sun, Moon, Send, QrCode, Lock, LogOut, ShieldCheck, UserCheck
} from 'lucide-react';
import { EXECUTIVE_USERS } from '../config';

export default function Header({
  isDarkMode,
  setIsDarkMode,
  soundEnabled,
  setSoundEnabled,
  currentUser,
  setCurrentUser,
  activeWaAccount,
  currentShift,
  currentTime,
  isWaConnected,
  groupsCount = 0,
  verifiedPropertiesCount = 0,
  onOpenSimModal,
  onOpenQrModal,
  onOpenAdminTab,
  onLockScreen,
  onLogout
}) {
  return (
    <header className={`border-b sticky top-0 z-40 px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 transition-colors ${
      isDarkMode ? 'border-slate-800 bg-slate-900/95 backdrop-blur-md' : 'border-slate-300 bg-white/95 shadow-sm'
    }`}>
      {/* Brand & User info */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white flex-shrink-0">
          <Hotel className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className={`font-extrabold text-sm sm:text-lg tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              KIOTEL <span className="text-blue-600">OPS INTELLIGENCE</span>
            </h1>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border flex items-center gap-1 ${
              isWaConnected 
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40' 
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isWaConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              {isWaConnected
                ? `WA LIVE (${groupsCount} Grps • ${verifiedPropertiesCount} Props${activeWaAccount ? ` • ${activeWaAccount}` : ''})`
                : 'WA NOT LINKED'}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 hidden sm:block">
            Multi-User Real-Time Command • Active Profile: <b className="text-slate-900 dark:text-white">{currentUser}</b>
          </p>
        </div>
      </div>

      {/* Shift Badge & Clock */}
      <div className={`hidden xl:flex items-center gap-3 border px-3.5 py-1.5 rounded-xl text-xs ${
        isDarkMode ? 'bg-slate-950/60 border-slate-800 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'
      }`}>
        <div className="flex items-center gap-2 border-r pr-3 border-slate-300 dark:border-slate-800">
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Active Shift</span>
            <span className="font-semibold text-xs">{currentShift?.name || 'Operations Shift'}</span>
          </div>
        </div>
        <div>
          <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 block">System Clock</span>
          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">{currentTime}</span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        {/* Quick User Switcher (Sarthak / Vikas / Dhiren) */}
        {setCurrentUser && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs ${
            isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-900'
          }`}>
            <UserCheck className="w-3.5 h-3.5 text-blue-500 hidden sm:inline" />
            <select
              value={currentUser}
              onChange={(e) => {
                setCurrentUser(e.target.value);
                sessionStorage.setItem('kiotel_auth_user', e.target.value);
              }}
              className="bg-transparent font-bold text-[11px] sm:text-xs focus:outline-none cursor-pointer"
              title="Switch active user profile (Sarthak / Vikas / Dhiren)"
            >
              {EXECUTIVE_USERS.map(u => (
                <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                  {u.icon} {u.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sound toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-1.5 sm:p-2 rounded-lg border transition-all ${
            soundEnabled 
              ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300' 
              : 'bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-700'
          }`}
          title={soundEnabled ? "Sound Alarms Enabled" : "Sound Alarms Muted"}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Dark / Light Mode toggle */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`p-1.5 sm:p-2 rounded-lg border text-xs font-semibold transition-all ${
            isDarkMode ? 'bg-slate-800 border-slate-700 text-amber-300' : 'bg-slate-100 border-slate-300 text-slate-800'
          }`}
          title="Toggle Day (Light) / Night (Dark) Mode"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-600" />}
        </button>

        {/* Simulate WhatsApp message (Testing / QA Sandbox) */}
        <button 
          onClick={onOpenSimModal}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-all"
          title="Inject a test message locally into the analysis engine"
        >
          <Send className="w-3.5 h-3.5 text-blue-500" /> <span>Test Sandbox</span>
        </button>
        
        {/* WhatsApp QR / Phone Pair link */}
        <button 
          onClick={onOpenQrModal}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-extrabold shadow-sm transition-all ${
            isWaConnected
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-blue-600 hover:bg-blue-700 border-blue-500 text-white'
          }`}
          title="Connect or Switch WhatsApp Multi-Device Session (QR or 8-Digit Phone Code)"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>{isWaConnected ? 'WA Linked' : 'Connect WA'}</span>
        </button>

        {/* Admin & Verification Button */}
        {onOpenAdminTab && (
          <button
            onClick={onOpenAdminTab}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-xs font-extrabold transition-all"
            title="Open Admin Controls, PIN Security & Audit Logs"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Admin</span>
          </button>
        )}

        {/* 🔒 End Session (Break Lock — Keeps background running, requires PIN to unlock) */}
        <button 
          onClick={onLockScreen}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 border-amber-400 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-extrabold transition-all shadow-sm active:scale-95"
          title="End Active Session for Break (Keeps WhatsApp monitoring running; requires PIN to resume)"
        >
          <Lock className="w-3.5 h-3.5" /> 
          <span>End Session</span>
        </button>

        {/* 🚪 Full Logout Button (Disconnects WhatsApp & Signs Out) */}
        <button 
          onClick={onLogout}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs font-extrabold transition-all shadow-sm active:scale-95"
          title="Complete Log Out & Disconnect WhatsApp Session"
        >
          <LogOut className="w-3.5 h-3.5" /> 
          <span>Log Out</span>
        </button>
      </div>
    </header>
  );
}
