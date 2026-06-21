import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [docTypeFilter, setDocTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchHistory = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/history", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setHistory(data);
        setFilteredHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Apply filters in-memory on filter/search change
  useEffect(() => {
    let result = [...history];

    if (docTypeFilter) {
      result = result.filter((item) => item.document_type === docTypeFilter);
    }

    if (statusFilter) {
      result = result.filter((item) => item.status === statusFilter);
    }

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.document_name.toLowerCase().includes(term) ||
          (item.signature_id && item.signature_id.toLowerCase().includes(term))
      );
    }

    setFilteredHistory(result);
  }, [docTypeFilter, statusFilter, searchTerm, history]);

  const exportToCSV = () => {
    if (filteredHistory.length === 0) return;

    const headers = ["Document Name", "Document Type", "Signed By", "Signed Date", "Status", "Signature ID", "Details/Error"];
    const rows = [
      headers.join(","),
      ...filteredHistory.map((item) => {
        const name = `"${item.document_name.replace(/"/g, '""')}"`;
        const type = `"${item.document_type}"`;
        const signer = `"${item.officer_name.replace(/"/g, '""')}"`;
        const date = `"${new Date(item.signed_at).toLocaleString()}"`;
        const status = `"${item.status}"`;
        const sigId = `"${item.signature_id || "N/A"}"`;
        const details = `"${(item.error_message || "").replace(/"/g, '""')}"`;
        return [name, type, signer, date, status, sigId, details].join(",");
      }),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DSC_Signing_Audit_Log_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col min-h-screen font-sans bg-govAsh dark:bg-slate-900 transition-colors duration-300 text-slate-800 dark:text-slate-100">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
              Officer Digital Signing Logs
            </h2>
            <p className="text-xs text-slate-555 dark:text-slate-400 mt-0.5">
              Secure, un-editable legal records of digital signature operations.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {filteredHistory.length > 0 && (
              <button
                onClick={exportToCSV}
                className="bg-govGold hover:bg-govGold-dark text-white font-bold py-2 px-4 rounded-lg text-xs tracking-wider uppercase transition duration-150 flex items-center space-x-1.5 shadow"
              >
                <span>📥 Export CSV</span>
              </button>
            )}
            <button
              onClick={fetchHistory}
              className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold py-2 px-4 rounded-lg text-xs tracking-wider uppercase transition duration-150 flex items-center space-x-1"
            >
              <span>↻ Refresh Log</span>
            </button>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4 transition-colors duration-300">
          
          {/* Text Search */}
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Search Document or Signature ID
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter file name, signature UUID..."
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-650 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-govBlue-700 focus:bg-white dark:focus:bg-slate-900"
            />
          </div>

          {/* Doc Type Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Document Type
            </label>
            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-650 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-govBlue-700 focus:bg-white dark:focus:bg-slate-900"
            >
              <option value="">All Types</option>
              <option value="PDF">PDF Documents</option>
              <option value="Text">Plain Text</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Signing Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-650 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 text-xs focus:outline-none focus:border-govBlue-700 focus:bg-white dark:focus:bg-slate-900"
            >
              <option value="">All Statuses</option>
              <option value="Success">Success Only</option>
              <option value="Failed">Failed Only</option>
            </select>
          </div>

        </div>

        {/* Logs Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto">
            {loading ? (
              /* Custom Table Loading Skeleton */
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <div key={idx} className="flex items-center space-x-6 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4 skeleton-loader"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-12 skeleton-loader"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 skeleton-loader"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 skeleton-loader"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16 skeleton-loader"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-40 skeleton-loader"></div>
                  </div>
                ))}
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-16 text-center text-slate-400 dark:text-slate-500 text-xs">
                No signatures match your filter queries.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700 text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4">Document Name</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Signed By</th>
                    <th className="px-6 py-4">Signed Date & Time</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Signature ID</th>
                    <th className="px-6 py-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                  {filteredHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition duration-150">
                      <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-150 truncate max-w-[200px]" title={item.document_name}>
                        {item.document_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.document_type === "PDF"
                            ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-150 dark:border-red-900/30"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-600"
                        }`}>
                          {item.document_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {item.officer_name}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {new Date(item.signed_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.status === "Success"
                            ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-150 dark:border-green-900/30"
                            : "bg-red-50 dark:bg-red-950/20 text-error dark:text-red-400 border border-red-150 dark:border-red-900/30"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                        {item.signature_id || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={item.error_message}>
                        {item.error_message || "—"}
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
    </div>
  );
}
