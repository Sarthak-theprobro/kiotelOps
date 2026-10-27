import React, { useState, useEffect } from 'react';
import { 
  QrCode, Phone, RefreshCw, Check, Copy, AlertCircle, 
  ShieldCheck, ArrowRight, Loader2, Sparkles 
} from 'lucide-react';
import { apiUrl } from '../../config';

export default function QrModal({
  showQrModal,
  isDarkMode,
  onClose
}) {
  const [activeTab, setActiveTab] = useState('QR'); // 'QR' or 'PHONE_CODE'
  const [statusState, setStatusState] = useState('CONNECTING'); // 'CONNECTING' | 'WAITING_FOR_SCAN' | 'CONNECTED' | 'QR_EXPIRED' | 'CONNECTION_FAILED'
  const [qrCodeImg, setQrCodeImg] = useState(null);
  const [activeAccount, setActiveAccount] = useState(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  // Phone Pairing State
  const [countryCode, setCountryCode] = useState('91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState(null);
  const [codeInstructions, setCodeInstructions] = useState('');
  const [codeError, setCodeError] = useState('');
  const [isLoadingCode, setIsLoadingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Fetch initial QR & Status
  const fetchStatus = async () => {
    try {
      const res = await fetch(apiUrl('/api/whatsapp/pair'), { method: 'POST' });
      const data = await res.json();
      if (data.state) setStatusState(data.state);
      if (data.qrCode) setQrCodeImg(data.qrCode);
      if (data.activeAccount) setActiveAccount(data.activeAccount);
    } catch (err) {
      setStatusState('CONNECTION_FAILED');
    }
  };

  useEffect(() => {
    if (!showQrModal) return;

    fetchStatus();

    // Poll every 3 seconds while modal is open
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, [showQrModal]);

  // Request fresh QR / Reset session
  const handleResetQr = async () => {
    setIsLoadingQr(true);
    setQrCodeImg(null);
    setStatusState('CONNECTING');
    try {
      const res = await fetch(apiUrl('/api/whatsapp/reset-session'), { method: 'POST' });
      const data = await res.json();
      if (data.status) {
        setStatusState(data.status.state);
        setQrCodeImg(data.status.qrCode);
      }
    } catch (err) {
      setStatusState('CONNECTION_FAILED');
    } finally {
      setIsLoadingQr(false);
    }
  };

  // Request real pairing code
  const handleRequestPairingCode = async (e) => {
    e.preventDefault();
    setCodeError('');
    setPairingCode(null);

    const fullPhone = `${countryCode}${phoneNumber}`.replace(/[^0-9]/g, '');

    if (fullPhone.length < 10 || fullPhone.length > 15) {
      setCodeError('Please enter a valid phone number (10-15 digits including country code).');
      return;
    }

    setIsLoadingCode(true);
    try {
      const res = await fetch(apiUrl('/api/whatsapp/pairing-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone })
      });
      const data = await res.json();

      if (data.success && data.code) {
        setPairingCode(data.formattedCode || data.code);
        setCodeInstructions(data.instructions || 'Open WhatsApp > Linked Devices > Link with phone number instead > Enter this code.');
      } else {
        setCodeError(data.error || 'WhatsApp could not generate pairing code. Please ensure number is correct.');
      }
    } catch (err) {
      setCodeError('Network error connecting to backend server.');
    } finally {
      setIsLoadingCode(false);
    }
  };

  const copyPairingCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode.replace(/-/g, ''));
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!showQrModal) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className={`border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">WhatsApp Multi-Device Link</h3>
              <p className="text-[11px] text-slate-500">Real-time sync for operations monitoring</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-200 text-sm p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Live Status Banner */}
        <div className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between border ${
          statusState === 'CONNECTED' ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' :
          statusState === 'WAITING_FOR_SCAN' ? 'bg-blue-950/40 border-blue-500/40 text-blue-300' :
          statusState === 'QR_EXPIRED' ? 'bg-amber-950/40 border-amber-500/40 text-amber-300' :
          statusState === 'CONNECTION_FAILED' ? 'bg-rose-950/40 border-rose-500/40 text-rose-300' :
          'bg-slate-800/60 border-slate-700 text-slate-300'
        }`}>
          <div className="flex items-center gap-2 font-semibold">
            {statusState === 'CONNECTED' && <ShieldCheck className="w-4 h-4 text-emerald-400" />}
            {statusState === 'WAITING_FOR_SCAN' && <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>}
            {statusState === 'CONNECTING' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
            {statusState === 'QR_EXPIRED' && <AlertCircle className="w-4 h-4 text-amber-400" />}
            {statusState === 'CONNECTION_FAILED' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            
            <span>
              {statusState === 'CONNECTED' ? `Connected: ${activeAccount || 'WhatsApp Live'}` :
               statusState === 'WAITING_FOR_SCAN' ? 'Ready to Scan QR Code' :
               statusState === 'QR_EXPIRED' ? 'QR Code Expired' :
               statusState === 'CONNECTION_FAILED' ? 'Connection Error' :
               'Connecting to WhatsApp servers...'}
            </span>
          </div>

          <button 
            onClick={handleResetQr}
            disabled={isLoadingQr}
            className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            title="Request fresh QR code"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingQr ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Pairing Mode Tabs */}
        {statusState !== 'CONNECTED' && (
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('QR')}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'QR' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" /> Scan QR Code
            </button>
            <button
              onClick={() => setActiveTab('PHONE_CODE')}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'PHONE_CODE' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Phone className="w-3.5 h-3.5" /> 8-Digit Pairing Code
            </button>
          </div>
        )}

        {/* 🟢 VIEW 1: ALREADY CONNECTED */}
        {statusState === 'CONNECTED' && (
          <div className="p-6 text-center space-y-3 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-emerald-400">WhatsApp Multi-Device Active</h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Your account is successfully paired. All group chats and incoming SLA tickets are syncing live to OpsRadar.
            </p>
            <button 
              onClick={handleResetQr}
              className="mt-2 px-3.5 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-semibold hover:bg-rose-900/50 transition-all"
            >
              Disconnect / Link Different Device
            </button>
          </div>
        )}

        {/* 📷 VIEW 2: REAL QR CODE SCAN */}
        {statusState !== 'CONNECTED' && activeTab === 'QR' && (
          <div className="space-y-3 text-center">
            <p className="text-xs text-slate-500">
              Open WhatsApp on your phone ➔ <b>Linked Devices</b> ➔ <b>Link a Device</b> and point camera:
            </p>

            <div className="bg-white p-3 rounded-2xl inline-block mx-auto border border-slate-200 shadow-md">
              {qrCodeImg && statusState === 'WAITING_FOR_SCAN' ? (
                <img src={qrCodeImg} alt="WhatsApp Authentication QR Code" className="w-48 h-48 mx-auto" />
              ) : (
                <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-800 gap-2 p-4">
                  {statusState === 'QR_EXPIRED' ? (
                    <>
                      <AlertCircle className="w-8 h-8 text-amber-500" />
                      <span className="text-xs font-bold text-slate-700">QR Code Expired</span>
                      <button 
                        onClick={handleResetQr}
                        className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow"
                      >
                        Generate Fresh QR
                      </button>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      <span className="text-xs font-bold text-slate-700">Generating Secure QR...</span>
                      <span className="text-[10px] text-slate-400">Connecting to WhatsApp Web</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              Real cryptographic QR authenticated directly via WhatsApp Multi-Device protocol.
            </p>
          </div>
        )}

        {/* 🔢 VIEW 3: REAL 8-DIGIT PHONE PAIRING CODE */}
        {statusState !== 'CONNECTED' && activeTab === 'PHONE_CODE' && (
          <div className="space-y-3.5 text-xs text-left">
            <p className="text-slate-500">
              Link without a camera by requesting an 8-digit code directly from WhatsApp:
            </p>

            <form onSubmit={handleRequestPairingCode} className="space-y-3">
              <div>
                <label className="font-semibold block mb-1">WhatsApp Phone Number:</label>
                <div className="flex gap-2">
                  <div className="flex items-center px-2.5 rounded-xl border bg-slate-100 dark:bg-slate-950 font-mono text-xs border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400">+</span>
                    <input 
                      type="text"
                      maxLength={3}
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-8 bg-transparent text-center font-mono focus:outline-none"
                    />
                  </div>
                  <input 
                    type="tel"
                    placeholder="98111 00001"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className={`flex-1 border rounded-xl p-2.5 font-mono text-sm focus:outline-none ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                    autoFocus
                  />
                </div>
              </div>

              {codeError && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                  <span>{codeError}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoadingCode || !phoneNumber}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                {isLoadingCode ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> <span>Requesting Code from WhatsApp...</span></>
                ) : (
                  <><Sparkles className="w-4 h-4 text-amber-300" /> <span>Generate Real 8-Digit Code</span></>
                )}
              </button>
            </form>

            {pairingCode && (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/50 text-center space-y-2 animate-in zoom-in-95">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">
                  Official WhatsApp Pairing Code
                </span>
                
                <div className="font-mono text-2xl sm:text-3xl font-extrabold tracking-widest text-emerald-300 bg-black/40 py-2 rounded-xl border border-emerald-500/30">
                  {pairingCode}
                </div>

                <p className="text-[11px] text-slate-300 max-w-xs mx-auto">
                  {codeInstructions}
                </p>

                <button 
                  onClick={copyPairingCode}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  {copiedCode ? <><Check className="w-3.5 h-3.5" /> Copied to Clipboard!</> : <><Copy className="w-3.5 h-3.5" /> Copy 8-Digit Code</>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
          <button 
            onClick={onClose} 
            className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
