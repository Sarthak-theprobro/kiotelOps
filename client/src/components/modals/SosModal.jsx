import React from 'react';
import { ShieldAlert, Check, Copy } from 'lucide-react';

export default function SosModal({
  activeSosAlert,
  copiedSosText,
  onCopySos,
  onClose
}) {
  if (!activeSosAlert) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-rose-950 border-2 border-rose-500 text-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
          <ShieldAlert className="w-6 h-6 animate-bounce" /> 🚨 5-MINUTE SLA BREACH SOS ALERT!
        </div>
        <pre className="p-3 bg-black/60 rounded-xl font-mono text-xs whitespace-pre-wrap border border-rose-900/60 text-slate-200">
          {activeSosAlert.alertMessage}
        </pre>
        <div className="flex gap-2">
          <button 
            onClick={onCopySos}
            className="flex-1 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all"
          >
            {copiedSosText ? <><Check className="w-3.5 h-3.5" /> Copied SOS!</> : <><Copy className="w-3.5 h-3.5" /> Copy SOS WhatsApp</>}
          </button>
          <button 
            onClick={onClose} 
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
}
