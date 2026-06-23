import React, { useState, useEffect } from 'react';
import { 
  Globe, Bell, Plus, Trash2, RefreshCw, ExternalLink, 
  AlertCircle, Info, Check, Sparkles, Search, Sliders, ToggleLeft, ToggleRight, Trash,
  ChevronRight, ChevronDown, Settings, Play, Cloud, Laptop, HelpCircle, Tag, CheckSquare, Square,
  List, BarChart2, Users, BookOpen, MessageSquare, Languages, ChevronLeft, Mail, Moon, Sun
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
  const [selectedSiteIds, setSelectedSiteIds] = useState([]);
  const [dialog, setDialog] = useState(null); // { type: 'alert' | 'confirm', title: '', message: '', onConfirm: () => {} }

  // Visual Selector States
  const [showVisualSelector, setShowVisualSelector] = useState(false);
  const [selectMode, setSelectMode] = useState(true);
  const [tempSelector, setTempSelector] = useState('');
  const [tempSelectorText, setTempSelectorText] = useState('');
  const iframeRef = React.useRef(null);

  const handleOpenVisualSelector = () => {
    if (!siteUrl) return;
    setTempSelector(siteSelector || '');
    setTempSelectorText('');
    setSelectMode(true);
    setShowVisualSelector(true);
  };

  const handleIframeLoad = () => {
    // After iframe loads, send current selectMode state
    if (iframeRef.current && iframeRef.current.contentWindow) {
      setTimeout(() => {
        try {
          iframeRef.current.contentWindow.postMessage({ type: 'SET_SELECT_MODE', enabled: selectMode }, '*');
        } catch (e) { /* cross-origin, ignore */ }
      }, 300);
    }
  };

  const handleConfirmVisualSelector = () => {
    setSiteSelector(tempSelector);
    setShowVisualSelector(false);
  };

  // Synchronize selectMode with iframe
  useEffect(() => {
    if (showVisualSelector && iframeRef.current) {
      const iframeWindow = iframeRef.current.contentWindow;
      if (iframeWindow) {
        iframeWindow.postMessage({ type: 'SET_SELECT_MODE', enabled: selectMode }, '*');
      }
    }
  }, [selectMode, showVisualSelector]);

  // Listen to selector messages from iframe
  useEffect(() => {
    const handleIframeMessage = (event) => {
      if (event.data && event.data.type === 'SELECTOR_SELECTED') {
        setTempSelector(event.data.selector);
        setTempSelectorText(event.data.text);
      }
    };
    window.addEventListener('message', handleIframeMessage);
    return () => {
      window.removeEventListener('message', handleIframeMessage);
    };
  }, []);


  const showModalAlert = (title, message) => {
    setDialog({ type: 'alert', title, message });
  };

  const showModalConfirm = (title, message, onConfirm) => {
    setDialog({ type: 'confirm', title, message, onConfirm });
  };

  // Fetch initial websites and change logs
  useEffect(() => {
    fetchSitesAndNotifications(true);
  }, [token]);

  const fetchSitesAndNotifications = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
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
      if (showSpinner) setLoading(false);
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
        
        // Refresh data silently
        await fetchSitesAndNotifications(false);
      } else {
        setFormError(data.error || 'Failed to add website.');
      }
    } catch (err) {
      console.error('Error adding site:', err);
      setFormError('An error occurred. Please check server logs.');
    }
  };

  const handleDeleteSite = async (id, name) => {
    showModalConfirm(
      'Stop Monitoring?',
      `Are you sure you want to stop monitoring "${name}"? All associated change logs will be deleted.`,
      async () => {
        try {
          const res = await fetch(`${API_BASE}/api/admin/web-notifications/sites/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            await fetchSitesAndNotifications(false);
          } else {
            showModalAlert('Error', 'Failed to delete monitored website.');
          }
        } catch (err) {
          console.error('Error deleting site:', err);
        }
      }
    );
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
        // Refresh data silently
        await fetchSitesAndNotifications(false);
        showModalAlert('Scan Complete', `Check completed for "${name}": ${data.message}`);
      } else {
        showModalAlert('Error', data.error || 'Failed to check website.');
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
        showModalAlert('Bulk Scan Complete', data.message);
        await fetchSitesAndNotifications(false);
      } else {
        showModalAlert('Error', data.error || 'Failed to trigger check.');
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
        await fetchSitesAndNotifications(false);
      } else {
        const data = await res.json();
        showModalAlert('Error', data.error || 'Failed to simulate change.');
      }
    } catch (err) {
      console.error('Error simulating change:', err);
    }
  };

  const handleClearNotifications = async () => {
    if (notifications.length === 0) return;
    showModalConfirm(
      'Clear Logs?',
      'Are you sure you want to clear all notification change logs?',
      async () => {
        try {
          const res = await fetch(`${API_BASE}/api/admin/web-notifications/clear`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            await fetchSitesAndNotifications(false);
          } else {
            showModalAlert('Error', 'Failed to clear notifications.');
          }
        } catch (err) {
          console.error('Error clearing notifications:', err);
        }
      }
    );
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
        await fetchSitesAndNotifications(false);
      } else {
        showModalAlert('Error', 'Failed to toggle monitor status.');
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
        await fetchSitesAndNotifications(false);
      } else {
        showModalAlert('Error', 'Failed to clear alerts.');
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

  // Helper to safely extract hostname for favicon URL
  const getFaviconUrl = (urlStr) => {
    try {
      let url = urlStr.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      const parsed = new URL(url);
      return `https://www.google.com/s2/favicons?sz=64&domain=${parsed.hostname}`;
    } catch (e) {
      return 'https://www.google.com/s2/favicons?sz=64&domain=google.com';
    }
  };

  // Badge count helpers
  const unreadSitesCount = sites.filter(site => notifications.some(n => n.websiteId === site.id)).length;
  const errorSitesCount = sites.filter(site => site.latestContentText && (site.latestContentText.startsWith('Error:') || site.latestContentText.includes('Failed'))).length;

  const handleSelectRow = (id) => {
    setSelectedSiteIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedSiteIds.length === filteredSites.length) {
      setSelectedSiteIds([]);
    } else {
      setSelectedSiteIds(filteredSites.map(s => s.id));
    }
  };

  // Filter sites based on Search and active filter
  const filteredSites = sites.filter(site => {
    const matchesSearch = 
      site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.url.toLowerCase().includes(searchQuery.toLowerCase());
      
    if (activeFilter === 'unread') {
      const hasAlert = notifications.some(n => n.websiteId === site.id);
      return matchesSearch && hasAlert;
    }
    if (activeFilter === 'error') {
      const isError = site.latestContentText && (site.latestContentText.startsWith('Error:') || site.latestContentText.includes('Failed'));
      return matchesSearch && isError;
    }
    if (activeFilter === 'trash') {
      return false; // trash is empty by default
    }
    
    return matchesSearch;
  });

  const renderFilterItem = (filterName, label, count, activeColor) => {
    const isActive = activeFilter === filterName;
    return (
      <button
        onClick={() => {
          setActiveFilter(filterName);
          setSelectedSiteIds([]);
        }}
        style={{
          width: '100%',
          textAlign: 'left',
          background: isActive ? '#111111' : 'transparent',
          color: isActive ? '#ffffff' : '#111111',
          border: isActive ? '2px solid #111111' : '1.5px solid transparent',
          borderRadius: '0px',
          padding: '8px 12px',
          fontWeight: 800,
          fontSize: '13px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transform: isActive ? 'translate(-1px, -1px)' : 'none',
          boxShadow: isActive ? '2px 2px 0px #111111' : 'none',
          transition: 'all 0.1s',
          fontFamily: 'var(--font-family-title)',
          textTransform: 'uppercase',
          letterSpacing: '0.02em'
        }}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.borderColor = '#111111';
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.boxShadow = '2px 2px 0px #111111';
            e.currentTarget.style.transform = 'translate(-1px, -1px)';
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'none';
          }
        }}
      >
        <span>{label}</span>
        {count > 0 && (
          <span style={{
            backgroundColor: isActive ? '#ffffff' : activeColor || '#111111',
            color: isActive ? '#111111' : '#ffffff',
            border: '1.5px solid #111111',
            borderRadius: '4px',
            padding: '1px 6px',
            fontSize: '10px',
            fontWeight: 900
          }}>
            {count}
          </span>
        )}
      </button>
    );
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5rem 2rem',
        fontFamily: 'var(--font-family-body)',
        gap: '1.5rem',
        textAlign: 'center'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          border: '2.5px solid #111111',
          boxShadow: '3px 3px 0px #111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f1f5f9',
          animation: 'spin 4s linear infinite'
        }}>
          <Globe size={32} style={{ color: '#2563eb' }} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#111111', textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
            Loading Web Watchlist...
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, marginTop: '0.4rem', margin: 0 }}>
            Checking crawler server connection & fetching active monitors
          </p>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  return (
    <div style={{
      padding: '1.5rem',
      maxWidth: '1400px',
      margin: '0 auto',
      fontFamily: 'var(--font-family-body)',
      color: 'var(--text-primary)'
    }}>
      {/* Page Header — matches Asset Manager style */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1.5rem',
        borderBottom: '2px solid var(--border-color)',
        paddingBottom: '1rem',
        gap: '16px'
      }}>
        {/* Left: title + subtitle */}
        <div>
          <h1 style={{
            fontFamily: 'var(--font-family-title)',
            fontSize: '2.2rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            margin: 0,
            color: '#111111'
          }}>
            Web Watchlist
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.2rem 0 0 0', fontWeight: 600, fontSize: '0.9rem' }}>
            Monitor websites for content changes and receive alerts
          </p>
        </div>

        {/* Right: search + unread badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#ffffff', padding: '6px 12px',
            border: '2px solid var(--border-color)',
            boxShadow: 'var(--shadow-flat-sm)',
            width: '260px'
          }}>
            <Search size={14} style={{ color: '#64748b' }} />
            <input
              type="text"
              style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '13px', color: '#111111', fontWeight: 600 }}
              placeholder="Search monitors..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Unread badge shortcut */}
          {unreadSitesCount > 0 && (
            <div
              onClick={() => setActiveFilter('unread')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px',
                border: '2px solid var(--danger)',
                backgroundColor: '#fef2f2',
                color: 'var(--danger)',
                fontWeight: 900, fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '2px 2px 0px var(--danger)',
                textTransform: 'uppercase'
              }}
            >
              <Bell size={13} />
              {unreadSitesCount} Unread
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace split */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: '0', border: '2px solid var(--border-color)', boxShadow: 'var(--shadow-flat)' }}>
        
        {/* Filters Sidebar */}
        <div style={{
          width: '180px',
          backgroundColor: 'var(--bg-main)',
          borderRight: '2px solid #111111',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          flexShrink: 0
        }}>
          {/* Add Monitor Button */}
          <button 
            onClick={() => setShowAddForm(true)}
            style={{
              width: '100%',
              backgroundColor: 'var(--success)',
              color: '#ffffff',
              border: '2px solid #111111',
              borderRadius: '0px',
              padding: '8px 12px',
              fontWeight: 900,
              fontSize: '12px',
              fontFamily: 'var(--font-family-title)',
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '2px 2px 0px #111111',
              transition: 'all 0.1s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translate(-1px, -1px)';
              e.currentTarget.style.boxShadow = '3px 3px 0px #111';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '2px 2px 0px #111';
            }}
          >
            <Plus size={14} /> Add Monitor
          </button>

          {/* Filter Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {renderFilterItem('all', 'All', sites.length, '#111111')}
            {renderFilterItem('history', 'Feed', notifications.length, '#64748b')}
            {renderFilterItem('unread', 'Unread', unreadSitesCount, '#111111')}
            {renderFilterItem('error', 'Error', errorSitesCount, 'var(--danger)')}
            {renderFilterItem('trash', 'Trash', 0, '#94a3b8')}
          </div>
        </div>

        {/* Main Workspace content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: '#ffffff' }}>

          {/* VIEW: WATCHLIST TABLE */}
          {activeFilter !== 'history' && (
            <>
              {/* Compact Table Toolbar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 12px',
                height: '36px',
                backgroundColor: 'var(--bg-main)',
                borderBottom: '2px solid #111111',
                flexShrink: 0
              }}>
                {/* Left: select all checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    onClick={handleSelectAll}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#111111' }}
                  >
                    {selectedSiteIds.length > 0 && selectedSiteIds.length === filteredSites.length
                      ? <CheckSquare size={14} />
                      : <Square size={14} />
                    }
                  </div>
                  {selectedSiteIds.length > 0 && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#111111' }}>
                      {selectedSiteIds.length} selected
                    </span>
                  )}
                </div>

                {/* Right controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: '#111111', fontWeight: 800 }}>
                  <button
                    onClick={handleTriggerCheckAll}
                    disabled={checkingAll}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '3px 10px',
                      backgroundColor: '#ffffff',
                      border: '1.5px solid #111111',
                      boxShadow: '1.5px 1.5px 0px #111',
                      fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                      textTransform: 'uppercase', transition: 'all 0.1s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-0.5px,-0.5px)'; e.currentTarget.style.boxShadow = '2px 2px 0px #111'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '1.5px 1.5px 0px #111'; }}
                  >
                    <RefreshCw size={10} className={checkingAll ? 'spin' : ''} />
                    {checkingAll ? 'Scanning…' : 'Scan All'}
                  </button>
                  <div style={{ width: '1.5px', height: '14px', backgroundColor: '#111111' }} />
                  <span style={{ letterSpacing: '0.04em', fontSize: '11px' }}>
                    1 – {filteredSites.length} of {filteredSites.length}
                  </span>
                </div>
              </div>

              {/* Column Header Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '24px 18px 20px 1fr 70px 110px 28px 52px',
                alignItems: 'center',
                padding: '0 12px',
                height: '28px',
                gap: '8px',
                backgroundColor: '#f8fafc',
                borderBottom: '1.5px solid #111111',
                flexShrink: 0
              }}>
                <div />
                <div />
                <div />
                <div style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>Monitor</div>
                <div style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>Interval</div>
                <div style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>Last Check</div>
                <div />
                <div />
              </div>

              {/* Table Body */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredSites.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center', color: '#111111' }}>
                    <Info size={32} style={{ margin: '0 auto 8px auto', color: '#111111' }} />
                    <div style={{ fontWeight: 900, fontSize: '14px', color: '#111111', textTransform: 'uppercase' }}>No Monitors Found</div>
                    <p style={{ fontSize: '12px', margin: '6px 0 0 0', fontWeight: 600, color: '#64748b' }}>
                      {searchQuery ? 'No websites match your search.' : 'Click "+ Add Monitor" to start tracking a website.'}
                    </p>
                  </div>
                ) : (
                  filteredSites.map(site => {
                    const siteAlerts = notifications.filter(n => n.websiteId === site.id);
                    const hasAlert = siteAlerts.length > 0;
                    const isEnabled = site.enabled !== false;
                    const isExpanded = expandedSiteId === site.id;
                    const isSelected = selectedSiteIds.includes(site.id);
                    const isChecking = checkingSiteId === site.id;

                    return (
                      <div
                        key={site.id}
                        style={{
                          borderBottom: '1.5px solid #e2e8f0',
                          backgroundColor: hasAlert ? '#f0fdf4' : 'transparent',
                        }}
                      >
                        {/* ── COMPACT ROW ── */}
                        <div
                          onClick={() => setExpandedSiteId(isExpanded ? null : site.id)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '24px 18px 20px 1fr 70px 110px 28px 52px',
                            alignItems: 'center',
                            padding: '0 12px',
                            height: '38px',
                            gap: '8px',
                            cursor: 'pointer',
                            transition: 'background 0.1s',
                            borderLeft: hasAlert ? '3px solid var(--success)' : '3px solid transparent'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = hasAlert ? '#dcfce7' : '#f1f5f9'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = hasAlert ? '#f0fdf4' : 'transparent'}
                        >
                          {/* Checkbox */}
                          <div
                            onClick={e => { e.stopPropagation(); handleSelectRow(site.id); }}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b' }}
                          >
                            {isSelected ? <CheckSquare size={14} style={{ color: '#111111' }} /> : <Square size={14} />}
                          </div>

                          {/* Expand caret */}
                          <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </div>

                          {/* Favicon */}
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <img
                              src={getFaviconUrl(site.url)}
                              alt=""
                              style={{ width: '16px', height: '16px', border: '1px solid #e2e8f0', flexShrink: 0 }}
                              onError={e => { e.currentTarget.src = 'https://www.google.com/s2/favicons?sz=64&domain=google.com'; }}
                            />
                          </div>

                          {/* Name + Content Preview (inline) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                            <a
                              href={site.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{
                                fontWeight: 800,
                                fontSize: '13px',
                                color: '#2563eb',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                maxWidth: '170px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                              title={site.url}
                            >
                              {site.name}
                            </a>
                            {site.latestContentText && (
                              <span style={{
                                fontSize: '12px',
                                color: '#64748b',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flexShrink: 1
                              }}>
                                — {site.latestContentText.replace(/\s+/g, ' ').substring(0, 140)}
                              </span>
                            )}
                          </div>

                          {/* Interval badge */}
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#2563eb',
                              backgroundColor: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              padding: '2px 7px',
                              whiteSpace: 'nowrap'
                            }}>
                              30 mins
                            </span>
                          </div>

                          {/* Last Checked */}
                          <div style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: hasAlert ? 'var(--danger)' : '#64748b',
                            whiteSpace: 'nowrap'
                          }}>
                            {formatTimeAgo(site.lastCheckedAt)}
                          </div>

                          {/* Cloud icon */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                            <Cloud size={14} />
                          </div>

                          {/* ON/OFF Toggle */}
                          <div
                            onClick={e => { e.stopPropagation(); handleToggleSite(site.id, isEnabled); }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
                          >
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 7px',
                              fontSize: '10px',
                              fontWeight: 900,
                              backgroundColor: isEnabled ? 'var(--success)' : '#f1f5f9',
                              color: isEnabled ? '#ffffff' : '#94a3b8',
                              border: '1.5px solid #111111',
                              boxShadow: '1.5px 1.5px 0px #111',
                              cursor: 'pointer',
                              letterSpacing: '0.04em',
                              transition: 'all 0.1s',
                              minWidth: '34px',
                              textAlign: 'center'
                            }}>
                              {isEnabled ? 'ON' : 'OFF'}
                            </span>
                          </div>
                        </div>

                        {/* ── EXPANDED DRAWER ── */}
                        {isExpanded && (
                          <div style={{
                            padding: '14px 16px 16px 60px',
                            backgroundColor: '#f8fafc',
                            borderTop: '1.5px solid #111111',
                            display: 'flex',
                            flexDirection: 'row',
                            gap: '20px'
                          }}>
                            {/* Preview box */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#111111', letterSpacing: '0.04em' }}>
                                  Latest Content
                                </span>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  {site.scrapedVia && (
                                    <span style={{
                                      fontSize: '9px', fontWeight: 800,
                                      padding: '2px 6px',
                                      border: '1.5px solid #111',
                                      backgroundColor: '#e0f2fe',
                                      color: '#0369a1',
                                      boxShadow: '1px 1px 0px #111'
                                    }}>
                                      ⚡ via {site.scrapedVia}
                                    </span>
                                  )}
                                  {site.selector && (
                                    <span style={{
                                      fontSize: '9px', fontWeight: 800,
                                      padding: '2px 6px',
                                      border: '1.5px solid #111',
                                      backgroundColor: '#fef9c3',
                                      color: '#854d0e',
                                      fontFamily: 'monospace',
                                      boxShadow: '1px 1px 0px #111'
                                    }}>
                                      CSS: {site.selector}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                padding: '12px',
                                border: '2px solid #111111',
                                backgroundColor: '#ffffff',
                                color: '#111111',
                                maxHeight: '160px',
                                overflowY: 'auto',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                fontWeight: 500
                              }}>
                                {site.latestContentText ? (
                                  <>
                                    {hasAlert && (
                                      <div style={{ color: '#166534', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        🟢 UNREAD CHANGE DETECTED:
                                      </div>
                                    )}
                                    {site.latestContentText}
                                  </>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                    No content fetched yet. Click "Scan" to initialise.
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right sidebar: profile + actions */}
                            <div style={{
                              width: '240px',
                              borderLeft: '2px solid #111111',
                              paddingLeft: '16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              fontSize: '11px',
                              flexShrink: 0
                            }}>
                              <h5 style={{ margin: '0 0 4px 0', fontWeight: 900, textTransform: 'uppercase', color: '#111111', fontFamily: 'var(--font-family-title)', fontSize: '11px' }}>
                                Scraper Profile
                              </h5>

                              {[
                                ['Status', isEnabled ? 'ACTIVE' : 'PAUSED', isEnabled ? 'var(--success)' : 'var(--danger)'],
                                ['Interval', '30 Minutes', null],
                                ['Added', site.createdAt ? new Date(site.createdAt).toLocaleDateString() : '—', null],
                                ['Hash', site.lastContentHash ? site.lastContentHash.substring(0, 12) + '…' : 'None', null],
                              ].map(([label, value, color]) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #d1d5db', paddingBottom: '3px' }}>
                                  <span style={{ color: '#64748b', fontWeight: 700 }}>{label}:</span>
                                  <strong style={{ color: color || '#111111', fontWeight: 800, fontFamily: color ? undefined : 'monospace', fontSize: '10px' }}>{value}</strong>
                                </div>
                              ))}

                              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                <button
                                  onClick={e => { e.stopPropagation(); handleCheckSingleSite(site.id, site.name); }}
                                  disabled={isChecking}
                                  style={{
                                    flex: 1, padding: '5px 4px',
                                    fontSize: '10px', backgroundColor: '#ffffff',
                                    border: '1.5px solid #111111',
                                    boxShadow: '1.5px 1.5px 0px #111',
                                    cursor: 'pointer', fontWeight: 900,
                                    textTransform: 'uppercase',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
                                    transition: 'all 0.1s'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-0.5px,-0.5px)'; e.currentTarget.style.boxShadow = '2px 2px 0px #111'; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '1.5px 1.5px 0px #111'; }}
                                >
                                  <RefreshCw size={9} className={isChecking ? 'spin' : ''} /> Scan
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); handleSimulateChange(site.id, site.name); }}
                                  style={{
                                    flex: 1, padding: '5px 4px',
                                    fontSize: '10px', backgroundColor: '#ffffff',
                                    border: '1.5px solid #111111',
                                    boxShadow: '1.5px 1.5px 0px #111',
                                    cursor: 'pointer', fontWeight: 900,
                                    textTransform: 'uppercase',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
                                    transition: 'all 0.1s'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-0.5px,-0.5px)'; e.currentTarget.style.boxShadow = '2px 2px 0px #111'; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '1.5px 1.5px 0px #111'; }}
                                >
                                  <Sparkles size={9} /> Test
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteSite(site.id, site.name); }}
                                  style={{
                                    padding: '5px 8px',
                                    fontSize: '10px', backgroundColor: '#ffffff',
                                    color: 'var(--danger)',
                                    border: '1.5px solid #111111',
                                    boxShadow: '1.5px 1.5px 0px #111',
                                    cursor: 'pointer', fontWeight: 900,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.1s'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-0.5px,-0.5px)'; e.currentTarget.style.boxShadow = '2px 2px 0px #111'; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '1.5px 1.5px 0px #111'; }}
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>

                              {hasAlert && (
                                <button
                                  onClick={async e => { e.stopPropagation(); await handleClearSiteAlerts(site.id); }}
                                  style={{
                                    width: '100%', padding: '5px',
                                    fontSize: '10px', backgroundColor: '#ffffff',
                                    border: '1.5px solid #111111',
                                    boxShadow: '1.5px 1.5px 0px #111',
                                    color: '#111111', fontWeight: 900,
                                    textTransform: 'uppercase',
                                    cursor: 'pointer', marginTop: '2px',
                                    transition: 'all 0.1s',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-1px,-1px)'; e.currentTarget.style.boxShadow = '2.5px 2.5px 0px #111'; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '1.5px 1.5px 0px #111'; }}
                                >
                                  <Check size={9} /> Mark as Read
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* VIEW: HISTORICAL CHANGE LOG FEED */}
          {activeFilter === 'history' && (
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 900, color: '#111111', fontFamily: 'var(--font-family-title)', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                  📜 Change Log Feed
                </h3>
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearNotifications}
                    style={{
                      padding: '4px 10px', backgroundColor: '#ffffff',
                      border: '1.5px solid #111111', boxShadow: '1.5px 1.5px 0px #111',
                      color: 'var(--danger)', fontWeight: 900, fontSize: '10px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      textTransform: 'uppercase', transition: 'all 0.1s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-1px,-1px)'; e.currentTarget.style.boxShadow = '2.5px 2.5px 0px #111'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '1.5px 1.5px 0px #111'; }}
                  >
                    <Trash size={10} /> Clear Logs
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '48px 20px', color: '#111111',
                  backgroundColor: 'var(--bg-main)', border: '2px dashed #111111'
                }}>
                  <Info size={28} style={{ marginBottom: '8px' }} />
                  <div style={{ fontWeight: 900, fontSize: '13px', textTransform: 'uppercase' }}>No Changes Logged</div>
                  <p style={{ fontSize: '11px', margin: '4px 0 0 0', fontWeight: 600, color: '#64748b' }}>
                    When a change is detected it will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {notifications.map(notif => (
                    <div
                      key={notif.id}
                      style={{
                        border: '2px solid #111111',
                        padding: '12px 14px',
                        backgroundColor: '#ffffff',
                        boxShadow: '2.5px 2.5px 0px #111111'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          <h4 style={{ fontSize: '12px', fontWeight: 900, color: '#111111', margin: 0 }}>{notif.title}</h4>
                          <a
                            href={notif.url} target="_blank" rel="noreferrer"
                            style={{ fontSize: '10px', color: '#2563eb', textDecoration: 'underline', fontWeight: 700 }}
                          >
                            {notif.url}
                          </a>
                        </div>
                        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{
                        fontSize: '11px', color: '#111111',
                        backgroundColor: 'var(--bg-main)',
                        padding: '8px 10px',
                        border: '1.5px solid #111111',
                        margin: 0, fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap', fontWeight: 600
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

      {/* Add Monitor Form Overlay Modal */}
      {showAddForm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(17, 17, 17, 0.35)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }} onClick={() => {
          setShowAddForm(false);
          setFormError('');
          setFormSuccess('');
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            border: '3px solid #111111',
            boxShadow: '8px 8px 0px #111111',
            width: '100%',
            maxWidth: '500px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #111111', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#111111', fontFamily: 'var(--font-family-title)', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                Add Website Monitor
              </h3>
              <button 
                onClick={() => {
                  setShowAddForm(false);
                  setFormError('');
                  setFormSuccess('');
                }}
                style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#111111', fontWeight: 900 }}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleAddWebsite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.05em' }}>MONITOR NAME</label>
                <input 
                  type="text" 
                  style={{ padding: '8px 12px', border: '2px solid #111111', outline: 'none', fontSize: '13px', fontWeight: 700 }}
                  placeholder="e.g. Sairam NCC Portal"
                  value={siteName}
                  onChange={e => setSiteName(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.05em' }}>WEBSITE URL</label>
                <input 
                  type="text" 
                  style={{ padding: '8px 12px', border: '2px solid #111111', outline: 'none', fontSize: '13px', fontWeight: 700 }}
                  placeholder="e.g. sairamncc.in"
                  value={siteUrl}
                  onChange={e => setSiteUrl(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CSS SELECTOR (OPTIONAL)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    style={{ flex: 1, padding: '8px 12px', border: '2px solid #111111', outline: 'none', fontSize: '13px', fontWeight: 700 }}
                    placeholder="e.g. .announcement-card"
                    value={siteSelector}
                    onChange={e => setSiteSelector(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleOpenVisualSelector}
                    disabled={!siteUrl}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: siteUrl ? '#ffffff' : '#f1f5f9',
                      color: siteUrl ? '#111111' : '#94a3b8',
                      border: '2px solid #111111',
                      boxShadow: siteUrl ? '2px 2px 0px #111' : 'none',
                      cursor: siteUrl ? 'pointer' : 'not-allowed',
                      fontWeight: 800,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      transition: 'all 0.1s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onMouseEnter={e => {
                      if (siteUrl) {
                        e.currentTarget.style.transform = 'translate(-1px, -1px)';
                        e.currentTarget.style.boxShadow = '3px 3px 0px #111';
                      }
                    }}
                    onMouseLeave={e => {
                      if (siteUrl) {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = '2px 2px 0px #111';
                      }
                    }}
                  >
                    <Sliders size={12} /> Select Visually
                  </button>
                </div>
              </div>
              
              <p style={{ margin: 0, fontSize: '11px', color: '#111111', lineHeight: 1.4, fontWeight: 600 }}>
                💡 Leave CSS selector blank to monitor the full page. Use selector (e.g. <code>.announcement-card</code>) to track changes in a specific element.
              </p>
              
              {formError && <div style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 800 }}>{formError}</div>}
              {formSuccess && <div style={{ color: 'var(--success)', fontSize: '12px', fontWeight: 800 }}>{formSuccess}</div>}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError('');
                    setFormSuccess('');
                  }}
                  style={{ 
                    padding: '8px 16px', 
                    border: '2px solid #111111', 
                    background: '#ffffff', 
                    boxShadow: '2px 2px 0px #111', 
                    cursor: 'pointer', 
                    fontSize: '12px', 
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    transition: 'all 0.1s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translate(-1px, -1px)';
                    e.currentTarget.style.boxShadow = '3px 3px 0px #111';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '2px 2px 0px #111';
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ 
                    padding: '8px 16px', 
                    border: '2px solid #111111', 
                    background: 'var(--success)', 
                    color: '#ffffff',
                    boxShadow: '2px 2px 0px #111', 
                    cursor: 'pointer', 
                    fontSize: '12px', 
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    transition: 'all 0.1s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translate(-1px, -1px)';
                    e.currentTarget.style.boxShadow = '3px 3px 0px #111';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '2px 2px 0px #111';
                  }}
                >
                  Start Monitoring
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom iOS/Neobrutalist Alert & Confirm Modal Dialog */}
      {dialog && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(17, 17, 17, 0.4)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            border: '3px solid #111111',
            boxShadow: '6px 6px 0px #111111',
            width: '100%',
            maxWidth: '380px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            textAlign: 'center'
          }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {dialog.title}
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#111111', fontWeight: 600, lineHeight: 1.4 }}>
              {dialog.message}
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '4px' }}>
              {dialog.type === 'confirm' ? (
                <>
                  <button 
                    onClick={() => setDialog(null)}
                    style={{ 
                      flex: 1,
                      padding: '8px 16px', 
                      border: '2px solid #111111', 
                      background: '#ffffff', 
                      boxShadow: '2px 2px 0px #111', 
                      cursor: 'pointer', 
                      fontSize: '12px', 
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      transition: 'all 0.1s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translate(-1px, -1px)';
                      e.currentTarget.style.boxShadow = '3px 3px 0px #111';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '2px 2px 0px #111';
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      dialog.onConfirm();
                      setDialog(null);
                    }}
                    style={{ 
                      flex: 1,
                      padding: '8px 16px', 
                      border: '2px solid #111111', 
                      background: '#111111', 
                      color: '#ffffff',
                      boxShadow: '2px 2px 0px #111', 
                      cursor: 'pointer', 
                      fontSize: '12px', 
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      transition: 'all 0.1s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translate(-1px, -1px)';
                      e.currentTarget.style.boxShadow = '3px 3px 0px #111';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '2px 2px 0px #111';
                    }}
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setDialog(null)}
                  style={{ 
                    width: '100%',
                    padding: '8px 16px', 
                    border: '2px solid #111111', 
                    background: '#111111', 
                    color: '#ffffff',
                    boxShadow: '2px 2px 0px #111', 
                    cursor: 'pointer', 
                    fontSize: '12px', 
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    transition: 'all 0.1s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translate(-1px, -1px)';
                    e.currentTarget.style.boxShadow = '3px 3px 0px #111';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '2px 2px 0px #111';
                  }}
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Visual Element Selector Modal */}
      {showVisualSelector && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(17, 17, 17, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10000,
          fontFamily: 'var(--font-family-body)'
        }}>
          {/* Top control bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            borderBottom: '2.5px solid #111111',
            padding: '10px 20px',
            gap: '16px',
            flexShrink: 0
          }}>
            {/* Left: title + URL badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={16} style={{ color: '#111111' }} />
                <span style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'var(--font-family-title)', textTransform: 'uppercase', letterSpacing: '-0.01em', color: '#111111', whiteSpace: 'nowrap' }}>
                  Select Elements
                </span>
              </div>
              <div style={{ height: '16px', width: '2px', backgroundColor: '#111111', flexShrink: 0 }} />
              <span style={{
                fontSize: '11px', fontWeight: 700, color: '#2563eb',
                backgroundColor: '#eff6ff', padding: '3px 10px',
                border: '1.5px solid #2563eb', boxShadow: '1px 1px 0px #2563eb',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px'
              }}>
                {siteUrl}
              </span>
            </div>

            {/* Center: mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#111111', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Mode:</span>
              <div style={{ display: 'flex', border: '2px solid #111111', boxShadow: '2px 2px 0px #111' }}>
                <button
                  type="button"
                  onClick={() => setSelectMode(true)}
                  style={{
                    padding: '5px 14px',
                    backgroundColor: selectMode ? '#111111' : '#ffffff',
                    color: selectMode ? '#ffffff' : '#111111',
                    border: 'none',
                    fontWeight: 800, fontSize: '11px', textTransform: 'uppercase',
                    cursor: 'pointer', fontFamily: 'var(--font-family-body)', transition: 'all 0.1s'
                  }}
                >
                  ✦ Select
                </button>
                <button
                  type="button"
                  onClick={() => setSelectMode(false)}
                  style={{
                    padding: '5px 14px',
                    backgroundColor: !selectMode ? '#111111' : '#ffffff',
                    color: !selectMode ? '#ffffff' : '#111111',
                    borderLeft: '2px solid #111111',
                    fontWeight: 800, fontSize: '11px', textTransform: 'uppercase',
                    cursor: 'pointer', fontFamily: 'var(--font-family-body)', transition: 'all 0.1s'
                  }}
                >
                  Browse
                </button>
              </div>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, maxWidth: '200px' }}>
                {selectMode ? '↖ Hover & click to select element' : '↖ Click to navigate, then switch back to Select'}
              </span>
            </div>

            {/* Right: Close */}
            <button
              type="button"
              onClick={() => setShowVisualSelector(false)}
              style={{
                padding: '5px 14px', border: '2px solid #111111', background: '#ffffff',
                color: '#111111', fontWeight: 900, fontSize: '12px', textTransform: 'uppercase',
                cursor: 'pointer', boxShadow: '2px 2px 0px #111', transition: 'all 0.1s',
                display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-1px,-1px)'; e.currentTarget.style.boxShadow = '3px 3px 0px #111'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0px #111'; }}
            >
              ✕ Close
            </button>
          </div>

          {/* Main body: iframe (left) + sidebar (right) */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* iframe area */}
            <div style={{ flex: 1, position: 'relative', backgroundColor: '#f1f5f9', minWidth: 0 }}>
              <iframe
                ref={iframeRef}
                src={`${API_BASE}/api/admin/web-notifications/proxy?url=${encodeURIComponent(siteUrl)}&token=${encodeURIComponent(token)}`}
                onLoad={handleIframeLoad}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                title="Visual Selector Website Proxy"
              />
            </div>

            {/* Right sidebar */}
            <div style={{
              width: '280px',
              backgroundColor: '#ffffff',
              borderLeft: '2.5px solid #111111',
              display: 'flex',
              flexDirection: 'column',
              gap: '0',
              flexShrink: 0
            }}>
              {/* Sidebar header */}
              <div style={{
                padding: '14px 16px',
                borderBottom: '2px solid #111111',
                backgroundColor: 'var(--bg-main)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 900, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family-title)' }}>
                  Selector Result
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                  Click an element in the preview to capture it
                </div>
              </div>

              {/* CSS Selector field */}
              <div style={{ padding: '14px 16px', borderBottom: '2px solid #111111', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: 900, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  CSS Selector
                </label>
                <input
                  type="text"
                  value={tempSelector}
                  onChange={e => setTempSelector(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    border: '2px solid #111111',
                    outline: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    backgroundColor: tempSelector ? '#f0fdf4' : '#ffffff',
                    boxShadow: tempSelector ? '2px 2px 0px #16a34a' : 'none',
                    transition: 'all 0.1s'
                  }}
                  placeholder="Click element to auto-fill..."
                />
                {tempSelector && (
                  <div style={{
                    fontSize: '10px', color: '#16a34a', fontWeight: 800,
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    <Check size={10} /> Selector captured
                  </div>
                )}
              </div>

              {/* Text preview */}
              <div style={{ padding: '14px 16px', borderBottom: '2px solid #111111', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minHeight: 0 }}>
                <label style={{ fontSize: '10px', fontWeight: 900, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Content Preview
                </label>
                <div style={{
                  border: '2px solid #111111',
                  backgroundColor: 'var(--bg-main)',
                  padding: '10px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  color: tempSelectorText ? '#111111' : '#94a3b8',
                  fontWeight: 500,
                  lineHeight: 1.5,
                  flex: 1,
                  maxHeight: '220px'
                }}>
                  {tempSelectorText || 'No element selected yet.\n\nSwitch to Select mode, then click any element on the website preview.'}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleConfirmVisualSelector}
                  disabled={!tempSelector}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '2px solid #111111',
                    background: tempSelector ? 'var(--success)' : '#f1f5f9',
                    color: tempSelector ? '#ffffff' : '#94a3b8',
                    boxShadow: tempSelector ? '3px 3px 0px #111' : 'none',
                    cursor: tempSelector ? 'pointer' : 'not-allowed',
                    fontSize: '12px', fontWeight: 900,
                    textTransform: 'uppercase',
                    transition: 'all 0.1s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                  onMouseEnter={e => { if (tempSelector) { e.currentTarget.style.transform = 'translate(-1px,-1px)'; e.currentTarget.style.boxShadow = '4px 4px 0px #111'; } }}
                  onMouseLeave={e => { if (tempSelector) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '3px 3px 0px #111'; } }}
                >
                  <Check size={13} /> Use This Selector
                </button>
                <button
                  type="button"
                  onClick={() => setShowVisualSelector(false)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '2px solid #111111',
                    background: '#ffffff',
                    color: '#111111',
                    boxShadow: '2px 2px 0px #111',
                    cursor: 'pointer',
                    fontSize: '11px', fontWeight: 800,
                    textTransform: 'uppercase',
                    transition: 'all 0.1s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-1px,-1px)'; e.currentTarget.style.boxShadow = '3px 3px 0px #111'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0px #111'; }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



    </div>

  );
}

export default WebNotifications;
