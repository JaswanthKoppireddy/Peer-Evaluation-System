import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Moon, Sun, LogOut, UserCircle2 } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    logout();
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/70 shadow-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center text-lg font-semibold shadow-lg shadow-indigo-500/20">
                PE
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900 dark:text-white">PeerEval</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Secure assessment dashboard</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user ? (
              <div className="flex items-center gap-3">
                <button className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shadow-sm">
                  <UserCircle2 size={20} />
                </button>
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{user.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{user.role}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
                  Sign in
                </Link>
                <Link to="/register" className="inline-flex items-center justify-center px-4 py-2 rounded-2xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/10 hover:shadow-xl">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
