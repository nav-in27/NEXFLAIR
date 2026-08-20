import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, Search, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { label: 'How it works', path: '/' },
    { label: 'Track complaint', path: '/track' },
    { label: 'Report an issue', path: '/report' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/how-it-works';
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200/90 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        
        {/* Left: MEIKAAN Brand Logo */}
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-8 h-8 rounded-lg bg-[#0047bb] flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-slate-900">
            MEIKAAN
          </span>
        </Link>

        {/* Center: Minimalist Public Navigation */}
        <nav className="flex items-center space-x-8 text-sm font-medium">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`py-2 transition-all relative ${
                  active
                    ? 'text-slate-900 font-bold border-b-2 border-[#0047bb]'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Search & Sign In / User Profile */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/track')}
            title="Search complaint"
            className="p-2 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>

          {user ? (
            <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
              <button
                onClick={() => {
                  if (user.role === 'REVIEWER') navigate('/reviewer/dashboard');
                  else if (user.role === 'FIELD_WORKER') navigate('/worker/dashboard');
                  else navigate('/admin/dashboard');
                }}
                className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800 transition-all"
              >
                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>{user.full_name.split(' ')[0]}</span>
                <span className="px-1.5 py-0.5 rounded bg-white text-[10px] text-blue-700 font-mono border border-slate-200">
                  {user.role}
                </span>
              </button>

              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 bg-[#0047bb] hover:bg-[#003ca0] text-white text-xs font-bold rounded-lg transition-all shadow-xs"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
