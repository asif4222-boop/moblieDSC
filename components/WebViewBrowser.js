import { useState, useEffect } from "react";
import PINModal from "./PINModal";

export default function WebViewBrowser() {
  const [url, setUrl] = useState("https://revenue.ap.gov.in/approvals/d-0982-land-registry");
  const [docName, setDocName] = useState("Land_Allotment_AP_REV_2026_09.pdf");
  const [docSize] = useState("1.24 MB");
  const [signStatus, setSignStatus] = useState("idle"); // idle, checking, pending_pin, signing, success, error
  const [statusMessage, setStatusMessage] = useState("");
  const [isPinOpen, setIsPinOpen] = useState(false);
  const [signedFileUrl, setSignedFileUrl] = useState(null);
  const [officer, setOfficer] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("officer");
    if (saved) {
      setOfficer(JSON.parse(saved));
    }
  }, []);

  const handleStartSigning = async () => {
    setSignStatus("checking");
    setStatusMessage("Connecting to local bridge server (localhost:7777)...");
    const token = localStorage.getItem("token");

    if (!token) {
      setSignStatus("error");
      setStatusMessage("Officer authentication token missing. Please log in first.");
      return;
    }

    try {
      // 1. Check/initialize signing request via the bridge intercept route
      const bridgeSignRes = await fetch("http://localhost:7777/bridge/sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_id: "doc-9882",
          document_name: docName,
          content_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          callback_url: "https://revenue.ap.gov.in/api/callback"
        })
      });

      if (!bridgeSignRes.ok) {
        const errDetails = await bridgeSignRes.json();
        throw new Error(errDetails.detail || "Bridge connection check failed.");
      }

      const bridgeSignData = await bridgeSignRes.json();
      
      // 2. Check dongle status from local bridge to see if PIN verification is required
      const statusRes = await fetch("http://localhost:7777/api/dongle/status", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!statusRes.ok) {
        throw new Error("Bridge status query failed.");
      }

      const statusData = await statusRes.json();
      if (!statusData.connected) {
        setSignStatus("error");
        setStatusMessage("DSC USB Dongle not detected. Connect the Type-C dongle.");
        return;
      }

      if (!statusData.unlocked) {
        setSignStatus("pending_pin");
        setStatusMessage(`Intercepted signing request (${bridgeSignData.signing_request_id}). PIN verification required.`);
        setIsPinOpen(true);
      } else {
        // Already unlocked, sign directly
        performSigning();
      }
    } catch (err) {
      setSignStatus("error");
      setStatusMessage(err.message || "Local bridge client offline. Ensure 'local_server.py' is running on port 7777.");
    }
  };

  const handlePinSuccess = () => {
    setStatusMessage("PIN verified successfully. Fetching document for cryptographic sign...");
    performSigning();
  };

  const performSigning = async () => {
    setSignStatus("signing");
    setStatusMessage("Signing PDF using RSA-2048 and SHA-256...");
    const token = localStorage.getItem("token");

    try {
      // Create a dummy PDF content to sign (simulating pdf fetch)
      const header = "%PDF-1.4\n";
      const obj1 = "1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n";
      const obj2 = "2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n";
      const obj3 = "3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <<>> /Contents 4 0 R>>\nendobj\n";
      const obj4 = "4 0 obj\n<</Length 24>>\nstream\nBT /F1 12 Tf 70 700 Td (Hello World) Tj ET\nendstream\nendobj\n";
      
      const encoder = new TextEncoder();
      const headerBytes = encoder.encode(header);
      const obj1Bytes = encoder.encode(obj1);
      const obj2Bytes = encoder.encode(obj2);
      const obj3Bytes = encoder.encode(obj3);
      const obj4Bytes = encoder.encode(obj4);

      const offset_1 = headerBytes.length;
      const offset_2 = offset_1 + obj1Bytes.length;
      const offset_3 = offset_2 + obj2Bytes.length;
      const offset_4 = offset_3 + obj3Bytes.length;
      const xref_offset = offset_4 + obj4Bytes.length;
      const xref_entries = [
        "0000000000 65535 f\r\n",
        `${String(offset_1).padStart(10, '0')} 00000 n\r\n`,
        `${String(offset_2).padStart(10, '0')} 00000 n\r\n`,
        `${String(offset_3).padStart(10, '0')} 00000 n\r\n`,
        `${String(offset_4).padStart(10, '0')} 00000 n\r\n`,
      ];
      const xref_table = "xref\r\n0 5\r\n" + xref_entries.join("");
      const trailer = "trailer\r\n<</Size 5 /Root 1 0 R>>\r\n";
      const startxref = `startxref\r\n${xref_offset}\r\n%%EOF\r\n`;
      const fullPdfStr = header + obj1 + obj2 + obj3 + obj4 + xref_table + trailer + startxref;
      
      const pdfBlob = new Blob([encoder.encode(fullPdfStr)], { type: "application/pdf" });
      const formData = new FormData();
      formData.append("file", pdfBlob, docName);
      formData.append("reason", "Land Registration Approval");

      const res = await fetch("http://localhost:7777/api/sign/pdf", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "PDF signing failed on bridge.");
      }

      // Read PDF blob response
      const signedBlob = await res.blob();
      const signedUrl = URL.createObjectURL(signedBlob);
      setSignedFileUrl(signedUrl);
      setSignStatus("success");
      setStatusMessage("Document signed and verified! Compliant with Class 3 DSC protocols.");
    } catch (err) {
      setSignStatus("error");
      setStatusMessage(err.message || "Cryptographic signing failed.");
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden border-4 border-slate-700 shadow-2xl flex flex-col h-[520px]">
      
      {/* WebView Browser Address Bar */}
      <div className="bg-slate-700 px-4 py-2 flex items-center space-x-2 text-xs">
        <div className="flex space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block"></span>
        </div>
        <div className="flex-grow bg-slate-900 rounded px-3 py-1 flex items-center text-slate-400 font-mono select-none">
          <svg className="w-3.5 h-3.5 text-slate-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="truncate">{url}</span>
        </div>
        <button
          onClick={() => {
            setSignStatus("idle");
            setSignedFileUrl(null);
            setStatusMessage("");
          }}
          className="text-slate-400 hover:text-white px-2 py-0.5"
          title="Reload Page"
        >
          ↻
        </button>
      </div>

      {/* WebView Internal Page */}
      <div className="flex-grow bg-slate-100 p-6 overflow-y-auto flex flex-col text-slate-800">
        
        {/* Government Portal Header */}
        <div className="bg-white border-b-2 border-orange-500 p-4 rounded shadow-sm mb-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-govBlue-700 text-xs border">
              AP
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-tight text-slate-700">
                Land Registration Portal
              </h4>
              <p className="text-[9px] text-slate-500 font-semibold tracking-wider">
                GOVERNMENT OF ANDHRA PRADESH
              </p>
            </div>
          </div>
          <span className="bg-orange-100 text-orange-800 text-[9px] font-bold px-2 py-0.5 rounded border border-orange-200">
            OFFICIAL USE ONLY
          </span>
        </div>

        {/* Land Clearance Content */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex-grow flex flex-col justify-between">
          <div>
            <h5 className="font-bold text-sm text-slate-800 mb-2 border-b border-slate-100 pb-1.5">
              Land Allotment Authorization File
            </h5>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded">
              <div>
                <span className="font-semibold text-slate-500 block text-[10px] uppercase">File Ref:</span>
                AP/REV/LR-2026/08892
              </div>
              <div>
                <span className="font-semibold text-slate-500 block text-[10px] uppercase">Allotment Area:</span>
                Vishwakhapatnam Central Zone
              </div>
              <div>
                <span className="font-semibold text-slate-500 block text-[10px] uppercase">Document:</span>
                {docName} ({docSize})
              </div>
              <div>
                <span className="font-semibold text-slate-500 block text-[10px] uppercase">Designated Signer:</span>
                {officer ? `${officer.name} (${officer.department})` : "Revenue Officer"}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-normal mb-4">
              This land clearance certificate requires Class 3 digital signature approval by the authorized Joint Secretary. By clicking sign, a local bridge request will trigger the hardware security token.
            </p>
          </div>

          {/* Dynamic Sign Controls */}
          <div>
            {/* Status updates */}
            {statusMessage && (
              <div
                className={`text-[11px] px-3.5 py-2.5 rounded-lg border mb-4 font-medium ${
                  signStatus === "success"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : signStatus === "error"
                    ? "bg-red-50 border-red-200 text-red-800"
                    : "bg-blue-50 border-blue-200 text-blue-800 animate-pulse"
                }`}
              >
                {statusMessage}
              </div>
            )}

            {signStatus === "idle" && (
              <button
                onClick={handleStartSigning}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-4 rounded shadow transition duration-150 text-xs tracking-wider uppercase flex justify-center items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Authorize & Sign Document</span>
              </button>
            )}

            {signStatus === "success" && (
              <div className="flex gap-2">
                <a
                  href={signedFileUrl}
                  download={`signed_${docName}`}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded shadow text-center transition duration-150 text-xs tracking-wider uppercase flex justify-center items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download Signed PDF</span>
                </a>
              </div>
            )}

            {(signStatus === "checking" || signStatus === "signing") && (
              <div className="w-full bg-slate-200 py-2.5 rounded text-center text-xs text-slate-500 font-semibold animate-pulse uppercase">
                Bridging Cryptography...
              </div>
            )}

            {signStatus === "error" && (
              <button
                onClick={handleStartSigning}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded shadow transition duration-150 text-xs tracking-wider uppercase"
              >
                Retry Signing Request
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Embedded PIN Modal */}
      <PINModal
        isOpen={isPinOpen}
        onClose={() => {
          setIsPinOpen(false);
          if (signStatus !== "success") setSignStatus("idle");
        }}
        onSuccess={handlePinSuccess}
      />
    </div>
  );
}
