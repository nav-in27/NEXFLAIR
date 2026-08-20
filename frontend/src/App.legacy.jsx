import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import EvidenceUploader from './components/EvidenceUploader';
import IntegrityReport from './components/IntegrityReport';
import AuditLedger from './components/AuditLedger';
import CertificateModal from './components/CertificateModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'report', 'ledger'
  const [activeReport, setActiveReport] = useState(null);
  const [certificateModalReport, setCertificateModalReport] = useState(null);
  const [ledgerStats, setLedgerStats] = useState({ total_records: 0, is_chain_valid: true });

  const fetchLedgerStats = async () => {
    try {
      const res = await fetch('/api/v1/audit/ledger');
      if (res.ok) {
        const data = await res.json();
        setLedgerStats({
          total_records: data.total_records || 0,
          is_chain_valid: data.is_chain_valid
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLedgerStats();
  }, [activeReport]);

  const handleAnalysisComplete = (reportData) => {
    setActiveReport(reportData);
    setActiveTab('report');
    fetchLedgerStats();
  };

  const handleSelectReportFromLedger = (reportData) => {
    setActiveReport(reportData);
    setActiveTab('report');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        ledgerStats={ledgerStats}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {activeTab === 'upload' && (
          <EvidenceUploader onAnalysisComplete={handleAnalysisComplete} />
        )}

        {activeTab === 'report' && (
          <IntegrityReport
            report={activeReport}
            onOpenCertificate={(rep) => setCertificateModalReport(rep)}
            onBackToUpload={() => setActiveTab('upload')}
          />
        )}

        {activeTab === 'ledger' && (
          <AuditLedger onSelectReport={handleSelectReportFromLedger} />
        )}
      </main>

      {/* Certificate Modal */}
      {certificateModalReport && (
        <CertificateModal
          report={certificateModalReport}
          onClose={() => setCertificateModalReport(null)}
        />
      )}

      {/* Footer */}
      <footer className="glass-panel border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>MEIKAAN — Civic Evidence Integrity Engine v1.0</div>
          <div>Cryptographic SHA-256 Merkle Ledger & Error Level Analysis (ELA)</div>
        </div>
      </footer>

    </div>
  );
}
