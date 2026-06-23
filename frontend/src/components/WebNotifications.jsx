import React, { useState, useEffect } from 'react';
import { 
  Globe, Bell, Plus, Trash2, RefreshCw, ExternalLink, 
  AlertCircle, Info, Check, Sparkles, Search, Sliders, ToggleLeft, ToggleRight, Trash
} from 'lucide-react';
import API_BASE from '../api';

function WebNotifications({ user, token }) {
  const [sites, setSites] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingSiteId, setCheckingSiteId] = useState(null);
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'history'
  
  // Form states
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [siteSelector, setSiteSelector] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedSiteId, setExpandedSiteId] = useState(null);


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
      formattedUrl = 'https://' + formattedUrl;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/web-notifications/sites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: siteName, url: formattedUrl, selector: siteSelector.trim() })
      });
      const data = await res.json();

      if (res.ok) {
        setFormSuccess(`Successfully added and initialized ${siteName}!`);
        setSiteName('');
        setSiteUrl('');
        setSiteSelector('');
        setShowAddForm(false);
        
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
        await fetchSitesAndNotifications();
      } else {
        alert('Failed to delete monitored website.');
      }
    } catch (err) {
      console.error('Error deleting site:', err);
    }
  };

  const handleCheckSingleSite = async (id, name) => {
    setCheckingSiteId(id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/web-notifications/sites/${id}/check`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh data
        await fetchSitesAndNotifications();
        alert(`Check completed for "${name}": ${data.message}`);
      } else {
        alert(data.error || 'Failed to check website.');
      }
    } catch (err) {
      console.error('Error checking site:', err);
    } finally {
      setCheckingSiteId(null);
    }
  };

  const handleTriggerCheckAll = async () => {
    setCheckingAll(true);
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
      setCheckingAll(false);
    }
  };

  const handleSimulateChange = async (id, name) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/web-notifications/simulate-change/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchSitesAndNotifications();
      } else {
        const data = await res.json();
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

  const handleToggleSite = async (id, currentEnabled) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/web-notifications/sites/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      if (res.ok) {
        await fetchSitesAndNotifications();
      } else {
        alert('Failed to toggle monitor status.');
      }
    } catch (err) {
      console.error('Error toggling site status:', err);
    }
  };

  const handleClearSiteAlerts = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/web-notifications/sites/${id}/clear-alerts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchSitesAndNotifications();
      } else {
        alert('Failed to clear alerts.');
      }
    } catch (err) {
      console.error('Error clearing site alerts:', err);
    }
  };


  // Helper to format last checked string
  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Never checked';
    const date = new Date(isoString);
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Filter sites based on Search and active filter
  const filteredSites = sites.filter(site => {
    const matchesSearch = 
      site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.url.toLowerCase().includes(searchQuery.toLowerCase());
      
    if (activeFilter === 'unread') {
      // Find if this site has any notification
      const hasAlert = notifications.some(n => n.websiteId === site.id);
      return matchesSearch && hasAlert;
    }
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Dynamic Header */}
      <div className="card" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-main)', border: '2px solid #111', boxShadow: '4px 4px 0px #111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={28} style={{ color: 'var(--primary)' }} /> Watchlist Monitor
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
              Distill.io-style website change crawling. Track real-time alerts on dynamic pages, updates, and UI notifications.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
            >
              <Plus size={16} /> Add Monitor
            </button>
            <button 
              onClick={handleTriggerCheckAll}
              disabled={checkingAll}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
            >
              <RefreshCw size={16} className={checkingAll ? 'spin' : ''} />
              {checkingAll ? 'Scanning...' : 'Scan All Websites'}
            </button>
          </div>
        </div>

        {/* Add Monitor Form Overlay / Inline Drawer */}
        {showAddForm && (
          <div className="card" style={{ marginTop: '1.25rem', padding: '1.25rem', borderStyle: 'dashed', backgroundColor: '#fff' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>
              ➕ Track New Website URL
            </h3>
            <form onSubmit={handleAddWebsite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Monitor Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Sairam NCC Portal" 
                    value={siteName}
                    onChange={e => setSiteName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Website URL</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. sairamncc.in" 
                    value={siteUrl}
                    onChange={e => setSiteUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">CSS Selector (Optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. .sc-jwTyAe" 
                    value={siteSelector}
                    onChange={e => setSiteSelector(e.target.value)}
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <span>💡 <strong>Tip:</strong> To monitor only a specific element (like an announcement card), enter its CSS selector (e.g. <code>.sc-jwTyAe</code>). To find it, open the site, right-click the element ➔ <strong>Inspect</strong> ➔ right-click the HTML tag in DevTools ➔ <strong>Copy</strong> ➔ <strong>Copy selector</strong>, then paste it here. Leave blank to monitor the full page.</span>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem 1.25rem', height: 'auto', flexShrink: 0 }}>
                  Start Monitoring
                </button>
              </div>
            </form>
            {formError && <div className="alert alert-danger" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>{formError}</div>}
            {formSuccess && <div className="alert alert-success" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>{formSuccess}</div>}
          </div>
        )}
      </div>

      {/* Main Panel Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.5rem', alignItems: 'flex-start' }}>
        
        {/* Left Sidebar Filter Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem', border: '2px solid #111', boxShadow: '3px 3px 0px #111' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              📂 Filters
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <button 
                onClick={() => setActiveFilter('all')}
                className="sidebar-item-btn" 
                style={{ 
                  justifyContent: 'space-between',
                  backgroundColor: activeFilter === 'all' ? '#111' : 'transparent',
                  color: activeFilter === 'all' ? '#fff' : 'inherit'
                }}
              >
                <span>🌐 All Monitors</span>
                <span className="badge" style={{ backgroundColor: activeFilter === 'all' ? '#fff' : '#111', color: activeFilter === 'all' ? '#111' : '#fff' }}>
                  {sites.length}
                </span>
              </button>
              <button 
                onClick={() => setActiveFilter('unread')}
                className="sidebar-item-btn"
                style={{ 
                  justifyContent: 'space-between',
                  backgroundColor: activeFilter === 'unread' ? '#111' : 'transparent',
                  color: activeFilter === 'unread' ? '#fff' : 'inherit'
                }}
              >
                <span>🔔 Has Alerts</span>
                {notifications.length > 0 && (
                  <span className="badge badge-danger">
                    {notifications.length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setActiveFilter('history')}
                className="sidebar-item-btn"
                style={{ 
                  justifyContent: 'space-between',
                  backgroundColor: activeFilter === 'history' ? '#111' : 'transparent',
                  color: activeFilter === 'history' ? '#fff' : 'inherit'
                }}
              >
                <span>📜 Change Log Feed</span>
              </button>
            </div>
          </div>

          {/* Quick Checker Status */}
          <div className="card" style={{ padding: '1rem', border: '2px solid #111', boxShadow: '3px 3px 0px #111', backgroundColor: '#fff' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              ⏱️ Background Scan
            </h4>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--success)' }}>
              <Check size={14} /> ACTIVE (30m Loop)
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: 1.4 }}>
              Websites are scraped in the background every 30 minutes. Headless Chromium will fetch dynamic changes.
            </p>
          </div>
        </div>

        {/* Right Content Watchlist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Watchlist Filter Bar */}
          {activeFilter !== 'history' && (
            <div className="card" style={{ padding: '0.75rem 1rem', border: '2px solid #111', boxShadow: '3px 3px 0px #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.2rem', marginBottom: 0 }}
                  placeholder="Filter watchlist by name or URL..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                Showing {filteredSites.length} of {sites.length} monitors
              </div>
            </div>
          )}

          {/* VIEW: WATCHLIST MONITORS LIST (Distill.io Tabular Style) */}
          {activeFilter !== 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredSites.length === 0 ? (
                <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', border: '2px dashed var(--border-color)' }}>
                  <Info size={36} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', opacity: 0.7 }} />
                  <h4 style={{ fontWeight: 800 }}>No Monitors Found</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {searchQuery ? 'Try matching another search query.' : 'Click "Add Monitor" to add websites to your watchlist.'}
                  </p>
                </div>
              ) : (
                <div className="card" style={{ padding: 0, border: '2.5px solid #111', boxShadow: '4px 4px 0px #111', overflowX: 'auto', backgroundColor: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '2.5px solid #111' }}>
                        <th style={{ padding: '0.75rem 1rem', width: '80px', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.78rem' }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.78rem' }}>Name & Source URL</th>
                        <th style={{ padding: '0.75rem 1rem', width: '180px', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.78rem' }}>CSS Selector</th>
                        <th style={{ padding: '0.75rem 1rem', width: '160px', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.78rem' }}>Last Checked</th>
                        <th style={{ padding: '0.75rem 1rem', width: '120px', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.78rem', textAlign: 'center' }}>Alerts</th>
                        <th style={{ padding: '0.75rem 1rem', width: '220px', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.78rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSites.map(site => {
                        const siteAlerts = notifications.filter(n => n.websiteId === site.id);
                        const hasAlert = siteAlerts.length > 0;
                        const isEnabled = site.enabled !== false;
                        const isExpanded = expandedSiteId === site.id;
                        
                        return (
                          <React.Fragment key={site.id}>
                            <tr 
                              onClick={() => setExpandedSiteId(isExpanded ? null : site.id)}
                              style={{ 
                                borderBottom: '1.5px solid #111', 
                                backgroundColor: hasAlert ? '#f0fdf4' : (isExpanded ? '#f8fafc' : 'transparent'),
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                              }}
                              className="watchlist-row"
                            >
                              {/* Status switch */}
                              <td style={{ padding: '0.75rem 1rem' }} onClick={e => e.stopPropagation()}>
                                <label className="toggle-switch" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                                  <input 
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={() => handleToggleSite(site.id, isEnabled)}
                                    style={{ display: 'none' }}
                                  />
                                  <div style={{
                                    width: '38px',
                                    height: '20px',
                                    backgroundColor: isEnabled ? 'var(--success)' : '#cbd5e1',
                                    borderRadius: '20px',
                                    padding: '2px',
                                    transition: 'background-color 0.2s',
                                    border: '1.5px solid #111',
                                    position: 'relative'
                                  }}>
                                    <div style={{
                                      width: '12px',
                                      height: '12px',
                                      backgroundColor: '#fff',
                                      borderRadius: '50%',
                                      border: '1px solid #111',
                                      transition: 'transform 0.2s',
                                      transform: isEnabled ? 'translateX(18px)' : 'translateX(0)',
                                    }} />
                                  </div>
                                </label>
                              </td>
                              
                              {/* Name & Source */}
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ fontWeight: 800, color: '#111', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  {site.name}
                                  {isExpanded ? <Sliders size={12} style={{ color: 'var(--primary)' }} /> : null}
                                </div>
                                <a 
                                  href={site.url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{ fontSize: '0.72rem', color: 'var(--primary)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '2px', marginTop: '0.15rem' }}
                                >
                                  {site.url.length > 50 ? site.url.substring(0, 47) + '...' : site.url} <ExternalLink size={10} />
                                </a>
                              </td>
                              
                              {/* Selector */}
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <span style={{ 
                                  fontSize: '0.7rem', 
                                  fontWeight: 800, 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  border: '1.5px solid #111', 
                                  backgroundColor: site.selector ? '#e2e8f0' : '#f1f5f9', 
                                  color: '#111',
                                  fontFamily: site.selector ? 'monospace' : 'inherit'
                                }}>
                                  {site.selector ? `${site.selector}` : 'document.body'}
                                </span>
                              </td>
                              
                              {/* Last Checked */}
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                <strong style={{ color: '#111' }}>{formatTimeAgo(site.lastCheckedAt)}</strong>
                              </td>
                              
                              {/* Alerts count badge */}
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                {hasAlert ? (
                                  <span className="badge badge-danger" style={{ fontWeight: 900, animation: 'pulse 2s infinite' }}>
                                    {siteAlerts.length} Alert{siteAlerts.length > 1 ? 's' : ''}
                                  </span>
                                ) : (
                                  <span style={{ color: '#cbd5e1', fontWeight: 800, fontSize: '0.75rem' }}>-</span>
                                )}
                              </td>
                              
                              {/* Actions */}
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                  <button
                                    onClick={() => handleCheckSingleSite(site.id, site.name)}
                                    disabled={checkingSiteId === site.id}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px' }}
                                    title="Scan Now"
                                  >
                                    <RefreshCw size={11} className={checkingSiteId === site.id ? 'spin' : ''} />
                                    Scan
                                  </button>
                                  <button
                                    onClick={() => handleSimulateChange(site.id, site.name)}
                                    className="btn btn-secondary"
                                    style={{ 
                                      padding: '0.25rem 0.5rem', 
                                      fontSize: '0.7rem', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '2px',
                                      borderColor: 'var(--primary)',
                                      color: 'var(--primary)'
                                    }}
                                    title="Simulate Website Change"
                                  >
                                    <Sparkles size={11} />
                                    Simulate
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSite(site.id, site.name)}
                                    className="btn btn-secondary"
                                    style={{ 
                                      padding: '0.25rem 0.5rem', 
                                      fontSize: '0.7rem', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '2px',
                                      borderColor: 'var(--danger)',
                                      color: 'var(--danger)'
                                    }}
                                    title="Delete Monitor"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            
                            {/* Collapsible detail drawer */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={6} style={{ backgroundColor: '#f8fafc', padding: '1rem', borderBottom: '1.5px solid #111' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem' }}>
                                    
                                    {/* Snippet display */}
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                                          🔍 Latest Extracted Content Preview
                                        </span>
                                        {site.scrapedVia && (
                                          <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', border: '1px solid #111', backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                                            ⚡ Scraped via: {site.scrapedVia}
                                          </span>
                                        )}
                                      </div>
                                      
                                      <div 
                                        style={{
                                          fontFamily: 'monospace',
                                          fontSize: '0.8rem',
                                          padding: '1rem',
                                          borderRadius: '6px',
                                          border: '1.5px solid #111',
                                          backgroundColor: hasAlert ? '#f0fdf4' : '#fff',
                                          borderColor: hasAlert ? 'var(--success)' : '#111',
                                          color: '#1e293b',
                                          maxHeight: '180px',
                                          overflowY: 'auto',
                                          lineHeight: 1.5,
                                          whiteSpace: 'pre-wrap',
                                          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
                                        }}
                                      >
                                        {site.latestContentText ? (
                                          <>
                                            {hasAlert && (
                                              <div style={{ color: '#15803d', fontWeight: 900, fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                                                🟢 UNREAD CHANGE ALERT DETECTED:
                                              </div>
                                            )}
                                            {site.latestContentText}
                                          </>
                                        ) : (
                                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            No content has been fetched yet. Click the "Scan" button to fetch initial data.
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Technical details side-card */}
                                    <div style={{ borderLeft: '1.5px solid #cbd5e1', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem' }}>
                                      <h5 style={{ margin: 0, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Scraper Profile</h5>
                                      
                                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.25rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                                        <strong style={{ color: isEnabled ? 'var(--success)' : 'var(--danger)' }}>
                                          {isEnabled ? 'ACTIVE MONITOR' : 'PAUSED'}
                                        </strong>
                                      </div>
                                      
                                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.25rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Interval:</span>
                                        <span>30 Minutes (Cron)</span>
                                      </div>
                                      
                                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.25rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Date Added:</span>
                                        <span>{site.createdAt ? new Date(site.createdAt).toLocaleDateString() : 'Unknown'}</span>
                                      </div>
                                      
                                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '0.25rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Hash ID:</span>
                                        <span style={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>
                                          {site.lastContentHash ? site.lastContentHash.substring(0, 16) + '...' : 'No Hash'}
                                        </span>
                                      </div>
                                      
                                      {hasAlert && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                          <button 
                                            onClick={async () => {
                                              await handleClearSiteAlerts(site.id);
                                            }}
                                            className="btn btn-secondary" 
                                            style={{ width: '100%', padding: '0.3rem', fontSize: '0.72rem', backgroundColor: '#e2e8f0' }}
                                          >
                                            Mark alerts as read
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW: HISTORICAL CHANGE LOG FEED */}
          {activeFilter === 'history' && (
            <div className="card" style={{ padding: '1.25rem', border: '2.5px solid #111', boxShadow: '4px 4px 0px #111' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  📜 Change Log Feed
                </h3>
                {notifications.length > 0 && (
                  <button 
                    onClick={handleClearNotifications}
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  >
                    <Trash size={12} /> Clear Logs
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '3rem 1.5rem', 
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-main)',
                  borderRadius: '6px',
                  border: '2px dashed var(--border-light)'
                }}>
                  <Info size={28} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                  <div style={{ fontWeight: 800 }}>No Changes Logged</div>
                  <p style={{ fontSize: '0.78rem', marginTop: '0.2rem' }}>
                    All websites currently match their recorded states. When a change is detected, it will be listed here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {notifications.map(notif => (
                    <div 
                      key={notif.id}
                      style={{
                        border: '1.5px solid #111',
                        borderRadius: '6px',
                        padding: '1rem',
                        backgroundColor: '#ffffff',
                        boxShadow: '2px 2px 0px #111'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                        <div>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 900, color: '#111', margin: 0 }}>{notif.title}</h4>
                          <a 
                            href={notif.url} 
                            target="_blank" 
                            rel="noreferrer"
                            style={{ fontSize: '0.72rem', color: 'var(--primary)', textDecoration: 'underline' }}
                          >
                            {notif.url}
                          </a>
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          🕒 {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ 
                        fontSize: '0.8rem', 
                        color: '#334155', 
                        backgroundColor: 'var(--bg-main)',
                        padding: '0.5rem',
                        border: '1px solid var(--border-light)',
                        borderRadius: '4px',
                        margin: 0,
                        fontFamily: 'monospace'
                      }}>
                        {notif.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default WebNotifications;
