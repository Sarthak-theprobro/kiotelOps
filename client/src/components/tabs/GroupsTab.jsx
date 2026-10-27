import React, { useState } from 'react';
import { 
  FolderGit2, Search, CheckCircle2, HelpCircle, PlusCircle, 
  RefreshCw, Link2, ShieldCheck, X 
} from 'lucide-react';

const GROUP_TYPES = [
  { id: 'PROPERTY', label: '🏨 Single Property Group' },
  { id: 'MULTI_PROPERTY', label: '🏢 Multi-Property / Portfolio Group' },
  { id: 'HANDOVER', label: '🔄 Shift Handover Group' },
  { id: 'INTERNAL_OPS', label: '⚙️ Kiotel Internal Ops / Tech' },
  { id: 'ADMIN_CONTROL', label: '🛡️ Admin / Response Control / Escalation' },
  { id: 'CLIENT_ACCOUNT', label: '🤝 Client / Owner Account Group' },
  { id: 'UNKNOWN', label: '❓ Unknown / Unclassified' }
];

export default function GroupsTab({
  isDarkMode,
  groups = [],
  properties = [],
  currentUser,
  onSyncGroups,
  onUpdateGroup
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('ALL'); // 'ALL' | 'VERIFIED' | 'UNVERIFIED'
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [editingGroup, setEditingGroup] = useState(null);
  const [selectedType, setSelectedType] = useState('PROPERTY');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState([]);
  const [relevanceNote, setRelevanceNote] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const openVerifyModal = (grp) => {
    setEditingGroup(grp);
    setSelectedType(grp.groupType === 'UNKNOWN' ? 'PROPERTY' : (grp.groupType || 'PROPERTY'));
    setSelectedPropertyIds(Array.isArray(grp.linkedPropertyIds) ? grp.linkedPropertyIds : []);
    setRelevanceNote(grp.relevanceReason || '');
  };

  const togglePropertySelection = (propId) => {
    setSelectedPropertyIds(prev =>
      prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]
    );
  };

  const handleSaveGroupVerification = async (e) => {
    e.preventDefault();
    if (!editingGroup || !onUpdateGroup) return;
    await onUpdateGroup(editingGroup.groupId, {
      groupType: selectedType,
      linkedPropertyIds: selectedPropertyIds,
      relevanceReason: relevanceNote.trim() || `Verified as ${selectedType} by ${currentUser}`,
      humanVerified: true,
      updatedBy: currentUser
    });
    setEditingGroup(null);
  };

  const handlePromoteToProperty = async (grp) => {
    if (!onUpdateGroup) return;
    await onUpdateGroup(grp.groupId, {
      groupType: 'PROPERTY',
      createPropertyFromGroup: true,
      humanVerified: true,
      updatedBy: currentUser
    });
  };

  const handleSyncClick = async () => {
    if (!onSyncGroups) return;
    setIsSyncing(true);
    try {
      await onSyncGroups();
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredGroups = groups.filter((g) => {
    if (verifiedFilter === 'VERIFIED' && !g.humanVerified) return false;
    if (verifiedFilter === 'UNVERIFIED' && g.humanVerified) return false;
    if (typeFilter !== 'ALL' && g.groupType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (g.groupName || '').toLowerCase().includes(q);
      const matchId = (g.groupId || '').toLowerCase().includes(q);
      if (!matchName && !matchId) return false;
    }
    return true;
  });

  const verifiedCount = groups.filter(g => g.humanVerified).length;
  const unverifiedCount = groups.length - verifiedCount;

  return (
    <div className="space-y-4">
      {/* Header & Explanation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-indigo-500" />
            WhatsApp Groups Profile & Property Mapping Directory ({groups.length} Imported)
          </h2>
          <p className="text-xs text-slate-500">
            Not every WhatsApp group is a single hotel property. Classify groups as Single Property, Multi-Property, Shift Handover, or Internal Ops, and map them to verified properties.
          </p>
        </div>
        <button
          onClick={handleSyncClick}
          disabled={isSyncing}
          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing WA Groups...' : 'Re-Sync WhatsApp Groups'}</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
        isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className={`flex items-center gap-2 flex-1 min-w-[220px] max-w-md border px-3 py-1.5 rounded-lg ${
          isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search imported WhatsApp groups by subject or JID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs focus:outline-none w-full"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { id: 'ALL', label: `All Groups (${groups.length})` },
            { id: 'UNVERIFIED', label: `❓ Needs Verification (${unverifiedCount})` },
            { id: 'VERIFIED', label: `✅ Human Verified (${verifiedCount})` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setVerifiedFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold ${
                verifiedFilter === f.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs ${
              isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <option value="ALL">All Group Types</option>
            {GROUP_TYPES.map(gt => (
              <option key={gt.id} value={gt.id}>{gt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Groups List */}
      {filteredGroups.length === 0 ? (
        <div className={`border border-dashed rounded-2xl p-10 text-center ${
          isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-300'
        }`}>
          <FolderGit2 className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
          <h3 className="text-sm sm:text-base font-bold">No WhatsApp Groups Imported Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Connect your WhatsApp account via the <b>Connect WA</b> button in the top bar (or click <b>Re-Sync WhatsApp Groups</b> once connected) to import your participating WhatsApp groups for classification.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredGroups.map((g) => {
            const linkedProps = properties.filter(p => (g.linkedPropertyIds || []).includes(p.id));
            return (
              <div
                key={g.groupId}
                className={`border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                  g.humanVerified
                    ? 'border-emerald-500/40 bg-white dark:bg-slate-900'
                    : 'border-amber-500/40 bg-amber-50/10 dark:bg-slate-900/80'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      g.humanVerified
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {g.humanVerified ? '✅ Verified Profile' : '❓ Needs Verification'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {g.groupType}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-sm">{g.groupName}</h4>
                    <p className="text-[10px] font-mono text-slate-400 truncate">JID: {g.groupId}</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] space-y-1">
                    <div>
                      <span className="text-slate-400">Relevance / Classification: </span>
                      <span className="text-slate-700 dark:text-slate-300">{g.relevanceReason || 'Auto-classified from group title'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Linked Properties ({linkedProps.length}): </span>
                      {linkedProps.length === 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">None linked</span>
                      ) : (
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {linkedProps.map(lp => lp.name).join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 flex justify-between pt-1">
                      <span>Participants: {g.participantCount || 0}</span>
                      <span>Synced: {g.lastSyncedAt ? new Date(g.lastSyncedAt).toLocaleTimeString() : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  {linkedProps.length === 0 && (
                    <button
                      onClick={() => handlePromoteToProperty(g)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1"
                      title="Create a new hotel property from this group and link them"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Promote to Property
                    </button>
                  )}
                  <button
                    onClick={() => openVerifyModal(g)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center gap-1 ml-auto"
                  >
                    <Link2 className="w-3.5 h-3.5" /> Classify & Link
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal to Classify Group & Link 1 or Multiple Properties */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold">Verify Group Profile: {editingGroup.groupName}</h3>
                <p className="text-[11px] font-mono text-slate-400">{editingGroup.groupId}</p>
              </div>
              <button onClick={() => setEditingGroup(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGroupVerification} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold block mb-1">1. Group Operational Type:</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
                  }`}
                >
                  {GROUP_TYPES.map(gt => (
                    <option key={gt.id} value={gt.id}>{gt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">
                  2. Associated Hotel Properties (Select 0 for Internal/Handover, 1 for Single Property, or Multiple for Portfolio Groups):
                </label>
                {properties.length === 0 ? (
                  <p className="text-[11px] text-amber-500">
                    No properties created yet. You can click "Promote to Property" on the card or add a property in the Properties Matrix tab.
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-1.5">
                    {properties.map(p => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800">
                        <input
                          type="checkbox"
                          checked={selectedPropertyIds.includes(p.id)}
                          onChange={() => togglePropertySelection(p.id)}
                        />
                        <span className="font-semibold">{p.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">({p.id})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold block mb-1">3. Operational Relevance Note:</label>
                <input
                  type="text"
                  value={relevanceNote}
                  onChange={(e) => setRelevanceNote(e.target.value)}
                  placeholder="e.g., Primary hotel owner + Kiotel front-desk operations group"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <ShieldCheck className="w-4 h-4" /> Save Verified Group Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
