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
          background: isActive ? '#2563eb' : 'transparent',
          color: isActive ? '#ffffff' : '#334155',
          border: 'none',
          borderRadius: '4px',
          padding: '8px 12px',
          fontWeight: 600,
          fontSize: '13px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'background-color 0.15s, color 0.15s'
        }}
        onMouseEnter={e => {
          if (!isActive) e.currentTarget.style.backgroundColor = '#e2e8f0';
        }}
        onMouseLeave={e => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span>{label}</span>
        {count > 0 && (
          <span style={{
            backgroundColor: isActive ? '#ffffff' : activeColor || '#3b82f6',
            color: isActive ? '#2563eb' : '#ffffff',
            borderRadius: '10px',
            padding: '1px 6px',
            fontSize: '10px',
            fontWeight: 700
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
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025)',
      overflow: 'hidden',
      fontFamily: '"Inter", sans-serif',
      color: '#334155'
    }}>
      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#ffffff'
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.05em', color: '#0f172a' }}>WATCHLIST</span>
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            color: '#2563eb',
            backgroundColor: '#eff6ff',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            CLOUD - CALL LOGIQ SERVERS
          </span>
        </div>

        {/* Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#f1f5f9',
          padding: '6px 12px',
          borderRadius: '20px',
          width: '260px',
          border: '1px solid transparent',
          marginLeft: '20px',
          marginRight: 'auto'
        }}>
          <Search size={14} style={{ color: '#64748b' }} />
          <input 
            type="text"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              fontSize: '13px',
              color: '#334155'
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
            style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b' }}
            title="Unread Alerts"
          >
            <Mail size={18} />
            {unreadSitesCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                borderRadius: '50%',
                width: '14px',
                height: '14px',
                fontSize: '8px',
                fontWeight: 700,
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
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Get Help <span style={{ opacity: 0.7, fontSize: '10px' }}>Ctrl K</span>
          </button>

          {/* Theme Switcher (Static) */}
          <div style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', cursor: 'pointer' }}>
            <Sun size={18} />
          </div>

          {/* User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#cbd5e1',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700
            }}>
              {user && user.username ? user.username.substring(0, 2).toUpperCase() : 'AD'}
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
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
          backgroundColor: '#0f172a',
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
              color: activeFilter !== 'history' ? '#3b82f6' : '#94a3b8', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '4px',
              backgroundColor: activeFilter !== 'history' ? 'rgba(59, 130, 246, 0.15)' : 'transparent'
            }}
            title="Watchlist"
          >
            <List size={18} />
          </div>
          
          <div style={{ color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Analytics">
            <BarChart2 size={18} />
          </div>
          
          <div style={{ color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Team">
            <Users size={18} />
          </div>
          
          <div style={{ color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Documentation">
            <BookOpen size={18} />
          </div>
          
          <div style={{ flex: 1 }} />
          
          <div style={{ color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Feedback">
            <MessageSquare size={18} />
          </div>
          
          <div style={{ color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Language">
            <Languages size={18} />
          </div>
        </div>

        {/* Filters Sidebar */}
        <div style={{
          width: '180px',
          backgroundColor: '#f8fafc',
          borderRight: '1px solid #e2e8f0',
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
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 12px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10b981'}
          >
            <Plus size={14} /> Add Monitor
          </button>

          {/* Filter Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {renderFilterItem('all', 'All', sites.length, '#2563eb')}
            {renderFilterItem('history', 'Feed', notifications.length, '#64748b')}
            {renderFilterItem('unread', 'Unread', unreadSitesCount, '#2563eb')}
            {renderFilterItem('error', 'Error', errorSitesCount, '#ef4444')}
            {renderFilterItem('trash', 'Trash', 0, '#94a3b8')}
          </div>

          {/* Add Label Button */}
          <button 
            style={{
              border: '1px dashed #cbd5e1',
              borderRadius: '4px',
              padding: '8px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              background: 'transparent',
              marginTop: 'auto'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
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
                padding: '8px 16px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0'
              }}>
                {/* Left controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Select All Checkbox */}
                  <div 
                    onClick={handleSelectAll}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: selectedSiteIds.length > 0 ? '#3b82f6' : '#94a3b8' }}
                  >
                    {selectedSiteIds.length > 0 && selectedSiteIds.length === filteredSites.length ? (
                      <CheckSquare size={16} />
                    ) : (
                      <Square size={16} />
                    )}
                  </div>
                  
                  {/* Action carets */}
                  <ChevronDown size={14} style={{ color: '#64748b', cursor: 'pointer' }} />
                  
                  <div style={{ height: '14px', width: '1px', backgroundColor: '#e2e8f0', margin: '0 4px' }} />
                  
                  {/* View/Sort selector button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: '#64748b' }}>
                    <Sliders size={14} />
                    <ChevronDown size={10} />
                  </div>
                </div>

                {/* Right controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748b' }}>
                  {/* Scan All button inline */}
                  <button 
                    onClick={handleTriggerCheckAll}
                    disabled={checkingAll}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RefreshCw size={12} className={checkingAll ? 'spin' : ''} />
                    {checkingAll ? 'Scanning...' : 'Scan All'}
                  </button>

                  <div style={{ height: '14px', width: '1px', backgroundColor: '#e2e8f0' }} />

                  {/* Pagination text */}
                  <span>1 - {filteredSites.length} of {filteredSites.length}</span>
                  
                  {/* Pagination chevrons */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <ChevronLeft size={14} style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                    <ChevronRight size={14} style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                  </div>

                  <div style={{ height: '14px', width: '1px', backgroundColor: '#e2e8f0' }} />

                  {/* Settings gear icon */}
                  <Settings size={14} style={{ cursor: 'pointer' }} />
                </div>
              </div>

              {/* Table Body */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredSites.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                    <Info size={32} style={{ margin: '0 auto 8px auto', opacity: 0.6 }} />
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>No Monitors Found</div>
                    <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>
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
                          borderBottom: '1px solid #e2e8f0',
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
                            padding: '10px 16px',
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
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: isSelected ? '#3b82f6' : '#94a3b8' }}
                          >
                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </div>

                          {/* Expand chevron caret */}
                          <div style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </div>

                          {/* Favicon + Name + Inline Snippet */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            <img 
                              src={getFaviconUrl(site.url)} 
                              alt="" 
                              style={{ width: '16px', height: '16px', borderRadius: '2px', flexShrink: 0, backgroundColor: '#f1f5f9' }}
                              onError={(e) => { e.currentTarget.src = 'https://www.google.com/s2/favicons?sz=64&domain=google.com'; }}
                            />
                            <a 
                              href={site.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{
                                fontWeight: 600,
                                fontSize: '13px',
                                color: '#2563eb',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '200px',
                                flexShrink: 0
                              }}
                              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                            >
                              {site.name}
                            </a>
                            {site.latestContentText && (
                              <span style={{
                                color: '#64748b',
                                fontSize: '12px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                fontWeight: 400
                              }}>
                                — {site.latestContentText.substring(0, 120)}
                              </span>
                            )}
                          </div>

                          {/* Interval */}
                          <div style={{ width: '90px', color: '#2563eb', fontSize: '12px', fontWeight: 600, textAlign: 'left', flexShrink: 0 }}>
                            30 mins
                          </div>

                          {/* Last Checked */}
                          <div style={{ 
                            width: '110px', 
                            color: hasAlert ? '#ef4444' : '#64748b', 
                            fontSize: '12px', 
                            fontWeight: hasAlert ? 700 : 500, 
                            textAlign: 'left',
                            flexShrink: 0
                          }}>
                            {formatTimeAgo(site.lastCheckedAt)}
                          </div>

                          {/* Device / Cloud Indicator */}
                          <div style={{ width: '40px', display: 'flex', justifyContent: 'center', color: '#94a3b8', flexShrink: 0 }}>
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
                              backgroundColor: isEnabled ? '#10b981' : '#94a3b8',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '2px 8px',
                              fontSize: '10px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              minWidth: '36px',
                              textAlign: 'center'
                            }}>
                              {isEnabled ? 'ON' : 'OFF'}
                            </button>
                          </div>
                        </div>

                        {/* Expand Details Drawer */}
                        {isExpanded && (
                          <div style={{
                            padding: '16px 24px',
                            backgroundColor: '#f8fafc',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'row',
                            gap: '24px'
                          }}>
                            {/* Preview box */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                                  🔍 Latest Extracted Content Preview
                                </span>
                                {site.scrapedVia && (
                                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                                    ⚡ Scraped via: {site.scrapedVia}
                                  </span>
                                )}
                              </div>
                              
                              <div style={{
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                padding: '12px',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#ffffff',
                                color: '#334155',
                                maxHeight: '180px',
                                overflowY: 'auto',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap'
                              }}>
                                {site.latestContentText ? (
                                  <>
                                    {hasAlert && (
                                      <div style={{ color: '#166534', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        🟢 UNREAD CHANGE ALERT DETECTED:
                                      </div>
                                    )}
                                    {site.latestContentText}
                                  </>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                    No content has been fetched yet. Click "Scan" to fetch initial data.
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Profile details */}
                            <div style={{
                              width: '260px',
                              borderLeft: '1px solid #e2e8f0',
                              paddingLeft: '20px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              fontSize: '12px'
                            }}>
                              <h5 style={{ margin: 0, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Scraper Profile</h5>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '4px' }}>
                                <span style={{ color: '#64748b' }}>Status:</span>
                                <strong style={{ color: isEnabled ? '#10b981' : '#ef4444' }}>
                                  {isEnabled ? 'ACTIVE MONITOR' : 'PAUSED'}
                                </strong>
                              </div>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '4px' }}>
                                <span style={{ color: '#64748b' }}>Interval:</span>
                                <span>30 Minutes</span>
                              </div>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '4px' }}>
                                <span style={{ color: '#64748b' }}>Date Added:</span>
                                <span>{site.createdAt ? new Date(site.createdAt).toLocaleDateString() : 'Unknown'}</span>
                              </div>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '4px' }}>
                                <span style={{ color: '#64748b' }}>Hash ID:</span>
                                <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>
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
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: '#ffffff',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '2px'
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
                                    borderRadius: '4px',
                                    border: '1px solid #bfdbfe',
                                    backgroundColor: '#eff6ff',
                                    color: '#1d4ed8',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '2px'
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
                                    borderRadius: '4px',
                                    border: '1px solid #fca5a5',
                                    backgroundColor: '#fef2f2',
                                    color: '#dc2626',
                                    cursor: 'pointer',
                                    fontWeight: 600
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
                                    borderRadius: '4px',
                                    border: 'none',
                                    backgroundColor: '#cbd5e1',
                                    color: '#1e293b',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    marginTop: '4px'
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
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  📜 Change Log Feed
                </h3>
                {notifications.length > 0 && (
                  <button 
                    onClick={handleClearNotifications}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: '1px solid #fca5a5',
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      fontWeight: 600,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
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
                  color: '#64748b',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  border: '1px dashed #cbd5e1'
                }}>
                  <Info size={28} style={{ opacity: 0.5, marginBottom: '8px' }} />
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>No Changes Logged</div>
                  <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>
                    All websites currently match their recorded states. When a change is detected, it will be listed here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {notifications.map(notif => (
                    <div 
                      key={notif.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '16px',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{notif.title}</h4>
                          <a 
                            href={notif.url} 
                            target="_blank" 
                            rel="noreferrer"
                            style={{ fontSize: '11px', color: '#2563eb', textDecoration: 'underline' }}
                          >
                            {notif.url}
                          </a>
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                          🕒 {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ 
                        fontSize: '12px', 
                        color: '#334155', 
                        backgroundColor: '#f8fafc',
                        padding: '10px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        margin: 0,
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap'
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
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }} onClick={() => {
          setShowAddForm(false);
          setFormError('');
          setFormSuccess('');
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            width: '100%',
            maxWidth: '500px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>
                Add Website Monitor
              </h3>
              <button 
                onClick={() => {
                  setShowAddForm(false);
                  setFormError('');
                  setFormSuccess('');
                }}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleAddWebsite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>MONITOR NAME</label>
                <input 
                  type="text" 
                  style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px' }}
                  placeholder="e.g. Sairam NCC Portal"
                  value={siteName}
                  onChange={e => setSiteName(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>WEBSITE URL</label>
                <input 
                  type="text" 
                  style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px' }}
                  placeholder="e.g. sairamncc.in"
                  value={siteUrl}
                  onChange={e => setSiteUrl(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>CSS SELECTOR (OPTIONAL)</label>
                <input 
                  type="text" 
                  style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px' }}
                  placeholder="e.g. .announcement-card"
                  value={siteSelector}
                  onChange={e => setSiteSelector(e.target.value)}
                />
              </div>
              
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                💡 Leave CSS selector blank to monitor the full page. Use selector (e.g. <code>.announcement-card</code>) to track changes in a specific element.
              </p>
              
              {formError && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>{formError}</div>}
              {formSuccess && <div style={{ color: '#10b981', fontSize: '12px', fontWeight: 500 }}>{formSuccess}</div>}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddForm(false);
                    setFormError('');
                    setFormSuccess('');
                  }}
                  style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', background: '#10b981', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
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
