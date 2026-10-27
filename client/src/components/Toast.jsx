import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getBg = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200';
      case 'error':
        return 'bg-rose-950/90 border-rose-500/40 text-rose-200';
      default:
        return 'bg-slate-900/95 border-blue-500/40 text-slate-100';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-semibold ${getBg()}`}>
        {getIcon()}
        <span>{toast.message}</span>
        <button 
          onClick={onClose} 
          className="ml-2 p-0.5 text-slate-400 hover:text-white rounded-md transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
