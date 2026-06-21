import { useEffect, useState, useRef } from "react";
import PINModal from "./PINModal";

/**
 * DongleStatus — Full simulation mode with animated connect/disconnect flow.
 * Works even when the bridge server at localhost:7777 is offline.
 * When bridge IS online, uses bridge API; when offline, uses local sim.
 */
export default function DongleStatus({ onStatusChange }) {
  const [officer, setOfficer] = useState(null);
  const [bridgeOnline, setBridgeOnline] = useState(false);

  // Core dongle state
  const [connected, setConnected] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [dongleId, setDongleId] = useState(null);

  // Simulation phase: idle | detecting | pin_required | connecting | disconnecting
  const [simPhase, setSimPhase] = useState("idle");
  const [simMessage, setSimMessage] = useState("");
  const [isPinOpen, setIsPinOpen] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  // USB plug animation progress (0-100)
  const [plugAnim, setPlugAnim] = useState(0);
  const animRef = useRef(null);

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const savedOfficer = localStorage.getItem("officer");
    if (savedOfficer) setOfficer(JSON.parse(savedOfficer));

    // Restore persisted dongle state
    const savedConnected = localStorage.getItem("dongleConnected") === "true";
    const savedUnlocked = localStorage.getItem("dongleUnlocked") === "true";
    const savedId = localStorage.getItem("dongleId");
    if (savedConnected) {
      setConnected(true);
      setUnlocked(savedUnlocked);
      setDongleId(savedId);
      if (onStatusChange) onStatusChange(true, savedUnlocked);
    }

    // Try bridge once to see if it's online
    pingBridge();
    const pollInterval = setInterval(pingBridge, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  const pingBridge = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch("http://localhost:7777/api/dongle/status", {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const data = await res.json();
        setBridgeOnline(true);
        setConnected(data.connected);
        setUnlocked(data.unlocked);
        setDongleId(data.dongle_id);
        persistDongleState(data.connected, data.unlocked, data.dongle_id);
        if (onStatusChange) onStatusChange(data.connected, data.unlocked);
      } else {
        setBridgeOnline(false);
      }
    } catch {
      setBridgeOnline(false);
    }
  };

  const persistDongleState = (conn, unlock, id) => {
    localStorage.setItem("dongleConnected", conn ? "true" : "false");
    localStorage.setItem("dongleUnlocked", unlock ? "true" : "false");
    if (id) localStorage.setItem("dongleId", id);
    else localStorage.removeItem("dongleId");
    // Trigger storage event for Navbar and WebView page
    window.dispatchEvent(new Event("storage"));
  };

  // ─── USB plug animation ───────────────────────────────────────────────────
  const startPlugAnimation = (onComplete) => {
    setPlugAnim(0);
    let progress = 0;
    animRef.current = setInterval(() => {
      progress += 4;
      setPlugAnim(progress);
      if (progress >= 100) {
        clearInterval(animRef.current);
        onComplete();
      }
    }, 40);
  };

  // ─── Connect Flow ─────────────────────────────────────────────────────────
  const handleConnect = async () => {
    if (bridgeOnline) {
      // Use real bridge
      const token = localStorage.getItem("token");
      const newId = "DSC-TYPE-C-" + Math.floor(100 + Math.random() * 900);
      try {
        const res = await fetch("http://localhost:7777/api/dongle/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ dongle_id: newId }),
        });
        if (res.ok) {
          await pingBridge();
          setIsPinOpen(true);
        }
      } catch {
        // fall through to sim
        runSimConnect();
      }
    } else {
      runSimConnect();
    }
  };

  const runSimConnect = () => {
    setSimPhase("detecting");
    setSimMessage("🔍 Detecting USB Type-C DSC dongle...");

    startPlugAnimation(() => {
      setTimeout(() => {
        const newId = "DSC-TYPE-C-" + Math.floor(100 + Math.random() * 900);
        setDongleId(newId);
        setSimPhase("pin_required");
        setSimMessage("✅ Dongle detected! Enter your PIN to unlock.");
        setIsPinOpen(true);
      }, 500);
    });
  };

  const handlePinSuccess = async () => {
    if (bridgeOnline) {
      // Bridge handled unlock inside PINModal; just re-ping
      await pingBridge();
    } else {
      // Simulation: mark as connected & unlocked
      setSimPhase("idle");
      setSimMessage("");
      setConnected(true);
      setUnlocked(true);
      persistDongleState(true, true, dongleId);
      if (onStatusChange) onStatusChange(true, true);
    }
  };

  // ─── Disconnect Flow ──────────────────────────────────────────────────────
  const handleDisconnectRequest = () => setShowConfirmDisconnect(true);

  const handleConfirmDisconnect = async () => {
    setShowConfirmDisconnect(false);
    setSimPhase("disconnecting");
    setSimMessage("⏏️ Safely ejecting dongle...");

    if (bridgeOnline) {
      const token = localStorage.getItem("token");
      try {
        await fetch("http://localhost:7777/api/dongle/disconnect", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* ignore */ }
    }

    setTimeout(() => {
      setConnected(false);
      setUnlocked(false);
      setDongleId(null);
      setSimPhase("idle");
      setSimMessage("");
      setPlugAnim(0);
      persistDongleState(false, false, null);
      if (onStatusChange) onStatusChange(false, false);
    }, 1500);
  };

  // ─── Render helpers ───────────────────────────────────────────────────────
  const isDetecting = simPhase === "detecting";
  const isDisconnecting = simPhase === "disconnecting";
  const isBusy = isDetecting || isDisconnecting;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">

      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-750 border-b border-slate-200 dark:border-slate-700 px-5 py-3.5 flex justify-between items-center">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-wide uppercase">
          DSC Dongle Status
        </h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
          bridgeOnline
            ? "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-400 border-green-200"
            : "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-400 border-yellow-200"
        }`}>
          {bridgeOnline ? "Bridge Online" : "Sim Mode"}
        </span>
      </div>

      <div className="p-6 space-y-5">

        {/* ── Big Status Visual ── */}
        <div className="flex flex-col items-center gap-4">

          {/* Animated USB Plug Icon (during connecting) */}
          {isDetecting && (
            <div className="relative w-full h-16 flex items-center">
              <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-govBlue-500 to-sky-400 rounded-full transition-all duration-75"
                  style={{ width: `${plugAnim}%` }}
                />
              </div>
              <span
                className="absolute text-2xl transition-all duration-75"
                style={{ left: `calc(${plugAnim}% - 16px)` }}
              >🔌</span>
              <span className="text-2xl ml-2">📱</span>
            </div>
          )}

          {/* Pulsing Circle Status Icon */}
          <div className="relative flex items-center justify-center">
            {/* Outer pulse rings */}
            {(connected || isDetecting) && (
              <>
                <span className={`animate-ping absolute inline-flex rounded-full opacity-20 ${
                  connected ? "h-24 w-24 bg-green-400" : "h-24 w-24 bg-blue-400"
                }`} />
                <span className={`animate-ping absolute inline-flex rounded-full opacity-10 ${
                  connected ? "h-32 w-32 bg-green-300" : "h-32 w-32 bg-blue-300"
                }`} style={{ animationDelay: "0.3s" }} />
              </>
            )}

            {/* Main circle */}
            <div className={`relative w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-lg transition-all duration-500 ${
              connected
                ? "bg-green-50 dark:bg-green-950/30 border-green-400 text-green-600 dark:text-green-400"
                : isDetecting
                ? "bg-blue-50 dark:bg-blue-950/30 border-blue-400 text-blue-600 dark:text-blue-400 animate-pulse"
                : isDisconnecting
                ? "bg-orange-50 dark:bg-orange-950/30 border-orange-400 text-orange-600 animate-pulse"
                : "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-700 text-red-500 dark:text-red-400"
            }`}>
              {connected ? (
                /* Lock open / unlocked icon */
                <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              ) : isDetecting ? (
                <svg className="w-9 h-9 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              ) : isDisconnecting ? (
                <span className="text-3xl">⏏️</span>
              ) : (
                /* X / disconnected */
                <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              )}
            </div>
          </div>

          {/* Status Text */}
          <div className="text-center space-y-1">
            <h4 className={`font-black text-base tracking-tight ${
              connected
                ? "text-green-700 dark:text-green-400"
                : isDetecting
                ? "text-blue-700 dark:text-sky-400"
                : isDisconnecting
                ? "text-orange-600"
                : "text-red-600 dark:text-red-400"
            }`}>
              {connected
                ? "DSC Dongle Connected"
                : isDetecting
                ? "Detecting Dongle..."
                : isDisconnecting
                ? "Disconnecting Dongle..."
                : "No DSC Dongle Detected"}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug max-w-[200px] mx-auto">
              {connected
                ? `Dongle ID: ${dongleId}`
                : isDetecting || isDisconnecting
                ? simMessage
                : "Please connect your Type-C DSC dongle to continue"}
            </p>
          </div>
        </div>

        {/* ── Connected Detail Card ── */}
        {connected && (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 rounded-xl p-4 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide text-[10px]">Dongle Type</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">Type-C USB DSC Token</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide text-[10px]">Dongle ID</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{dongleId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide text-[10px]">Officer</span>
              <span className="font-bold text-govBlue-700 dark:text-sky-400">{officer?.name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide text-[10px]">Security</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                unlocked
                  ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                  : "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400"
              }`}>
                {unlocked ? "✅ Unlocked" : "🔒 Locked"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide text-[10px]">Status</span>
              <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                Ready to Sign
              </span>
            </div>
          </div>
        )}

        {/* ── System Message Banner ── */}
        {!connected && !isBusy && (
          <div className="bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
            <span className="font-bold">System: </span>
            USB Type-C DSC Dongle not detected. Click below to simulate dongle insertion.
          </div>
        )}

        {/* ── Action Buttons ── */}
        {!connected && !isBusy && (
          <button
            onClick={handleConnect}
            className="w-full bg-govBlue-700 hover:bg-govBlue-800 active:scale-95 text-white font-black py-3 px-4 rounded-xl text-xs tracking-wider uppercase transition-all duration-150 shadow-md hover:shadow-lg flex justify-center items-center gap-2"
          >
            <span className="text-base">🔌</span>
            <span>Simulate Dongle Connect</span>
          </button>
        )}

        {connected && !isBusy && (
          <button
            onClick={handleDisconnectRequest}
            className="w-full bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-700 dark:text-slate-200 hover:text-red-700 dark:hover:text-red-400 border border-slate-300 dark:border-slate-600 hover:border-red-300 dark:hover:border-red-700 font-bold py-3 px-4 rounded-xl text-xs tracking-wider uppercase transition-all duration-150 flex justify-center items-center gap-2"
          >
            <span className="text-base">⏏️</span>
            <span>Disconnect Dongle</span>
          </button>
        )}

        {isBusy && (
          <div className="w-full py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 animate-pulse uppercase tracking-wider">
            {isDetecting ? "Detecting hardware..." : "Ejecting safely..."}
          </div>
        )}
      </div>

      {/* ── PIN Modal ── */}
      <PINModal
        isOpen={isPinOpen}
        onClose={() => {
          setIsPinOpen(false);
          if (simPhase === "pin_required" || simPhase === "detecting") {
            setSimPhase("idle");
            setSimMessage("");
          }
        }}
        onSuccess={() => {
          setIsPinOpen(false);
          handlePinSuccess();
        }}
      />

      {/* ── Confirm Disconnect Dialog ── */}
      {showConfirmDisconnect && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl">⏏️</div>
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-base">Disconnect DSC Dongle?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Are you sure you want to disconnect? Any pending signing operations will be cancelled.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDisconnect(false)}
                className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition border border-slate-200 dark:border-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisconnect}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-sm"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
