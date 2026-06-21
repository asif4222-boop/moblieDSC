export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 text-xs mt-auto border-t border-slate-800">
      {/* Logos and Hackathon Partners Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <h2 className="text-white font-bold text-sm tracking-wide uppercase mb-3">
            DSC Mobile Signing Solution
          </h2>
          <p className="text-slate-400 mb-4 pr-4 leading-relaxed">
            A secure digital gateway bridging mobile WebView architectures with USB Type-C cryptographic dongles. Compliant with CCA guidelines and digital signature standards (IT Act 2000).
          </p>
          <div className="flex space-x-2 text-[10px] text-slate-500">
            <span>Hackathon Team Project</span>
            <span>•</span>
            <span>APTS, RTIH & NIC Integration</span>
          </div>
        </div>

        <div>
          <h3 className="text-white font-semibold text-xs tracking-wider uppercase mb-3">
            Hackathon Nodes
          </h3>
          <ul className="space-y-2">
            <li>
              <a href="#" className="hover:text-white transition duration-150">
                APIS (Andhra Pradesh Innovation Society)
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition duration-150">
                APTS (AP Technology Services)
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition duration-150">
                RTIH (Research & Tech Innovation Hub)
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition duration-150">
                NIC (National Informatics Centre)
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-white font-semibold text-xs tracking-wider uppercase mb-3">
            Standards & Certs
          </h3>
          <ul className="space-y-2">
            <li>
              <a href="#" className="hover:text-white transition duration-150">
                CCA Class-3 DSC Compliance
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition duration-150">
                RSA 2048-bit Cryptography
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition duration-150">
                SHA-256 PDF Signing
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition duration-150">
                Secure Mobile WebView Bridge
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Copyright Bar */}
      <div className="bg-slate-950 py-4 border-t border-slate-800 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center text-slate-500 gap-2">
          <p>© {new Date().getFullYear()} Government of Andhra Pradesh. All rights reserved.</p>
          <div className="flex space-x-4">
            <a href="#" className="hover:underline">Privacy Policy</a>
            <span>|</span>
            <a href="#" className="hover:underline">Terms of Service</a>
            <span>|</span>
            <a href="#" className="hover:underline">Security Audit Log</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
