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
      <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      border: '2.5px solid #111111',
      boxShadow: 'var(--shadow-flat)',
      overflow: 'hidden',
      fontFamily: 'var(--font-family-body)',
      color: 'var(--text-primary)'
    }}>
      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 20px',
        borderBottom: '2.5px solid #111111',
        backgroundColor: '#ffffff'
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'var(--font-family-title)', color: '#111111', letterSpacing: '-0.02em' }}>WATCHLIST</span>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            color: '#111111',
            backgroundColor: '#ffffff',
            padding: '2px 8px',
            border: '2px solid #111111',
            boxShadow: '1.5px 1.5px 0px #111'
          }}>
            CLOUD - CALL LOGIQ SERVERS
          </span>
        </div>

        {/* Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#ffffff',
          padding: '6px 12px',
          border: '2px solid #111111',
          width: '260px',
          marginLeft: '20px',
          marginRight: 'auto'
        }}>
          <Search size={14} style={{ color: '#111111' }} />
          <input 
            type="text"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              fontSize: '13px',
              color: '#111111',
              fontWeight: 700
            }}
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Right Section Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Notifications Envelope */}
          <div 
            onClick={() => setActiveFilter('unread')}
            style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#111111' }}
            title="Unread Alerts"
          >
            <Mail size={18} />
            {unreadSitesCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                backgroundColor: 'var(--danger)',
                color: '#ffffff',
                border: '1.5px solid #111',
                borderRadius: '4px',
                width: '15px',
                height: '15px',
                fontSize: '8px',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {unreadSitesCount}
              </span>
            )}
          </div>

          {/* Get Help Button */}
          <button 
            style={{
              backgroundColor: '#ffffff',
              color: '#111111',
              border: '2px solid #111111',
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '2px 2px 0px #111',
              fontFamily: 'var(--font-family-body)',
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
            Get Help <span style={{ opacity: 0.7, fontSize: '9px' }}>Ctrl K</span>
          </button>

          {/* Theme Switcher (Static) */}
          <div style={{ display: 'flex', alignItems: 'center', color: '#111111', cursor: 'pointer' }}>
            <Sun size={18} />
          </div>

          {/* User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '2px solid #111111', paddingLeft: '16px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              border: '1.5px solid #111',
              boxShadow: '1.5px 1.5px 0px #111',
              backgroundColor: '#ffffff',
              color: '#111111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 900
            }}>
              {user && user.username ? user.username.substring(0, 2).toUpperCase() : 'AD'}
            </div>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#111111', textTransform: 'uppercase' }}>
              {user && user.username ? user.username : 'admin'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Workspace split */}
      <div style={{ display: 'flex', flexDirection: 'row', minHeight: '520px', backgroundColor: '#ffffff' }}>
        
        {/* Far-Left Narrow Slate Toolbar */}
        <div style={{
          width: '48px',
          backgroundColor: '#ffffff',
          borderRight: '2px solid #111111',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '16px',
          paddingBottom: '16px',
          gap: '20px',
          flexShrink: 0
        }}>
          <div 
            onClick={() => setActiveFilter('all')}
            style={{ 
              color: activeFilter !== 'history' ? '#ffffff' : '#111111', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: activeFilter !== 'history' ? '1.5px solid #111111' : '1.5px solid transparent',
              backgroundColor: activeFilter !== 'history' ? '#111111' : 'transparent',
              boxShadow: activeFilter !== 'history' ? '1.5px 1.5px 0px #111' : 'none'
            }}
            title="Watchlist"
          >
            <List size={18} />
          </div>
          
          <div 
            style={{ 
              color: '#111111', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: '1.5px solid transparent',
              transition: 'all 0.1s'
            }} 
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#111111';
              e.currentTarget.style.backgroundColor = '#f1f5f9';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Analytics"
          >
            <BarChart2 size={18} />
          </div>
          
          <div 
            style={{ 
              color: '#111111', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: '1.5px solid transparent',
              transition: 'all 0.1s'
            }} 
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#111111';
              e.currentTarget.style.backgroundColor = '#f1f5f9';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Team"
          >
            <Users size={18} />
          </div>
          
          <div 
            style={{ 
              color: '#111111', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: '1.5px solid transparent',
              transition: 'all 0.1s'
            }} 
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#111111';
              e.currentTarget.style.backgroundColor = '#f1f5f9';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Documentation"
          >
            <BookOpen size={18} />
          </div>
          
          <div style={{ flex: 1 }} />
          
          <div style={{ color: '#111111', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Feedback">
            <MessageSquare size={18} />
          </div>
          
          <div style={{ color: '#111111', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Language">
            <Languages size={18} />
          </div>
        </div>

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

          {/* Add Label Button */}
          <button 
            style={{
              border: '2px dashed #111111',
              borderRadius: '0px',
              padding: '8px',
              textAlign: 'center',
              color: '#111111',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              background: '#ffffff',
              marginTop: 'auto',
              boxShadow: '2px 2px 0px #111',
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
            Add label
          </button>
        </div>

        {/* Main Workspace content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: '#ffffff' }}>
          
          {/* VIEW: WATCHLIST TABLE */}
          {activeFilter !== 'history' && (
            <>
              {/* Watchlist Table Top Toolbar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 16px',
                backgroundColor: 'var(--bg-main)',
                borderBottom: '2px solid #111111'
              }}>
                {/* Left controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Select All Checkbox */}
                  <div 
                    onClick={handleSelectAll}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#111111' }}
                  >
                    {selectedSiteIds.length > 0 && selectedSiteIds.length === filteredSites.length ? (
                      <CheckSquare size={16} />
                    ) : (
                      <Square size={16} />
                    )}
                  </div>
                  
                  {/* Action carets */}
                  <ChevronDown size={14} style={{ color: '#111111', cursor: 'pointer' }} />
                  
                  <div style={{ height: '14px', width: '2px', backgroundColor: '#111111', margin: '0 4px' }} />
                  
                  {/* View/Sort selector button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#111111' }}>
                    <Sliders size={14} />
                    <ChevronDown size={10} />
                  </div>
                </div>

                {/* Right controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#111111', fontWeight: 800 }}>
                  {/* Scan All button inline */}
                  <button 
                    onClick={handleTriggerCheckAll}
                    disabled={checkingAll}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '2px solid #111111',
                      color: '#111111',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      boxShadow: '1.5px 1.5px 0px #111',
                      textTransform: 'uppercase',
                      transition: 'all 0.1s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translate(-0.5px, -0.5px)';
                      e.currentTarget.style.boxShadow = '2px 2px 0px #111';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '1.5px 1.5px 0px #111';
                    }}
                  >
                    <RefreshCw size={11} className={checkingAll ? 'spin' : ''} />
                    {checkingAll ? 'Scanning...' : 'Scan All'}
                  </button>

                  <div style={{ height: '14px', width: '2px', backgroundColor: '#111111' }} />

                  {/* Pagination text */}
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>1 - {filteredSites.length} of {filteredSites.length}</span>
                  
                  {/* Pagination chevrons */}
                  <div style={{ display: 'flex', gap: '4px', color: '#111111' }}>
                    <ChevronLeft size={14} style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                    <ChevronRight size={14} style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                  </div>

                  <div style={{ height: '14px', width: '2px', backgroundColor: '#111111' }} />

                  {/* Settings gear icon */}
                  <Settings size={14} style={{ cursor: 'pointer', color: '#111111' }} />
                </div>
              </div>

              {/* Table Body */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredSites.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center', color: '#111111' }}>
                    <Info size={32} style={{ margin: '0 auto 8px auto', color: '#111111' }} />
                    <div style={{ fontWeight: 900, fontSize: '15px', color: '#111111', textTransform: 'uppercase' }}>No Monitors Found</div>
                    <p style={{ fontSize: '13px', margin: '4px 0 0 0', fontWeight: 600 }}>
                      {searchQuery ? 'No websites match your search query.' : 'Click "Add Monitor" to start tracking.'}
                    </p>
                  </div>
                ) : (
                  filteredSites.map(site => {
                    const siteAlerts = notifications.filter(n => n.websiteId === site.id);
                    const hasAlert = siteAlerts.length > 0;
                    const isEnabled = site.enabled !== false;
                    const isExpanded = expandedSiteId === site.id;
                    const isSelected = selectedSiteIds.includes(site.id);
                    
                    return (
                      <div 
                        key={site.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          borderBottom: '1.5px solid #111111',
                          backgroundColor: hasAlert ? '#f0fdf4' : (isExpanded ? '#f8fafc' : 'transparent'),
                          transition: 'background-color 0.2s'
                        }}
                      >
                        {/* Row Header */}
                        <div 
                          onClick={() => setExpandedSiteId(isExpanded ? null : site.id)}
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: '12px 16px',
                            gap: '12px',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = hasAlert ? '#dcfce7' : '#f1f5f9'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = hasAlert ? '#f0fdf4' : (isExpanded ? '#f8fafc' : 'transparent')}
                        >
                          {/* Checkbox */}
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectRow(site.id);
                            }}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#111111' }}
                          >
                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </div>

                          {/* Expand chevron caret */}
                          <div style={{ color: '#111111', display: 'flex', alignItems: 'center' }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </div>

                          {/* Favicon + Name + Inline Snippet */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            <img 
                              src={getFaviconUrl(site.url)} 
                              alt="" 
                              style={{ width: '16px', height: '16px', border: '1px solid #111', borderRadius: '0px', flexShrink: 0, backgroundColor: '#ffffff' }}
                              onError={(e) => { e.currentTarget.src = 'https://www.google.com/s2/favicons?sz=64&domain=google.com'; }}
                            />
                            <a 
                              href={site.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{
                                fontWeight: 800,
                                fontSize: '13px',
                                color: '#2563eb',
                                textDecoration: 'underline',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '200px',
                                flexShrink: 0
                              }}
                            >
                              {site.name}
                            </a>
                            {site.latestContentText && (
                              <span style={{
                                color: '#475569',
                                fontSize: '12px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                fontWeight: 600
                              }}>
                                — {site.latestContentText.substring(0, 120)}
                              </span>
                            )}
                          </div>

                          {/* Interval */}
                          <div style={{ width: '90px', color: '#2563eb', fontSize: '12px', fontWeight: 800, textAlign: 'left', flexShrink: 0 }}>
                            30 mins
                          </div>

                          {/* Last Checked */}
                          <div style={{ 
                            width: '110px', 
                            color: hasAlert ? 'var(--danger)' : '#111111', 
                            fontSize: '12px', 
                            fontWeight: 800, 
                            textAlign: 'left',
                            flexShrink: 0
                          }}>
                            {formatTimeAgo(site.lastCheckedAt)}
                          </div>

                          {/* Device / Cloud Indicator */}
                          <div style={{ width: '40px', display: 'flex', justifyContent: 'center', color: '#111111', flexShrink: 0 }}>
                            <Cloud size={15} />
                          </div>

                          {/* ON/OFF Switch Button */}
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSite(site.id, isEnabled);
                            }}
                            style={{ width: '60px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}
                          >
                            <button style={{
                              backgroundColor: isEnabled ? 'var(--success)' : '#ffffff',
                              color: isEnabled ? '#ffffff' : '#111111',
                              border: '1.5px solid #111111',
                              borderRadius: '0px',
                              padding: '2px 8px',
                              fontSize: '10px',
                              fontWeight: 900,
                              cursor: 'pointer',
                              minWidth: '38px',
                              textAlign: 'center',
                              boxShadow: '1.5px 1.5px 0px #111',
                              transition: 'all 0.1s'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.transform = 'translate(-0.5px, -0.5px)';
                              e.currentTarget.style.boxShadow = '2.2px 2.2px 0px #111';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.boxShadow = '1.5px 1.5px 0px #111';
                            }}
                            >
                              {isEnabled ? 'ON' : 'OFF'}
                            </button>
                          </div>
                        </div>

                        {/* Expand Details Drawer */}
                        {isExpanded && (
                          <div style={{
                            padding: '16px 24px',
                            backgroundColor: '#f8fafc',
                            borderTop: '2px solid #111111',
                            display: 'flex',
                            flexDirection: 'row',
                            gap: '24px'
                          }}>
                            {/* Preview box */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', color: '#111111', letterSpacing: '0.03em' }}>
                                  🔍 Latest Extracted Content Preview
                                </span>
                                {site.scrapedVia && (
                                  <span style={{ 
                                    fontSize: '10px', 
                                    fontWeight: 800, 
                                    padding: '2px 6px', 
                                    border: '1.5px solid #111',
                                    borderRadius: '0px', 
                                    backgroundColor: '#e0f2fe', 
                                    color: '#0369a1',
                                    boxShadow: '1px 1px 0px #111'
                                  }}>
                                    ⚡ Scraped via: {site.scrapedVia}
                                  </span>
                                )}
                              </div>
                              
                              <div style={{
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                padding: '16px',
                                border: '2px solid #111111',
                                borderRadius: '0px',
                                backgroundColor: '#ffffff',
                                color: '#111111',
                                maxHeight: '180px',
                                overflowY: 'auto',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                fontWeight: 500
                              }}>
                                {site.latestContentText ? (
                                  <>
                                    {hasAlert && (
                                      <div style={{ color: '#166534', fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        🟢 UNREAD CHANGE ALERT DETECTED:
                                      </div>
                                    )}
                                    {site.latestContentText}
                                  </>
                                ) : (
                                  <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                                    No content has been fetched yet. Click "Scan" to fetch initial data.
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Profile details */}
                            <div style={{
                              width: '260px',
                              borderLeft: '2px solid #111111',
                              paddingLeft: '20px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              fontSize: '12px'
                            }}>
                              <h5 style={{ margin: 0, fontWeight: 900, textTransform: 'uppercase', color: '#111111', fontFamily: 'var(--font-family-title)' }}>Scraper Profile</h5>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px dashed #111111', paddingBottom: '4px' }}>
                                <span style={{ color: '#111111', fontWeight: 700 }}>Status:</span>
                                <strong style={{ color: isEnabled ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>
                                  {isEnabled ? 'ACTIVE MONITOR' : 'PAUSED'}
                                </strong>
                              </div>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px dashed #111111', paddingBottom: '4px' }}>
                                <span style={{ color: '#111111', fontWeight: 700 }}>Interval:</span>
                                <span style={{ fontWeight: 600 }}>30 Minutes</span>
                              </div>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px dashed #111111', paddingBottom: '4px' }}>
                                <span style={{ color: '#111111', fontWeight: 700 }}>Date Added:</span>
                                <span style={{ fontWeight: 600 }}>{site.createdAt ? new Date(site.createdAt).toLocaleDateString() : 'Unknown'}</span>
                              </div>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px dashed #111111', paddingBottom: '4px' }}>
                                <span style={{ color: '#111111', fontWeight: 700 }}>Hash ID:</span>
                                <span style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: 600 }}>
                                  {site.lastContentHash ? site.lastContentHash.substring(0, 16) + '...' : 'No Hash'}
                                </span>
                              </div>

                              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCheckSingleSite(site.id, site.name);
                                  }}
                                  disabled={checkingSiteId === site.id}
                                  style={{
                                    flex: 1,
                                    padding: '5px',
                                    fontSize: '11px',
                                    backgroundColor: '#ffffff',
                                    border: '2px solid #111111',
                                    boxShadow: '1.5px 1.5px 0px #111',
                                    cursor: 'pointer',
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '2px',
                                    transition: 'all 0.1s'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translate(-0.5px, -0.5px)';
                                    e.currentTarget.style.boxShadow = '2.2px 2.2px 0px #111';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = '1.5px 1.5px 0px #111';
                                  }}
                                >
                                  <RefreshCw size={10} className={checkingSiteId === site.id ? 'spin' : ''} />
                                  Scan
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSimulateChange(site.id, site.name);
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '5px',
                                    fontSize: '11px',
                                    backgroundColor: '#ffffff',
                                    border: '2px solid #111111',
                                    boxShadow: '1.5px 1.5px 0px #111',
                                    cursor: 'pointer',
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '2px',
                                    transition: 'all 0.1s'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translate(-0.5px, -0.5px)';
                                    e.currentTarget.style.boxShadow = '2.2px 2.2px 0px #111';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = '1.5px 1.5px 0px #111';
                                  }}
                                >
                                  <Sparkles size={10} />
                                  Simulate
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSite(site.id, site.name);
                                  }}
                                  style={{
                                    padding: '5px 8px',
                                    fontSize: '11px',
                                    backgroundColor: '#ffffff',
                                    color: 'var(--danger)',
                                    border: '2px solid #111111',
                                    boxShadow: '1.5px 1.5px 0px #111',
                                    cursor: 'pointer',
                                    fontWeight: 900,
                                    transition: 'all 0.1s'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translate(-0.5px, -0.5px)';
                                    e.currentTarget.style.boxShadow = '2.2px 2.2px 0px #111';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = '1.5px 1.5px 0px #111';
                                  }}
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                              
                              {hasAlert && (
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await handleClearSiteAlerts(site.id);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '6px',
                                    fontSize: '11px',
                                    backgroundColor: '#ffffff',
                                    border: '2px solid #111111',
                                    boxShadow: '2px 2px 0px #111',
                                    color: '#111111',
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    cursor: 'pointer',
                                    marginTop: '4px',
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
                                  Mark alerts as read
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
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#111111', fontFamily: 'var(--font-family-title)', letterSpacing: '-0.02em' }}>
                  📜 Change Log Feed
                </h3>
                {notifications.length > 0 && (
                  <button 
                    onClick={handleClearNotifications}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#ffffff',
                      border: '2px solid #111111',
                      boxShadow: '2px 2px 0px #111',
                      color: 'var(--danger)',
                      fontWeight: 900,
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
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
                    <Trash size={12} /> Clear Logs
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '48px 20px', 
                  color: '#111111',
                  backgroundColor: 'var(--bg-main)',
                  border: '2px dashed #111111'
                }}>
                  <Info size={28} style={{ marginBottom: '8px' }} />
                  <div style={{ fontWeight: 900, fontSize: '14px', textTransform: 'uppercase' }}>No Changes Logged</div>
                  <p style={{ fontSize: '12px', margin: '4px 0 0 0', fontWeight: 600 }}>
                    All websites currently match their recorded states. When a change is detected, it will be listed here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {notifications.map(notif => (
                    <div 
                      key={notif.id}
                      style={{
                        border: '2px solid #111111',
                        padding: '16px',
                        backgroundColor: '#ffffff',
                        boxShadow: '3px 3px 0px #111111'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#111111', margin: 0 }}>{notif.title}</h4>
                          <a 
                            href={notif.url} 
                            target="_blank" 
                            rel="noreferrer"
                            style={{ fontSize: '11px', color: '#2563eb', textDecoration: 'underline', fontWeight: 800 }}
                          >
                            {notif.url}
                          </a>
                        </div>
                        <span style={{ fontSize: '11px', color: '#111111', fontWeight: 700 }}>
                          🕒 {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ 
                        fontSize: '12px', 
                        color: '#111111', 
                        backgroundColor: 'var(--bg-main)',
                        padding: '10px',
                        border: '1.5px solid #111111',
                        margin: 0,
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        fontWeight: 600
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
                <input 
                  type="text" 
                  style={{ padding: '8px 12px', border: '2px solid #111111', outline: 'none', fontSize: '13px', fontWeight: 700 }}
                  placeholder="e.g. .announcement-card"
                  value={siteSelector}
                  onChange={e => setSiteSelector(e.target.value)}
                />
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

    </div>
  );
}

export default WebNotifications;
