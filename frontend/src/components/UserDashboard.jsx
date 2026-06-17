import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, FileSpreadsheet, Clock, Phone, PhoneCall, PhoneIncoming, 
  PhoneMissed, AlertCircle, Calendar, Download, CheckSquare, Square, Check
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';

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
  
  // Profile Setup States
  const [showSetupModal, setShowSetupModal] = useState((user?.domain === 'Pending' || user?.branch === 'Pending') && !previewMode);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [selectedSetupDomain, setSelectedSetupDomain] = useState('');
  const [selectedSetupBranch, setSelectedSetupBranch] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');

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
      const res = await fetch('/api/users/update-profile', {
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
    fetchHistory();
    fetchTasks();
  }, [token]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/calls/history', {
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
      const res = await fetch('/api/tasks', {
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
      const res = await fetch('/api/calls/upload', {
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

  // Toggle Task Status
  const handleToggleTask = async (taskId, currentStatus) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/toggle`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ isCompleted: !currentStatus })
      });
      if (res.ok) {
        // Optimistic UI update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: !currentStatus } : t));
      }
    } catch (err) {
      console.error('Error toggling task:', err);
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
          <div className="user-avatar">{user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}</div>
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
              <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--gradient-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Calendar size={18} color="var(--primary)" />
                      Call Logs Analysis: {selectedLog.callDate}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Uploaded on {new Date(selectedLog.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {previewMode && (
                    <a 
                      href={`/api/calls/download/${selectedLog.id}`} 
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
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="Dialed" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Incoming" fill="var(--success)" radius={[4, 4, 0, 0]} />
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
                          <Tooltip />
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
                {tasks.map(task => (
                  <li key={task.id} className={`todo-item ${task.isCompleted ? 'completed' : ''}`}>
                    <input 
                      type="checkbox" 
                      className="todo-checkbox" 
                      checked={task.isCompleted} 
                      onChange={() => handleToggleTask(task.id, task.isCompleted)}
                      disabled={previewMode}
                    />
                    <div className="todo-details">
                      <div className="todo-item-title">{task.title}</div>
                      {task.description && <div className="todo-item-desc">{task.description}</div>}
                      <span className={`todo-badge ${task.isDomainTask ? 'domain' : 'personal'}`}>
                        {task.isDomainTask ? `${task.assignedTo} task` : 'Personal'}
                      </span>
                    </div>
                  </li>
                ))}
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
                      border: '1px solid var(--border-light)',
                      borderRadius: '10px',
                      marginBottom: '0.5rem',
                      cursor: 'pointer',
                      background: selectedLog?.id === log.id ? 'var(--primary-light)' : 'transparent',
                      color: selectedLog?.id === log.id ? 'var(--primary)' : 'inherit',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Log Date: {log.callDate}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
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
      {/* 2030 Futuristic Profile Setup Modal */}
      {showSetupModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(11, 15, 25, 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="futuristic-card" style={{
            background: 'rgba(17, 24, 39, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: '2.5rem',
            width: '460px',
            maxWidth: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            color: '#ffffff',
            boxSizing: 'border-box'
          }}>
            <h2 style={{ 
              fontSize: '1.8rem', 
              fontWeight: 800, 
              margin: '0 0 0.5rem 0', 
              background: 'linear-gradient(135deg, #ffffff 30%, #a5b4fc 100%)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              fontFamily: "'Outfit', sans-serif" 
            }}>
              Complete Your Profile
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: '0 0 1.5rem 0' }}>
              Confirm your display name and choose your department domain to configure your new workspace.
            </p>

            {setupError && (
              <div style={{ 
                background: 'rgba(220, 38, 38, 0.15)', 
                border: '1px solid rgba(220, 38, 38, 0.3)', 
                color: '#f87171', 
                borderRadius: '12px', 
                padding: '10px', 
                fontSize: '0.85rem', 
                marginBottom: '1.5rem', 
                textAlign: 'center' 
              }}>
                {setupError}
              </div>
            )}

            <form onSubmit={handleSetupSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
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
                    padding: '14px', 
                    background: 'rgba(31, 41, 55, 0.4)', 
                    border: '1px solid rgba(255, 255, 255, 0.08)', 
                    borderRadius: '12px', 
                    color: '#ffffff', 
                    outline: 'none', 
                    boxSizing: 'border-box',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Department Domain
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                  {['Sales', 'Accounts', 'Support', 'HR', 'Operations'].map((dom) => {
                    const isSelected = selectedSetupDomain === dom;
                    return (
                      <div
                        key={dom}
                        onClick={() => setSelectedSetupDomain(dom)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px 14px',
                          background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(31, 41, 55, 0.4)',
                          border: `1px solid ${isSelected ? '#6366f1' : 'rgba(255, 255, 255, 0.08)'}`,
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontWeight: isSelected ? 600 : 500
                        }}
                      >
                        <span style={{ flex: 1, color: isSelected ? '#ffffff' : '#e5e7eb', fontSize: '0.9rem' }}>{dom}</span>
                        {isSelected && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 8px #6366f1' }}></span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
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
                          background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(31, 41, 55, 0.4)',
                          border: `1px solid ${isSelected ? '#6366f1' : 'rgba(255, 255, 255, 0.08)'}`,
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontWeight: isSelected ? 600 : 500,
                          fontSize: '0.85rem',
                          textAlign: 'center',
                          color: isSelected ? '#ffffff' : '#e5e7eb'
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
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '1rem',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 10px 20px -10px rgba(99, 102, 241, 0.4)',
                  transition: 'all 0.3s',
                  marginTop: '0.5rem'
                }}
              >
                {setupLoading ? 'Saving Profile...' : 'Save & Enter Workspace'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDashboard;
