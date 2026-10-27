import React from 'react';
import { Hotel, KeyRound, QrCode, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { EXECUTIVE_USERS } from '../config';

export default function LoginScreen({
  currentUser,
  setCurrentUser,
  pinInput,
  setPinInput,
  pinError,
  onLoginSubmit,
  onOpenQr,
  currentShift,
  currentTime,
  isWaConnected
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Hotel className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg text-white">
              KIOTEL <span className="text-blue-500">OPERATIONS INTELLIGENCE</span>
            </h1>
            <span className="text-[11px] sm:text-xs text-slate-400">24/7 Remote Front-Desk & Multi-User Operations Control</span>
          </div>
        </div>

        <div className="text-right hidden sm:block">
          <span className="text-[10px] text-slate-400 block font-bold uppercase">{currentShift.name}</span>
          <span className="font-mono text-xs text-blue-400 font-bold">{currentTime}</span>
        </div>
      </div>

      {/* Login Card */}
      <div className="max-w-md mx-auto w-full my-6 bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-5">
        <div className="text-center space-y-1">
          <div className="inline-flex p-3 rounded-2xl bg-blue-600/20 text-blue-400 mb-2">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white">Sign In to Operations Command</h2>
          <p className="text-xs text-slate-400">
            {isWaConnected
              ? 'WhatsApp Session Connected. Select your user profile (Sarthak, Vikas, or Dhiren) and enter your 4-digit passcode.'
              : 'Full Log Out Active — Scan WhatsApp QR Code or enter 8-Digit Phone Pairing Code first to enable sign-in.'}
          </p>
        </div>

        {/* Step 1: Mandatory WhatsApp QR / Phone Pairing Gate when Logged Out */}
        <div className={`p-4 rounded-2xl border space-y-3 ${
          isWaConnected
            ? 'bg-emerald-950/30 border-emerald-500/40'
            : 'bg-rose-950/30 border-rose-500/40'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-extrabold">
              <span className={`w-2.5 h-2.5 rounded-full ${isWaConnected ? 'bg-emerald-400' : 'bg-rose-500 animate-ping'}`}></span>
              <span className={isWaConnected ? 'text-emerald-300' : 'text-rose-300'}>
                {isWaConnected ? 'STEP 1 COMPLETE: WHATSAPP CONNECTED' : 'STEP 1 REQUIRED: LINK WHATSAPP'}
              </span>
            </div>
            {isWaConnected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          </div>

          {!isWaConnected ? (
            <>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                After a full Log Out, <b className="text-white">passcode entry is disabled</b> until a WhatsApp account is paired (via QR Code or 8-Digit Phone Code on mobile). Each user&apos;s WhatsApp automatically loads their exact groups and properties.
              </p>
              <button
                type="button"
                onClick={onOpenQr}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <QrCode className="w-4 h-4" /> Scan QR or Pair with Phone Number
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>Live WhatsApp session active.</span>
              <button
                type="button"
                onClick={onOpenQr}
                className="text-emerald-400 hover:underline font-bold"
              >
                Switch WhatsApp Account
              </button>
            </div>
          )}
        </div>

        {/* Profile Selector: Sarthak, Vikas, Dhiren */}
        <div className={`space-y-2 ${!isWaConnected ? 'opacity-50 pointer-events-none' : ''}`}>
          <label className="font-semibold text-slate-300 block text-xs">Step 2 — Select User Profile (Sarthak / Vikas / Dhiren):</label>
          <div className="grid grid-cols-1 gap-2">
            {EXECUTIVE_USERS.map(user => (
              <button
                key={user.id}
                type="button"
                disabled={!isWaConnected}
                onClick={() => setCurrentUser(user.id)}
                className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                  currentUser === user.id 
                    ? 'bg-blue-600/20 border-blue-500 text-white ring-2 ring-blue-500/30' 
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                }`}
              >
                <div>
                  <span className="font-bold text-sm text-white flex items-center gap-1.5">
                    {user.icon} {user.name}
                  </span>
                  <span className="text-[11px] text-slate-400 block">{user.role}</span>
                </div>
                {currentUser === user.id && (
                  <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Secret Security PIN Form (Disabled until QR is scanned!) */}
        <form onSubmit={onLoginSubmit} className="pt-2 border-t border-slate-800/80 space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-300 block mb-1.5">
              {isWaConnected ? 'Step 3 — Enter 4-Digit Security Passcode:' : 'Passcode Locked Until WhatsApp Linked:'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              disabled={!isWaConnected}
              placeholder={isWaConnected ? '• • • •' : 'LINK WA FIRST'}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className={`w-full border rounded-xl p-3 text-center text-xl tracking-widest font-mono transition-colors ${
                isWaConnected
                  ? 'bg-slate-950 border-slate-800 text-white focus:outline-none focus:border-blue-500'
                  : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            />
          </div>

          {pinError && <p className="text-xs text-rose-400 text-center font-medium">{pinError}</p>}

          <button 
            type="submit"
            disabled={!isWaConnected}
            className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              isWaConnected
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isWaConnected ? (
              <>
                <span>Authenticate & Open Command Center</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Link WhatsApp Above to Enable Login</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Bottom Footer */}
      <div className="text-center text-xs text-slate-600 border-t border-slate-900 pt-3">
        Kiotel Operations Intelligence • Sarthak • Vikas • Dhiren
      </div>
    </div>
  );
}
