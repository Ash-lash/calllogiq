import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';
import AssetManager from './components/AssetManager';
import { LogOut, LayoutDashboard, CheckSquare, ShieldAlert, Laptop } from 'lucide-react';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [adminViewMode, setAdminViewMode] = useState(false); // Toggle to simulate what normal user sees, or view different views

  useEffect(() => {
    if (token) {
      // Decode JWT simple way to get user info, or fetch profile
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.userId,
          email: payload.email,
          name: payload.name,
          domain: payload.domain,
          branch: payload.branch,
          role: payload.role
        });
        
        // If user is admin, set active tab to admin panel
        if (payload.role === 'admin') {
          setActiveTab('admin');
        } else {
          setActiveTab('dashboard');
        }
      } catch (err) {
        console.error('Invalid token format', err);
        handleLogout();
      }
    } else {
      setUser(null);
    }
  }, [token]);

  const handleLoginSuccess = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
    if (newUser.role === 'admin') {
      setActiveTab('admin');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setActiveTab('dashboard');
  };

  if (!token || !user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  const isUserAdmin = user.role === 'admin';

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.8rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect width="24" height="24" rx="4" fill="#111111" />
            <path d="M7 7H9V17H7V7ZM11 11H13V17H11V11ZM15 14H17V17H15V14Z" fill="#ffffff" />
            <circle cx="17" cy="8" r="2" fill="#ef4444" />
          </svg>
          <span style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.04em' }}>CALLLOGIQ</span>
        </div>
        
        <nav className="sidebar-menu">
          {!isUserAdmin && (
            <>
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className={`sidebar-item-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                <LayoutDashboard size={18} />
                Dashboard
              </button>
              <button 
                onClick={() => setActiveTab('assets')} 
                className={`sidebar-item-btn ${activeTab === 'assets' ? 'active' : ''}`}
              >
                <Laptop size={18} />
                Asset Manager
              </button>
            </>
          )}

          {isUserAdmin && (
            <>
              <button 
                onClick={() => setActiveTab('admin')} 
                className={`sidebar-item-btn ${activeTab === 'admin' ? 'active' : ''}`}
              >
                <ShieldAlert size={18} />
                Admin Panel
              </button>
              <button 
                onClick={() => setActiveTab('assets')} 
                className={`sidebar-item-btn ${activeTab === 'assets' ? 'active' : ''}`}
              >
                <Laptop size={18} />
                Asset Manager
              </button>
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className={`sidebar-item-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                <LayoutDashboard size={18} />
                Preview Dashboard
              </button>
            </>
          )}
        </nav>
        
        <div className="sidebar-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {user.domain && user.domain !== 'Pending' && (
                <div className="user-meta-domain">
                  {user.domain}
                </div>
              )}
              {user.branch && user.branch !== 'Pending' && (
                <div className="user-meta-domain" style={{ borderColor: 'var(--success)', color: 'var(--success)', boxShadow: '1px 1px 0px var(--success)' }}>
                  {user.branch}
                </div>
              )}
            </div>
          </div>
          
          <button onClick={handleLogout} className="sidebar-item-btn" style={{ color: 'var(--danger)', marginTop: 'auto' }}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main workspace area */}
      <main className="main-content">
        {activeTab === 'admin' && isUserAdmin ? (
          <AdminDashboard user={user} token={token} />
        ) : activeTab === 'assets' ? (
          <AssetManager user={user} token={token} />
        ) : (
          <UserDashboard user={user} token={token} previewMode={isUserAdmin} onProfileUpdate={handleLoginSuccess} />
        )}
      </main>
    </div>
  );
}

export default App;
