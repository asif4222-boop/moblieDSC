import { useState, useRef, useEffect } from "react";

/**
 * PINModal — DSC token PIN verification.
 *
 * Verification strategy (in order):
 *  1. Compare against sessionStorage['officer_pin'] (set at login) — works offline, instant.
 *  2. If sessionStorage PIN is missing, try the bridge server at localhost:7777.
 *  3. If bridge is also unreachable, show a helpful error.
 *
 * This ensures the SAME PIN used at login always works here.
 */
export default function PINModal({ isOpen, onClose, onSuccess }) {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    if (isOpen) {
      setPin(["", "", "", ""]);
      setError("");
      setSuccessMsg("");
      setTimeout(() => {
        if (inputRefs[0].current) inputRefs[0].current.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (index, value) => {
    if (value !== "" && !/^[0-9]$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError("");
    setSuccessMsg("");

    if (value !== "" && index < 3) {
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && pin[index] === "" && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  // ── Main submit handler ──────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const pinStr = pin.join("");

    // Validation
    if (pinStr.length < 4) {
      setError("Please enter your full 4-digit PIN.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    // ── Strategy 1: Local sessionStorage verification (preferred) ──────────
    const savedPin = sessionStorage.getItem("officer_pin");
    if (savedPin) {
      if (pinStr === savedPin) {
        // Correct PIN — also try to unlock the bridge in background
        tryBridgeUnlock(pinStr).catch(() => {}); // fire-and-forget
        handleSuccess(pinStr);
        return;
      } else {
        setError("❌ Incorrect PIN. Please use the same PIN you set during registration.");
        setLoading(false);
        return;
      }
    }

    // ── Strategy 2: Bridge server at localhost:7777 ────────────────────────
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      const ok = await tryBridgeUnlock(pinStr);
      if (ok) {
        handleSuccess(pinStr);
      } else {
        setError("❌ Incorrect PIN. Please use the same PIN you set during registration.");
        setLoading(false);
      }
    } catch (err) {
      // Bridge unreachable — cannot verify
      setError(
        "Cannot verify PIN: bridge server not running and login session data missing. " +
        "Please log out and log back in, then try again."
      );
      setLoading(false);
    }
  };

  // ── Attempt to unlock via bridge (non-throwing: returns true/false) ──────
  const tryBridgeUnlock = async (pinStr) => {
    const token = localStorage.getItem("token");
    if (!token) return false;
    try {
      const res = await fetch("http://localhost:7777/api/dongle/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: pinStr }),
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      // Bridge offline — that's fine, we already verified locally
      return false;
    }
  };

  const handleSuccess = (pinStr) => {
    setSuccessMsg("✅ DSC Dongle unlocked! Ready to sign documents.");
    setTimeout(() => {
      setLoading(false);
      onSuccess(pinStr);
      onClose();
    }, 800);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-8 shadow-2xl border border-slate-200 dark:border-slate-700 transition-colors duration-300">

        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center space-x-2">
            <svg className="w-5 h-5 text-govGold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>DSC PIN Authentication</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none transition duration-150"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <p className="text-slate-500 dark:text-slate-400 text-xs mb-6 leading-relaxed">
          Enter your DSC token security PIN to authorize the cryptographic signing key.
        </p>

        {/* PIN Form */}
        <form onSubmit={handleSubmit}>
          {/* PIN Boxes */}
          <div className="flex justify-center space-x-4 mb-3">
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={loading}
                className={`w-14 h-14 text-center text-2xl font-bold bg-slate-50 dark:bg-slate-700/50 border-2 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none transition duration-150 disabled:opacity-50 ${
                  error
                    ? "border-red-400 dark:border-red-600"
                    : successMsg
                    ? "border-green-400 dark:border-green-600"
                    : "border-slate-200 dark:border-slate-600 focus:border-govBlue-700"
                }`}
              />
            ))}
          </div>

          {/* Hint text */}
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 mb-5 font-medium">
            💡 Enter the same PIN you used to login
          </p>

          {/* Success Message */}
          {successMsg && (
            <div className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 text-xs px-4 py-3 rounded-lg border border-green-200 dark:border-green-900/60 mb-5 font-semibold flex items-center gap-2">
              {successMsg}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs px-4 py-3 rounded-lg border border-red-200 dark:border-red-900/60 mb-5 font-medium">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-1/2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl text-xs tracking-wider uppercase transition duration-150 border border-slate-200 dark:border-slate-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !!successMsg}
              className="w-1/2 bg-govBlue-700 hover:bg-govBlue-800 text-white font-bold py-3 rounded-xl text-xs tracking-wider uppercase transition duration-150 shadow-md hover:shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Confirm PIN</span>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
