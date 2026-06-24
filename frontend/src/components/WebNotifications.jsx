import React, { useState, useEffect } from 'react';
import { 
  Globe, Bell, Plus, Trash2, RefreshCw, ExternalLink, 
  AlertCircle, Info, Check, Sparkles, Search, Sliders, ToggleLeft, ToggleRight, Trash,
  ChevronRight, ChevronDown, Settings, Play, Cloud, Laptop, HelpCircle, Tag, CheckSquare, Square,
  List, BarChart2, Users, BookOpen, MessageSquare, Languages, ChevronLeft, Mail, Moon, Sun, Copy, Pause
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
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'error' | 'paused'
  
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
  const [copiedId, setCopiedId] = useState(null);

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
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
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

  // Copy CSS Selector to Clipboard Helper
  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Stats calculation
  const totalMonitors = sites.length;
  const activeMonitorsCount = sites.filter(site => site.enabled !== false).length;
  const sitesWithAlertsCount = sites.filter(site => notifications.some(n => n.websiteId === site.id)).length;
  const errorSitesCount = sites.filter(site => site.latestContentText && (site.latestContentText.startsWith('Error:') || site.latestContentText.includes('Failed') || site.latestContentText.startsWith('[ERROR]'))).length;

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
      const isError = site.latestContentText && (site.latestContentText.startsWith('Error:') || site.latestContentText.includes('Failed') || site.latestContentText.startsWith('[ERROR]'));
      return matchesSearch && isError;
    }
    if (activeFilter === 'paused') {
      return matchesSearch && site.enabled === false;
    }
    
    return matchesSearch;
  });

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

  // Styled visual diff generator
  const renderVisualDiff = (notif) => {
    const desc = notif.description || '';
    let parsedNew = '';
    let parsedOld = 'Cached Page Snapshot (Original State)';
    
    if (desc.includes('[SIMULATED CHANGE]')) {
      const parts = desc.split('Detail:');
      parsedNew = parts[1] ? parts[1].trim() : desc;
      parsedOld = "Previous cached layout snapshot";
    } else if (desc.includes('Preview: "')) {
      const match = desc.match(/Preview:\s*"([^"]+)"/);
      parsedNew = match ? match[1] : desc;
      parsedOld = "Previous body text checksum block";
    } else if (desc.includes('Content: "')) {
      const match = desc.match(/Content:\s*"([^"]+)"/);
      parsedNew = match ? match[1] : desc;
      parsedOld = "Previous matching selector string content";
    } else {
      parsedNew = desc;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {/* Old Box */}
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#dc2626',
            textDecoration: 'line-through',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '4px',
              fontSize: '8px',
              fontWeight: 900,
              backgroundColor: '#fee2e2',
              padding: '1px 3px',
              borderRadius: '3px',
              textTransform: 'uppercase',
              color: '#dc2626'
            }}>OLD</span>
            {parsedOld}
          </div>
          {/* New Box */}
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#166534',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '4px',
              fontSize: '8px',
              fontWeight: 900,
              backgroundColor: '#dcfce7',
              padding: '1px 3px',
              borderRadius: '3px',
              textTransform: 'uppercase',
              color: '#166534'
            }}>NEW</span>
            {parsedNew}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6rem 2rem',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        gap: '1.5rem',
        textAlign: 'center',
        backgroundColor: '#f8fafc',
        minHeight: '80vh'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '16px',
          border: '3px solid #0f172a',
          boxShadow: '4px 4px 0px #0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#eff6ff',
          animation: 'bounceSpin 2.5s infinite ease-in-out'
        }}>
          <Globe size={36} style={{ color: '#4f46e5' }} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
            Syncing Crawler Services
          </h3>
          <p style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600, marginTop: '0.5rem', margin: 0 }}>
            Checking proxy networks and fetching active web monitors...
          </p>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes bounceSpin {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(180deg); }
          }
        `}} />
      </div>
    );
  }

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '1440px',
      margin: '0 auto',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      color: '#0f172a',
      backgroundColor: '#f8fafc',
      minHeight: '100vh'
    }}>
      {/* CSS Animations Injector */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulseDot {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spinSlow 1s linear infinite;
        }
        .pulse-active {
          animation: pulseDot 2s infinite ease-in-out;
        }
        .hover-card {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hover-card:hover {
          transform: translateY(-4px);
          box-shadow: 6px 6px 0px #0f172a !important;
          border-color: #4f46e5 !important;
        }
        .hover-btn {
          transition: all 0.15s ease;
        }
        .hover-btn:hover {
          transform: translate(-1px, -1px);
          box-shadow: 3px 3px 0px #0f172a !important;
        }
        .hover-btn:active {
          transform: translate(1px, 1px);
          box-shadow: 1px 1px 0px #0f172a !important;
        }
      `}} />

      {/* Top Banner / Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        borderBottom: '2.5px solid #0f172a',
        paddingBottom: '1.2rem',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              padding: '6px',
              borderRadius: '8px',
              border: '2px solid #0f172a',
              boxShadow: '2px 2px 0px #0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Globe size={24} />
            </span>
            <h1 style={{
              fontSize: '2.2rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '-0.03em',
              margin: 0,
              color: '#0f172a'
            }}>
              Web Watchlist
            </h1>
          </div>
          <p style={{ color: '#475569', margin: '0.4rem 0 0 0', fontWeight: 600, fontSize: '0.95rem' }}>
            Configure visual target CSS selectors and monitor site changes in real time.
          </p>
        </div>

        {/* Global Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleTriggerCheckAll}
            disabled={checkingAll}
            className="hover-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              backgroundColor: '#ffffff',
              border: '2.5px solid #0f172a',
              borderRadius: '10px',
              boxShadow: '2.5px 2.5px 0px #0f172a',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              textTransform: 'uppercase'
            }}
          >
            <RefreshCw size={14} className={checkingAll ? 'spin' : ''} />
            {checkingAll ? 'Scanning All...' : 'Scan All Pages'}
          </button>

          <button
            onClick={() => setShowAddForm(true)}
            className="hover-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: '2.5px solid #0f172a',
              borderRadius: '10px',
              boxShadow: '2.5px 2.5px 0px #0f172a',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              textTransform: 'uppercase'
            }}
          >
            <Plus size={16} /> Add Monitor
          </button>
        </div>
      </header>

      {/* Top 4 statistics dashboard row */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '20px',
        marginBottom: '2rem'
      }}>
        {/* Card 1: Total Monitors */}
        <div style={{
          backgroundColor: '#eff6ff',
          border: '2.5px solid #0f172a',
          boxShadow: '4px 4px 0px #0f172a',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Web Monitors</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>{totalMonitors}</div>
          </div>
          <span style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', border: '2px solid #0f172a', padding: '10px', borderRadius: '10px' }}>
            <Globe size={24} />
          </span>
        </div>

        {/* Card 2: Active Crawler Instances */}
        <div style={{
          backgroundColor: '#ecfdf5',
          border: '2.5px solid #0f172a',
          boxShadow: '4px 4px 0px #0f172a',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Scrapers</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeMonitorsCount}
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#047857' }}>/ {totalMonitors} enabled</span>
            </div>
          </div>
          <span style={{ backgroundColor: '#d1fae5', color: '#059669', border: '2px solid #0f172a', padding: '10px', borderRadius: '10px' }}>
            <Play size={24} />
          </span>
        </div>

        {/* Card 3: Change Alerts */}
        <div style={{
          backgroundColor: sitesWithAlertsCount > 0 ? '#fff1f2' : '#ffffff',
          border: '2.5px solid #0f172a',
          boxShadow: '4px 4px 0px #0f172a',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.3s'
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#9f1239', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sites with Alerts</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {sitesWithAlertsCount}
              {sitesWithAlertsCount > 0 && (
                <span className="pulse-active" style={{
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#f43f5e',
                  borderRadius: '50%',
                  display: 'inline-block'
                }} />
              )}
            </div>
          </div>
          <span style={{
            backgroundColor: sitesWithAlertsCount > 0 ? '#ffe4e6' : '#f1f5f9',
            color: sitesWithAlertsCount > 0 ? '#e11d48' : '#64748b',
            border: '2px solid #0f172a',
            padding: '10px',
            borderRadius: '10px'
          }}>
            <Bell size={24} />
          </span>
        </div>

        {/* Card 4: Crawler Node Health */}
        <div style={{
          backgroundColor: '#faf5ff',
          border: '2.5px solid #0f172a',
          boxShadow: '4px 4px 0px #0f172a',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Node Engine Status</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pulse-active" style={{
                width: '8px',
                height: '8px',
                backgroundColor: '#10b981',
                borderRadius: '50%'
              }} />
              SYSTEM HEALTHY
            </div>
          </div>
          <span style={{ backgroundColor: '#f3e8ff', color: '#9333ea', border: '2px solid #0f172a', padding: '10px', borderRadius: '10px' }}>
            <Laptop size={24} />
          </span>
        </div>
      </section>

      {/* Main Workspace Split Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 440px',
        gap: '24px',
        alignItems: 'start'
      }}>

        {/* LEFT COLUMN: Monitored Sites Dashboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Controls, Search and Filter Tabs */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '2.5px solid #0f172a',
            boxShadow: '4px 4px 0px #0f172a',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            {/* Filter tab buttons */}
            <div style={{ display: 'flex', border: '2px solid #0f172a', borderRadius: '8px', overflow: 'hidden' }}>
              {[
                { filter: 'all', label: 'All Pages', count: sites.length, color: '#64748b' },
                { filter: 'unread', label: 'Alerts', count: sitesWithAlertsCount, color: '#f43f5e' },
                { filter: 'error', label: 'Errors', count: errorSitesCount, color: '#dc2626' },
                { filter: 'paused', label: 'Paused', count: sites.filter(s => s.enabled === false).length, color: '#b45309' }
              ].map(tab => {
                const isActive = activeFilter === tab.filter;
                return (
                  <button
                    key={tab.filter}
                    onClick={() => {
                      setActiveFilter(tab.filter);
                      setSelectedSiteIds([]);
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: isActive ? '#0f172a' : '#ffffff',
                      color: isActive ? '#ffffff' : '#0f172a',
                      border: 'none',
                      borderRight: '2px solid #0f172a',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      textTransform: 'uppercase',
                      transition: 'all 0.15s'
                    }}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span style={{
                        fontSize: '9px',
                        backgroundColor: isActive ? '#ffffff' : tab.color,
                        color: isActive ? '#0f172a' : '#ffffff',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontWeight: 900
                      }}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search Input bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#f1f5f9',
              border: '2px solid #0f172a',
              borderRadius: '8px',
              padding: '6px 14px',
              width: '100%',
              maxWidth: '300px'
            }}>
              <Search size={14} style={{ color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search monitored pages..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  width: '100%',
                  color: '#0f172a'
                }}
              />
            </div>
          </div>

          {/* List of Sites (Grid Card Layout) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredSites.length === 0 ? (
              <div style={{
                backgroundColor: '#ffffff',
                border: '2.5px solid #0f172a',
                boxShadow: '4px 4px 0px #0f172a',
                borderRadius: '12px',
                padding: '60px 20px',
                textAlign: 'center',
                color: '#0f172a'
              }}>
                <Info size={40} style={{ margin: '0 auto 12px auto', color: '#4f46e5' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.02em', margin: 0 }}>
                  No monitored pages found
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginTop: '6px', margin: 0 }}>
                  {searchQuery ? 'Adjust your search parameters and try again.' : 'Click "Add Monitor" in the top bar to set up your first website tracking.'}
                </p>
              </div>
            ) : (
              filteredSites.map(site => {
                const siteAlerts = notifications.filter(n => n.websiteId === site.id);
                const hasAlert = siteAlerts.length > 0;
                const isEnabled = site.enabled !== false;
                const isChecking = checkingSiteId === site.id;
                const isExpanded = expandedSiteId === site.id;
                
                // Status Color Mapping
                let statusColor = '#10b981'; // Active Green
                let statusText = 'Active & Healthy';
                if (!isEnabled) {
                  statusColor = '#94a3b8'; // Gray Paused
                  statusText = 'Paused';
                } else if (site.latestContentText && (site.latestContentText.startsWith('Error:') || site.latestContentText.includes('Failed') || site.latestContentText.startsWith('[ERROR]'))) {
                  statusColor = '#ef4444'; // Red Error
                  statusText = 'Scrape Failure';
                } else if (hasAlert) {
                  statusColor = '#f59e0b'; // Amber Alert
                  statusText = 'Change Detected';
                }

                return (
                  <div
                    key={site.id}
                    className="hover-card"
                    style={{
                      backgroundColor: '#ffffff',
                      border: '2.5px solid #0f172a',
                      boxShadow: '4px 4px 0px #0f172a',
                      borderRadius: '12px',
                      padding: '20px',
                      position: 'relative',
                      borderLeft: `8px solid ${statusColor}`,
                      transition: 'all 0.25s ease-in-out'
                    }}
                  >
                    {/* Top Row: Favicon, Name, URL, Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <img
                          src={getFaviconUrl(site.url)}
                          alt=""
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: '2px solid #0f172a',
                            flexShrink: 0,
                            backgroundColor: '#f1f5f9'
                          }}
                          onError={e => { e.currentTarget.src = 'https://www.google.com/s2/favicons?sz=64&domain=google.com'; }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                            {site.name}
                            <a
                              href={site.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', color: '#4f46e5' }}
                              title="Visit website"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </h4>
                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, wordBreak: 'break-all' }}>{site.url}</span>
                        </div>
                      </div>

                      {/* Toggles & Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: 900,
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          border: '1.5px solid #0f172a',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}>
                          30m interval
                        </span>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: 900,
                          backgroundColor: `${statusColor}15`,
                          color: statusColor,
                          border: `1.5px solid ${statusColor}`,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}>
                          {statusText}
                        </span>
                      </div>
                    </div>

                    {/* CSS Selector and info bar */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '12px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px 12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Tag size={12} style={{ color: '#4f46e5' }} />
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>Target Area:</span>
                        <code style={{
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          backgroundColor: '#fdf0d5',
                          border: '1px solid #0f172a',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 800,
                          color: '#7f5539'
                        }}>
                          {site.selector || 'Full Document Body'}
                        </code>
                        {site.selector && (
                          <button
                            onClick={() => copyToClipboard(site.selector, site.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#64748b',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '2px'
                            }}
                            title="Copy CSS Selector"
                          >
                            <Copy size={11} />
                          </button>
                        )}
                        {copiedId === site.id && (
                          <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 800, textTransform: 'uppercase' }}>Copied!</span>
                        )}
                      </div>
                      
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                        Last Checked: <strong style={{ color: '#0f172a' }}>{formatTimeAgo(site.lastCheckedAt)}</strong>
                      </div>
                    </div>

                    {/* expandable latest scraped content section */}
                    <div style={{ marginTop: '12px' }}>
                      <button
                        onClick={() => setExpandedSiteId(isExpanded ? null : site.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#4f46e5',
                          fontWeight: 800,
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: 0,
                          textTransform: 'uppercase'
                        }}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {isExpanded ? 'Hide Page Snapshot' : 'Inspect Scraped Snapshot'}
                      </button>

                      {isExpanded && (
                        <div style={{
                          marginTop: '8px',
                          border: '2px solid #0f172a',
                          borderRadius: '8px',
                          backgroundColor: '#0f172a',
                          color: '#f8fafc',
                          padding: '12px',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          maxHeight: '160px',
                          overflowY: 'auto',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          position: 'relative'
                        }}>
                          {hasAlert && (
                            <div style={{
                              color: '#f59e0b',
                              fontWeight: 900,
                              fontSize: '9px',
                              textTransform: 'uppercase',
                              borderBottom: '1px solid #334155',
                              paddingBottom: '4px',
                              marginBottom: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <AlertCircle size={10} /> Unread Change Detected! Mark as read to clear.
                            </div>
                          )}
                          {site.latestContentText || (
                            <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                              No page snapshot cached. Click "Scan" to fetch initial content.
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Action footer bar */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '16px',
                      paddingTop: '12px',
                      borderTop: '1.5px dashed #e2e8f0'
                    }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleCheckSingleSite(site.id, site.name)}
                          disabled={isChecking}
                          className="hover-btn"
                          style={{
                            padding: '6px 12px',
                            fontSize: '11px',
                            backgroundColor: '#ffffff',
                            color: '#0f172a',
                            border: '2px solid #0f172a',
                            borderRadius: '8px',
                            boxShadow: '1.5px 1.5px 0px #0f172a',
                            cursor: 'pointer',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <RefreshCw size={11} className={isChecking ? 'spin' : ''} />
                          {isChecking ? 'Checking...' : 'Scan Now'}
                        </button>

                        <button
                          onClick={() => handleSimulateChange(site.id, site.name)}
                          className="hover-btn"
                          style={{
                            padding: '6px 12px',
                            fontSize: '11px',
                            backgroundColor: '#ffffff',
                            color: '#0f172a',
                            border: '2px solid #0f172a',
                            borderRadius: '8px',
                            boxShadow: '1.5px 1.5px 0px #0f172a',
                            cursor: 'pointer',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Sparkles size={11} /> Test Change
                        </button>

                        {hasAlert && (
                          <button
                            onClick={() => handleClearSiteAlerts(site.id)}
                            className="hover-btn"
                            style={{
                              padding: '6px 12px',
                              fontSize: '11px',
                              backgroundColor: '#ecfdf5',
                              color: '#047857',
                              border: '2px solid #0f172a',
                              borderRadius: '8px',
                              boxShadow: '1.5px 1.5px 0px #0f172a',
                              cursor: 'pointer',
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Check size={12} /> Mark Read
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* ON/OFF Switch */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Active:</span>
                          <button
                            onClick={() => handleToggleSite(site.id, isEnabled)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              color: isEnabled ? '#10b981' : '#cbd5e1'
                            }}
                          >
                            {isEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} style={{ color: '#94a3b8' }} />}
                          </button>
                        </div>

                        {/* Delete Trash */}
                        <button
                          onClick={() => handleDeleteSite(site.id, site.name)}
                          style={{
                            padding: '6px',
                            backgroundColor: 'transparent',
                            color: '#ef4444',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Delete Monitor"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Live Activity Feed (Changes Log) */}
        <aside style={{
          backgroundColor: '#ffffff',
          border: '2.5px solid #0f172a',
          boxShadow: '4px 4px 0px #0f172a',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 250px)',
          minHeight: '520px',
          position: 'sticky',
          top: '24px'
        }}>
          {/* Feed Header */}
          <div style={{
            padding: '16px',
            borderBottom: '2.5px solid #0f172a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#faf5ff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pulse-active" style={{
                width: '8px',
                height: '8px',
                backgroundColor: '#a855f7',
                borderRadius: '50%',
                display: 'inline-block'
              }} />
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Live Change Feed
              </h3>
            </div>
            {notifications.length > 0 && (
              <button
                onClick={handleClearNotifications}
                className="hover-btn"
                style={{
                  padding: '4px 10px',
                  backgroundColor: '#ffffff',
                  color: '#ef4444',
                  border: '1.5px solid #0f172a',
                  borderRadius: '6px',
                  fontSize: '9px',
                  fontWeight: 950,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <Trash size={10} /> Clear logs
              </button>
            )}
          </div>

          {/* Scrollable feed items container */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {notifications.length === 0 ? (
              <div style={{
                margin: 'auto 0',
                textAlign: 'center',
                padding: '24px 12px'
              }}>
                <Info size={28} style={{ margin: '0 auto 8px auto', color: '#64748b' }} />
                <div style={{ fontWeight: 900, fontSize: '12px', textTransform: 'uppercase', color: '#0f172a' }}>
                  No updates captured
                </div>
                <p style={{ fontSize: '10px', margin: '4px 0 0 0', fontWeight: 600, color: '#64748b' }}>
                  System will list all real-time HTML checksum modifications and crawler alerts here.
                </p>
              </div>
            ) : (
              notifications.map(notif => {
                const site = sites.find(s => s.id === notif.websiteId);
                return (
                  <div
                    key={notif.id}
                    style={{
                      border: '2px solid #0f172a',
                      borderRadius: '8px',
                      padding: '12px',
                      backgroundColor: '#ffffff',
                      boxShadow: '2px 2px 0px #0f172a'
                    }}
                  >
                    <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <img
                          src={getFaviconUrl(notif.url)}
                          alt=""
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '3px',
                            border: '1px solid #0f172a',
                            flexShrink: 0
                          }}
                          onError={e => { e.currentTarget.src = 'https://www.google.com/s2/favicons?sz=64&domain=google.com'; }}
                        />
                        <strong style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: '#0f172a'
                        }}>
                          {notif.websiteName || 'Unknown Site'}
                        </strong>
                      </div>
                      <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>

                    {/* Change Notification description */}
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#0f172a',
                      textTransform: 'uppercase',
                      borderBottom: '1.5px solid #0f172a',
                      paddingBottom: '4px',
                      margin: '2px 0 6px 0'
                    }}>
                      ⚡ {notif.title || 'Diff detected'}
                    </div>

                    {/* Diff highlighting boxes */}
                    {renderVisualDiff(notif)}
                  </div>
                );
              })
            )}
          </div>
        </aside>

      </div>

      {/* Add Monitor Form Modal */}
      {showAddForm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }} onClick={() => {
          setShowAddForm(false);
          setFormError('');
          setFormSuccess('');
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            border: '3px solid #0f172a',
            boxShadow: '8px 8px 0px #0f172a',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            animation: 'modalSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2.5px solid #0f172a',
              paddingBottom: '12px'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                Add Website Monitor
              </h3>
              <button 
                onClick={() => {
                  setShowAddForm(false);
                  setFormError('');
                  setFormSuccess('');
                }}
                style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#0f172a', fontWeight: 900 }}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleAddWebsite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monitor Name</label>
                <input 
                  type="text" 
                  style={{
                    padding: '10px 14px',
                    border: '2.5px solid #0f172a',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '13px',
                    fontWeight: 700
                  }}
                  placeholder="e.g. TN Medical Admission Alerts"
                  value={siteName}
                  onChange={e => setSiteName(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Website URL</label>
                <input 
                  type="text" 
                  style={{
                    padding: '10px 14px',
                    border: '2.5px solid #0f172a',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '13px',
                    fontWeight: 700
                  }}
                  placeholder="e.g. tnmedicalselection.net"
                  value={siteUrl}
                  onChange={e => setSiteUrl(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CSS Selector (Optional)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      border: '2.5px solid #0f172a',
                      borderRadius: '8px',
                      outline: 'none',
                      fontSize: '13px',
                      fontWeight: 700
                    }}
                    placeholder="e.g. .announcements"
                    value={siteSelector}
                    onChange={e => setSiteSelector(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleOpenVisualSelector}
                    disabled={!siteUrl}
                    className="hover-btn"
                    style={{
                      padding: '10px 16px',
                      backgroundColor: siteUrl ? '#ffffff' : '#f1f5f9',
                      color: siteUrl ? '#0f172a' : '#94a3b8',
                      border: '2.5px solid #0f172a',
                      borderRadius: '8px',
                      boxShadow: siteUrl ? '2px 2px 0px #0f172a' : 'none',
                      cursor: siteUrl ? 'pointer' : 'not-allowed',
                      fontWeight: 800,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Sliders size={12} /> Select Visually
                  </button>
                </div>
              </div>

              {/* Suggestions quick tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b' }}>Common targets:</span>
                {['#content', 'article', '.announcement-card', 'table', '.news-updates'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSiteSelector(tag)}
                    style={{
                      fontSize: '10px',
                      padding: '3px 8px',
                      border: '1.5px solid #0f172a',
                      borderRadius: '4px',
                      backgroundColor: '#f1f5f9',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: 1.4, fontWeight: 600 }}>
                💡 Leave CSS selector blank to track the full page. Enter specific tags to target elements and reduce false positive change flags.
              </p>
              
              {formError && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 800 }}>{formError}</div>}
              {formSuccess && <div style={{ color: '#10b981', fontSize: '12px', fontWeight: 800 }}>{formSuccess}</div>}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError('');
                    setFormSuccess('');
                  }}
                  className="hover-btn"
                  style={{ 
                    padding: '10px 18px', 
                    border: '2.5px solid #0f172a', 
                    borderRadius: '8px',
                    background: '#ffffff', 
                    boxShadow: '2px 2px 0px #0f172a', 
                    cursor: 'pointer', 
                    fontSize: '12px', 
                    fontWeight: 800,
                    textTransform: 'uppercase'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="hover-btn"
                  style={{ 
                    padding: '10px 18px', 
                    border: '2.5px solid #0f172a', 
                    borderRadius: '8px',
                    background: '#10b981', 
                    color: '#ffffff',
                    boxShadow: '2px 2px 0px #0f172a', 
                    cursor: 'pointer', 
                    fontSize: '12px', 
                    fontWeight: 800,
                    textTransform: 'uppercase'
                  }}
                >
                  Start Monitoring
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom iOS/Neobrutalist Alert & Confirm Dialog Modal */}
      {dialog && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            border: '3px solid #0f172a',
            boxShadow: '6px 6px 0px #0f172a',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '400px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            textAlign: 'center'
          }}>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0f172a' }}>
              {dialog.title}
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#475569', fontWeight: 600, lineHeight: 1.4 }}>
              {dialog.message}
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '4px' }}>
              {dialog.type === 'confirm' ? (
                <>
                  <button 
                    onClick={() => setDialog(null)}
                    className="hover-btn"
                    style={{ 
                      flex: 1,
                      padding: '10px 16px', 
                      border: '2.5px solid #0f172a', 
                      borderRadius: '8px',
                      background: '#ffffff', 
                      boxShadow: '2px 2px 0px #0f172a', 
                      cursor: 'pointer', 
                      fontSize: '12px', 
                      fontWeight: 800,
                      textTransform: 'uppercase'
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      dialog.onConfirm();
                      setDialog(null);
                    }}
                    className="hover-btn"
                    style={{ 
                      flex: 1,
                      padding: '10px 16px', 
                      border: '2.5px solid #0f172a', 
                      borderRadius: '8px',
                      background: '#ef4444', 
                      color: '#ffffff',
                      boxShadow: '2px 2px 0px #0f172a', 
                      cursor: 'pointer', 
                      fontSize: '12px', 
                      fontWeight: 800,
                      textTransform: 'uppercase'
                    }}
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setDialog(null)}
                  className="hover-btn"
                  style={{ 
                    width: '100%',
                    padding: '10px 16px', 
                    border: '2.5px solid #0f172a', 
                    borderRadius: '8px',
                    background: '#0f172a', 
                    color: '#ffffff',
                    boxShadow: '2px 2px 0px #0f172a', 
                    cursor: 'pointer', 
                    fontSize: '12px', 
                    fontWeight: 800,
                    textTransform: 'uppercase'
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
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10000
        }}>
          {/* Top control bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            borderBottom: '3px solid #0f172a',
            padding: '12px 24px',
            gap: '16px',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={18} style={{ color: '#4f46e5' }} />
                <span style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  Target Node Selector
                </span>
              </div>
              <div style={{ height: '18px', width: '2px', backgroundColor: '#e2e8f0', flexShrink: 0 }} />
              <span style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#4f46e5',
                backgroundColor: '#eff6ff',
                padding: '4px 12px',
                borderRadius: '6px',
                border: '1.5px solid #0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '380px'
              }}>
                {siteUrl}
              </span>
            </div>

            {/* Mode switch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Crawler Mode:</span>
              <div style={{ display: 'flex', border: '2.5px solid #0f172a', borderRadius: '8px', overflow: 'hidden', boxShadow: '2px 2px 0px #0f172a' }}>
                <button
                  type="button"
                  onClick={() => setSelectMode(true)}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: selectMode ? '#0f172a' : '#ffffff',
                    color: selectMode ? '#ffffff' : '#0f172a',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.1s'
                  }}
                >
                  🎯 Select Element
                </button>
                <button
                  type="button"
                  onClick={() => setSelectMode(false)}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: !selectMode ? '#0f172a' : '#ffffff',
                    color: !selectMode ? '#ffffff' : '#0f172a',
                    border: 'none',
                    borderLeft: '2px solid #0f172a',
                    fontWeight: 800,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.1s'
                  }}
                >
                  🧭 Browse Link
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowVisualSelector(false)}
              className="hover-btn"
              style={{
                padding: '8px 16px',
                border: '2.5px solid #0f172a',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#ef4444',
                fontWeight: 900,
                fontSize: '12px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: '2px 2px 0px #0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ✕ Exit
            </button>
          </div>

          {/* Main workspace for Visual Selector */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
            {/* iframe proxy area */}
            <div style={{ flex: 1, position: 'relative', minWidth: 0, padding: '16px' }}>
              <div style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#ffffff',
                border: '3px solid #0f172a',
                borderRadius: '12px',
                boxShadow: '4px 4px 0px #0f172a',
                overflow: 'hidden'
              }}>
                <iframe
                  ref={iframeRef}
                  src={`${API_BASE}/api/admin/web-notifications/proxy?url=${encodeURIComponent(siteUrl)}&token=${encodeURIComponent(token)}`}
                  onLoad={handleIframeLoad}
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                  title="Visual Selector Website Proxy"
                />
              </div>
            </div>

            {/* Selector Sidebar */}
            <div style={{
              width: '320px',
              backgroundColor: '#ffffff',
              borderLeft: '3px solid #0f172a',
              display: 'flex',
              flexDirection: 'column',
              gap: '0',
              flexShrink: 0
            }}>
              <div style={{
                padding: '16px',
                borderBottom: '2.5px solid #0f172a',
                backgroundColor: '#faf5ff'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Target Node Output
                </div>
                <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, margin: '4px 0 0 0' }}>
                  Hover and click elements on the page model to calculate paths.
                </p>
              </div>

              {/* Selector input display */}
              <div style={{ padding: '16px', borderBottom: '2px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Calculated CSS path
                </label>
                <input
                  type="text"
                  value={tempSelector}
                  onChange={e => setTempSelector(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '2.5px solid #0f172a',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '12px',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    backgroundColor: tempSelector ? '#f0fdf4' : '#ffffff',
                    color: tempSelector ? '#166534' : '#0f172a',
                    transition: 'all 0.15s'
                  }}
                  placeholder="Click elements to extract paths..."
                />
                {tempSelector && (
                  <div style={{
                    fontSize: '10px',
                    color: '#10b981',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '2px'
                  }}>
                    <Check size={10} /> CSS Selector Matched
                  </div>
                )}
              </div>

              {/* Element Text preview box */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minHeight: 0 }}>
                <label style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Live Node Content Preview
                </label>
                <div style={{
                  border: '2px solid #0f172a',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  padding: '12px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  color: tempSelectorText ? '#0f172a' : '#64748b',
                  fontWeight: 650,
                  lineHeight: 1.5,
                  flex: 1
                }}>
                  {tempSelectorText || 'Click target sections in select mode to preview the underlying text crawler payload.'}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ padding: '16px', borderTop: '2.5px solid #0f172a', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#f8fafc' }}>
                <button
                  type="button"
                  onClick={handleConfirmVisualSelector}
                  disabled={!tempSelector}
                  className="hover-btn"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '2.5px solid #0f172a',
                    background: tempSelector ? '#10b981' : '#cbd5e1',
                    color: tempSelector ? '#ffffff' : '#94a3b8',
                    boxShadow: tempSelector ? '2.5px 2.5px 0px #0f172a' : 'none',
                    cursor: tempSelector ? 'pointer' : 'not-allowed',
                    fontSize: '12px',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Check size={14} /> Lock Selector
                </button>
                <button
                  type="button"
                  onClick={() => setShowVisualSelector(false)}
                  className="hover-btn"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '2.5px solid #0f172a',
                    background: '#ffffff',
                    color: '#0f172a',
                    boxShadow: '2px 2px 0px #0f172a',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Modal Slide In Animation Definition */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes modalSlideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}} />

    </div>
  );
}

export default WebNotifications;
