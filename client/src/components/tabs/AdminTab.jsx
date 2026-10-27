import React, { useState } from 'react';
import { 
  ShieldCheck, Lock, Users, FileCheck2, RefreshCw, Plus, CheckCircle2, KeyRound 
} from 'lucide-react';

export default function AdminTab({
  isDarkMode,
  currentUser,
  team = [],
  auditLogs = [],
  onAddTeamMember,
  onChangePin,
  onSyncGroups
}) {
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  // New team member form
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('Remote Front-Desk Agent');
  const [memberShift, setMemberShift] = useState('Morning Shift');
  const [memberPhone, setMemberPhone] = useState('');

  const handlePinUpdate = (e) => {
    e.preventDefault();
    if (newPin.length < 4) {
      setPinMsg('PIN must be at least 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinMsg('PIN confirmation does not match.');
      return;
    }
    if (onChangePin) {
      onChangePin(newPin);
      setNewPin('');
      setConfirmPin('');
      setPinMsg('✅ Security PIN updated! Required on next End Session (Break Lock) or Login.');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberName.trim() || !onAddTeamMember) return;
    await onAddTeamMember({
      name: memberName.trim(),
      role: memberRole,
      shift: memberShift,
      phone: memberPhone.trim(),
      updatedBy: currentUser
    });
    setMemberName('');
    setMemberPhone('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            Admin Control Center, Security PIN & Audit Trail
          </h2>
          <p className="text-xs text-slate-500">
            Manage session lock security PIN, Kiotel operations roster, and inspect human-verified changes & outbound message dispatches.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 1. Security PIN Configuration */}
        <div className="lg:col-span-5 space-y-5">
          <div className={`border rounded-2xl p-5 space-y-4 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-sm font-extrabold">Session Lock & Login Security PIN</h3>
                <p className="text-[11px] text-slate-400">
                  Used to unlock the app after clicking <b>End Session (Break Lock)</b> or after signing out. Never displayed on screen.
                </p>
              </div>
            </div>

            <form onSubmit={handlePinUpdate} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold block mb-1">New 4-Digit PIN:</label>
                  <input
                    type="password"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="••••"
                    className={`w-full px-3 py-2 rounded-lg border font-mono tracking-widest ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Confirm New PIN:</label>
                  <input
                    type="password"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="••••"
                    className={`w-full px-3 py-2 rounded-lg border font-mono tracking-widest ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
                    }`}
                  />
                </div>
              </div>
              {pinMsg && (
                <p className="text-[11px] font-bold text-emerald-500">{pinMsg}</p>
              )}
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm"
              >
                Update Security PIN
              </button>
            </form>
          </div>

          {/* 2. Kiotel Team Roster */}
          <div className={`border rounded-2xl p-5 space-y-4 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-extrabold">Kiotel Staff & Shift Roster ({team.length})</h3>
                <p className="text-[11px] text-slate-400">
                  Staff phone numbers registered here are automatically recognized as Kiotel Team members in WhatsApp group analysis.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddMember} className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                placeholder="Staff Name (e.g. Rohan)"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className={`px-3 py-1.5 rounded-lg border ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
                }`}
              />
              <input
                type="text"
                placeholder="WhatsApp Phone (+91...)"
                value={memberPhone}
                onChange={(e) => setMemberPhone(e.target.value)}
                className={`px-3 py-1.5 rounded-lg border font-mono ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
                }`}
              />
              <select
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                className={`px-2.5 py-1.5 rounded-lg border ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
                }`}
              >
                <option value="Remote Front-Desk Agent">Remote Front-Desk Agent</option>
                <option value="Shift Lead">Shift Lead</option>
                <option value="Tech Support Engineer">Tech Support Engineer</option>
                <option value="Operations Manager">Operations Manager</option>
              </select>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add to Roster
              </button>
            </form>

            <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs">
              {team.length === 0 ? (
                <p className="text-slate-400 text-[11px]">No custom staff added yet.</p>
              ) : (
                team.map((m) => (
                  <div key={m.id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold">{m.name}</span>
                      <span className="text-[10px] text-slate-400 block">{m.role} • {m.shift}</span>
                    </div>
                    <span className="font-mono text-[11px] text-blue-500">{m.phone || 'N/A'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 3. Immutable Human Verification & Outbound Message Audit Log */}
        <div className="lg:col-span-7">
          <div className={`border rounded-2xl p-5 space-y-3 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-500" />
                <div>
                  <h3 className="text-sm font-extrabold">Human Verification & Outbound Message Audit Trail ({auditLogs.length})</h3>
                  <p className="text-[11px] text-slate-400">
                    Every property configuration, group mapping, incident override, and human-approved WhatsApp message is logged here.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 text-xs">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  No audit actions recorded yet.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold text-[10px]">
                        {log.actionType}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      Actor: <b>{log.actor}</b> • Target: <code className="font-mono">{log.targetId}</code>
                    </div>
                    {log.details && (
                      <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
