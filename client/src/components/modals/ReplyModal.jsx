import React, { useState } from 'react';
import { 
  Send, Wand2, ShieldAlert, ShieldCheck, AlertTriangle, 
  Copy, Check, ArrowRight, User 
} from 'lucide-react';
import { apiUrl } from '../../config';

export default function ReplyModal({
  isDarkMode,
  replyTicket,
  replyDraft,
  setReplyDraft,
  currentUser,
  isWaConnected,
  onClose,
  onPolishDraft,
  onConfirmSend,
  onCopyDraft
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  if (!replyTicket) return null;

  const senderDisplay = replyTicket.ownerName || replyTicket.reportedBy?.name || 'Group Participant';
  const queryText = replyTicket.messageText || replyTicket.summary || '';
  const targetGroupJid = replyTicket.groupId || replyTicket.sourceGroupId || '';
  const targetPropertyId = replyTicket.propertyId || null;
  const targetPropertyName = replyTicket.propertyName || replyTicket.groupName || 'Linked Group';

  const handleDraftChange = (e) => {
    setReplyDraft(e.target.value);
    setIsConfirming(false); // Invalidate confirmation if draft text changes
    setSendError('');
  };

  const handleProceedToConfirmation = () => {
    if (!replyDraft.trim()) return;
    setIsConfirming(true);
    setSendError('');
  };

  const handleExecuteSend = async () => {
    setIsSending(true);
    setSendError('');
    try {
      const res = await fetch(apiUrl('/api/whatsapp/send-message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientJid: targetGroupJid,
          text: replyDraft,
          approvedBy: currentUser,
          propertyId: targetPropertyId,
          explicitHumanConfirmation: true
        })
      });
      const data = await res.json();

      if (data.success) {
        onConfirmSend(data);
      } else {
        setSendError(data.error || 'Failed to dispatch message to WhatsApp.');
      }
    } catch (err) {
      setSendError('Network error connecting to dispatch gateway.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className={`border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              {targetPropertyId && (
                <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                  {targetPropertyId}
                </span>
              )}
              <h3 className="font-extrabold text-base">{targetPropertyName}</h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Target Group JID: <code className="font-mono text-slate-500 dark:text-slate-300">{targetGroupJid}</code>
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-200 text-sm p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Incoming Client Query Box */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400 font-semibold text-[10px] uppercase">
            <span className="flex items-center gap-1"><User className="w-3 h-3" /> Message from {senderDisplay}:</span>
            <span>{replyTicket.createdAt ? new Date(replyTicket.createdAt).toLocaleTimeString() : 'Recent'}</span>
          </div>
          <p className="font-mono text-slate-800 dark:text-slate-200">
            "{queryText}"
          </p>
        </div>

        {/* ⚠️ Disconnected Notice */}
        {!isWaConnected && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">WhatsApp Device Not Linked</p>
              <p className="text-[11px] text-amber-400/90 mt-0.5">
                Live WhatsApp dispatch is disabled until your WhatsApp account is paired. You can still draft, polish, and copy this response to your clipboard.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {sendError && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{sendError}</span>
          </div>
        )}

        {/* Step 1: Draft & AI Polisher */}
        {!isConfirming && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Response Draft (No message is sent until you explicitly authorize in Step 2):
                </label>
                <button 
                  onClick={onPolishDraft}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all"
                >
                  <Wand2 className="w-3.5 h-3.5 text-indigo-500" /> ✨ Polish Tone
                </button>
              </div>

              <textarea 
                rows={3} 
                value={replyDraft} 
                onChange={handleDraftChange}
                className={`w-full border rounded-xl p-3 font-mono text-xs focus:outline-none focus:border-blue-500 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
                placeholder="Type your response here..."
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <button 
                onClick={onClose} 
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => onCopyDraft(replyDraft)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Draft Only
                </button>

                {isWaConnected && (
                  <button 
                    onClick={handleProceedToConfirmation}
                    disabled={!replyDraft.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50 transition-all active:scale-95"
                  >
                    <span>Step 2: Review & Authorize</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Explicit Human Approval Confirmation Gate */}
        {isConfirming && (
          <div className="space-y-4 animate-in zoom-in-95">
            <div className="p-4 rounded-2xl bg-blue-950/30 border-2 border-blue-500/50 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <span>Explicit Human Dispatch Authorization Gate</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <div><span className="text-slate-400 block">Target Group / Property:</span> <b className="text-white">{targetPropertyName}</b></div>
                <div><span className="text-slate-400 block">Recipient Group JID:</span> <b className="font-mono text-blue-300 truncate block">{targetGroupJid}</b></div>
                <div><span className="text-slate-400 block">Approved By:</span> <b className="text-emerald-400">{currentUser}</b></div>
                <div><span className="text-slate-400 block">Audit Trail:</span> <b className="text-emerald-400">Logged to Audit Store</b></div>
              </div>

              <div className="p-2.5 bg-slate-950/80 rounded-xl border border-blue-900/40 font-mono text-xs text-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Exact Outbound Payload:</span>
                "{replyDraft}"
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <button 
                onClick={() => setIsConfirming(false)} 
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold"
              >
                Back to Edit
              </button>

              <button 
                onClick={handleExecuteSend}
                disabled={isSending}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'Dispatching...' : 'Authorize & Send to WhatsApp Now'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
