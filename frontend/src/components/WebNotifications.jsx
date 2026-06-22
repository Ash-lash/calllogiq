import React, { useState, useEffect } from 'react';
import { 
  Globe, Bell, Plus, Trash2, RefreshCw, ExternalLink, 
  Play, AlertCircle, Info, Check, Sparkles 
} from 'lucide-react';
import API_BASE from '../api';

function WebNotifications({ user, token }) {
  const [sites, setSites] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('feed'); // 'feed' | 'manage'
  
  // Form states
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Fetch initial websites and change logs
  useEffect(() => {
    fetchSitesAndNotifications();
  }, [token]);

  const fetchSitesAndNotifications = async () => {
    setLoading(true);
    try {
      const [sitesRes, notifRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/web-notifications/sites`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/admin/web-notifications`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (sitesRes.ok && notifRes.ok) {
        const sitesData = await sitesRes.json();
        const notifData = await notifRes.json();
        setSites(sitesData);
        setNotifications(notifData);
      }
    } catch (err) {
      console.error('Error fetching web notifications data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWebsite = async (e) => {
    if (e) e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!siteName || !siteUrl) {
      setFormError('Both Website Name and URL are required.');
      return;
    }

    // Basic URL validation
    let formattedUrl = siteUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'http://' + formattedUrl;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/web-notifications/sites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: siteName, url: formattedUrl })
      });
      const data = await res.json();

      if (res.ok) {
        setFormSuccess(`Successfully added and initialized ${siteName}!`);
        setSiteName('');
        setSiteUrl('');
        
        // Refresh data
        await fetchSitesAndNotifications();
      } else {
        setFormError(data.error || 'Failed to add website.');
      }
    } catch (err) {
      console.error('Error adding site:', err);
      setFormError('An error occurred. Please check server logs.');
    }
  };

  const handleDeleteSite = async (id, name) => {
    if (!window.confirm(`Are you sure you want to stop monitoring "${name}"? All associated change logs will be deleted.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/web-notifications/sites/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        // Refresh data
        await fetchSitesAndNotifications();
      } else {
        alert('Failed to delete monitored website.');
      }
    } catch (err) {
      console.error('Error deleting site:', err);
    }
  };

  const handleTriggerCheck = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/web-notifications/trigger-check`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        await fetchSitesAndNotifications();
      } else {
        alert(data.error || 'Failed to trigger check.');
      }
    } catch (err) {
      console.error('Error triggering check:', err);
    } finally {
      setChecking(false);
    }
  };

  const handleSimulateChange = async (id, name) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/web-notifications/simulate-change/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        await fetchSitesAndNotifications();
      } else {
        alert(data.error || 'Failed to simulate change.');
      }
    } catch (err) {
      console.error('Error simulating change:', err);
    }
  };

  const handleClearNotifications = async () => {
    if (notifications.length === 0) return;
    if (!window.confirm('Are you sure you want to clear all notification change logs?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/web-notifications/clear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchSitesAndNotifications();
      } else {
        alert('Failed to clear notifications.');
      }
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  // --- VIEW 1: FIRST TIME SETUP (0 sites monitored) ---
  if (sites.length === 0) {
    return (
      <div style={{ maxWidth: '650px', margin: '2rem auto' }}>
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '50%', 
            background: 'var(--primary-light)', 
            color: 'var(--primary)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 1.5rem',
            border: '2px solid var(--border-color)',
            boxShadow: '2px 2px 0px var(--border-color)'
          }}>
            <Globe size={32} />
          </div>
          
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Set Up Web Notifications
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: 1.5 }}>
            Monitor external websites for content updates, news, and changes. 
            Add your first website to initialize the live update feed tracking.
          </p>

          <form onSubmit={handleAddWebsite} className="card" style={{ 
            textAlign: 'left', 
            backgroundColor: 'var(--bg-main)', 
            padding: '1.5rem',
            borderStyle: 'dashed'
          }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={18} /> Add First Website
            </h3>

            {formError && (
              <div className="alert alert-danger" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Website Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. GYC Portal" 
                value={siteName}
                onChange={e => setSiteName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Website URL</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. https://gyc.in" 
                value={siteUrl}
                onChange={e => setSiteUrl(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
              Add & Start Tracking
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- VIEW 2: MONITOR ACTIVE DASHBOARD ---
  return (
    <div>
      {/* Overview KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card">
          <div className="kpi-icon primary"><Globe size={20} /></div>
          <div>
            <div className="kpi-label">Monitored Websites</div>
            <div className="kpi-value">{sites.length}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon danger"><Bell size={20} /></div>
          <div>
            <div className="kpi-label">Change Events Logged</div>
            <div className="kpi-value">{notifications.length}</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon success"><Check size={20} /></div>
          <div>
            <div className="kpi-label">Checker Status</div>
            <div className="kpi-value" style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 800 }}>ACTIVE (30M Interval)</div>
          </div>
        </div>
      </div>

      {/* Main control bar */}
      <div className="card" style={{ 
        marginBottom: '1.5rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1rem',
        padding: '1.25rem' 
      }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setActiveSubTab('feed')}
            className={`tab-btn ${activeSubTab === 'feed' ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Bell size={16} />
            Live Change Feed {notifications.length > 0 && <span className="badge badge-danger" style={{ marginLeft: '4px' }}>{notifications.length}</span>}
          </button>
          <button 
            onClick={() => setActiveSubTab('manage')}
            className={`tab-btn ${activeSubTab === 'manage' ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Globe size={16} />
            Manage Tracked Sites
          </button>
        </div>

        {/* Global actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {activeSubTab === 'feed' && notifications.length > 0 && (
            <button 
              onClick={handleClearNotifications}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
            >
              <Trash2 size={14} /> Clear Feed
            </button>
          )}

          <button 
            onClick={handleTriggerCheck}
            disabled={checking}
            className="btn btn-primary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={checking ? 'spin' : ''} />
            {checking ? 'Checking websites...' : 'Check All Websites Now'}
          </button>
        </div>
      </div>

      {/* --- SUBTAB VIEW 1: LIVE UPDATE FEED --- */}
      {activeSubTab === 'feed' && (
        <div className="card">
          <div className="card-title-bar" style={{ marginBottom: '1.25rem' }}>
            <h3>🔔 Live Update Feed</h3>
          </div>

          {notifications.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '4rem 1.5rem', 
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-main)',
              borderRadius: '8px',
              border: '2px dashed var(--border-light)'
            }}>
              <Info size={32} style={{ opacity: 0.5, marginBottom: '0.75rem' }} />
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#111' }}>No Updates Logged Yet</div>
              <p style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                All websites are currently matching their recorded hashes. Click "Check All Websites Now" to run a scan.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {notifications.map(notif => (
                <div 
                  key={notif.id}
                  style={{
                    border: '2px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    backgroundColor: '#ffffff',
                    boxShadow: '4px 4px 0px #111111',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 900, color: '#111' }}>{notif.title}</h4>
                      <a 
                        href={notif.url} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '2px', marginTop: '0.1rem' }}
                      >
                        {notif.url} <ExternalLink size={10} />
                      </a>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      🕒 {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ 
                    fontSize: '0.85rem', 
                    color: '#334155', 
                    lineHeight: 1.5,
                    background: 'var(--bg-main)',
                    padding: '0.75rem',
                    border: '1.5px solid var(--border-color)',
                    borderRadius: '6px',
                    margin: 0
                  }}>
                    {notif.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- SUBTAB VIEW 2: MANAGE MONITOR LIST --- */}
      {activeSubTab === 'manage' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'flex-start' }}>
          {/* Sites list table */}
          <div className="card">
            <div className="card-title-bar" style={{ marginBottom: '1.25rem' }}>
              <h3>🌐 Monitored Websites ({sites.length})</h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Website Name</th>
                    <th>URL</th>
                    <th>Last Checked</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map(site => (
                    <tr key={site.id}>
                      <td style={{ fontWeight: 800 }}>{site.name}</td>
                      <td>
                        <a 
                          href={site.url} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ color: 'var(--primary)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          {site.url.substring(0, 45)}{site.url.length > 45 ? '...' : ''} <ExternalLink size={11} />
                        </a>
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>
                        {site.lastCheckedAt ? (
                          <>
                            {new Date(site.lastCheckedAt).toLocaleDateString()} {new Date(site.lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending check...</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleSimulateChange(site.id, site.name)}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '0.2rem 0.5rem', 
                              fontSize: '0.7rem', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '3px',
                              borderColor: 'var(--success)',
                              color: 'var(--success)'
                            }}
                            title="Simulate change on website"
                          >
                            <Sparkles size={11} /> Simulate
                          </button>
                          <button
                            onClick={() => handleDeleteSite(site.id, site.name)}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '0.2rem 0.5rem', 
                              fontSize: '0.7rem', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '3px',
                              borderColor: 'var(--danger)',
                              color: 'var(--danger)'
                            }}
                            title="Remove from monitoring list"
                          >
                            <Trash2 size={11} /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add more websites panel */}
          <div className="card">
            <div className="card-title-bar" style={{ marginBottom: '1.25rem' }}>
              <h3>➕ Add Website</h3>
            </div>

            <form onSubmit={handleAddWebsite}>
              {formError && (
                <div className="alert alert-danger" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                  <AlertCircle size={14} />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="alert alert-success" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                  <Check size={14} />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Website Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ padding: '8px', fontSize: '0.85rem' }}
                  placeholder="e.g. GYC Portal" 
                  value={siteName}
                  onChange={e => setSiteName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Website URL</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ padding: '8px', fontSize: '0.85rem' }}
                  placeholder="e.g. https://gyc.in" 
                  value={siteUrl}
                  onChange={e => setSiteUrl(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '8px', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Start Monitoring URL
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default WebNotifications;
