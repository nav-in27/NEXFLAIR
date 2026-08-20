import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Shield, Search, LogOut, User as UserIcon, Menu, X, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  const navItems = [
    { label: 'Overview', path: '/' },
    { label: 'Track Complaint', path: '/track' },
    { label: 'Report Issue', path: '/report' },
    { label: 'Interactive Demo', path: '/demo' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/how-it-works';
    return location.pathname === path;
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'REVIEWER') return '/reviewer/dashboard';
    if (user.role === 'FIELD_WORKER') return '/worker/dashboard';
    return '/admin/dashboard';
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 focus:outline-none">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
            <Shield className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-slate-900 flex items-center gap-1.5">
              <span>MEIKAAN</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                GOV
              </span>
            </div>
            <p className="text-[10px] text-slate-500 hidden sm:block">Civic Evidence Integrity</p>
          </div>
        </Link>

        {/* Center: Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`py-1.5 transition-colors ${
                  active
                    ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: User actions & Login */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => navigate('/track')}
            title="Search complaint"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>

          {user ? (
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <button
                onClick={() => navigate(getDashboardPath())}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-800 transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>{user.full_name.split(' ')[0]}</span>
                <span className="px-1.5 py-0.2 rounded bg-white text-[10px] text-slate-600 font-mono border border-slate-200">
                  {user.role.replace('_', ' ')}
                </span>
              </button>

              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/report')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5 text-slate-500" />
                Report
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors"
              >
                Staff Portal
              </button>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-md"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-md text-xs font-medium ${
                isActive(item.path) ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </Link>
          ))}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            {user ? (
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={() => {
                    navigate(getDashboardPath());
                    setMobileMenuOpen(false);
                  }}
                  className="text-xs font-medium text-slate-800 flex items-center gap-2"
                >
                  <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>{user.full_name}</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="text-xs font-medium text-rose-600 hover:underline flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  navigate('/login');
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2 bg-slate-900 text-white text-xs font-semibold rounded-md text-center"
              >
                Staff Portal Sign In
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
