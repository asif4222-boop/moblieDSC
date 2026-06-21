import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function Navbar() {
  const router = useRouter();
  const [officer, setOfficer] = useState(null);
  const [theme, setTheme] = useState("light");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dongleConnected, setDongleConnected] = useState(false);

  useEffect(() => {
    const savedOfficer = localStorage.getItem("officer");
    if (savedOfficer) {
      setOfficer(JSON.parse(savedOfficer));
    }

    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Read dongle state from localStorage
    setDongleConnected(localStorage.getItem("dongleConnected") === "true");

    // Listen for dongle state changes dispatched by DongleStatus component
    const onStorage = () => {
      setDongleConnected(localStorage.getItem("dongleConnected") === "true");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("officer");
    localStorage.removeItem("dongleConnected");
    localStorage.removeItem("dongleUnlocked");
    localStorage.removeItem("dongleId");
    sessionStorage.removeItem("officer_pin"); // clear PIN on logout for security
    router.push("/login");
  };

  const navItems = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Sign Document", path: "/upload" },
    { name: "Signing History", path: "/history" },
    { name: "DSC Certificate", path: "/certificate" },
    { name: "Gov Browser", path: "/webview" },
    { name: "Settings", path: "/settings" },
  ];

  return (
    <header className="bg-govBlue-700 dark:bg-slate-800 text-white gov-shadow sticky top-0 z-40 transition-colors duration-300">
      
      {/* Top Ministry Ribbon */}
      <div className="bg-govBlue-900 dark:bg-slate-900 text-[10px] sm:text-xs py-2 px-4 flex justify-between items-center border-b border-govBlue-800 dark:border-slate-800 text-slate-300">
        <div className="flex items-center space-x-1 sm:space-x-2">
          <span>GOVERNMENT OF INDIA</span>
          <span className="text-sky-400">☸️</span>
          <span className="hidden sm:inline">MINISTRY OF ELECTRONICS &amp; IT (MeitY)</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="hidden md:inline text-slate-400">APTS &amp; NIC COLLABORATION</span>
          <span className="text-govGold font-bold">CLASS 3 CCA SECURE</span>
        </div>
      </div>

      {/* Main Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        
        {/* Logo and Branding */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push("/")}>
          <div className="w-10 h-10 bg-white dark:bg-slate-100 rounded-full flex items-center justify-center font-bold text-govBlue-700 shadow-sm border border-slate-200">
            <span className="text-orange-500">A</span>
            <span className="text-govBlue-700">P</span>
            <span className="text-green-600">☸️</span>
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black leading-tight tracking-tight uppercase">
              DSC Mobile Bridge
            </h1>
            <p className="text-[10px] text-govBlue-200 dark:text-sky-300 font-bold tracking-wider uppercase">
              Government of Andhra Pradesh
            </p>
          </div>
        </div>

        {/* Desktop Navigation, Profile & Theme Toggle */}
        <div className="hidden lg:flex items-center space-x-6">
          {officer && (
            <nav className="flex items-center space-x-1 text-sm font-semibold">
              {navItems.map((item) => {
                const isActive = router.pathname === item.path;
                const isBrowser = item.path === "/webview";
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`px-3 py-2 rounded-md transition-all flex items-center gap-1 ${
                      isActive
                        ? "bg-govBlue-800 dark:bg-slate-700 text-white border-b-2 border-govGold shadow-inner"
                        : "text-govBlue-100 dark:text-slate-300 hover:bg-govBlue-600 dark:hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    {isBrowser && <span className="text-xs">🌐</span>}
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-govBlue-800 dark:bg-slate-700 text-govBlue-100 dark:text-yellow-400 hover:text-white hover:bg-govBlue-600 dark:hover:bg-slate-600 transition-colors focus:outline-none"
            aria-label="Toggle Dark Mode"
            title="Toggle Light/Dark Theme"
          >
            {theme === "light" ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            )}
          </button>

          {/* Profile Card, Dongle Dot & Logout */}
          {officer ? (
            <div className="flex items-center space-x-3 border-l border-govBlue-600 dark:border-slate-700 pl-4">
              {/* Dongle status dot */}
              <div className="relative flex" title={dongleConnected ? "DSC Dongle Connected" : "DSC Dongle Disconnected"}>
                {dongleConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-3 w-3 border border-white/50 ${dongleConnected ? "bg-green-400" : "bg-red-400"}`}></span>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-white dark:text-slate-100">{officer.name}</p>
                <p className="text-[9px] text-govBlue-200 dark:text-sky-300 uppercase tracking-wider">{officer.department}</p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-govGold hover:bg-govGold-dark text-white text-xs font-bold px-3 py-1.5 rounded-md transition duration-150 shadow-md"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-white hover:bg-slate-100 text-govBlue-700 text-xs font-bold px-4 py-2 rounded-md transition duration-150 shadow-sm"
            >
              Officer Login
            </Link>
          )}
        </div>

        {/* Mobile controls (hamburger and theme toggle) */}
        <div className="flex lg:hidden items-center space-x-3">
          {/* Mobile dongle dot */}
          {officer && (
            <div className="relative flex" title={dongleConnected ? "DSC Dongle Connected" : "DSC Dongle Disconnected"}>
              {dongleConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 border border-white/50 ${dongleConnected ? "bg-green-400" : "bg-red-400"}`}></span>
            </div>
          )}

          {/* Mobile Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-full bg-govBlue-800 dark:bg-slate-700 text-govBlue-100 dark:text-yellow-400 hover:text-white transition-colors"
          >
            {theme === "light" ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            )}
          </button>

          {/* Hamburger Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-md text-govBlue-100 hover:text-white hover:bg-govBlue-800 dark:hover:bg-slate-700 focus:outline-none transition-colors"
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-govBlue-800 dark:border-slate-700 bg-govBlue-800 dark:bg-slate-800 px-4 py-3 space-y-3 transition-all duration-200">
          {officer && (
            <nav className="flex flex-col space-y-1.5">
              {navItems.map((item) => {
                const isActive = router.pathname === item.path;
                const isBrowser = item.path === "/webview";
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`px-3 py-2 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${
                      isActive
                        ? "bg-govBlue-900 dark:bg-slate-900 text-white border-l-4 border-govGold shadow-inner"
                        : "text-govBlue-100 dark:text-slate-300 hover:bg-govBlue-700 dark:hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    {isBrowser && <span>🌐</span>}
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Profile details for mobile */}
          {officer ? (
            <div className="pt-3 border-t border-govBlue-700 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Mobile dongle dot in menu */}
                <div className="relative flex">
                  {dongleConnected && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dongleConnected ? "bg-green-400" : "bg-red-400"}`}></span>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{officer.name}</p>
                  <p className="text-[10px] text-govBlue-200 dark:text-sky-300 uppercase">{officer.department}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="bg-govGold hover:bg-govGold-dark text-white text-xs font-bold px-3 py-1.5 rounded-md"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block w-full text-center bg-white text-govBlue-700 hover:bg-slate-100 font-bold text-xs py-2 rounded-md shadow-sm"
            >
              Officer Login
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
