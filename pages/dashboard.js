import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DongleStatus from "@/components/DongleStatus";
import WebViewBrowser from "@/components/WebViewBrowser";
import PINModal from "@/components/PINModal";

export default function DashboardPage() {
  const router = useRouter();
  const [officer, setOfficer] = useState(null);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, rate: 0 });
  const [recentHistory, setRecentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dongleConnected, setDongleConnected] = useState(false);
  const [dongleUnlocked, setDongleUnlocked] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });
  
  // Text Sign State
  const [textToSign, setTextToSign] = useState("");
  const [signatureOutput, setSignatureOutput] = useState("");
  const [signatureId, setSignatureId] = useState("");
  const [textSigningState, setTextSigningState] = useState("idle"); // idle, signing, success, error
  const [isPinOpen, setIsPinOpen] = useState(false);

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: "" });
    }, 4000);
  };

  const fetchDashboardData = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const res = await fetch("http://localhost:8000/api/history", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const historyData = await res.json();
        setRecentHistory(historyData.slice(0, 5)); // Get last 5

        // Calculate stats
        const total = historyData.length;
        const success = historyData.filter((h) => h.status === "Success").length;
        const failed = historyData.filter((h) => h.status === "Failed").length;
        const rate = total > 0 ? Math.round((success / total) * 100) : 100;

        setStats({ total, success, failed, rate });
      }
    } catch (err) {
      console.error("Failed to load dashboard statistics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedOfficer = localStorage.getItem("officer");
    if (!savedOfficer) {
      router.push("/login");
    } else {
      setOfficer(JSON.parse(savedOfficer));
      
      const isDemo = localStorage.getItem("demoMode") === "true";
      setDemoMode(isDemo);

      fetchDashboardData();
    }
  }, []);

  const handleToggleDemo = (e) => {
    const checked = e.target.checked;
    setDemoMode(checked);
    localStorage.setItem("demoMode", checked ? "true" : "false");
    showToast(
      checked
        ? "Demo Simulation Mode Enabled: Offline actions allowed."
        : "Demo Simulation Mode Disabled: Connecting to Python APIs."
    );
  };

  const handleDongleChange = (connected, unlocked) => {
    setDongleConnected(connected);
    setDongleUnlocked(unlocked);
  };

  const handleTextSignClick = () => {
    if (!textToSign.trim()) {
      showToast("Please enter text content to sign.");
      return;
    }

    const isDemo = localStorage.getItem("demoMode") === "true";
    if (!isDemo && !dongleConnected) {
      showToast("Simulated DSC USB Dongle not connected. Connect the dongle first.");
      return;
    }

    if (!isDemo && !dongleUnlocked) {
      setIsPinOpen(true);
    } else {
      executeTextSign();
    }
  };

  const handlePinSuccess = () => {
    executeTextSign();
  };

  const executeTextSign = async () => {
    setTextSigningState("signing");
    setSignatureOutput("");
    const token = localStorage.getItem("token");

    const isDemo = localStorage.getItem("demoMode") === "true";
    if (isDemo) {
      setTimeout(() => {
        const simulatedSig = btoa(`Simulated_RSA_2048_Signature_for_${textToSign}_` + Math.random().toString(36).substring(7));
        const simulatedSigId = "sim-sig-" + Math.random().toString(36).substring(2, 10);
        
        setSignatureOutput(simulatedSig);
        setSignatureId(simulatedSigId);
        setTextSigningState("success");
        showToast("Demo Mode: Text signed successfully client-side!");
        
        // Add item to local history to show in stats
        const mockLog = {
          id: Date.now(),
          document_name: `Plain Text ("${textToSign.substring(0, 15)}...")`,
          document_type: "Text",
          officer_name: officer ? officer.name : "Demo Officer",
          signed_at: new Date().toISOString(),
          status: "Success",
          signature_id: simulatedSigId,
          error_message: null
        };
        
        setRecentHistory((prev) => [mockLog, ...prev.slice(0, 4)]);
        setStats((prev) => {
          const total = prev.total + 1;
          const success = prev.success + 1;
          const rate = Math.round((success / total) * 100);
          return { ...prev, total, success, rate };
        });
      }, 1000);
      return;
    }

    try {
      const res = await fetch("http://localhost:7777/api/sign/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: textToSign }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Text signing failed.");
      }

      setSignatureOutput(data.signature);
      setSignatureId(data.signature_id);
      setTextSigningState("success");
      showToast("Text signed successfully!");
      fetchDashboardData(); // Refresh history table & stats
    } catch (err) {
      showToast(err.message || "Cryptographic text sign failed.");
      setTextSigningState("error");
    }
  };

  return (
    <div className="flex flex-col min-h-screen font-sans bg-govAsh dark:bg-slate-900 transition-colors duration-300 text-slate-800 dark:text-slate-100">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow space-y-8">
        
        {/* Officer Welcome Header / Loading Skeleton */}
        {loading ? (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 w-1/2">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
            </div>
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
          </div>
        ) : (
          officer && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-colors duration-300">
              <div>
                <p className="text-xs text-govBlue-700 dark:text-sky-400 font-bold uppercase tracking-wider">
                  Authorized Session
                </p>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                  Welcome, {officer.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {officer.designation} &bull; {officer.department}
                </p>
              </div>

              {/* Demo Mode & Expiry Container */}
              <div className="flex flex-wrap items-center gap-4 text-xs">
                
                {/* Demo Mode Toggle */}
                <label className="inline-flex items-center space-x-2 cursor-pointer bg-slate-100 dark:bg-slate-750 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-650 transition hover:bg-slate-200 dark:hover:bg-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={demoMode}
                    onChange={handleToggleDemo}
                    className="rounded border-slate-350 dark:border-slate-600 text-govBlue-700 focus:ring-govBlue-500 h-3.5 w-3.5"
                  />
                  <span className="font-bold text-slate-650 dark:text-slate-200 uppercase tracking-wide text-[10px]">
                    Demo Simulation Mode
                  </span>
                </label>

                <div className="flex items-center space-x-1">
                  <span className="text-slate-400">Class 3 DSC Cryptographic Key:</span>
                  <span className="bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-400 font-bold px-2 py-0.5 rounded border border-green-200 dark:border-green-850">
                    ACTIVE
                  </span>
                </div>
              </div>
            </div>
          )
        )}

        {/* Dynamic Statistics Section / Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 animate-pulse">
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Signatures", value: stats.total, color: "text-govBlue-700 dark:text-sky-400", icon: "📊" },
              { label: "Successful signs", value: stats.success, color: "text-green-600 dark:text-green-400", icon: "✅" },
              { label: "Failed signs", value: stats.failed, color: "text-red-500 dark:text-red-400", icon: "❌" },
              { label: "Success Rate", value: `${stats.rate}%`, color: "text-govGold dark:text-yellow-500", icon: "📈" },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-300">
                <div className="text-xl mb-1">{stat.icon}</div>
                <p className="text-slate-400 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">{stat.label}</p>
                <p className={`text-2xl font-extrabold ${stat.color} mt-1`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Live Dongle Status & Live Text Signer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: Dongle Connection Monitor */}
          <div className="lg:col-span-1">
            <DongleStatus onStatusChange={handleDongleChange} />
          </div>

          {/* Column 2 & 3: Live Cryptographic Text Signer & Actions */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Quick Actions Panel */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-300">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-wide uppercase mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                Core Cryptographic Actions
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => router.push("/upload")}
                  className="bg-govBlue-700 hover:bg-govBlue-800 text-white font-bold p-4 rounded-lg text-xs transition duration-150 flex flex-col items-center justify-center text-center gap-2 shadow-sm"
                >
                  <span className="text-xl">📄</span>
                  <span>Sign PDF Document</span>
                </button>
                <button
                  onClick={() => router.push("/history")}
                  className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 border border-slate-350 dark:border-slate-600 font-bold p-4 rounded-lg text-xs transition duration-150 flex flex-col items-center justify-center text-center gap-2"
                >
                  <span className="text-xl">📜</span>
                  <span>Signature History</span>
                </button>
                <button
                  onClick={() => router.push("/certificate")}
                  className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 border border-slate-350 dark:border-slate-600 font-bold p-4 rounded-lg text-xs transition duration-150 flex flex-col items-center justify-center text-center gap-2"
                >
                  <span className="text-xl">🔍</span>
                  <span>View Certificate Details</span>
                </button>
                <button
                  onClick={() => router.push("/settings")}
                  className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 border border-slate-350 dark:border-slate-600 font-bold p-4 rounded-lg text-xs transition duration-150 flex flex-col items-center justify-center text-center gap-2"
                >
                  <span className="text-xl">⚙️</span>
                  <span>Manage Token PIN</span>
                </button>
              </div>
            </div>

            {/* Live Text Signer Card */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex-grow transition-colors duration-300">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-wide uppercase mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                Live Text Signing Console
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                    Plain Text Content to Sign
                  </label>
                  <textarea
                    rows={2}
                    value={textToSign}
                    onChange={(e) => setTextToSign(e.target.value)}
                    placeholder="Enter approval details, memo strings, or raw voucher payload to cryptographically sign..."
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-650 rounded-lg p-3 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-govBlue-700 focus:bg-white dark:focus:bg-slate-900 resize-none"
                  />
                </div>

                <button
                  onClick={handleTextSignClick}
                  disabled={textSigningState === "signing"}
                  className="bg-govGold hover:bg-govGold-dark text-white font-bold py-2.5 px-6 rounded-lg text-xs tracking-wider uppercase transition duration-150 shadow disabled:opacity-50 flex items-center space-x-2"
                >
                  <span>{textSigningState === "signing" ? "Signing..." : "Sign Text Content"}</span>
                </button>

                {/* Signature Output */}
                {signatureOutput && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Cryptographic Base64 Signature (RSA-SHA256)
                      </span>
                      <textarea
                        readOnly
                        rows={2}
                        value={signatureOutput}
                        className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-650 rounded-lg p-3 text-slate-600 dark:text-slate-300 font-mono text-[10px] focus:outline-none select-all"
                      />
                    </div>
                    <div className="text-[10px] text-slate-405 dark:text-slate-500">
                      Signature ID: <span className="font-mono text-slate-550 dark:text-slate-400">{signatureId}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Government WebView Integration Demo */}
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-300">
            <div className="mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-wide uppercase">
                WebView Bridge App Simulation
              </h3>
              <p className="text-slate-505 dark:text-slate-400 text-xs mt-1">
                This component emulates the government land registration portal running inside a mobile WebView. Try connecting the simulated USB dongle above, then click sign inside the webview!
              </p>
            </div>
            <WebViewBrowser />
          </div>
        </div>

        {/* Recent Signing Logs Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="bg-slate-50 dark:bg-slate-700 px-6 py-4 border-b border-slate-150 dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-wide uppercase">
              Recent Signing Logs
            </h3>
            <button
              onClick={() => router.push("/history")}
              className="text-govBlue-700 dark:text-sky-400 hover:underline text-xs font-bold"
            >
              View Full Log
            </button>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
              </div>
            ) : recentHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                No signatures recorded in this session. Start signing above!
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-750 text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Document Name</th>
                    <th className="px-6 py-3.5">Type</th>
                    <th className="px-6 py-3.5">Signed At</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Signature ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-350">
                  {recentHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition duration-150">
                      <td className="px-6 py-3.5 font-semibold text-slate-800 dark:text-slate-150 truncate max-w-[200px]" title={item.document_name}>
                        {item.document_name}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.document_type === "PDF"
                            ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-150 dark:border-red-900/30"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-600"
                        }`}>
                          {item.document_type}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400">
                        {new Date(item.signed_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.status === "Success"
                            ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-150 dark:border-green-900/30"
                            : "bg-red-50 dark:bg-red-950/20 text-error dark:text-red-400 border border-red-150 dark:border-red-900/30"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                        {item.signature_id || "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </main>

      <Footer />

      {/* Embedded PIN Modal for Text Sign */}
      <PINModal
        isOpen={isPinOpen}
        onClose={() => setIsPinOpen(false)}
        onSuccess={handlePinSuccess}
      />

      {/* Toast Alert */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 dark:bg-slate-700 text-white text-xs font-semibold px-4.5 py-3 rounded-xl shadow-2xl border border-slate-700 dark:border-slate-600 transition-all duration-300 flex items-center space-x-2 animate-pulse">
          <span>🔔</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
