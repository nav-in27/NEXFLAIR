import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

export const RootLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans antialiased">
      <Navbar />

      {/* Main Page Body */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Understated Civic Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">MEIKAAN</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">Civic Evidence Integrity Platform</span>
          </div>
          <p className="text-slate-400 text-[11px]">Municipal Cryptographic Verification System • 2026</p>
        </div>
      </footer>
    </div>
  );
};

export default RootLayout;
