import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, FileSpreadsheet, PlusCircle, CheckCircle, Clock, 
  PhoneCall, AlertTriangle, Download, ArrowRight, ClipboardList, Settings, RotateCcw,
  ChevronUp, ChevronDown, ChevronsUpDown, FileText, Folder, FolderOpen, RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  LineChart, Line
} from 'recharts';
import API_BASE from '../api';

function AdminDashboard({ user, token }) {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  
  // Attendance State
  const [selectedAttendanceUserId, setSelectedAttendanceUserId] = useState('');
  const [attendanceData, setAttendanceData] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  
  // Active Admin Sub-View: 'leaderboard' | 'aggregate' | 'assign' | 'attendance'
  const [adminTab, setAdminTab] = useState('leaderboard');
  
  // Filter state for Aggregations: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  const [aggPeriod, setAggPeriod] = useState('monthly');
  
  // Task Assignment form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignee, setTaskAssignee] = useState(''); // can be userId or domain name
  const [taskSuccess, setTaskSuccess] = useState('');
  const [taskError, setTaskError] = useState('');

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [editSuccess, setEditSuccess] = useState('');
  const [editError, setEditError] = useState('');

  // Leaderboard Sort State
  const [sortKey, setSortKey] = useState('talkTimeSecs');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' or 'desc'

  // Database Flush State
  const [flushSuccess, setFlushSuccess] = useState('');
  const [flushError, setFlushError] = useState('');
  const [flushLoading, setFlushLoading] = useState(false);

  // Cloudinary to Base64 Migration State
  const [migrateSuccess, setMigrateSuccess] = useState('');
  const [migrateError, setMigrateError] = useState('');
  const [migrateLoading, setMigrateLoading] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(null);

  // Download loading states: { [logId_type]: true/false }
  const [downloadingStates, setDownloadingStates] = useState({});

  // Reports Directory: which employee accordion sections are expanded
  const [expandedEmployees, setExpandedEmployees] = useState({});
  // Aggregate download loading per userId
  const [aggregateLoading, setAggregateLoading] = useState({});

  // Fetch Admin Data
  useEffect(() => {
    fetchUsers();
    fetchLogs();
    fetchTasks();
  }, [token]);

  // Auto-detect running migration on Settings Tab mount
  useEffect(() => {
    if (adminTab === 'settings') {
      const checkStatus = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/admin/migration-status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.inProgress) {
              setMigrateLoading(true);
              setMigrationProgress(data);
              pollMigrationStatus();
            }
          }
        } catch (err) {
          console.error(err);
        }
      };
      checkStatus();
    }
    return () => {
      if (window.migrationIntervalId) {
        clearInterval(window.migrationIntervalId);
        window.migrationIntervalId = null;
      }
    };
  }, [adminTab, token]);

  // Fetch Attendance when user changes
  useEffect(() => {
    if (selectedAttendanceUserId) {
      fetchAttendance(selectedAttendanceUserId);
    } else {
      setAttendanceData(null);
    }
  }, [selectedAttendanceUserId]);

  const fetchAttendance = async (userId) => {
    setAttendanceLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/attendance/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAttendanceData(data);
      }
    } catch (err) {
      console.error('Error fetching attendance:', err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const fetchTasks = async () => {
    // Admin can see all tasks
    try {
      const res = await fetch(`${API_BASE}/api/admin/tasks`, {
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

  const handleDeleteUser = async (userId, userName) => {
    if (userId === user.id) {
      alert("You cannot delete your own administrator account.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete telecaller "${userName}" and all their call history? This action is irreversible.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        // Refresh local data
        fetchUsers();
        fetchLogs();
        fetchTasks();
        // Clear selected attendance if that user was deleted
        if (selectedAttendanceUserId === userId) {
          setSelectedAttendanceUserId('');
        }
      } else {
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('An error occurred while deleting the user.');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setEditSuccess('');
    setEditError('');

    if (!editingUser.name || !editingUser.domain || !editingUser.role || !editingUser.email || !editingUser.branch) {
      setEditError('All fields are required.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editingUser.name,
          email: editingUser.email,
          domain: editingUser.domain,
          role: editingUser.role,
          branch: editingUser.branch
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      setEditSuccess('User updated successfully!');
      
      // Close modal after a brief delay
      setTimeout(() => {
        setEditingUser(null);
        setEditSuccess('');
      }, 1000);

      // Refresh list
      fetchUsers();
      fetchLogs();
    } catch (err) {
      setEditError(err.message);
    }
  };

  const handleAssignTask = async (e) => {
    e.preventDefault();
    setTaskSuccess('');
    setTaskError('');

    if (!taskTitle || !taskAssignee) {
      setTaskError('Please fill in task title and select an assignee.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/assign-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDesc,
          assignedTo: taskAssignee
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to assign task');
      }

      setTaskSuccess('Task assigned successfully!');
      setTaskTitle('');
      setTaskDesc('');
      setTaskAssignee('');
      
      // Refresh task list
      fetchTasks();
    } catch (err) {
      setTaskError(err.message);
    }
  };

  const handleFlushDatabase = async () => {
    if (!window.confirm("WARNING: Are you sure you want to flush/reset the database? This will delete all users (except you), all attendance logs, and all task logs. This action is IRREVERSIBLE.")) {
      return;
    }

    setFlushLoading(true);
    setFlushSuccess('');
    setFlushError('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/flush-database`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to flush database');
      }

      setFlushSuccess('Database flushed successfully! Redirecting you to re-login...');
      
      // Since everything is flushed, sign the admin out so they can log back in and re-seed the admin user
      setTimeout(() => {
        localStorage.removeItem('token');
        window.location.reload();
      }, 3000);
    } catch (err) {
      setFlushError(err.message);
    } finally {
      setFlushLoading(false);
    }
  };

  const pollMigrationStatus = () => {
    if (window.migrationIntervalId) {
      clearInterval(window.migrationIntervalId);
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/migration-status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        
        setMigrationProgress(data);
        
        if (!data.inProgress) {
          clearInterval(interval);
          window.migrationIntervalId = null;
          setMigrateLoading(false);
          setMigrateSuccess(`Migration finished! Total logs processed: ${data.total}. Migrated: ${data.successCount}. Already up-to-date: ${data.alreadyMigrated}. Errors: ${data.errorCount}.`);
        }
      } catch (err) {
        console.error('Error polling migration status:', err);
      }
    }, 1500);

    window.migrationIntervalId = interval;
  };

  const handleMigrateToBase64 = async () => {
    if (!window.confirm("Are you sure you want to migrate Cloudinary/Firebase links to Base64 in Firestore? This might take a few minutes if you have many logs. Make sure Cloudinary has PDF delivery restriction disabled!")) {
      return;
    }

    setMigrateLoading(true);
    setMigrateSuccess('');
    setMigrateError('');
    setMigrationProgress({
      inProgress: true,
      total: 0,
      current: 0,
      successCount: 0,
      alreadyMigrated: 0,
      errorCount: 0,
      errors: []
    });

    try {
      const res = await fetch(`${API_BASE}/api/admin/migrate-to-base64`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start migration');
      }

      pollMigrationStatus();
    } catch (err) {
      setMigrateError(err.message);
      setMigrateLoading(false);
      setMigrationProgress(null);
    }
  };

  // Helper: Format seconds to string
  const formatSeconds = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  // Authenticated file action: opens PDF inline or downloads Excel
  const handleFileAction = async (logId, type) => {
    const key = `${logId}_${type}`;
    setDownloadingStates(prev => ({ ...prev, [key]: true }));
    try {
      const endpoint = type === 'pdf' ? `${API_BASE}/api/calls/pdf/${logId}` : `${API_BASE}/api/calls/download/${logId}`;
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || `Failed to load ${type.toUpperCase()}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (type === 'pdf') {
        // Open PDF in a new browser tab for viewing
        window.open(url, '_blank');
      } else {
        // Trigger download for Excel
        const a = document.createElement('a');
        const contentDisposition = res.headers.get('Content-Disposition') || '';
        const filenameMatch = contentDisposition.match(/filename="(.+?)"/);
        a.download = filenameMatch ? filenameMatch[1] : `CallLog_${logId}.xlsx`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      alert(`Error accessing ${type.toUpperCase()}: ${err.message}`);
    } finally {
      setDownloadingStates(prev => ({ ...prev, [key]: false }));
    }
  };

  // Toggle employee accordion in Reports Directory
  const toggleEmployee = (userId) => {
    setExpandedEmployees(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Download aggregate Excel for a single user (all their dates combined)
  const handleAggregateDownload = async (userId, userName) => {
    setAggregateLoading(prev => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/calls/aggregate-excel/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to generate aggregate report');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="(.+?)"/);
      a.download = match ? match[1] : `${userName.replace(/\s+/g,'_')}_Aggregate_Report.xlsx`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setAggregateLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  // Helper: Get employee productivity metrics
  const getEmployeeLeaderboard = () => {
    // Group logs by user
    const leaderboard = users.map(u => {
      const userLogs = logs.filter(l => l.userId === u.id);
      const totalCalls = userLogs.reduce((sum, l) => sum + l.summary.grand_total, 0);
      const totalTalkSecs = userLogs.reduce((sum, l) => sum + l.summary.talk_time_secs, 0);
      const totalIdleSecs = userLogs.reduce((sum, l) => sum + l.summary.total_idle_secs, 0);
      const totalUploads = userLogs.length;

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        domain: u.domain,
        role: u.role || 'user',
        uploads: totalUploads,
        totalCalls,
        talkTimeStr: formatSeconds(totalTalkSecs),
        idleTimeStr: formatSeconds(totalIdleSecs),
        talkTimeSecs: totalTalkSecs,
        idleTimeSecs: totalIdleSecs,
        avgCallsPerLog: totalUploads > 0 ? Math.round(totalCalls / totalUploads) : 0
      };
    });

    // Sort by the selected key and direction
    return leaderboard.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ colKey }) => {
    if (sortKey !== colKey) return <ChevronsUpDown size={13} style={{ opacity: 0.4, verticalAlign: 'middle', marginLeft: '3px' }} />;
    return sortDir === 'asc'
      ? <ChevronUp size={13} style={{ color: 'var(--primary)', verticalAlign: 'middle', marginLeft: '3px' }} />
      : <ChevronDown size={13} style={{ color: 'var(--primary)', verticalAlign: 'middle', marginLeft: '3px' }} />;
  };

  // Helper: Get Aggregated Reports (Monthly, Daily, Weekly, Quarterly, Yearly)
  const getAggregatedData = () => {
    const aggregated = {};

    logs.forEach(log => {
      // Parse call date string "26 Mar 2026"
      // Let's extract year, month, and week
      let periodKey = '';
      let dateObj = new Date(log.createdAt); // Fallback to upload time if date parsing is messy
      
      try {
        const parts = log.callDate.split(' ');
        const day = parseInt(parts[0]);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthIdx = monthNames.indexOf(parts[1]);
        const year = parseInt(parts[2]);
        if (monthIdx !== -1 && year > 0) {
          dateObj = new Date(year, monthIdx, day);
        }
      } catch (err) {}

      const year = dateObj.getFullYear();
      const month = dateObj.getMonth(); // 0-11
      const monthName = dateObj.toLocaleString('default', { month: 'short' });

      if (aggPeriod === 'daily') {
        periodKey = log.callDate; // e.g. "26 Mar 2026"
      } else if (aggPeriod === 'weekly') {
        // Calculate week number
        const oneJan = new Date(dateObj.getFullYear(), 0, 1);
        const numberOfDays = Math.floor((dateObj - oneJan) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((dateObj.getDay() + 1 + numberOfDays) / 7);
        periodKey = `Week ${weekNum}, ${year}`;
      } else if (aggPeriod === 'monthly') {
        periodKey = `${monthName} ${year}`;
      } else if (aggPeriod === 'quarterly') {
        const quarter = Math.floor(month / 3) + 1;
        periodKey = `Q${quarter} ${year}`;
      } else if (aggPeriod === 'yearly') {
        periodKey = `${year}`;
      }

      if (!aggregated[periodKey]) {
        aggregated[periodKey] = {
          period: periodKey,
          dialed: 0,
          incoming: 0,
          missed: 0,
          total: 0,
          talkTime: 0,
          idleTime: 0,
          logCount: 0
        };
      }

      const sum = log.summary;
      aggregated[periodKey].dialed += sum.total_dialed;
      aggregated[periodKey].incoming += sum.total_incoming;
      aggregated[periodKey].missed += sum.total_missed;
      aggregated[periodKey].total += sum.grand_total;
      aggregated[periodKey].talkTime += sum.talk_time_secs;
      aggregated[periodKey].idleTime += sum.total_idle_secs;
      aggregated[periodKey].logCount += 1;
    });

    // Convert to array and sort chronologically/alphabetically (since keys are structured nicely)
    return Object.values(aggregated);
  };

  const aggregatedList = getAggregatedData();
  const leaderboard = getEmployeeLeaderboard();

  return (
    <div>
      {/* Banner */}
      <div className="header-banner">
        <div className="header-user-profile">
          <div className="user-avatar" style={{ background: 'var(--gradient-danger)' }}>AD</div>
          <div>
            <div className="user-meta-name">Administrator Control Panel</div>
            <div className="user-meta-domain" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>Role: Global Administrator</div>
          </div>
        </div>
        <div>
          <span>System Portal: Light Mode</span>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="tabs-header">
        <button 
          onClick={() => setAdminTab('leaderboard')} 
          className={`tab-btn ${adminTab === 'leaderboard' ? 'active' : ''}`}
        >
          <Users size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Analytics
        </button>
        <button 
          onClick={() => setAdminTab('attendance')} 
          className={`tab-btn ${adminTab === 'attendance' ? 'active' : ''}`}
        >
          <Calendar size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Attendance
        </button>
        <button 
          onClick={() => setAdminTab('aggregate')} 
          className={`tab-btn ${adminTab === 'aggregate' ? 'active' : ''}`}
        >
          <FileSpreadsheet size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Aggregates
        </button>
        <button 
          onClick={() => setAdminTab('reports')} 
          className={`tab-btn ${adminTab === 'reports' ? 'active' : ''}`}
        >
          <Folder size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Directory
        </button>
        <button 
          onClick={() => setAdminTab('assign')} 
          className={`tab-btn ${adminTab === 'assign' ? 'active' : ''}`}
        >
          <ClipboardList size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Assign Tasks
        </button>
        <button 
          onClick={() => setAdminTab('settings')} 
          className={`tab-btn ${adminTab === 'settings' ? 'active' : ''}`}
        >
          <Settings size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Settings
        </button>
      </div>

      {/* SUB-VIEW 1: Employee Productivity Leaderboard */}
      {adminTab === 'leaderboard' && (
        <div>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon primary"><Users size={20} /></div>
              <div>
                <div className="kpi-label">Registered Telecallers</div>
                <div className="kpi-value">{users.filter(u => u.role !== 'admin').length}</div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon success"><FileSpreadsheet size={20} /></div>
              <div>
                <div className="kpi-label">Total Logs Analyzed</div>
                <div className="kpi-value">{logs.length}</div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon secondary"><PhoneCall size={20} /></div>
              <div>
                <div className="kpi-label">Combined Daily Calls</div>
                <div className="kpi-value">{logs.reduce((sum, l) => sum + l.summary.grand_total, 0)}</div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon warning"><Clock size={20} /></div>
              <div>
                <div className="kpi-label">Combined Talk Time</div>
                <div className="kpi-value">{formatSeconds(logs.reduce((sum, l) => sum + l.summary.talk_time_secs, 0))}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title-bar">
              <h3>Employee Productivity Report</h3>
            </div>
            
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th className="name-col" onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Employee <SortIcon colKey="name" />
                    </th>
                    <th className="email-col" onClick={() => handleSort('email')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Email <SortIcon colKey="email" />
                    </th>
                    <th onClick={() => handleSort('domain')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Domain <SortIcon colKey="domain" />
                    </th>
                    <th>Branch</th>
                    <th onClick={() => handleSort('uploads')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Logs <SortIcon colKey="uploads" />
                    </th>
                    <th onClick={() => handleSort('totalCalls')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Calls <SortIcon colKey="totalCalls" />
                    </th>
                    <th onClick={() => handleSort('avgCallsPerLog')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Avg/Day <SortIcon colKey="avgCallsPerLog" />
                    </th>
                    <th onClick={() => handleSort('talkTimeSecs')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Talk Time <SortIcon colKey="talkTimeSecs" />
                    </th>
                    <th onClick={() => handleSort('idleTimeSecs')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Idle Time <SortIcon colKey="idleTimeSecs" />
                    </th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.filter(u => u.email !== user.email).map(emp => (
                    <tr key={emp.id}>
                      <td className="name-col" style={{ fontWeight: 600 }}>{emp.name}</td>
                      <td className="email-col">{emp.email}</td>
                      <td><span className="badge badge-primary">{emp.domain}</span></td>
                      <td>
                        <span 
                          className="badge badge-success" 
                          style={{ 
                            background: emp.branch === 'Pending' || !emp.branch ? 'var(--danger-light)' : 'var(--success-light)', 
                            color: emp.branch === 'Pending' || !emp.branch ? 'var(--danger)' : 'var(--success)' 
                          }}
                        >
                          {emp.branch || 'Pending'}
                        </span>
                      </td>
                      <td>{emp.uploads}</td>
                      <td>{emp.totalCalls}</td>
                      <td>{emp.avgCallsPerLog}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>{emp.talkTimeStr}</td>
                      <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{emp.idleTimeStr}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn btn-outline" 
                          onClick={() => setEditingUser({ id: emp.id, name: emp.name, email: emp.email, domain: emp.domain, branch: emp.branch || 'Pending', role: emp.role })}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', marginRight: '0.5rem' }}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-danger" 
                          onClick={() => handleDeleteUser(emp.id, emp.name)}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--danger)', color: '#fff', border: 'none' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {leaderboard.filter(u => u.email !== user.email).length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No employee records found in system database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW: Attendance Reports */}
      {adminTab === 'attendance' && (
        <div>
          {/* Employee Selector */}
          <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label className="form-label" style={{ margin: 0 }}>Select Employee:</label>
            <select 
              className="form-select" 
              value={selectedAttendanceUserId}
              onChange={e => setSelectedAttendanceUserId(e.target.value)}
              style={{ maxWidth: '300px', margin: 0 }}
            >
              <option value="">-- Choose Employee --</option>
              {users.filter(u => u.role !== 'admin').map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          {attendanceLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <div className="spinner"></div>
            </div>
          ) : attendanceData ? (
            <div>
              {/* Summary KPIs */}
              <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="kpi-card">
                  <div className="kpi-icon primary"><Calendar size={20} /></div>
                  <div>
                    <div className="kpi-label">Present Days</div>
                    <div className="kpi-value">{attendanceData.summary.presentDays}</div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon danger"><AlertTriangle size={20} /></div>
                  <div>
                    <div className="kpi-label">Absent Days</div>
                    <div className="kpi-value">{attendanceData.summary.absentDays}</div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon warning"><Clock size={20} /></div>
                  <div>
                    <div className="kpi-label">Holidays (Sundays)</div>
                    <div className="kpi-value">{attendanceData.summary.holidays}</div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon success"><CheckCircle size={20} /></div>
                  <div>
                    <div className="kpi-label">Attendance Rate</div>
                    <div className="kpi-value">
                      {Math.round((attendanceData.summary.presentDays / attendanceData.summary.workingDays) * 100) || 0}%
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                        {attendanceData.summary.workingDays} Workdays
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendance Details Table */}
              <div className="card">
                <div className="card-title-bar">
                  <h3>Daily Attendance Log</h3>
                </div>
                
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Clock In</th>
                        <th>Clock Out</th>
                        <th>Span</th>
                        <th>Net Hours</th>
                        <th>Talk Time</th>
                        <th>Calls</th>
                        <th>PDF</th>
                        <th>Excel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceData.history.map((row, idx) => {
                        let badgeClass = 'badge-success';
                        if (row.status === 'Absent') badgeClass = 'badge-danger';
                        if (row.status === 'Holiday') badgeClass = 'badge-warning';

                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{row.date}</td>
                            <td><span className={`badge ${badgeClass}`}>{row.status}</span></td>
                            <td style={{ fontWeight: row.status === 'Present' ? 600 : 400 }}>{row.arrival}</td>
                            <td style={{ fontWeight: row.status === 'Present' ? 600 : 400 }}>{row.departure}</td>
                            <td>{row.duration}</td>
                            <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{row.netWorkHours || '-'}</td>
                            <td>{row.talkTime}</td>
                            <td>{row.calls}</td>
                            <td>
                              {row.status === 'Present' && row.logId && (
                                <button
                                  onClick={() => handleFileAction(row.logId, 'pdf')}
                                  disabled={downloadingStates[`${row.logId}_pdf`] || !(row.hasPdf || row.pdfUrl)}
                                  className="btn btn-outline" 
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px', opacity: (row.hasPdf || row.pdfUrl) ? 1 : 0.4, cursor: (row.hasPdf || row.pdfUrl) ? 'pointer' : 'not-allowed' }}
                                  title={(row.hasPdf || row.pdfUrl) ? 'View PDF' : 'No PDF available'}
                                >
                                  <FileText size={12} />
                                  {downloadingStates[`${row.logId}_pdf`] ? '...' : 'PDF'}
                                </button>
                              )}
                            </td>
                            <td>
                              {row.status === 'Present' && row.logId && (
                                <button
                                  onClick={() => handleFileAction(row.logId, 'excel')}
                                  disabled={downloadingStates[`${row.logId}_excel`]}
                                  className="btn btn-outline" 
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                >
                                  <Download size={12} />
                                  {downloadingStates[`${row.logId}_excel`] ? 'Loading...' : 'Excel'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '3rem 1rem', textText: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <h3>No employee selected</h3>
              <p style={{ marginTop: '0.5rem' }}>Please choose a telecaller from the dropdown above to load their attendance and clock logs.</p>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 2: Aggregate Call Reports (Charts & Exports) */}
      {adminTab === 'aggregate' && (
        <div>
          {/* Controls */}
          <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Aggregate Period:</span>
              <div style={{ display: 'flex', border: '1px solid var(--border-light)', borderRadius: '8px', overflow: 'hidden' }}>
                {['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].map(p => (
                  <button
                    key={p}
                    onClick={() => setAggPeriod(p)}
                    style={{
                      background: aggPeriod === p ? 'var(--primary-light)' : 'transparent',
                      color: aggPeriod === p ? 'var(--primary)' : 'var(--text-secondary)',
                      border: 'none',
                      padding: '0.4rem 0.8rem',
                      cursor: 'pointer',
                      fontWeight: aggPeriod === p ? 600 : 500,
                      fontSize: '0.8rem',
                      textTransform: 'capitalize'
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Showing combined statistics of {logs.length} logged files.
            </div>
          </div>

          {/* Aggregated Chart */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div className="card-title-bar">
              <h3>Aggregate Calls Trend</h3>
            </div>
            {aggregatedList.length > 0 ? (
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={aggregatedList}>
                    <XAxis dataKey="period" stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                    <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#ffffff', border: '2px solid #111111', borderRadius: '4px', color: '#111111', fontWeight: '700' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="dialed" name="Dialed Calls" fill="var(--primary)" stackId="a" />
                    <Bar dataKey="incoming" name="Incoming Calls" fill="var(--success)" stackId="a" />
                    <Bar dataKey="missed" name="Missed Calls" fill="var(--danger)" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                No aggregated data available. Upload call log files to compute trends.
              </div>
            )}
          </div>

          {/* Reports Table & Downloads */}
          <div className="card">
            <div className="card-title-bar">
              <h3>Aggregated Reports Directory</h3>
            </div>
            
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Compiled</th>
                    <th>Dialed</th>
                    <th>Incoming</th>
                    <th>Missed</th>
                    <th>Total</th>
                    <th>Talk Time</th>
                    <th>Idle Gaps</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedList.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{row.period}</td>
                      <td>{row.logCount} logs</td>
                      <td>{row.dialed}</td>
                      <td>{row.incoming}</td>
                      <td>{row.missed}</td>
                      <td>{row.total}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>{formatSeconds(row.talkTime)}</td>
                      <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{formatSeconds(row.idleTime)}</td>
                    </tr>
                  ))}
                  {aggregatedList.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No aggregated reports compiled yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Aggregated stats table only — individual reports moved to its own tab */}
            {aggregatedList.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                No aggregated reports compiled yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW: Reports Directory (per-employee grouped) */}
      {adminTab === 'reports' && (() => {
        // Group logs by userId
        const nonAdminUsers = users.filter(u => u.role !== 'admin');
        const logsByUser = {};
        nonAdminUsers.forEach(u => {
          logsByUser[u.id] = logs
            .filter(l => l.userId === u.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        });

        return (
          <div>
            {/* Header KPI */}
            <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="kpi-card">
                <div className="kpi-icon primary"><Users size={20} /></div>
                <div>
                  <div className="kpi-label">Telecallers with Uploads</div>
                  <div className="kpi-value">{nonAdminUsers.filter(u => (logsByUser[u.id] || []).length > 0).length}</div>
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon success"><FileSpreadsheet size={20} /></div>
                <div>
                  <div className="kpi-label">Total Call Log Files</div>
                  <div className="kpi-value">{logs.length}</div>
                </div>
              </div>
            </div>

            {nonAdminUsers.length === 0 && (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Folder size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <p>No employee records found.</p>
              </div>
            )}

            {nonAdminUsers.map(emp => {
              const empLogs = logsByUser[emp.id] || [];
              const isExpanded = !!expandedEmployees[emp.id];
              const totalCalls = empLogs.reduce((s, l) => s + (l.summary?.grand_total || 0), 0);
              const totalTalkSecs = empLogs.reduce((s, l) => s + (l.summary?.talk_time_secs || 0), 0);

              return (
                <div key={emp.id} className="card" style={{ marginBottom: '1rem', padding: 0, overflow: 'hidden' }}>
                  {/* Employee accordion header */}
                  <div
                    onClick={() => toggleEmployee(emp.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '1rem 1.25rem', cursor: 'pointer',
                      background: isExpanded ? 'var(--primary-light)' : 'var(--bg-card)',
                      borderBottom: isExpanded ? '2px solid var(--primary)' : '2px solid transparent',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {isExpanded
                        ? <FolderOpen size={20} style={{ color: 'var(--primary)' }} />
                        : <Folder size={20} style={{ color: 'var(--text-secondary)' }} />}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{emp.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {emp.email} &nbsp;·&nbsp; {emp.domain} &nbsp;·&nbsp;
                          <strong>{empLogs.length}</strong> log{empLogs.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
                          <strong>{totalCalls}</strong> total calls &nbsp;·&nbsp;
                          Talk: <strong>{formatSeconds(totalTalkSecs)}</strong>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {/* Aggregate Excel download */}
                      {empLogs.length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAggregateDownload(emp.id, emp.name); }}
                          disabled={aggregateLoading[emp.id]}
                          className="btn btn-primary"
                          style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
                          title="Download all call logs combined into one Excel file"
                        >
                          <Download size={14} />
                          {aggregateLoading[emp.id] ? 'Generating...' : 'Download Aggregate Excel'}
                        </button>
                      )}
                      {empLogs.length === 0 && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No uploads yet</span>
                      )}
                      {isExpanded
                        ? <ChevronUp size={18} style={{ color: 'var(--primary)' }} />
                        : <ChevronDown size={18} style={{ color: 'var(--text-secondary)' }} />}
                    </div>
                  </div>

                  {/* Expanded: per-date log table */}
                  {isExpanded && (
                    <div style={{ padding: '0' }}>
                      {empLogs.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No call logs uploaded by this employee yet.
                        </div>
                      ) : (
                        <div className="table-wrapper" style={{ margin: 0, borderRadius: 0 }}>
                          <table className="table" style={{ fontSize: '0.85rem', margin: 0 }}>
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Date</th>
                                <th>Dialed</th>
                                <th>Incoming</th>
                                <th>Missed</th>
                                <th>Total</th>
                                <th>Talk Time</th>
                                <th>Span</th>
                                <th>Idle</th>
                                <th>PDF</th>
                                <th>Excel</th>
                              </tr>
                            </thead>
                            <tbody>
                              {empLogs.map((log, idx) => (
                                <tr key={log.id}>
                                  <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{idx + 1}</td>
                                  <td style={{ fontWeight: 600 }}>{log.callDate}</td>
                                  <td>{log.summary?.total_dialed ?? '-'}</td>
                                  <td>{log.summary?.total_incoming ?? '-'}</td>
                                  <td>{log.summary?.total_missed ?? '-'}</td>
                                  <td style={{ fontWeight: 600 }}>{log.summary?.grand_total ?? '-'}</td>
                                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{log.summary?.talk_time_str || '-'}</td>
                                  <td>{log.summary?.workday_span_str || '-'}</td>
                                  <td style={{ color: 'var(--warning)' }}>{log.summary?.total_idle_str ? `${log.summary.total_idle_str} (${log.summary.idle_gaps_count ?? 0} gaps)` : '-'}</td>
                                  <td>
                                    <button
                                      onClick={() => handleFileAction(log.id, 'pdf')}
                                      disabled={downloadingStates[`${log.id}_pdf`] || !(log.hasPdf || log.pdfUrl)}
                                      className="btn btn-outline"
                                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '3px', opacity: (log.hasPdf || log.pdfUrl) ? 1 : 0.35, cursor: (log.hasPdf || log.pdfUrl) ? 'pointer' : 'not-allowed' }}
                                      title={(log.hasPdf || log.pdfUrl) ? 'View original PDF' : 'No PDF stored'}
                                    >
                                      <FileText size={11} />
                                      {downloadingStates[`${log.id}_pdf`] ? '...' : 'PDF'}
                                    </button>
                                  </td>
                                  <td>
                                    <button
                                      onClick={() => handleFileAction(log.id, 'excel')}
                                      disabled={downloadingStates[`${log.id}_excel`]}
                                      className="btn btn-outline"
                                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                    >
                                      <Download size={11} />
                                      {downloadingStates[`${log.id}_excel`] ? '...' : 'XLSX'}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* SUB-VIEW 3: Task Assignment Form */}
      {adminTab === 'assign' && (
        <div className="dashboard-grid-2">
          {/* Form */}
          <div className="card">
            <div className="card-title-bar">
              <h3>Assign Workload Task</h3>
            </div>
            
            {taskSuccess && <div className="alert alert-success">{taskSuccess}</div>}
            {taskError && <div className="alert alert-danger">{taskError}</div>}

            <form onSubmit={handleAssignTask}>
              <div className="form-group">
                <label className="form-label">Task Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Complete client callbacks list" 
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Task Description (Optional)</label>
                <textarea 
                  className="form-input" 
                  rows={4}
                  placeholder="Provide details of the assignment..."
                  value={taskDesc}
                  onChange={e => setTaskDesc(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assign To</label>
                <select 
                  className="form-select" 
                  value={taskAssignee}
                  onChange={e => setTaskAssignee(e.target.value)}
                  required
                >
                  <option value="">-- Select Assignee --</option>
                  
                  {/* Domains */}
                  <optgroup label="Departments (All members in domain)">
                    <option value="Sales">Sales Domain</option>
                    <option value="Accounts">Accounts Domain</option>
                    <option value="Support">Support Domain</option>
                    <option value="HR">HR Domain</option>
                    <option value="Operations">Operations Domain</option>
                  </optgroup>
                  
                  {/* Individual Users */}
                  <optgroup label="Specific Employees">
                    {users.filter(u => u.role !== 'admin').map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.email})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                <PlusCircle size={18} />
                Assign Workload Task
              </button>
            </form>
          </div>

          {/* Active Assigned Tasks list */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-title-bar">
              <h3>Active Workload Assignments ({tasks.length})</h3>
            </div>
            
            {tasks.length > 0 ? (
              <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
                {tasks.map(task => {
                  let assigneeName = task.assignedTo;
                  // If assignee is a userId, find user name
                  const targetUser = users.find(u => u.id === task.assignedTo);
                  if (targetUser) {
                    assigneeName = targetUser.name;
                  }

                  const isDomainTask = ['accounts', 'sales', 'support', 'hr', 'operations'].includes(task.assignedTo.toLowerCase());

                  return (
                    <div 
                      key={task.id} 
                      style={{ 
                        padding: '1rem', 
                        border: '1px solid var(--border-light)', 
                        borderRadius: '10px', 
                        marginBottom: '0.75rem',
                        backgroundColor: 'var(--bg-main)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{task.title}</h4>
                        {isDomainTask ? (
                          <span className="badge badge-primary">Domain: {task.assignedTo}</span>
                        ) : (
                          <span className="badge badge-success">Personal</span>
                        )}
                      </div>
                      
                      {task.description && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                          {task.description}
                        </p>
                      )}
                      
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Assigned to: <strong>{assigneeName}</strong></span>
                        {isDomainTask ? (
                          <span>Completions: {task.completions?.length || 0}</span>
                        ) : (
                          <span style={{ textTransform: 'capitalize', fontWeight: 600, color: task.status === 'completed' ? 'var(--success)' : 'var(--text-secondary)' }}>
                            {task.status}
                          </span>
                        )}
                      </div>

                      {/* Employee Stage Tracking */}
                      {(() => {
                        let assignedUsers = [];
                        if (isDomainTask) {
                          assignedUsers = users.filter(u => u.domain && u.domain.toLowerCase() === task.assignedTo.toLowerCase() && u.role !== 'admin');
                        } else {
                          const targetUser = users.find(u => u.id === task.assignedTo);
                          if (targetUser) assignedUsers = [targetUser];
                        }

                        if (assignedUsers.length === 0) return null;

                        return (
                          <div style={{ marginTop: '0.8rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.6rem' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                              Employee Progress Status:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                              {assignedUsers.map(u => {
                                const stage = task.employeeStages?.[u.id] || (isDomainTask ? 'pending' : (task.status || 'pending'));
                                let badgeBg = '#f3f4f6';
                                let badgeColor = '#4b5563';
                                if (stage === 'seen') { badgeBg = '#fef3c7'; badgeColor = '#b45309'; }
                                else if (stage === 'doing') { badgeBg = '#e0f2fe'; badgeColor = '#0369a1'; }
                                else if (stage === 'completed') { badgeBg = '#d1fae5'; badgeColor = '#047857'; }
                                
                                return (
                                  <span 
                                    key={u.id} 
                                    style={{ 
                                      fontSize: '0.7rem', 
                                      padding: '0.15rem 0.4rem', 
                                      borderRadius: '4px', 
                                      backgroundColor: badgeBg, 
                                      color: badgeColor,
                                      fontWeight: 600,
                                      border: '1px solid rgba(0,0,0,0.05)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px'
                                    }}
                                  >
                                    {u.name}: <strong style={{ textTransform: 'capitalize' }}>{stage}</strong>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                No workload tasks assigned yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 5: System Settings (Admin only) */}
      {adminTab === 'settings' && (
        <div className="card" style={{ maxWidth: '600px', margin: '2rem auto', padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              display: 'inline-flex',
              padding: '1rem',
              borderRadius: '50%',
              backgroundColor: 'var(--danger-light)',
              color: 'var(--danger)',
              marginBottom: '1rem'
            }}>
              <AlertTriangle size={32} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              System Administration Settings
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Perform administrative maintenance and system operations.
            </p>
          </div>

          <div style={{
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            padding: '1.25rem',
            backgroundColor: 'var(--bg-main)',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              Flush / Reset Database
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
              This action will completely delete all registered employees, call log records, daily stats, and workload tasks from the system. Your admin login account will be automatically re-seeded upon next login. 
            </p>
            <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 500, marginBottom: '1rem' }}>
              WARNING: This action is permanent and cannot be undone. All data stored in Firebase Firestore will be completely wiped.
            </div>

            {flushSuccess && (
              <div className="alert success-alert" style={{ marginBottom: '1rem' }}>
                <CheckCircle size={16} />
                <span>{flushSuccess}</span>
              </div>
            )}
            {flushError && (
              <div className="alert error-alert" style={{ marginBottom: '1rem' }}>
                <AlertTriangle size={16} />
                <span>{flushError}</span>
              </div>
            )}

            <button
              onClick={handleFlushDatabase}
              disabled={flushLoading}
              className="btn btn-danger"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--danger)',
                color: 'white',
                padding: '0.75rem',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: flushLoading ? 'not-allowed' : 'pointer',
                opacity: flushLoading ? 0.7 : 1
              }}
            >
              <RotateCcw size={18} />
              {flushLoading ? 'Flushing Database...' : 'Flush All Database Data'}
            </button>
          </div>

          <div style={{
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            padding: '1.25rem',
            backgroundColor: 'var(--bg-main)'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              Migrate Cloudinary & Firebase Links to Base64
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
              This will download all historical call log PDFs and Excel sheets currently stored as Cloudinary or Firebase links, convert them to inline Base64 data, and store them directly in Firestore. This fixes accessibility errors (e.g. 401 Unauthorized errors from Cloudinary).
            </p>
            <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'var(--warning-light)', color: '#856404', fontSize: '0.8rem', fontWeight: 500, marginBottom: '1rem', border: '1px solid #ffeeba' }}>
              IMPORTANT: Ensure that you have logged into Cloudinary and disabled the <strong>"Restrict PDF and ZIP files delivery"</strong> option in Settings -&gt; Security before starting the migration.
            </div>

            {/* Migration progress bar */}
            {migrationProgress && (
              <div style={{ marginBottom: '1.25rem', padding: '1rem', border: '2px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-main)' }}>
                <div style={{
                  width: '100%',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '4px',
                  height: '14px',
                  overflow: 'hidden',
                  marginBottom: '0.5rem',
                  border: '2px solid var(--border-color)',
                  boxShadow: '1px 1px 0px var(--border-color)'
                }}>
                  <div style={{
                    width: `${migrationProgress.total > 0 ? (migrationProgress.current / migrationProgress.total) * 100 : 0}%`,
                    backgroundColor: 'var(--text-primary)',
                    height: '100%',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  <span>Progress: {migrationProgress.current} / {migrationProgress.total} logs</span>
                  <span>{migrationProgress.total > 0 ? Math.round((migrationProgress.current / migrationProgress.total) * 100) : 0}%</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '0.4rem', borderRadius: '4px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                    Migrated: <span style={{ color: 'var(--success)' }}>{migrationProgress.successCount}</span>
                  </div>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '0.4rem', borderRadius: '4px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                    Skipped: <span style={{ color: 'var(--text-secondary)' }}>{migrationProgress.alreadyMigrated}</span>
                  </div>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '0.4rem', borderRadius: '4px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                    Errors: <span style={{ color: migrationProgress.errorCount > 0 ? 'var(--danger)' : 'inherit' }}>{migrationProgress.errorCount}</span>
                  </div>
                </div>

                {migrationProgress.errors && migrationProgress.errors.length > 0 && (
                  <div style={{
                    marginTop: '1rem',
                    border: '2px solid var(--border-color)',
                    backgroundColor: 'var(--danger-light)',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    boxShadow: '1px 1px 0px var(--border-color)'
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--danger)', marginBottom: '0.25rem' }}>
                      Migration Errors ({migrationProgress.errors.length}):
                    </div>
                    <div style={{
                      maxHeight: '100px',
                      overflowY: 'auto',
                      fontSize: '0.7rem',
                      lineHeight: 1.3,
                      color: 'var(--danger)'
                    }}>
                      {migrationProgress.errors.map((e, idx) => (
                        <div key={idx} style={{ marginBottom: '0.2rem', borderBottom: '1px dashed rgba(239, 68, 68, 0.2)', paddingBottom: '0.2rem' }}>
                          <strong>{e.date || 'Log'}</strong> ({e.field || 'General'}): {e.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {migrateSuccess && (
              <div className="alert success-alert" style={{ marginBottom: '1rem' }}>
                <CheckCircle size={16} />
                <span>{migrateSuccess}</span>
              </div>
            )}
            {migrateError && (
              <div className="alert error-alert" style={{ marginBottom: '1rem' }}>
                <AlertTriangle size={16} />
                <span>{migrateError}</span>
              </div>
            )}

            <button
              onClick={handleMigrateToBase64}
              disabled={migrateLoading}
              className="btn btn-primary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--text-primary)',
                color: 'white',
                padding: '0.75rem',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: migrateLoading ? 'not-allowed' : 'pointer',
                opacity: migrateLoading ? 0.7 : 1
              }}
            >
              <RefreshCw size={18} className={migrateLoading ? 'spin' : ''} />
              {migrateLoading ? 'Migrating Assets...' : 'Migrate Assets to Base64'}
            </button>
          </div>
        </div>
      )}

      {/* Edit User Modal Overlay */}
      {editingUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '500px',
            boxShadow: '6px 6px 0px 0px #111111',
            border: '2px solid #111111',
            borderRadius: '4px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div className="card-title-bar" style={{ marginBottom: '1.5rem' }}>
              <h3>Edit User Profile</h3>
              <button 
                onClick={() => setEditingUser(null)} 
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  lineHeight: 1
                }}
              >
                &times;
              </button>
            </div>

            {editSuccess && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{editSuccess}</div>}
            {editError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{editError}</div>}

            <form onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editingUser.name} 
                  onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={editingUser.email} 
                  onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Department Domain</label>
                <select 
                  className="form-select" 
                  value={editingUser.domain} 
                  onChange={e => setEditingUser({ ...editingUser, domain: e.target.value })} 
                  required
                >
                  <option value="Sales">Sales</option>
                  <option value="Accounts">Accounts</option>
                  <option value="Support">Support</option>
                  <option value="HR">HR</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Workplace Branch</label>
                <select 
                  className="form-select" 
                  value={editingUser.branch || 'Pending'} 
                  onChange={e => setEditingUser({ ...editingUser, branch: e.target.value })} 
                  required
                >
                  <option value="Pending" disabled>Pending</option>
                  <option value="Maduravoyal">Maduravoyal</option>
                  <option value="Porur">Porur</option>
                  <option value="Mettur">Mettur</option>
                  <option value="Tiruvannamalai">Tiruvannamalai</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">System Role</label>
                <select 
                  className="form-select" 
                  value={editingUser.role} 
                  onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} 
                  disabled={editingUser.id === user.id}
                  required
                >
                  <option value="user">User (Employee)</option>
                  <option value="admin">Administrator</option>
                </select>
                {editingUser.id === user.id && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    You cannot downgrade your own administrator account role.
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
