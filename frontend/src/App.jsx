import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';
import AssetManager from './components/AssetManager';
import UserProfile from './components/UserProfile';
import WebNotifications from './components/WebNotifications';
import WhatsAppManager from './components/WhatsAppManager';
import API_BASE from './api';
import { LogOut, LayoutDashboard, CheckSquare, ShieldAlert, Laptop, User, Globe, MessageSquare } from 'lucide-react';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [adminViewMode, setAdminViewMode] = useState(false); // Toggle to simulate what normal user sees, or view different views

  useEffect(() => {
    if (token) {
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

        // Fetch full profile dynamically (photo, phone)
        fetch(`${API_BASE}/api/users/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data && data.email) {
              setUser(prev => ({
                ...prev,
                name: data.name || prev.name,
                domain: data.domain || prev.domain,
                branch: data.branch || prev.branch,
                phone: data.phone || '',
                photo: data.photo || ''
              }));
            }
          })
          .catch(err => console.error('Error fetching full user profile:', err));
        
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

  // Automatically log out if backend returns 401 Unauthorized or 403 Forbidden
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (response.status === 401 || response.status === 403) {
          const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
          // Avoid logging out on login/google auth endpoints themselves, or on PDF/Excel proxy routes
          const isAuthRoute = url.includes('/api/auth/login') || url.includes('/api/auth/google');
          const isFileProxyRoute = url.includes('/api/calls/pdf') || url.includes('/api/calls/download') || url.includes('/api/assets/reports/download');
          if (!isAuthRoute && !isFileProxyRoute) {
            console.warn('Session expired or unauthorized (401/403). Logging out...');
            handleLogout();
          }
        }
        return response;
      } catch (err) {
        throw err;
      }
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

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
              <button 
                onClick={() => setActiveTab('profile')} 
                className={`sidebar-item-btn ${activeTab === 'profile' ? 'active' : ''}`}
              >
                <User size={18} />
                My Profile
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
                onClick={() => setActiveTab('webnotifications')} 
                className={`sidebar-item-btn ${activeTab === 'webnotifications' ? 'active' : ''}`}
              >
                <Globe size={18} />
                Web Notifications
              </button>
              <button 
                onClick={() => setActiveTab('whatsapp')} 
                className={`sidebar-item-btn ${activeTab === 'whatsapp' ? 'active' : ''}`}
              >
                <MessageSquare size={18} />
                WhatsApp Manager
              </button>
              <button 
                onClick={() => setActiveTab('profile')} 
                className={`sidebar-item-btn ${activeTab === 'profile' ? 'active' : ''}`}
              >
                <User size={18} />
                My Profile
              </button>
            </>
          )}
        </nav>
        
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            {user.photo ? (
              <img src={user.photo} alt={user.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #111' }} />
            ) : (
              <div className="user-avatar" style={{ width: '36px', height: '36px', minWidth: '36px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)', color: '#fff', borderRadius: '50%', fontWeight: 700 }}>
                {user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </div>
              <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                {user.domain && user.domain !== 'Pending' && (
                  <div className="user-meta-domain" style={{ fontSize: '0.65rem', padding: '1px 4px' }}>
                    {user.domain}
                  </div>
                )}
                {user.branch && user.branch !== 'Pending' && (
                  <div className="user-meta-domain" style={{ fontSize: '0.65rem', padding: '1px 4px', borderColor: 'var(--success)', color: 'var(--success)', boxShadow: '1px 1px 0px var(--success)' }}>
                    {user.branch}
                  </div>
                )}
              </div>
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
          ) : activeTab === 'webnotifications' && isUserAdmin ? (
            <WebNotifications user={user} token={token} />
          ) : activeTab === 'whatsapp' && isUserAdmin ? (
            <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '4rem auto', borderRadius: '8px', border: '3px solid #111111', boxShadow: '8px 8px 0px #111111', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--warning-light)', color: 'var(--warning)', border: '2px solid #111111', borderRadius: '50%', width: '70px', height: '70px', marginBottom: '1.5rem', boxShadow: '3px 3px 0px #111111' }}>
                <MessageSquare size={36} />
              </div>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#111111', marginBottom: '0.75rem' }}>
                WhatsApp Manager
              </h2>
              <span className="badge badge-warning" style={{ border: '2px solid #111111', fontSize: '0.8rem', padding: '0.3rem 1rem', boxShadow: '2px 2px 0px #111111', display: 'inline-block', marginBottom: '1.5rem' }}>
                🚧 Under Development
              </span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                Configure automated WhatsApp chatbots, coordinate team marketing campaigns, and manage broadcasting lists. This feature is currently undergoing system upgrades and will be launched soon!
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#111111', color: '#ffffff', padding: '0.75rem 1.5rem', borderRadius: '4px', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', border: '2px solid #111111', boxShadow: '4px 4px 0px #2563eb' }}>
                <span>🚀 Coming Soon</span>
              </div>
            </div>
          ) : activeTab === 'assets' ? (
            <AssetManager user={user} token={token} />
          ) : activeTab === 'profile' ? (
            <UserProfile user={user} token={token} onProfileUpdate={handleLoginSuccess} />
          ) : (
            <UserDashboard user={user} token={token} previewMode={isUserAdmin} onProfileUpdate={handleLoginSuccess} />
          )}
       </main>
    </div>
  );
}

export default App;
