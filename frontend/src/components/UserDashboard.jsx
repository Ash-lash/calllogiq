import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, FileSpreadsheet, Clock, Phone, PhoneCall, PhoneIncoming, 
  PhoneMissed, AlertCircle, Calendar, Download, CheckSquare, Square, Check
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import API_BASE from '../api';

const format_seconds = (seconds) => {
  if (isNaN(seconds) || seconds === undefined || seconds === null) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

function UserDashboard({ user, token, previewMode, onProfileUpdate }) {
  const [selectedLog, setSelectedLog] = useState(null);
  const [history, setHistory] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [iosAlert, setIosAlert] = useState(null);

  const showIosAlert = (message, title = 'Notification') => {
    return new Promise((resolve) => {
      setIosAlert({
        title,
        message,
        type: 'alert',
        onConfirm: () => {
          setIosAlert(null);
          resolve(true);
        }
      });
    });
  };

  const showIosConfirm = (message, title = 'Confirm Action') => {
    return new Promise((resolve) => {
      setIosAlert({
        title,
        message,
        type: 'confirm',
        onConfirm: () => {
          setIosAlert(null);
          resolve(true);
        },
        onCancel: () => {
          setIosAlert(null);
          resolve(false);
        }
      });
    });
  };
  
  // Profile Setup States
  const [showSetupModal, setShowSetupModal] = useState((user?.domain === 'Pending' || user?.branch === 'Pending') && !previewMode);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [selectedSetupDomain, setSelectedSetupDomain] = useState('');
  const [selectedSetupBranch, setSelectedSetupBranch] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');

  // Business Development Team states
  const [bdPhotos, setBdPhotos] = useState([]);
  const [bdLocation, setBdLocation] = useState('');
  const [bdDateTime, setBdDateTime] = useState('');
  const [bdGpsEnabled, setBdGpsEnabled] = useState(false);
  const [showGpsWarning, setShowGpsWarning] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [bdVisits, setBdVisits] = useState([]);
  const [bdLoading, setBdLoading] = useState(false);
  const [bdError, setBdError] = useState('');
  const [activePreviewImage, setActivePreviewImage] = useState(null);

  const fetchBdVisits = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/business-development/field-visits`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBdVisits(data);
      }
    } catch (err) {
      console.error('Error fetching field visits:', err);
    }
  };

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    if (files.length > 2) {
      setBdError('Maximum 2 photos can be uploaded.');
      return;
    }

    const base64Promises = files.map(file => {
      return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
          reject(new Error('Only image files are allowed.'));
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(base64Promises)
      .then(base64s => {
        setBdPhotos(base64s);
        setBdError('');
        setShowGpsWarning(true);
      })
      .catch(err => {
        setBdError(err.message);
      });
  };

  const handleGpsChoice = (enabled) => {
    setBdGpsEnabled(enabled);
    setShowGpsWarning(false);
    
    const now = new Date();
    const tzoffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - tzoffset)).toISOString().slice(0, 16);
    setBdDateTime(localISOTime);
    setBdLocation('');
    setShowDetailsModal(true);
  };

  const handleBdSubmit = async (e) => {
    e.preventDefault();
    if (!bdLocation.trim()) {
      setBdError('Location is required.');
      return;
    }
    if (!bdDateTime) {
      setBdError('Date and time are required.');
      return;
    }

    setBdLoading(true);
    setBdError('');

    try {
      const res = await fetch(`${API_BASE}/api/business-development/field-visit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          photos: bdPhotos,
          gpsEnabled: bdGpsEnabled,
          location: bdLocation,
          visitDateTime: bdDateTime
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record field visit');
      }

      setBdVisits(prev => [data.visit, ...prev]);
      setShowDetailsModal(false);
      setBdPhotos([]);
      setBdLocation('');
      setBdDateTime('');
      await showIosAlert('Field visit report submitted successfully!', 'Success');
    } catch (err) {
      setBdError(err.message);
    } finally {
      setBdLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      setShowSetupModal((user.domain === 'Pending' || user.branch === 'Pending') && !previewMode);
      setProfileName(user.name || '');
    }
  }, [user, previewMode]);

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) {
      setSetupError('Name is required.');
      return;
    }
    if (!selectedSetupDomain) {
      setSetupError('Please select a domain.');
      return;
    }
    if (!selectedSetupBranch) {
      setSetupError('Please select a branch.');
      return;
    }

    setSetupLoading(true);
    setSetupError('');
    try {
      const res = await fetch(`${API_BASE}/api/users/update-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: profileName, 
          domain: selectedSetupDomain, 
          branch: selectedSetupBranch 
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }
      if (onProfileUpdate) {
        onProfileUpdate(data.token, data.user);
      }
      setShowSetupModal(false);
    } catch (err) {
      setSetupError(err.message);
    } finally {
      setSetupLoading(false);
    }
  };
  
  // File Upload State
  const [dragActive, setDragActive] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Fetch initial data
  useEffect(() => {
    if (token) {
      fetchTasks();
      if (user?.domain === 'Business Development Team') {
        fetchBdVisits();
      } else {
        fetchHistory();
      }
    }
  }, [token, user]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/calls/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setHistory(data);
        if (data.length > 0 && !selectedLog) {
          setSelectedLog(data[0]); // Default to show latest upload
        }
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTasks(data);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  // Drag and Drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF files are allowed.');
      return;
    }

    setUploadError('');
    setUploadLoading(true);
    
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch(`${API_BASE}/api/calls/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process PDF file');
      }

      setHistory(prev => [data.log, ...prev]);
      setSelectedLog(data.log);
      fetchHistory(); // Sync
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadLoading(false);
    }
  };

  // Update Task Status
  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      const statusLabels = {
        pending: 'Pending (Not Started)',
        seen: 'Seen (Acknowledged)',
        doing: 'Doing (In Progress)',
        completed: 'Completed (Done)'
      };
      
      const label = statusLabels[newStatus] || newStatus;
      const isConfirmed = await showIosConfirm(`Are you sure you want to mark this task as "${label}"? This will update the admin.`, 'Confirm Status Change');
      if (!isConfirmed) return;

      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, isCompleted: newStatus === 'completed' } : t));
        await showIosAlert(`Task status updated to "${label}". The admin has been updated.`, 'Status Updated');
      } else {
        const err = await res.json().catch(() => ({}));
        await showIosAlert(err.error || 'Failed to update task status', 'Error');
      }
    } catch (err) {
      console.error('Error updating task status:', err);
      await showIosAlert('Error updating task status: ' + err.message, 'Error');
    }
  };

  // Recharts Helper Data Formatting
  const getPieData = () => {
    if (!selectedLog) return [];
    const sum = selectedLog.summary;
    const connectedDialed = sum.connected_dialed;
    const unconnectedDialed = sum.total_dialed - sum.connected_dialed;
    const connectedIncoming = sum.connected_incoming;
    const unconnectedIncoming = sum.total_incoming - sum.connected_incoming;
    const missed = sum.total_missed;

    return [
      { name: 'Connected (Dialed)', value: connectedDialed, color: 'var(--primary)' },
      { name: 'Unconnected (Dialed)', value: unconnectedDialed, color: 'var(--text-muted)' },
      { name: 'Connected (Incoming)', value: connectedIncoming, color: 'var(--success)' },
      { name: 'Unconnected (Incoming)', value: unconnectedIncoming, color: '#a7f3d0' },
      { name: 'Missed Calls', value: missed, color: 'var(--danger)' }
    ];
  };

  const getBarData = () => {
    if (!selectedLog) return [];
    const sum = selectedLog.summary;
    
    // Map duration ranges to recharts bar format
    return Object.keys(sum.dialed_splits).map(range => ({
      name: range === "0 sec (Not Connected)" ? "0s" : range.replace(" secs", "s").replace(" sec", "s").replace(" mins", "m").replace(" min", "m"),
      Dialed: sum.dialed_splits[range] || 0,
      Incoming: sum.incoming_splits[range] || 0
    }));
  };

  // Render workday timeline visualization
  const renderTimeline = () => {
    if (!selectedLog) return null;
    const sum = selectedLog.summary;
    const workdayStart = sum.workday_start;
    const workdayEnd = sum.workday_end;
    const totalSecs = sum.workday_span_secs;

    if (totalSecs <= 0) return <p>No call logs to map timeline.</p>;

    // Convert time "HH:MM" to seconds from start of day
    const getSecondsFromMidnight = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 3600 + m * 60;
    };

    const startSecs = getSecondsFromMidnight(workdayStart);
    
    // We want to overlay calls. Since calls might overlap or be dense, we represent them as green lines.
    // In our backend, we also have raw call records sorted chronologically.
    const calls = selectedLog.calls || [];
    
    return (
      <div className="timeline-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
          <span>🌅 Start: {workdayStart}</span>
          <span style={{ color: 'var(--primary)' }}>Workday Duration: {sum.workday_span_str}</span>
          <span>🌇 End: {workdayEnd}</span>
        </div>

        <div className="timeline-bar-wrapper">
          {/* Base Workday bar */}
          <div style={{ width: '100%', height: '100%', position: 'absolute', left: 0, top: 0, background: 'var(--bg-input)' }}></div>
          
          {/* Render work intervals (when caller is actually in call) */}
          {calls.map((c, idx) => {
            const cTimeStr = c.time.split(' ')[1].substring(0, 5); // get HH:MM
            const cSecs = getSecondsFromMidnight(cTimeStr);
            const offsetSecs = cSecs - startSecs;
            const offsetPct = Math.max(0, (offsetSecs / totalSecs) * 100);
            const widthPct = Math.max(0.3, (Math.max(10, c.duration_secs) / totalSecs) * 100); // minimum width for visibility
            
            return (
              <div 
                key={`call-${idx}`}
                className="timeline-segment active"
                style={{ 
                  left: `${offsetPct}%`, 
                  width: `${widthPct}%`,
                  opacity: c.duration_secs > 0 ? 0.85 : 0.25,
                  title: `${c.name} (${c.type}) - ${cTimeStr} - ${c.duration}`
                }}
              />
            );
          })}

          {/* Render idle gaps > 15 mins in Amber */}
          {sum.idle_gaps && sum.idle_gaps.map((gap, idx) => {
            const gapStartSecs = getSecondsFromMidnight(gap.start);
            const offsetSecs = gapStartSecs - startSecs;
            const offsetPct = Math.max(0, (offsetSecs / totalSecs) * 100);
            const widthPct = (gap.duration_secs / totalSecs) * 100;

            return (
              <div 
                key={`gap-${idx}`}
                className="timeline-segment idle"
                style={{ 
                  left: `${offsetPct}%`, 
                  width: `${widthPct}%`,
                  title: `Idle: ${gap.start} - ${gap.end} (${gap.duration_str})`
                }}
              />
            );
          })}
        </div>

        <div className="timeline-legend">
          <div className="legend-item">
            <span className="legend-dot work" />
            <span>Active Calls ({sum.connected_dialed + sum.connected_incoming})</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot idle" />
            <span>Idle Breaks &gt; 15 mins ({sum.idle_gaps_count})</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot empty" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-light)' }} />
            <span>Gaps &lt; 15 mins</span>
          </div>
        </div>

        {sum.idle_gaps_count > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Detected Idle Breaks (&gt; 15 mins)</h4>
            <div className="timeline-gaps-list">
              {sum.idle_gaps.map((gap, idx) => (
                <div key={idx} className="idle-gap-chip">
                  <span>⏰ {gap.start} to {gap.end}</span>
                  <span style={{ fontWeight: 600 }}>{gap.duration_str} Idle</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Profile Header */}
      <div className="header-banner">
        <div className="header-user-profile">
          {user.photo ? (
            <img src={user.photo} alt={user.name} className="user-avatar" style={{ objectFit: 'cover', border: '2px solid #111111' }} />
          ) : (
            <div className="user-avatar">{user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}</div>
          )}
          <div>
            <div className="user-meta-name">Welcome back, {user.name}</div>
            <div className="user-meta-domain">Workspace: {user.domain} Domain</div>
          </div>
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
          {previewMode && <span className="badge badge-warning" style={{ marginRight: '1rem' }}>Admin Preview Mode</span>}
          <span>Today's Date: {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Drag & Drop PDF Uploader */}
      {user?.domain === 'Business Development Team' ? (
        <div>
          {/* Uploader area for BD Team */}
          {!previewMode && (
            <div 
              className="uploader-zone"
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1.5rem', marginBottom: '2rem' }}
              onClick={() => {
                const picker = document.getElementById('bd-photo-picker');
                if (picker) picker.click();
              }}
            >
              <input 
                id="bd-photo-picker"
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
              />
              <UploadCloud size={48} className="uploader-icon" />
              <h3 className="uploader-title">
                {bdLoading ? 'Recording field visit...' : 'Upload Field Visit Photos'}
              </h3>
              <p className="uploader-desc">
                {bdLoading ? 'Saving details and photos...' : 'Click to select up to 2 field visit photos (PNG, JPG)'}
              </p>
              {bdLoading && (
                <div style={{ 
                  width: '100%', 
                  maxWidth: '350px', 
                  height: '6px', 
                  backgroundColor: 'var(--border-color)', 
                  borderRadius: '3px', 
                  marginTop: '1.25rem', 
                  overflow: 'hidden', 
                  position: 'relative' 
                }} onClick={e => e.stopPropagation()}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: '45%',
                    borderRadius: '3px',
                    background: 'linear-gradient(90deg, #111111 0%, #777777 100%)',
                    animation: 'uploadProgressAnim 1.4s infinite ease-in-out'
                  }} />
                </div>
              )}
              {bdError && (
                <div className="alert alert-danger" style={{ marginTop: '1rem', width: '100%', maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                  <AlertCircle size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                  {bdError}
                </div>
              )}
            </div>
          )}

          {/* Grid: Left: Past visits, Right: Tasks */}
          <div className="dashboard-grid-2">
            {/* Left Side: Field Visit History */}
            <div>
              <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="card-title-bar" style={{ marginBottom: '1.25rem' }}>
                  <h3>My Recorded Field Visits ({bdVisits.length})</h3>
                </div>
                
                {bdVisits.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {bdVisits.map(visit => (
                      <div 
                        key={visit.id}
                        style={{ 
                          border: '2px solid #111111', 
                          borderRadius: '4px', 
                          padding: '1rem',
                          backgroundColor: '#ffffff',
                          boxShadow: '4px 4px 0px #111111'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px dashed #111111', paddingBottom: '0.6rem', marginBottom: '0.6rem' }}>
                          <div>
                            <strong style={{ fontSize: '1rem', display: 'block', color: '#111111' }}>📍 {visit.location}</strong>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              📅 {new Date(visit.visitDateTime).toLocaleString()}
                            </span>
                          </div>
                          <span className={`badge ${visit.gpsEnabled ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.68rem', transform: 'rotate(-1deg)' }}>
                            {visit.gpsEnabled ? 'GPS Enabled' : 'No GPS'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                          {visit.photos && visit.photos.map((photo, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => setActivePreviewImage(photo)}
                              style={{ 
                                cursor: 'pointer', 
                                border: '2px solid #111111', 
                                borderRadius: '4px', 
                                overflow: 'hidden', 
                                width: '100px', 
                                height: '100px',
                                boxShadow: '2px 2px 0px #111'
                              }}
                            >
                              <img 
                                src={photo} 
                                alt={`Visit by ${visit.userName}`} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                    No field visits recorded yet. Use the selector above to log school/field visits.
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Tasks Checklist */}
            <div>
              <div className="card todo-panel" style={{ marginBottom: '2rem' }}>
                <div className="card-title-bar">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckSquare size={18} color="var(--primary)" />
                    My Todo checklist ({tasks.filter(t => !t.isCompleted).length})
                  </h3>
                </div>
                {tasks.length > 0 ? (
                  <ul className="todo-list">
                    {tasks.map(task => {
                      let badgeBg = '#f3f4f6';
                      let badgeColor = '#4b5563';
                      if (task.status === 'seen') { badgeBg = '#fef3c7'; badgeColor = '#d97706'; }
                      else if (task.status === 'doing') { badgeBg = '#e0f2fe'; badgeColor = '#0284c7'; }
                      else if (task.status === 'completed') { badgeBg = '#d1fae5'; badgeColor = '#059669'; }

                      return (
                        <li key={task.id} className={`todo-item ${task.status === 'completed' ? 'completed' : ''}`} style={{ display: 'block', padding: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className="todo-details" style={{ width: '100%' }}>
                              <div className="todo-item-title" style={{ fontSize: '0.95rem', fontWeight: 600 }}>{task.title}</div>
                              {task.description && <div className="todo-item-desc" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>{task.description}</div>}
                              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', alignItems: 'center' }}>
                                <span className={`todo-badge ${task.isDomainTask ? 'domain' : 'personal'}`}>
                                  {task.isDomainTask ? `${task.assignedTo} task` : 'Personal'}
                                </span>
                                <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: badgeBg, color: badgeColor, fontWeight: 700, textTransform: 'uppercase' }}>
                                  {task.status || 'pending'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {!previewMode && (
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.6rem' }}>
                              <button 
                                onClick={() => handleUpdateStatus(task.id, 'seen')}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '6px',
                                  border: task.status === 'seen' ? '1px solid #d97706' : '1px solid var(--border-color)',
                                  background: task.status === 'seen' ? '#fef3c7' : '#ffffff',
                                  color: task.status === 'seen' ? '#b45309' : 'var(--text-primary)',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                👀 Seen
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(task.id, 'doing')}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '6px',
                                  border: task.status === 'doing' ? '1px solid #0284c7' : '1px solid var(--border-color)',
                                  background: task.status === 'doing' ? '#e0f2fe' : '#ffffff',
                                  color: task.status === 'doing' ? '#0369a1' : 'var(--text-primary)',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                ⚙️ Doing
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(task.id, 'completed')}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '6px',
                                  border: task.status === 'completed' ? '1px solid #059669' : '1px solid var(--border-color)',
                                  background: task.status === 'completed' ? '#d1fae5' : '#ffffff',
                                  color: task.status === 'completed' ? '#047857' : 'var(--text-primary)',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                ✅ Completed
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                    No active tasks assigned
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Regular Call Log Uploader & Analysis dashboard */
        <div>
          {!previewMode && (
            <div 
              className={`uploader-zone ${dragActive ? 'active' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileInput} 
                style={{ display: 'none' }} 
                accept=".pdf" 
              />
              <UploadCloud size={48} className="uploader-icon" />
              <h3 className="uploader-title">
                {uploadLoading ? 'Uploading and analyzing call log PDF...' : 'Drag & drop daily call log PDF here'}
              </h3>
              <p className="uploader-desc">
                {uploadLoading ? 'Running metrics models and generating spreadsheets...' : 'or click to browse from files (Only PDF logs)'}
              </p>
              {uploadLoading && (
                <div style={{ 
                  width: '100%', 
                  maxWidth: '350px', 
                  height: '6px', 
                  backgroundColor: 'var(--border-color)', 
                  borderRadius: '3px', 
                  marginTop: '1.25rem', 
                  overflow: 'hidden', 
                  position: 'relative' 
                }} onClick={e => e.stopPropagation()}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: '45%',
                    borderRadius: '3px',
                    background: 'linear-gradient(90deg, #111111 0%, #777777 100%)',
                    animation: 'uploadProgressAnim 1.4s infinite ease-in-out'
                  }} />
                </div>
              )}
              {uploadError && (
                <div className="alert alert-danger" style={{ marginTop: '1rem', width: '100%', maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                  <AlertCircle size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                  {uploadError}
                </div>
              )}
            </div>
          )}

          {/* Dashboard Section */}
          <div className="dashboard-grid-2">
            {/* Left Side: Graphs and Metrics */}
            <div>
              {selectedLog ? (
                <div>
                  {/* Selected log header details */}
                  <div className="card" style={{ marginBottom: '1.5rem', background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', letterSpacing: '-0.02em' }}>
                          <Calendar size={18} color="#111111" />
                          Call Logs Analysis: {selectedLog.callDate}
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          Uploaded on {new Date(selectedLog.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {previewMode && (
                        <a 
                          href={`${API_BASE}/api/calls/download/${selectedLog.id}`} 
                          className="btn btn-success" 
                          style={{ textDecoration: 'none' }}
                        >
                          <Download size={16} />
                          Download Excel Report
                        </a>
                      )}
                    </div>
                  </div>

                  {/* KPI metrics cards */}
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-icon primary"><Phone size={20} /></div>
                      <div>
                        <div className="kpi-label">Grand Total Calls</div>
                        <div className="kpi-value">{selectedLog.summary.grand_total}</div>
                      </div>
                    </div>
                    
                    <div className="kpi-card">
                      <div className="kpi-icon success"><PhoneCall size={20} /></div>
                      <div>
                        <div className="kpi-label">Dialed (Connected)</div>
                        <div className="kpi-value">{selectedLog.summary.connected_dialed} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>/ {selectedLog.summary.total_dialed}</span></div>
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-icon secondary"><PhoneIncoming size={20} /></div>
                      <div>
                        <div className="kpi-label">Incoming (Connected)</div>
                        <div className="kpi-value">{selectedLog.summary.connected_incoming} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>/ {selectedLog.summary.total_incoming}</span></div>
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-icon danger"><PhoneMissed size={20} /></div>
                      <div>
                        <div className="kpi-label">Missed Calls</div>
                        <div className="kpi-value">{selectedLog.summary.total_missed}</div>
                      </div>
                    </div>
                  </div>

                  {/* Talk time KPIs */}
                  <div className="kpi-grid" style={{ marginBottom: '2rem' }}>
                    <div className="kpi-card">
                      <div className="kpi-icon primary"><Clock size={20} /></div>
                      <div>
                        <div className="kpi-label">Total Talking Time</div>
                        <div className="kpi-value">{selectedLog.summary.talk_time_str}</div>
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-icon warning"><AlertCircle size={20} /></div>
                      <div>
                        <div className="kpi-label">Total Idle Hours</div>
                        <div className="kpi-value">{selectedLog.summary.total_idle_str}</div>
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-icon secondary"><Clock size={20} /></div>
                      <div>
                        <div className="kpi-label">Average Call Duration</div>
                        <div className="kpi-value">{format_seconds(selectedLog.summary.avg_duration_secs)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Workday Idle Timeline block */}
                  <div className="card" style={{ marginBottom: '2rem' }}>
                    <div className="card-title-bar">
                      <h3>Workday Productivity Timeline</h3>
                    </div>
                    {renderTimeline()}
                  </div>

                  {/* Visual Charts Grid */}
                  <div className="dashboard-grid-1-1" style={{ margin: 0 }}>
                    {/* Duration Split Bar chart */}
                    <div className="card">
                      <div className="card-title-bar">
                        <h3>Duration Range split</h3>
                      </div>
                      <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                          <BarChart data={getBarData()}>
                            <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                            <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                            <Tooltip contentStyle={{ background: '#ffffff', border: '2px solid #111111', borderRadius: '4px', color: '#111111', fontWeight: '700' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar dataKey="Dialed" fill="#111111" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="Incoming" fill="var(--success)" radius={[0, 0, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Call Connectivity Donut chart */}
                    <div className="card">
                      <div className="card-title-bar">
                        <h3>Call Outcome split</h3>
                      </div>
                      <div style={{ width: '100%', height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '100%', height: 220 }}>
                          <ResponsiveContainer>
                            <PieChart>
                              <Pie
                                data={getPieData()}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {getPieData().map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ background: '#ffffff', border: '2px solid #111111', borderRadius: '4px', color: '#111111', fontWeight: '700' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        
                        {/* Donut Legend */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', width: '100%', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                          {getPieData().map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }} />
                              <span style={{ color: 'var(--text-secondary)' }}>{item.name}: <strong>{item.value}</strong></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: '4rem 2rem', textText: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <FileSpreadsheet size={64} style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }} />
                  <h3>No analysis logs available</h3>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Please upload a call log PDF to compute visual analysis and download Excel sheets.
                  </p>
                </div>
              )}
            </div>

            {/* Right Side: TODO checklist and History List */}
            <div>
              {/* TO DO LIST */}
              <div className="card todo-panel" style={{ marginBottom: '2rem' }}>
                <div className="card-title-bar">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckSquare size={18} color="var(--primary)" />
                    My Todo checklist ({tasks.filter(t => !t.isCompleted).length})
                  </h3>
                </div>
                {tasks.length > 0 ? (
                  <ul className="todo-list">
                    {tasks.map(task => {
                      let badgeBg = '#f3f4f6';
                      let badgeColor = '#4b5563';
                      if (task.status === 'seen') { badgeBg = '#fef3c7'; badgeColor = '#d97706'; }
                      else if (task.status === 'doing') { badgeBg = '#e0f2fe'; badgeColor = '#0284c7'; }
                      else if (task.status === 'completed') { badgeBg = '#d1fae5'; badgeColor = '#059669'; }

                      return (
                        <li key={task.id} className={`todo-item ${task.status === 'completed' ? 'completed' : ''}`} style={{ display: 'block', padding: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className="todo-details" style={{ width: '100%' }}>
                              <div className="todo-item-title" style={{ fontSize: '0.95rem', fontWeight: 600 }}>{task.title}</div>
                              {task.description && <div className="todo-item-desc" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>{task.description}</div>}
                              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', alignItems: 'center' }}>
                                <span className={`todo-badge ${task.isDomainTask ? 'domain' : 'personal'}`}>
                                  {task.isDomainTask ? `${task.assignedTo} task` : 'Personal'}
                                </span>
                                <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: badgeBg, color: badgeColor, fontWeight: 700, textTransform: 'uppercase' }}>
                                  {task.status || 'pending'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Task Status Action Buttons */}
                          {!previewMode && (
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.6rem' }}>
                              <button 
                                onClick={() => handleUpdateStatus(task.id, 'seen')}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '6px',
                                  border: task.status === 'seen' ? '1px solid #d97706' : '1px solid var(--border-color)',
                                  background: task.status === 'seen' ? '#fef3c7' : '#ffffff',
                                  color: task.status === 'seen' ? '#b45309' : 'var(--text-primary)',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                👀 Seen
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(task.id, 'doing')}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '6px',
                                  border: task.status === 'doing' ? '1px solid #0284c7' : '1px solid var(--border-color)',
                                  background: task.status === 'doing' ? '#e0f2fe' : '#ffffff',
                                  color: task.status === 'doing' ? '#0369a1' : 'var(--text-primary)',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                ⚙️ Doing
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(task.id, 'completed')}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '6px',
                                  border: task.status === 'completed' ? '1px solid #059669' : '1px solid var(--border-color)',
                                  background: task.status === 'completed' ? '#d1fae5' : '#ffffff',
                                  color: task.status === 'completed' ? '#047857' : 'var(--text-primary)',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                ✅ Completed
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                    No active tasks assigned
                  </div>
                )}
              </div>

              {/* Past Uploads History */}
              <div className="card" style={{ maxHeight: '420px', display: 'flex', flexDirection: 'column' }}>
                <div className="card-title-bar">
                  <h3>Previous Uploads</h3>
                </div>
                {history.length > 0 ? (
                  <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
                    {history.map(log => (
                      <div 
                        key={log.id} 
                        onClick={() => setSelectedLog(log)}
                        style={{ 
                          padding: '0.75rem 1rem',
                          border: '2px solid #111111',
                          borderRadius: '4px',
                          marginBottom: '0.6rem',
                          cursor: 'pointer',
                          background: selectedLog?.id === log.id ? '#111111' : '#ffffff',
                          color: selectedLog?.id === log.id ? '#ffffff' : '#111111',
                          boxShadow: selectedLog?.id === log.id ? '2px 2px 0px #111' : 'none',
                          transition: 'all 0.2s ease',
                          transform: selectedLog?.id === log.id ? 'translate(-1px, -1px)' : 'none'
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Log Date: {log.callDate}</div>
                        <div style={{ fontSize: '0.75rem', color: selectedLog?.id === log.id ? '#e2e8f0' : 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                          <span>Total calls: {log.summary.grand_total}</span>
                          <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                    No previous uploads found
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showSetupModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(17, 17, 17, 0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="card" style={{
            background: '#ffffff',
            border: '2px solid #111111',
            borderRadius: '4px',
            padding: '2.5rem',
            width: '460px',
            maxWidth: '100%',
            boxShadow: '6px 6px 0px 0px #111111',
            color: '#111111',
            boxSizing: 'border-box'
          }}>
            <h2 style={{ 
              fontSize: '1.8rem', 
              fontWeight: 900, 
              margin: '0 0 0.5rem 0', 
              color: '#111111',
              fontFamily: "'Outfit', sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '-0.03em'
            }}>
              Complete Your Profile
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: '0 0 1.5rem 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Confirm display name & select workspace credentials.
            </p>

            {setupError && (
              <div style={{ 
                background: 'var(--danger-light)', 
                border: '2px solid var(--danger)', 
                color: 'var(--danger)', 
                padding: '10px', 
                fontSize: '0.85rem', 
                marginBottom: '1.5rem', 
                textAlign: 'center',
                fontWeight: 700
              }}>
                {setupError}
              </div>
            )}

            <form onSubmit={handleSetupSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="e.g. Ashwin Annamalai"
                  required
                  style={{ 
                    width: '100%', 
                    padding: '12px 14px', 
                    background: '#ffffff', 
                    border: '2px solid #111111', 
                    borderRadius: '4px', 
                    color: '#111111', 
                    outline: 'none', 
                    boxSizing: 'border-box',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={e => {
                    e.target.style.transform = 'translate(-2px, -2px)';
                    e.target.style.boxShadow = '3px 3px 0px #111';
                  }}
                  onBlur={e => {
                    e.target.style.transform = 'none';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                  Department Domain
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                  {['Academic Couselling Team', 'Accounts & Developement Team', 'Business Development Team'].map((dom) => {
                    const isSelected = selectedSetupDomain === dom;
                    return (
                      <div
                        key={dom}
                        onClick={() => setSelectedSetupDomain(dom)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px 14px',
                          background: isSelected ? '#111111' : '#ffffff',
                          border: '2px solid #111111',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          fontWeight: 800,
                          transform: isSelected ? 'translate(-2px, -2px)' : 'none',
                          boxShadow: isSelected ? '3px 3px 0px #111' : 'none'
                        }}
                      >
                        <span style={{ flex: 1, color: isSelected ? '#ffffff' : '#111111', fontSize: '0.92rem', textTransform: 'uppercase' }}>{dom}</span>
                        {isSelected && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffffff' }}></span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#111111', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                  Workplace Branch
                </label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '0.6rem' 
                }}>
                  {['Maduravoyal', 'Porur', 'Mettur', 'Tiruvannamalai'].map((br) => {
                    const isSelected = selectedSetupBranch === br;
                    return (
                      <div
                        key={br}
                        onClick={() => setSelectedSetupBranch(br)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '12px 8px',
                          background: isSelected ? '#111111' : '#ffffff',
                          border: '2px solid #111111',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          textAlign: 'center',
                          color: isSelected ? '#ffffff' : '#111111',
                          textTransform: 'uppercase',
                          transform: isSelected ? 'translate(-2px, -2px)' : 'none',
                          boxShadow: isSelected ? '3px 3px 0px #111' : 'none'
                        }}
                      >
                        {br}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={setupLoading || !profileName.trim() || !selectedSetupDomain || !selectedSetupBranch}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#111111',
                  border: '2px solid #111111',
                  outline: 'none',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '1rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: '3px 3px 0px #111',
                  transition: 'all 0.2s ease',
                  marginTop: '0.5rem',
                  textTransform: 'uppercase'
                }}
                onMouseEnter={e => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.color = '#111111';
                    e.currentTarget.style.transform = 'translate(-2px, -2px)';
                    e.currentTarget.style.boxShadow = '5px 5px 0px #111';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#111111';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '3px 3px 0px #111';
                }}
              >
                {setupLoading ? 'Saving Profile...' : 'Save & Enter Workspace'}
              </button>
            </form>
          </div>
        </div>
      )}
      {showGpsWarning && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h3 className="modal-title" style={{ fontSize: '1.4rem', color: '#b45309' }}>GPS Location Verification</h3>
            <p className="modal-desc" style={{ marginBottom: '1.5rem' }}>
              Would you like to upload these photos with GPS location enabled? Enabling GPS helps verify the location coordinates of your field visit automatically.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => handleGpsChoice(true)}
                style={{
                  padding: '10px 18px',
                  background: '#111111',
                  color: '#ffffff',
                  border: '2px solid #111111',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '3px 3px 0px #111',
                  transition: 'all 0.15s ease'
                }}
              >
                Yes, Enable GPS
              </button>
              <button
                onClick={() => handleGpsChoice(false)}
                style={{
                  padding: '10px 18px',
                  background: '#ffffff',
                  color: '#111111',
                  border: '2px solid #111111',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '3px 3px 0px #111',
                  transition: 'all 0.15s ease'
                }}
              >
                No, Continue Without GPS
              </button>
            </div>
          </div>
        </div>
      )}
      {showDetailsModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h3 className="modal-title" style={{ fontSize: '1.4rem' }}>Visit Details</h3>
            <p className="modal-desc" style={{ marginBottom: '1.25rem' }}>
              Please enter the location details and the date/time of your field visit to complete the submission.
            </p>
            <form onSubmit={handleBdSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  📍 Visit Location / School Name
                </label>
                <input 
                  type="text" 
                  value={bdLocation} 
                  onChange={e => setBdLocation(e.target.value)}
                  placeholder="e.g. Greenwood High School, Bangalore" 
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '0.9rem',
                    border: '2px solid #111111',
                    borderRadius: '4px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  📅 Date & Time of Visit
                </label>
                <input 
                  type="datetime-local" 
                  value={bdDateTime} 
                  onChange={e => setBdDateTime(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '0.9rem',
                    border: '2px solid #111111',
                    borderRadius: '4px',
                    outline: 'none'
                  }}
                />
              </div>

              {bdError && (
                <div className="alert alert-danger" style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                  {bdError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={bdLoading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#111111',
                    color: '#ffffff',
                    border: '2px solid #111111',
                    borderRadius: '4px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '3px 3px 0px #111',
                    textTransform: 'uppercase',
                    fontSize: '0.85rem'
                  }}
                >
                  {bdLoading ? 'Submitting...' : 'Submit Report'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setBdPhotos([]);
                  }}
                  style={{
                    padding: '12px 18px',
                    background: '#ffffff',
                    color: '#111111',
                    border: '2px solid #111111',
                    borderRadius: '4px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '3px 3px 0px #111',
                    textTransform: 'uppercase',
                    fontSize: '0.85rem'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {activePreviewImage && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 100000, background: 'rgba(0, 0, 0, 0.85)' }}
          onClick={() => setActivePreviewImage(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setActivePreviewImage(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'none',
                border: 'none',
                color: '#ffffff',
                fontSize: '2rem',
                cursor: 'pointer'
              }}
            >
              &times;
            </button>
            <img 
              src={activePreviewImage} 
              alt="Fullscreen Preview" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '90vh', 
                objectFit: 'contain',
                border: '3px solid #ffffff',
                borderRadius: '4px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
              }} 
            />
          </div>
        </div>
      )}
      {/* iOS Apple style Alert Popup Dialog */}
      {iosAlert && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            width: '270px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            borderRadius: '14px',
            textAlign: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'scaleIn 0.25s cubic-bezier(0.1, 0.8, 0.25, 1)'
          }}>
            <div style={{ padding: '1.25rem 1rem 1rem 1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#000', margin: 0 }}>
                {iosAlert.title}
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#333', marginTop: '0.35rem', marginBottom: 0, lineHeight: 1.35 }}>
                {iosAlert.message}
              </p>
            </div>
            
            <div style={{ display: 'flex', borderTop: '0.5px solid rgba(0, 0, 0, 0.15)' }}>
              {iosAlert.type === 'confirm' && (
                <button 
                  onClick={iosAlert.onCancel}
                  style={{
                    flex: 1,
                    padding: '0.75rem 0.5rem',
                    border: 'none',
                    background: 'none',
                    fontSize: '1rem',
                    color: '#007aff',
                    cursor: 'pointer',
                    outline: 'none',
                    fontWeight: 400,
                    borderRight: '0.5px solid rgba(0, 0, 0, 0.15)'
                  }}
                >
                  Cancel
                </button>
              )}
              <button 
                onClick={iosAlert.onConfirm}
                style={{
                  flex: 1,
                  padding: '0.75rem 0.5rem',
                  border: 'none',
                  background: 'none',
                  fontSize: '1rem',
                  color: '#007aff',
                  cursor: 'pointer',
                  outline: 'none',
                  fontWeight: 600
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDashboard;
