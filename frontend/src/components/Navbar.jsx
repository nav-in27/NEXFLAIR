import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, PlusCircle, Search, LogIn, LogOut, User as UserIcon, LayoutDashboard, CheckSquare, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="p-2 rounded-xl bg-blue-600 group-hover:bg-blue-500 shadow-md transition-colors">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight text-white">MEIKAAN</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                CIVIC
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">Civic Evidence Integrity Engine</p>
          </div>
        </Link>

        {/* Role Based Navigation */}
        <nav className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm font-semibold">
          {!user ? (
            /* Citizen Navigation */
            <>
              <Link
                to="/citizen/report"
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  location.pathname === '/citizen/report'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <PlusCircle className="w-4 h-4 text-blue-400" />
                <span>Report Issue</span>
              </Link>

              <Link
                to="/citizen/track"
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  location.pathname === '/citizen/track'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Search className="w-4 h-4 text-blue-400" />
                <span>Track Complaint</span>
              </Link>

              <Link
                to="/login"
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-slate-800"
              >
                <LogIn className="w-4 h-4" />
                <span>Portal Login</span>
              </Link>
            </>
          ) : user.role === 'FIELD_WORKER' ? (
            /* Field Worker Navigation */
            <>
              <Link
                to="/worker/dashboard"
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  location.pathname.startsWith('/worker')
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <CheckSquare className="w-4 h-4 text-blue-400" />
                <span>My Tasks</span>
              </Link>
            </>
          ) : user.role === 'REVIEWER' ? (
            /* Reviewer Navigation */
            <>
              <Link
                to="/reviewer/dashboard"
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  location.pathname.startsWith('/reviewer')
                    ? 'bg-amber-600 text-slate-950 font-bold shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ClipboardList className="w-4 h-4 text-amber-400" />
                <span>Review Queue</span>
              </Link>
            </>
          ) : (
            /* Admin Navigation */
            <>
              <Link
                to="/admin/dashboard"
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  location.pathname === '/admin/dashboard'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-blue-400" />
                <span>Dashboard</span>
              </Link>

              <Link
                to="/tickets"
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  location.pathname === '/tickets'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ClipboardList className="w-4 h-4 text-blue-400" />
                <span>Complaints</span>
              </Link>

              <Link
                to="/reviewer/dashboard"
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  location.pathname.startsWith('/reviewer')
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>Audit Queue</span>
              </Link>
            </>
          )}

          {/* User Profile & Logout */}
          {user && (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
              <div className="hidden md:flex items-center space-x-1.5 text-xs text-slate-300">
                <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-semibold text-white">{user.full_name.split(' ')[0]}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
