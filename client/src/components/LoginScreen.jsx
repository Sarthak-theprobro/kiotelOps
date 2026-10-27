import React, { useState } from 'react';
import { Hotel, KeyRound, QrCode, ArrowRight, CheckCircle2, Lock, UserPlus, RefreshCw } from 'lucide-react';
import { EXECUTIVE_USERS } from '../config';

export default function LoginScreen({
  currentUser,
  setCurrentUser,
  users = EXECUTIVE_USERS,
  onSelectUser,
  onAddUser,
  switchingUser = false,
  pinInput,
  setPinInput,
  pinError,
  onLoginSubmit,
  onOpenQr,
  currentShift,
  currentTime,
  isWaConnected,
  waStatus
}) {
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('Operations Manager');
  const [addingUser, setAddingUser] = useState(false);

  const selectedUserObj =
    users.find(u => u.id === currentUser || u.label === currentUser) ||
    users[0] ||
    EXECUTIVE_USERS[0];

  const handleUserClick = (user) => {
    const labelOrId = user.label || user.id;
    setCurrentUser(labelOrId);
    if (onSelectUser) {
      onSelectUser(user);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserName.trim() || !onAddUser) return;
    setAddingUser(true);
    try {
      await onAddUser({ name: newUserName.trim(), role: newUserRole.trim() || 'Operations Manager' });
      setNewUserName('');
      setShowAddUser(false);
    } finally {
      setAddingUser(false);
    }
  };

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
            <span className="text-[11px] sm:text-xs text-slate-400">24/7 Multi-User WhatsApp Operations Control</span>
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
            Select your profile first. Each user connects their own WhatsApp account and sees their exact groups &amp; properties.
          </p>
        </div>

        {/* STEP 1: Select User Profile (Sarthak, Vikas, Dhiren, or + Add User) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-300 block text-xs">
              Step 1 — Select User Profile:
            </label>
            <button
              type="button"
              onClick={() => setShowAddUser(!showAddUser)}
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 rounded-lg transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {showAddUser ? 'Cancel' : '+ Add User'}
            </button>
          </div>

          {showAddUser && (
            <form onSubmit={handleCreateUser} className="p-3 rounded-xl bg-slate-950 border border-blue-500/40 space-y-2.5">
              <div className="text-[11px] font-bold text-blue-300">Add New Operations User (Own WhatsApp Workspace)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Name (e.g., Rohan)"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Role (e.g., Shift Lead)"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={addingUser}
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all"
              >
                {addingUser ? 'Creating User Workspace...' : 'Create User & Switch to Their Workspace'}
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
            {users.map(user => {
              const userKey = user.label || user.id;
              const isSelected = currentUser === userKey || currentUser === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleUserClick(user)}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-white ring-2 ring-blue-500/30'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <div>
                    <span className="font-bold text-sm text-white flex items-center gap-1.5">
                      {user.icon || '👤'} {user.name}
                    </span>
                    <span className="text-[11px] text-slate-400 block">{user.role}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSelected && switchingUser && (
                      <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                    )}
                    {isSelected && !switchingUser && (
                      <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: Mandatory Per-User WhatsApp QR / Phone Pairing Gate */}
        <div className={`p-4 rounded-2xl border space-y-3 ${
          isWaConnected
            ? 'bg-emerald-950/30 border-emerald-500/40'
            : 'bg-rose-950/30 border-rose-500/40'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-extrabold">
              <span className={`w-2.5 h-2.5 rounded-full ${isWaConnected ? 'bg-emerald-400' : 'bg-rose-500 animate-ping'}`}></span>
              <span className={isWaConnected ? 'text-emerald-300' : 'text-rose-300'}>
                {isWaConnected
                  ? `STEP 2 COMPLETE: ${selectedUserObj.name.toUpperCase()}'S WHATSAPP CONNECTED`
                  : `STEP 2 REQUIRED: LINK ${selectedUserObj.name.toUpperCase()}'S WHATSAPP`}
              </span>
            </div>
            {isWaConnected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          </div>

          {!isWaConnected ? (
            <>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <b className="text-white">{selectedUserObj.name}</b>&apos;s WhatsApp is not connected yet. Scan the QR Code or use the <b className="text-white">8-Digit Phone Pairing Code</b> to connect {selectedUserObj.name}&apos;s WhatsApp and load their groups &amp; properties.
              </p>
              <button
                type="button"
                onClick={onOpenQr}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <QrCode className="w-4 h-4" /> Connect {selectedUserObj.name}&apos;s WhatsApp (QR / Phone Code)
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>
                Connected ({waStatus?.syncedGroupsCount || 0} groups • {waStatus?.verifiedPropertiesCount || 0} properties)
              </span>
              <button
                type="button"
                onClick={onOpenQr}
                className="text-emerald-400 hover:underline font-bold"
              >
                Re-Link / View QR
              </button>
            </div>
          )}
        </div>

        {/* STEP 3: Security PIN Form (Disabled until selected user's WhatsApp is connected!) */}
        <form onSubmit={onLoginSubmit} className="pt-2 border-t border-slate-800/80 space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-300 block mb-1.5">
              {isWaConnected
                ? `Step 3 — Enter 4-Digit Security Passcode for ${selectedUserObj.name}:`
                : `Passcode Locked Until ${selectedUserObj.name}'s WhatsApp is Linked:`}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              disabled={!isWaConnected}
              placeholder={isWaConnected ? '• • • •' : 'LINK WHATSAPP IN STEP 2 FIRST'}
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
                <span>Open {selectedUserObj.name}&apos;s Command Center</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Connect {selectedUserObj.name}&apos;s WhatsApp Above First</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Bottom Footer */}
      <div className="text-center text-xs text-slate-600 border-t border-slate-900 pt-3">
        Kiotel Operations Intelligence • Multi-User Isolated WhatsApp Workspaces ({users.map(u => u.name).join(' • ')})
      </div>
    </div>
  );
}
