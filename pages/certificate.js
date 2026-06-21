import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function CertificatePage() {
  const router = useRouter();
  const [officer, setOfficer] = useState(null);
  const [isOpenChain, setIsOpenChain] = useState(false);
  const [todayStr, setTodayStr] = useState("");
  const [oneYearLaterStr, setOneYearLaterStr] = useState("");
  const [daysRemaining, setDaysRemaining] = useState(365);
  const [simulateLowExpiry, setSimulateLowExpiry] = useState(false);

  useEffect(() => {
    // Always read the logged-in officer from localStorage
    const savedOfficer = localStorage.getItem("officer");
    if (!savedOfficer) {
      router.push("/login");
      return;
    }
    setOfficer(JSON.parse(savedOfficer));

    const today = new Date();
    const oneYearLater = new Date();
    oneYearLater.setFullYear(today.getFullYear() + 1);

    const options = { day: "numeric", month: "short", year: "numeric" };
    setTodayStr(today.toLocaleDateString("en-IN", options));
    setOneYearLaterStr(oneYearLater.toLocaleDateString("en-IN", options));

    const diffTime = oneYearLater.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setDaysRemaining(diffDays);
  }, []);

  // Set up low expiry date details for testing
  const activeValidUntil = simulateLowExpiry
    ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : oneYearLaterStr;

  const activeDaysRemaining = simulateLowExpiry ? 14 : daysRemaining;
  const showWarningBanner = activeDaysRemaining <= 30;

  // Generate serial number from officer.id — first 16 chars, uppercase hex-like
  const generateSerialNumber = (officerId) => {
    if (!officerId) return "A1B2C3D4E5F6G7H8";
    const idStr = String(officerId).replace(/-/g, "").toUpperCase();
    return idStr.substring(0, 16).padEnd(16, "0");
  };

  // Build certificate data from the logged-in officer
  const simulatedCert = officer
    ? {
        common_name: officer.name,
        organization: "Government of Andhra Pradesh",
        department: officer.department,
        designation: officer.designation,
        serial_number: generateSerialNumber(officer.id),
        valid_from: todayStr,
        valid_until: activeValidUntil,
        issued_by: "CCA India - Class 3 DSC",
        algorithm: "SHA256withRSA",
        key_size: "2048 bits",
      }
    : null;

  if (!officer || !simulatedCert) {
    return (
      <div className="flex flex-col min-h-screen font-sans bg-govAsh dark:bg-slate-900 items-center justify-center">
        <div className="animate-pulse text-slate-400 text-sm">Loading officer profile...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen font-sans bg-govAsh dark:bg-slate-900 transition-colors duration-300 text-slate-800 dark:text-slate-100">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow space-y-6">
        
        {/* Warning Banner */}
        {showWarningBanner && (
          <div className="bg-orange-50 dark:bg-orange-950/20 text-orange-850 dark:text-orange-300 text-xs px-5 py-4 rounded-xl border border-orange-200 dark:border-orange-900/40 leading-relaxed font-semibold shadow-sm animate-pulse flex items-start space-x-2">
            <span className="text-sm">⚠️</span>
            <div>
              <span className="font-extrabold uppercase block tracking-wider mb-0.5">Certificate Expiring Soon</span>
              Your Class 3 DSC token validity expires in <span className="font-extrabold text-orange-600 dark:text-orange-400">{activeDaysRemaining}</span> days. Please initiate renewal procedures with NIC/CCA APTS authorities to avoid service interruptions.
            </div>
          </div>
        )}

        {/* Page Title & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
              Cryptographic Identity Card
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              PKCS#11 secure profile for <span className="font-bold text-govBlue-700 dark:text-sky-400">{officer.name}</span>
            </p>
          </div>
          
          <button
            onClick={() => setSimulateLowExpiry(!simulateLowExpiry)}
            className={`text-xs font-bold py-2 px-4 rounded-lg tracking-wider uppercase transition duration-150 border shadow-sm ${
              simulateLowExpiry
                ? "bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
                : "bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
          >
            {simulateLowExpiry ? "Reset Expiry (365 Days)" : "Simulate Low Expiry (< 30 Days)"}
          </button>
        </div>

        {/* Dongle Status Banner (Connected) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm transition-colors duration-300">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-3.5">
              {/* Pulsing Green Dot */}
              <div className="relative flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-green-500 border-2 border-white dark:border-slate-800"></span>
              </div>
              <div>
                <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm">
                  DSC Dongle Connected (Simulated)
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium tracking-wide mt-0.5">
                  ID: <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">DSC-DONGLE-DEMO-001</span> &bull; Type: Type-C USB DSC Token
                </p>
              </div>
            </div>
            <span className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 text-[10px] font-black px-3 py-1 rounded-full uppercase border border-green-200 dark:border-green-900/30">
              Active Key
            </span>
          </div>
        </div>

        {/* Visual Real Government ID Card */}
        <div className="flex justify-center">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl overflow-hidden border-2 border-slate-200 dark:border-slate-750 shadow-2xl transition-colors duration-300 relative">
            
            {/* Top Tricolour Header Band */}
            <div className="h-2.5 flex">
              <div className="w-1/3 h-full bg-[#FF9933]"></div>
              <div className="w-1/3 h-full bg-white"></div>
              <div className="w-1/3 h-full bg-[#138808]"></div>
            </div>

            {/* ID Header Section */}
            <div className="bg-slate-50 dark:bg-slate-750 px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span className="text-xl">☸️</span>
                <div>
                  <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-wider uppercase">
                    Controller of Certifying Authorities
                  </h3>
                  <p className="text-[9px] text-slate-450 dark:text-slate-400 tracking-widest font-bold">
                    GOVERNMENT OF INDIA &bull; CLASS 3 DSC
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black text-govBlue-700 dark:text-sky-400 uppercase tracking-widest">
                ID CARD
              </span>
            </div>

            {/* Card Content Body */}
            <div className="p-6 sm:p-8 space-y-6 relative">
              
              {/* COMPLIANT Rotated Stamp (Absolutely Positioned) */}
              <div className="absolute top-24 right-8 transform rotate-12 border-2 border-dashed border-green-500/60 dark:border-green-450/40 px-3.5 py-1.5 text-green-500 dark:text-green-400 rounded text-center select-none pointer-events-none uppercase font-black tracking-widest text-xs">
                CCA Compliant ✓
              </div>

              {/* Photo/Emblem & Holder Info Row */}
              <div className="flex items-start space-x-5">
                {/* Simulated Chip/Emblem */}
                <div className="w-16 h-20 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center p-2 shadow-inner">
                  {/* Golden Chip representation */}
                  <div className="w-9 h-7 bg-gradient-to-tr from-amber-300 via-yellow-400 to-amber-500 rounded-md border border-amber-400 mb-2"></div>
                  <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    SECURE
                  </span>
                </div>
                
                {/* Officer Details — READ FROM localStorage */}
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-slate-900 dark:text-slate-50 leading-tight">
                    {simulatedCert.common_name}
                  </h4>
                  <p className="text-xs font-bold text-govBlue-700 dark:text-sky-400 uppercase tracking-wide">
                    {simulatedCert.designation}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-snug">
                    {simulatedCert.department} &bull; {simulatedCert.organization}
                  </p>
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-700">
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Serial Number:</span>
                  <span className="font-mono font-bold text-slate-750 dark:text-slate-200">{simulatedCert.serial_number}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Issuer:</span>
                  <span className="font-bold text-slate-750 dark:text-slate-200">{simulatedCert.issued_by}</span>
                </div>

                <div>
                  <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Valid From:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-350">{simulatedCert.valid_from}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Valid Until:</span>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-350">{simulatedCert.valid_until}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded leading-none ${
                      showWarningBanner
                        ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                        : "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300"
                    }`}>
                      {showWarningBanner ? "Expiring" : "Valid"}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Algorithm:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-350">{simulatedCert.algorithm}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Key Size:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-350">{simulatedCert.key_size}</span>
                </div>
              </div>

            </div>

            {/* Bottom Card Strip */}
            <div className="bg-slate-100 dark:bg-slate-750 px-6 py-3 border-t border-slate-50 dark:border-slate-700 text-center">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                CLASS 3 NON-REPUDIATION IDENTITY TOKEN
              </span>
            </div>
          </div>
        </div>

        {/* Certificate Chain Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors duration-300">
          <button
            onClick={() => setIsOpenChain(!isOpenChain)}
            className="w-full px-6 py-4 flex justify-between items-center font-bold text-slate-800 dark:text-slate-100 text-sm focus:outline-none bg-slate-50/50 dark:bg-slate-750/30 hover:bg-slate-50 dark:hover:bg-slate-750/50 transition duration-150"
          >
            <span>Hierarchy &amp; Certificate Chain</span>
            <span className="text-xs text-slate-450">{isOpenChain ? "▲ Close" : "▼ Expand"}</span>
          </button>

          {isOpenChain && (
            <div className="px-6 py-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/20 dark:bg-slate-800/10 text-xs font-semibold leading-relaxed">
              <div className="space-y-4 font-mono">
                {/* Chain Root */}
                <div className="flex items-center space-x-2 text-govBlue-700 dark:text-sky-400">
                  <span>🏢</span>
                  <div>
                    <p className="font-bold">CCA India Root CA</p>
                    <p className="text-[9px] text-slate-450 dark:text-slate-500">Root Certification Authority &bull; SHA256withRSA</p>
                  </div>
                </div>

                {/* Level 2 Intermediate */}
                <div className="ml-6 pl-4 border-l-2 border-slate-200 dark:border-slate-700 flex items-center space-x-2 text-govGold">
                  <span>↳ 🏢</span>
                  <div>
                    <p className="font-bold">CCA India Class 3 CA</p>
                    <p className="text-[9px] text-slate-450 dark:text-slate-550">Intermediate CA &bull; Issuing Authority</p>
                  </div>
                </div>

                {/* User Leaf — uses logged-in officer name */}
                <div className="ml-12 pl-4 border-l-2 border-slate-250 dark:border-slate-700 flex items-center space-x-2 text-green-600 dark:text-green-400">
                  <span>↳ 👤</span>
                  <div>
                    <p className="font-bold">{officer.name} ({officer.department})</p>
                    <p className="text-[9px] text-slate-450 dark:text-slate-500">Subject Token: {simulatedCert.serial_number} &bull; End Entity Card</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </main>

      <Footer />
    </div>
  );
}
