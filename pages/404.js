import Link from "next/link";
import Footer from "@/components/Footer";

export default function Custom404() {
  return (
    <div className="flex flex-col min-h-screen font-sans bg-govAsh dark:bg-slate-900 transition-colors duration-300">
      {/* Top Ministry Ribbon */}
      <div className="bg-govBlue-950 text-white text-[10px] sm:text-xs py-2 px-4 flex justify-between tracking-wide font-medium border-b border-govBlue-900">
        <div className="flex items-center space-x-2">
          <span>GOVERNMENT OF INDIA</span>
          <span>☸️</span>
          <span>MEITY INITIATIVE</span>
        </div>
        <div className="flex space-x-4">
          <span>APIS & NIC PARTNERSHIP</span>
          <span className="text-govGold">CLASS 3 CCA APPROVED</span>
        </div>
      </div>

      {/* Main 404 Content */}
      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-md w-full space-y-8 text-center bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl transition-colors duration-300 relative overflow-hidden">
          
          {/* Top Tricolour Bar */}
          <div className="absolute top-0 left-0 w-full h-1 flex">
            <div className="w-1/3 h-full bg-[#FF9933]"></div>
            <div className="w-1/3 h-full bg-white"></div>
            <div className="w-1/3 h-full bg-[#138808]"></div>
          </div>

          <div className="flex flex-col items-center">
            {/* Ashoka Chakra & 404 Combined Badge */}
            <div className="w-24 h-24 bg-govBlue-50 dark:bg-slate-700 text-govBlue-700 dark:text-govBlue-200 rounded-full flex items-center justify-center font-black text-4xl mb-4 border border-govBlue-100 dark:border-slate-600 shadow-inner">
              404
            </div>
            
            <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 uppercase mb-2">
              Record Not Found
            </h1>
            
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
              The requested directory, application page, or document file could not be retrieved from the central state database. It might have been migrated, archived, or deleted.
            </p>

            {/* Security Notice */}
            <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-left mb-8 w-full">
              <span className="text-[10px] font-bold text-govGold uppercase tracking-wider block mb-1">
                🔒 Security Trace Logged
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal block">
                Your secure session ID and IP address have been logged for security audit compliance under NIC protocol standards.
              </span>
            </div>

            {/* Quick Action Navigation */}
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              <Link
                href="/login"
                className="bg-govBlue-700 hover:bg-govBlue-800 text-white font-bold py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider transition duration-150 flex items-center justify-center space-x-2"
              >
                <span>Dashboard Login</span>
              </Link>
              <Link
                href="/"
                className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider transition duration-150 flex items-center justify-center"
              >
                Return Home
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
