import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

export const RootLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      {/* Main Page Body */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>MEIKAAN © 2026 • Civic Evidence Integrity Engine</p>
      </footer>
    </div>
  );
};

export default RootLayout;
