import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Home, FileText, BookOpen, ClipboardList, Users, ShieldAlert,
  LogOut, Moon, Sun, UserCircle2, Menu, X, User, AlertTriangle, ArrowUpCircle,
} from 'lucide-react';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const currentSection = new URLSearchParams(location.search).get('section') || 'home';
  const [profileOpen, setProfileOpen] = React.useState(false);
  // On desktop, sidebar is always open by default
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  const getSidebarItems = () => {
    if (user?.role === 'Teacher') {
      return [
        { label: 'Home',             icon: Home,          section: 'home' },
        { label: 'Assessments',      icon: ClipboardList,  section: 'assessments' },
        { label: 'Exams & Quizzes',  icon: FileText,       section: 'quizzes' },
        { label: 'Course Materials', icon: BookOpen,       section: 'notes' },
        { label: 'Approvals',        icon: ShieldAlert,    section: 'submissions' },
      ];
    }
    if (user?.role === 'Student') {
      return [
        { label: 'Home',             icon: Home,          section: 'home' },
        { label: 'Assessments',      icon: ClipboardList,  section: 'assessments' },
        { label: 'Exams & Quizzes',  icon: FileText,       section: 'quizzes' },
        { label: 'Course Materials', icon: BookOpen,       section: 'notes' },
        { label: 'Results',          icon: ShieldAlert,    section: 'submissions' },
      ];
    }
    if (user?.role === 'TA') {
      return [
        { label: 'Home',        icon: Home,           section: 'home' },
        { label: 'Anomalies',   icon: AlertTriangle,  section: 'anomalies' },
        { label: 'Escalations', icon: ArrowUpCircle,  section: 'escalations' },
        { label: 'Groups',      icon: Users,          section: 'groups' },
      ];
    }
    return [];
  };

  const closeSidebar = () => setSidebarOpen(false);
  const toggleSidebar = () => setSidebarOpen(prev => !prev);

  return (
    <div className="dashboard-shell min-h-screen">
      <div className="flex min-h-screen relative">

        {/* ── Mobile Overlay (only visible on mobile when sidebar is open) ── */}
        {sidebarOpen && (
          <div
            className="sidebar-overlay lg:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        {/* ── Sidebar ── */}
        <aside className={`sidebar-panel ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
          {/* Top: Close button on mobile, brand on desktop */}
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-lg border border-white/50 bg-white/15 flex items-center justify-center text-white shrink-0">
              <span className="text-sm font-bold">PE</span>
            </div>
            {/* Close button — visible on mobile when sidebar is open */}
            <button
              onClick={closeSidebar}
              className="sidebar-close-btn lg:hidden"
              aria-label="Close sidebar"
              id="sidebar-close-btn"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-3 px-1">
            <p className="text-[28px] leading-[1.15] text-white font-bold">
              {user?.role || 'User'} Panel
            </p>
            {user?.uniqueId && (
              <p className="text-xs text-white/50 font-mono mt-0.5">{user.uniqueId}</p>
            )}
          </div>

          <nav className="mt-6 space-y-1" role="navigation" aria-label="Dashboard navigation">
            {getSidebarItems().map((item) => {
              const Icon = item.icon;
              const isActive =
                currentSection === item.section ||
                (item.section === 'home' && !location.search);
              return (
                <Link
                  key={item.section}
                  to={`/?section=${item.section}`}
                  onClick={closeSidebar}
                  className={`sidebar-item ${isActive ? 'sidebar-item-active' : 'sidebar-item-hover'}`}
                  aria-current={isActive ? 'page' : undefined}
                  id={`nav-${item.section}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pb-2 pt-4 border-t border-white/10">
            <button
              id="sidebar-logout-btn"
              onClick={logout}
              className="w-full sidebar-item sidebar-item-hover text-white/80 hover:text-white"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="topbar">
            {/* Hamburger — always visible */}
            <button
              id="sidebar-toggle-btn"
              onClick={toggleSidebar}
              className="topbar-button topbar-hamburger mr-auto"
              aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <div className="relative flex items-center gap-2">
              <button
                id="theme-toggle-btn"
                onClick={toggleTheme}
                className="topbar-button"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <button
                id="profile-menu-btn"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="topbar-button"
                aria-label="Toggle profile menu"
                aria-expanded={profileOpen}
                aria-haspopup="true"
              >
                <UserCircle2 size={28} />
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setProfileOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    className="profile-dropdown"
                    role="menu"
                    aria-label="Profile options"
                  >
                    <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--stroke)' }}>
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--primary-text)' }}>
                        {user?.name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted-text)' }}>
                        {user?.role}
                      </p>
                    </div>
                    <div className="p-1">
                      <Link
                        to="/?section=profile"
                        onClick={() => setProfileOpen(false)}
                        className="profile-dropdown-item"
                        role="menuitem"
                        id="nav-profile"
                      >
                        <User size={14} />
                        <span>My Profile</span>
                      </Link>
                      <button
                        onClick={() => { setProfileOpen(false); logout(); }}
                        className="w-full profile-dropdown-item text-left"
                        role="menuitem"
                        id="profile-logout-btn"
                      >
                        <LogOut size={14} />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </header>

          <main className="flex-1 dashboard-content">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
