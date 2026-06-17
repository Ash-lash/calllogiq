import React, { useState, useEffect } from 'react';
import { 
  Laptop, Phone, Wifi, AlertTriangle, CheckCircle, Trash2, Edit2, 
  Download, User, Calendar, ArrowRight, Search, FileText, X, Check, UploadCloud
} from 'lucide-react';

function AssetManager({ user, token }) {
  const isUserAdmin = user.role === 'admin';
  
  // Tab states for Admin
  const [adminTab, setAdminTab] = useState('inventory'); // 'inventory', 'verifications', 'alerts', 'reports'
  
  // Loading and Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Data states
  const [assets, setAssets] = useState([]);
  const [myAssetData, setMyAssetData] = useState({
    verifiedThisMonth: false,
    latestVerification: null,
    myAssets: []
  });
  
  // Admin Data
  const [allVerifications, setAllVerifications] = useState([]);
  const [allNotifications, setAllNotifications] = useState([]);
  
  // Modal States (Add Asset modal removed as requested, keeping Edit modal for adjustments)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter report states
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  
  // --- Employee Declaration Form States ---
  const [hasLaptop, setHasLaptop] = useState(false);
  const [laptopCode, setLaptopCode] = useState('');
  const [laptopPhoto, setLaptopPhoto] = useState('');
  
  const [hasMobile, setHasMobile] = useState(false);
  const [mobileCode, setMobileCode] = useState('');
  const [mobilePhoto, setMobilePhoto] = useState('');
  
  const [hasSim, setHasSim] = useState(false);
  const [sims, setSims] = useState([{ id: 1, phoneNumber: '', provider: 'Airtel', photo: '' }]);
  
  // Upload progress states
  const [uploadingStates, setUploadingStates] = useState({});

  // --- Employee Verification Dialog States ---
  const [verificationStep, setVerificationStep] = useState(1); // 1 = Question, 2 = Yes-Follow-up, 3 = Confirm No
  const [verificationHasIssues, setVerificationHasIssues] = useState(null);
  const [repairedHandedOver, setRepairedHandedOver] = useState(null); // 'yes' or 'no'
  const [newDeviceReceived, setNewDeviceReceived] = useState(null); // 'yes' or 'no'
  const [newAssetTagId, setNewAssetTagId] = useState('');
  const [newDevicePhoto, setNewDevicePhoto] = useState('');

  // Edit Asset Form States
  const [assetForm, setAssetForm] = useState({
    assetPhoto: '',
    assetTagId: '',
    description: '',
    brand: '',
    status: 'Available',
    assignedTo: ''
  });

  const currentMonthStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"
  
  // Fetch data
  useEffect(() => {
    fetchInitialData();
  }, [token]);

  const fetchInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch user's latest verification status
      const myRes = await fetch('/api/assets/verifications/my-latest', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (myRes.ok) {
        const myData = await myRes.json();
        setMyAssetData(myData);
        
        // Prefill declaration forms if user has assigned assets
        if (myData.myAssets && myData.myAssets.length > 0) {
          const laptop = myData.myAssets.find(a => a.assetTagId.startsWith('L') || a.description.toLowerCase().includes('laptop'));
          const mobile = myData.myAssets.find(a => a.assetTagId.startsWith('M') || a.description.toLowerCase().includes('mobile'));
          const simsList = myData.myAssets.filter(a => a.assetTagId.startsWith('SIM') || a.description.toLowerCase().includes('sim'));
          
          if (laptop) {
            setHasLaptop(true);
            setLaptopCode(laptop.assetTagId);
            setLaptopPhoto(laptop.assetPhoto || '');
          }
          if (mobile) {
            setHasMobile(true);
            setMobileCode(mobile.assetTagId);
            setMobilePhoto(mobile.assetPhoto || '');
          }
          if (simsList.length > 0) {
            setHasSim(true);
            setSims(simsList.map((s, idx) => ({
              id: idx + 1,
              phoneNumber: s.assetTagId.replace('SIM-', ''),
              provider: s.brand || 'Airtel',
              photo: s.assetPhoto || ''
            })));
          }
        }
      }

      // 2. Fetch all assets for warnings / inventory
      const assetsRes = await fetch('/api/assets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (assetsRes.ok) {
        const assetsData = await assetsRes.json();
        setAssets(assetsData);
      }

      // 3. Admin specific data
      if (isUserAdmin) {
        await fetchAdminData();
      }

    } catch (err) {
      console.error('Error fetching asset manager data:', err);
      setError('Failed to fetch data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async () => {
    try {
      const verRes = await fetch('/api/assets/verifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (verRes.ok) {
        setAllVerifications(await verRes.json());
      }

      const notifRes = await fetch('/api/assets/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (notifRes.ok) {
        setAllNotifications(await notifRes.json());
      }
    } catch (err) {
      console.error('Error loading admin details:', err);
    }
  };

  // Image Upload handler
  const handleImageUpload = async (e, type, simId = null) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const uploadKey = simId ? `sim-${simId}` : type;
    setUploadingStates(prev => ({ ...prev, [uploadKey]: true }));
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const res = await fetch('/api/assets/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload image');
      
      if (type === 'laptop') {
        setLaptopPhoto(data.imageUrl);
      } else if (type === 'mobile') {
        setMobilePhoto(data.imageUrl);
      } else if (type === 'sim') {
        setSims(prev => prev.map(s => s.id === simId ? { ...s, photo: data.imageUrl } : s));
      } else if (type === 'newDevice') {
        setNewDevicePhoto(data.imageUrl);
      }
    } catch (err) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setUploadingStates(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  // Warning check: checks if an asset tag ID is already checked out to another user
  const getAssetWarning = (code, type) => {
    if (!code) return null;
    const clean = code.replace(/\s+/g, '').toUpperCase();
    if (!clean) return null;
    
    const targetId = type === 'SIM' ? `SIM-${clean}` : clean;
    const matched = assets.find(a => a.assetTagId === targetId);
    
    if (matched && matched.status === 'Checked out') {
      if (matched.assignedTo && matched.assignedTo.toLowerCase() !== user.email.toLowerCase()) {
        return `⚠️ Already assigned to ${matched.assignedToName || matched.assignedTo}`;
      }
    }
    return null;
  };

  // Add SIM field
  const handleAddSimField = () => {
    setSims([...sims, { id: Date.now(), phoneNumber: '', provider: 'Airtel', photo: '' }]);
  };

  // Remove SIM field
  const handleRemoveSimField = (id) => {
    setSims(sims.filter(s => s.id !== id));
  };

  // Edit SIM field
  const handleEditSimField = (id, field, value) => {
    setSims(sims.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // Submit Initial Declaration
  const handleDeclarationSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const assetsPayload = [];
    if (hasLaptop) {
      if (!laptopCode.trim()) {
        setError('Please enter your Laptop Asset ID / Code.');
        return;
      }
      const cleanLaptop = laptopCode.replace(/\s+/g, '').toUpperCase();
      assetsPayload.push({ type: 'Laptop', code: cleanLaptop, photo: laptopPhoto });
    }
    if (hasMobile) {
      if (!mobileCode.trim()) {
        setError('Please enter your Mobile Asset ID / Code.');
        return;
      }
      const cleanMobile = mobileCode.replace(/\s+/g, '').toUpperCase();
      assetsPayload.push({ type: 'Mobile', code: cleanMobile, photo: mobilePhoto });
    }
    if (hasSim) {
      const validSims = sims.filter(s => s.phoneNumber.trim());
      if (validSims.length === 0) {
        setError('Please enter your SIM phone number.');
        return;
      }
      for (const sim of validSims) {
        const cleanPhone = sim.phoneNumber.replace(/\s+/g, '');
        assetsPayload.push({
          type: 'SIM',
          phoneNumber: cleanPhone,
          provider: sim.provider,
          photo: sim.photo
        });
      }
    }

    if (assetsPayload.length === 0) {
      setError('Please select and fill out at least one asset.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/assets/verifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          month: currentMonthStr,
          assets: assetsPayload,
          isInitialDeclaration: true,
          hasIssues: false
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit declaration');
      }
      
      // Reload details
      await fetchInitialData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit Monthly Verification Check
  const handleVerificationSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const sanitizedNewAssetTag = newAssetTagId ? newAssetTagId.replace(/\s+/g, '').toUpperCase() : '';
      
      const payload = {
        month: currentMonthStr,
        isInitialDeclaration: false,
        hasIssues: !!verificationHasIssues,
        assets: myAssetData.myAssets.map(a => {
          if (a.assetTagId.startsWith('SIM-')) {
            return {
              type: 'SIM',
              phoneNumber: a.assetTagId.replace('SIM-', ''),
              provider: a.brand,
              photo: a.assetPhoto || ''
            };
          }
          return {
            type: a.description.toLowerCase().includes('laptop') ? 'Laptop' : 'Mobile',
            code: a.assetTagId,
            photo: a.assetPhoto || ''
          };
        })
      };

      if (verificationHasIssues) {
        payload.repairedHandedOver = repairedHandedOver === 'yes';
        payload.newDeviceReceived = newDeviceReceived === 'yes';
        if (newDeviceReceived === 'yes') {
          if (!sanitizedNewAssetTag.trim()) {
            throw new Error('Please enter the new Asset ID received.');
          }
          payload.newAssetTagId = sanitizedNewAssetTag.trim();
          payload.newDevicePhoto = newDevicePhoto;
        }
      }

      const res = await fetch('/api/assets/verifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit verification');
      }
      
      // Reset wizard
      setVerificationStep(1);
      setVerificationHasIssues(null);
      setRepairedHandedOver(null);
      setNewDeviceReceived(null);
      setNewAssetTagId('');
      setNewDevicePhoto('');
      
      // Reload
      await fetchInitialData();
    } catch (err) {
      setError(err.message);
      setVerificationStep(1);
    } finally {
      setLoading(false);
    }
  };

  // Download Excel Report
  const handleDownloadReport = async () => {
    try {
      let url = '/api/assets/reports/download';
      const params = [];
      if (selectedYear) params.push(`year=${selectedYear}`);
      if (selectedMonth && selectedMonth !== 'All') params.push(`month=${selectedMonth}`);
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errData = await response.json();
        alert(`Download failed: ${errData.error}`);
        return;
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `AssetReport-${selectedYear}-${selectedMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('Error downloading report:', err);
      alert('Failed to download report.');
    }
  };

  // Resolve Alert Notification
  const handleResolveAlert = async (id) => {
    try {
      const res = await fetch(`/api/assets/notifications/${id}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchAdminData();
      }
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  // Edit Asset (Admin)
  const handleEditAssetSubmit = async (e) => {
    e.preventDefault();
    try {
      const sanitizedTag = assetForm.assetTagId.replace(/\s+/g, '').toUpperCase();
      const res = await fetch(`/api/assets/${editingAsset.assetTagId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...assetForm, assetTagId: sanitizedTag })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to edit asset');
      
      setShowEditModal(false);
      setEditingAsset(null);
      setAssetForm({ assetPhoto: '', assetTagId: '', description: '', brand: '', status: 'Available', assignedTo: '' });
      await fetchInitialData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Delete Asset (Admin)
  const handleDeleteAsset = async (tagId) => {
    if (!window.confirm(`Are you sure you want to delete asset ${tagId}?`)) return;
    try {
      const res = await fetch(`/api/assets/${tagId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchInitialData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete asset');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Open Edit Modal
  const openEditModal = (asset) => {
    setEditingAsset(asset);
    setAssetForm({
      assetPhoto: asset.assetPhoto || '',
      assetTagId: asset.assetTagId,
      description: asset.description || '',
      brand: asset.brand || '',
      status: asset.status || 'Available',
      assignedTo: asset.assignedTo || ''
    });
    setShowEditModal(true);
  };

  // Grouping Assets by Employee (Admin View)
  const groupedEmployees = React.useMemo(() => {
    const term = searchTerm.toLowerCase();
    
    // Filter assets first
    const filtered = assets.filter(asset => {
      return (
        (asset.assetTagId || '').toLowerCase().includes(term) ||
        (asset.description || '').toLowerCase().includes(term) ||
        (asset.brand || '').toLowerCase().includes(term) ||
        (asset.status || '').toLowerCase().includes(term) ||
        (asset.assignedTo || '').toLowerCase().includes(term)
      );
    });

    const groups = {};
    const unassignedList = [];

    filtered.forEach(asset => {
      if (asset.assignedTo) {
        const email = asset.assignedTo.toLowerCase();
        const name = asset.assignedToName || asset.assignedTo;
        if (!groups[email]) {
          groups[email] = {
            name,
            email,
            assets: []
          };
        }
        groups[email].assets.push(asset);
      } else {
        unassignedList.push(asset);
      }
    });

    return {
      assigned: Object.values(groups),
      unassigned: unassignedList
    };
  }, [assets, searchTerm]);

  // KPI calculations
  const totalAssetsCount = assets.length;
  const checkedOutCount = assets.filter(a => a.status === 'Checked out').length;
  const underRepairCount = assets.filter(a => a.status === 'Under repair').length;
  const pendingAlertsCount = allNotifications.filter(n => !n.resolved).length;

  if (loading && assets.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', fontFamily: 'var(--font-family-title)', fontWeight: 700 }}>
        Loading Asset Manager...
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header Bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-family-title)', fontSize: '2.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
            Asset Manager
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
            {isUserAdmin ? 'Standalone corporate asset control panel and logs' : 'Declare and verify your devices monthly'}
          </p>
        </div>
        
        {isUserAdmin && (
          <div className="btn-group-tabs" style={{ display: 'flex', border: '2px solid var(--border-color)', background: '#fff', boxShadow: 'var(--shadow-flat-sm)' }}>
            <button 
              onClick={() => setAdminTab('inventory')}
              style={{ padding: '0.5rem 1rem', border: 'none', borderRight: '2px solid var(--border-color)', fontWeight: 700, cursor: 'pointer', background: adminTab === 'inventory' ? '#111' : '#fff', color: adminTab === 'inventory' ? '#fff' : '#111', transition: 'all var(--transition-fast)' }}
            >
              Inventory
            </button>
            <button 
              onClick={() => setAdminTab('verifications')}
              style={{ padding: '0.5rem 1rem', border: 'none', borderRight: '2px solid var(--border-color)', fontWeight: 700, cursor: 'pointer', background: adminTab === 'verifications' ? '#111' : '#fff', color: adminTab === 'verifications' ? '#fff' : '#111', transition: 'all var(--transition-fast)' }}
            >
              Declarations
            </button>
            <button 
              onClick={() => setAdminTab('alerts')}
              style={{ padding: '0.5rem 1rem', border: 'none', borderRight: '2px solid var(--border-color)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', background: adminTab === 'alerts' ? '#111' : '#fff', color: adminTab === 'alerts' ? '#fff' : '#111', transition: 'all var(--transition-fast)' }}
            >
              Alerts 
              {pendingAlertsCount > 0 && (
                <span style={{ background: 'var(--danger)', color: '#fff', fontSize: '0.75rem', padding: '0.1rem 0.4rem', border: '1px solid #111', borderRadius: '4px', fontWeight: 900 }}>
                  {pendingAlertsCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => setAdminTab('reports')}
              style={{ padding: '0.5rem 1rem', border: 'none', fontWeight: 700, cursor: 'pointer', background: adminTab === 'reports' ? '#111' : '#fff', color: adminTab === 'reports' ? '#fff' : '#111', transition: 'all var(--transition-fast)' }}
            >
              Excel Reports
            </button>
          </div>
        )}
      </header>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'var(--danger-light)', border: '2px solid var(--danger)', padding: '1rem', marginBottom: '1.5rem', boxShadow: 'var(--shadow-flat-sm)', fontWeight: 700 }}>
          <AlertTriangle color="var(--danger)" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================== */}
      {/*              EMPLOYEE VIEW                 */}
      {/* ========================================== */}
      {!isUserAdmin && (
        <div>
          {myAssetData.verifiedThisMonth ? (
            /* Case 1: Verified state */
            <div style={{ background: '#fff', border: '2px solid var(--border-color)', padding: '2rem', boxShadow: 'var(--shadow-flat)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--success-light)', border: '2px solid var(--success)', padding: '0.6rem', borderRadius: '50%' }}>
                  <CheckCircle size={36} color="var(--success)" />
                </div>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '1.6rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                    Verification Complete
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', margin: '0.2rem 0 0 0', fontSize: '0.95rem' }}>
                    Your assigned assets are verified for this calendar month. No further action is required.
                  </p>
                </div>
              </div>

              <h3 style={{ fontFamily: 'var(--font-family-title)', fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', borderTop: '2px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Laptop size={20} />
                Your Confirmed Assets
              </h3>
              
              {myAssetData.myAssets.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No devices assigned in database. Contact Admin if this is incorrect.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  {myAssetData.myAssets.map(asset => (
                    <div key={asset.assetTagId} style={{ border: '2px solid var(--border-color)', padding: '1rem', background: 'var(--bg-main)', boxShadow: 'var(--shadow-flat-sm)' }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {asset.assetPhoto ? (
                          <img 
                            src={asset.assetPhoto} 
                            alt={asset.description} 
                            style={{ width: '60px', height: '60px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                          />
                        ) : (
                          <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', background: '#fff' }}>
                            {asset.assetTagId.startsWith('SIM') ? <Wifi size={24} /> : <Laptop size={24} />}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 900, fontFamily: 'var(--font-family-title)', textTransform: 'uppercase' }}>
                            {asset.assetTagId}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {asset.description}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            Brand: {asset.brand}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Case 2: Unverified/Declaration needed */
            <div>
              {!myAssetData.latestVerification && myAssetData.myAssets.length === 0 ? (
                /* Initial Setup Declaration Form */
                <div style={{ background: '#fff', border: '2px solid var(--border-color)', padding: '2rem', boxShadow: 'var(--shadow-flat)' }}>
                  <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '1.6rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Asset Profile Initialization
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                    Please declare the assets currently provided to you by the organization. This information will update the asset database.
                  </p>

                  <form onSubmit={handleDeclarationSubmit}>
                    
                    {/* Laptop Option */}
                    <div style={{ border: '2px solid var(--border-color)', padding: '1rem', marginBottom: '1rem', background: hasLaptop ? 'var(--accent-light)' : 'transparent', transition: 'all var(--transition-fast)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={hasLaptop} 
                          onChange={(e) => setHasLaptop(e.target.checked)}
                          style={{ width: '18px', height: '18px', accentColor: '#111' }}
                        />
                        <Laptop size={20} />
                        I have a Laptop assigned to me
                      </label>
                      {hasLaptop && (
                        <div style={{ marginTop: '0.8rem', paddingLeft: '1.8rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>
                          <div style={{ flex: '1 1 300px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                              ENTER LAPTOP ASSET ID (CODE)
                            </label>
                            <input 
                              type="text" 
                              placeholder="e.g. L-005"
                              value={laptopCode}
                              onChange={(e) => setLaptopCode(e.target.value)}
                              style={{ width: '100%', padding: '0.5rem', border: '2px solid var(--border-color)', fontFamily: 'inherit', fontWeight: 600 }}
                            />
                            {/* Warnings check */}
                            {getAssetWarning(laptopCode, 'Laptop') && (
                              <div style={{ color: 'var(--danger)', fontSize: '0.82rem', fontWeight: 700, marginTop: '0.3rem' }}>
                                {getAssetWarning(laptopCode, 'Laptop')}
                              </div>
                            )}
                          </div>
                          
                          <div style={{ flex: '1 1 250px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                              UPLOAD LAPTOP IMAGE
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'laptop')}
                                style={{ display: 'none' }}
                                id="laptop-img-input"
                              />
                              <label htmlFor="laptop-img-input" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#fff', border: '2px solid var(--border-color)', padding: '0.5rem 0.8rem', fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-flat-sm)' }}>
                                <UploadCloud size={16} /> 
                                {uploadingStates['laptop'] ? 'Uploading...' : 'Choose Image'}
                              </label>
                              {laptopPhoto && (
                                <img src={laptopPhoto} alt="laptop-thumb" style={{ width: '42px', height: '42px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mobile Option */}
                    <div style={{ border: '2px solid var(--border-color)', padding: '1rem', marginBottom: '1rem', background: hasMobile ? 'var(--warning-light)' : 'transparent', transition: 'all var(--transition-fast)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={hasMobile} 
                          onChange={(e) => setHasMobile(e.target.checked)}
                          style={{ width: '18px', height: '18px', accentColor: '#111' }}
                        />
                        <Phone size={20} />
                        I have a Mobile assigned to me
                      </label>
                      {hasMobile && (
                        <div style={{ marginTop: '0.8rem', paddingLeft: '1.8rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>
                          <div style={{ flex: '1 1 300px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                              ENTER MOBILE ASSET ID (CODE)
                            </label>
                            <input 
                              type="text" 
                              placeholder="e.g. M-012"
                              value={mobileCode}
                              onChange={(e) => setMobileCode(e.target.value)}
                              style={{ width: '100%', padding: '0.5rem', border: '2px solid var(--border-color)', fontFamily: 'inherit', fontWeight: 600 }}
                            />
                            {/* Warnings check */}
                            {getAssetWarning(mobileCode, 'Mobile') && (
                              <div style={{ color: 'var(--danger)', fontSize: '0.82rem', fontWeight: 700, marginTop: '0.3rem' }}>
                                {getAssetWarning(mobileCode, 'Mobile')}
                              </div>
                            )}
                          </div>

                          <div style={{ flex: '1 1 250px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                              UPLOAD MOBILE IMAGE
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'mobile')}
                                style={{ display: 'none' }}
                                id="mobile-img-input"
                              />
                              <label htmlFor="mobile-img-input" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#fff', border: '2px solid var(--border-color)', padding: '0.5rem 0.8rem', fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-flat-sm)' }}>
                                <UploadCloud size={16} /> 
                                {uploadingStates['mobile'] ? 'Uploading...' : 'Choose Image'}
                              </label>
                              {mobilePhoto && (
                                <img src={mobilePhoto} alt="mobile-thumb" style={{ width: '42px', height: '42px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SIM Card Option */}
                    <div style={{ border: '2px solid var(--border-color)', padding: '1rem', marginBottom: '1.5rem', background: hasSim ? 'var(--success-light)' : 'transparent', transition: 'all var(--transition-fast)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={hasSim} 
                          onChange={(e) => setHasSim(e.target.checked)}
                          style={{ width: '18px', height: '18px', accentColor: '#111' }}
                        />
                        <Wifi size={20} />
                        I have one or more corporate SIM cards
                      </label>
                      
                      {hasSim && (
                        <div style={{ marginTop: '0.8rem', paddingLeft: '1.8rem' }}>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.8rem 0', fontWeight: 600 }}>
                            Enter details for each active SIM card. Valid providers: VI-Vodafone, Airtel.
                          </p>
                          
                          {sims.map((sim, index) => (
                            <div key={sim.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1rem', background: '#fff', padding: '1rem', border: '1px solid var(--border-color)' }}>
                              <div style={{ flex: '2 1 200px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                  PHONE NUMBER
                                </label>
                                <input 
                                  type="text" 
                                  placeholder="10-digit number"
                                  value={sim.phoneNumber}
                                  onChange={(e) => handleEditSimField(sim.id, 'phoneNumber', e.target.value)}
                                  style={{ width: '100%', padding: '0.45rem', border: '2px solid var(--border-color)', fontFamily: 'inherit', fontWeight: 600 }}
                                />
                                {getAssetWarning(sim.phoneNumber, 'SIM') && (
                                  <div style={{ color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 700, marginTop: '0.2rem' }}>
                                    {getAssetWarning(sim.phoneNumber, 'SIM')}
                                  </div>
                                )}
                              </div>

                              <div style={{ flex: '1 1 150px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                  SERVICE PROVIDER
                                </label>
                                <select
                                  value={sim.provider}
                                  onChange={(e) => handleEditSimField(sim.id, 'provider', e.target.value)}
                                  style={{ width: '100%', padding: '0.45rem', border: '2px solid var(--border-color)', fontFamily: 'inherit', fontWeight: 700, background: '#fff' }}
                                >
                                  <option value="Airtel">Airtel</option>
                                  <option value="VI-Vodafone">VI-Vodafone</option>
                                </select>
                              </div>

                              <div style={{ flex: '1 1 180px' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                  SIM CARD PHOTO
                                </label>
                                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                  <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e, 'sim', sim.id)}
                                    style={{ display: 'none' }}
                                    id={`sim-img-input-${sim.id}`}
                                  />
                                  <label htmlFor={`sim-img-input-${sim.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: '#fff', border: '2px solid var(--border-color)', padding: '0.4rem 0.6rem', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', boxShadow: 'var(--shadow-flat-sm)' }}>
                                    <UploadCloud size={14} /> 
                                    {uploadingStates[`sim-${sim.id}`] ? 'Wait...' : 'Image'}
                                  </label>
                                  {sim.photo && (
                                    <img src={sim.photo} alt="sim-thumb" style={{ width: '36px', height: '36px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                                  )}
                                </div>
                              </div>

                              {sims.length > 1 && (
                                <button 
                                  type="button"
                                  onClick={() => handleRemoveSimField(sim.id)}
                                  style={{ padding: '0.45rem', background: 'var(--danger-light)', border: '2px solid var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', alignSelf: 'flex-end' }}
                                >
                                  <Trash2 size={16} color="var(--danger)" />
                                </button>
                              )}
                            </div>
                          ))}

                          <button 
                            type="button" 
                            onClick={handleAddSimField}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#fff', border: '2px solid var(--border-color)', padding: '0.4rem 0.8rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', boxShadow: 'var(--shadow-flat-sm)' }}
                          >
                            <Plus size={14} /> Add Another SIM
                          </button>
                        </div>
                      )}
                    </div>

                    <button 
                      type="submit" 
                      style={{ background: '#111', color: '#fff', border: 'none', borderBottom: '4px solid #000', padding: '0.8rem 1.8rem', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', transition: 'all var(--transition-fast)', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-flat-sm)' }}
                    >
                      Submit Asset Declaration
                      <ArrowRight size={18} />
                    </button>
                  </form>
                </div>
              ) : (
                /* User monthly verification wizards */
                <div style={{ background: '#fff', border: '2px solid var(--border-color)', padding: '2rem', boxShadow: 'var(--shadow-flat)', maxWidth: '600px', margin: '2rem auto' }}>
                  
                  {/* STEP 1: Verification Dialog Question */}
                  {verificationStep === 1 && (
                    <div>
                      <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '1.6rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        Monthly Verification
                      </h2>
                      <p style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                        Is there any problem (defects, issues, repairs needed) with the assets currently assigned to you?
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <button
                          onClick={() => {
                            setVerificationHasIssues(false);
                            setVerificationStep(3);
                          }}
                          style={{ padding: '1.5rem', border: '2px solid var(--border-color)', background: 'var(--success-light)', color: 'var(--success)', fontWeight: 900, fontSize: '1.2rem', textTransform: 'uppercase', cursor: 'pointer', boxShadow: 'var(--shadow-flat-sm)' }}
                        >
                          No Problems
                        </button>
                        <button
                          onClick={() => {
                            setVerificationHasIssues(true);
                            setVerificationStep(2);
                          }}
                          style={{ padding: '1.5rem', border: '2px solid var(--border-color)', background: 'var(--danger-light)', color: 'var(--danger)', fontWeight: 900, fontSize: '1.2rem', textTransform: 'uppercase', cursor: 'pointer', boxShadow: 'var(--shadow-flat-sm)' }}
                        >
                          Yes, I have issues
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Issue Reporting Flow */}
                  {verificationStep === 2 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '1.6rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                          Report Asset Defect
                        </h2>
                        <button onClick={() => setVerificationStep(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800 }}>Back</button>
                      </div>

                      {/* Defective Device Handed Over */}
                      <div style={{ marginBottom: '1.2rem' }}>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '0.5rem' }}>
                          Have you handed over the repaired/defective device to the admin?
                        </label>
                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                          <button
                            type="button"
                            onClick={() => setRepairedHandedOver('yes')}
                            style={{ flex: 1, padding: '0.5rem', border: '2px solid var(--border-color)', background: repairedHandedOver === 'yes' ? '#111' : '#fff', color: repairedHandedOver === 'yes' ? '#fff' : '#111', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setRepairedHandedOver('no')}
                            style={{ flex: 1, padding: '0.5rem', border: '2px solid var(--border-color)', background: repairedHandedOver === 'no' ? '#111' : '#fff', color: repairedHandedOver === 'no' ? '#fff' : '#111', fontWeight: 700, cursor: 'pointer' }}
                          >
                            No
                          </button>
                        </div>
                      </div>

                      {/* New Device Received */}
                      <div style={{ marginBottom: '1.2rem' }}>
                        <label style={{ display: 'block', fontWeight: 800, marginBottom: '0.5rem' }}>
                          Have you received a new / replacement device from the admin?
                        </label>
                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                          <button
                            type="button"
                            onClick={() => setNewDeviceReceived('yes')}
                            style={{ flex: 1, padding: '0.5rem', border: '2px solid var(--border-color)', background: newDeviceReceived === 'yes' ? '#111' : '#fff', color: newDeviceReceived === 'yes' ? '#fff' : '#111', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewDeviceReceived('no')}
                            style={{ flex: 1, padding: '0.5rem', border: '2px solid var(--border-color)', background: newDeviceReceived === 'no' ? '#111' : '#fff', color: newDeviceReceived === 'no' ? '#fff' : '#111', fontWeight: 700, cursor: 'pointer' }}
                          >
                            No
                          </button>
                        </div>
                      </div>

                      {/* Replacement Details input */}
                      {newDeviceReceived === 'yes' && (
                        <div style={{ marginBottom: '1.5rem', background: 'var(--accent-light)', padding: '1rem', border: '1px solid var(--border-color)' }}>
                          <div style={{ marginBottom: '0.8rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.3rem' }}>
                              ENTER NEW ASSET ID (CODE)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. C-012 or L-035"
                              value={newAssetTagId}
                              onChange={(e) => setNewAssetTagId(e.target.value)}
                              style={{ width: '100%', padding: '0.4rem', border: '2px solid var(--border-color)', fontFamily: 'inherit', fontWeight: 600 }}
                            />
                            {getAssetWarning(newAssetTagId, 'NewDevice') && (
                              <div style={{ color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 700, marginTop: '0.2rem' }}>
                                {getAssetWarning(newAssetTagId, 'NewDevice')}
                              </div>
                            )}
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.3rem' }}>
                              UPLOAD PHOTO OF NEW DEVICE
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'newDevice')}
                                style={{ display: 'none' }}
                                id="newdevice-img-input"
                              />
                              <label htmlFor="newdevice-img-input" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#fff', border: '2px solid var(--border-color)', padding: '0.4rem 0.6rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', boxShadow: 'var(--shadow-flat-sm)' }}>
                                <UploadCloud size={14} /> 
                                {uploadingStates['newDevice'] ? 'Uploading...' : 'Choose Image'}
                              </label>
                              {newDevicePhoto && (
                                <img src={newDevicePhoto} alt="new-thumb" style={{ width: '38px', height: '38px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {newDeviceReceived === 'no' && (
                        <div style={{ marginBottom: '1.5rem', background: 'var(--danger-light)', padding: '1rem', border: '1px solid var(--danger)', fontWeight: 600 }}>
                          Note: A direct notification will be sent to the Admin to escalate and provide your replacement device.
                        </div>
                      )}

                      <button
                        onClick={handleVerificationSubmit}
                        disabled={repairedHandedOver === null || newDeviceReceived === null}
                        style={{ width: '100%', background: '#111', color: '#fff', padding: '0.8rem', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none', borderBottom: '4px solid #000', opacity: (repairedHandedOver === null || newDeviceReceived === null) ? 0.5 : 1 }}
                      >
                        Submit Issue Report
                      </button>
                    </div>
                  )}

                  {/* STEP 3: No issues confirm */}
                  {verificationStep === 3 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '1.6rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                          Confirm Verification
                        </h2>
                        <button onClick={() => setVerificationStep(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800 }}>Back</button>
                      </div>

                      <p style={{ fontWeight: 600, marginBottom: '1.5rem' }}>
                        You are submitting that all your assigned assets are in good working condition. No defects, issues, or repairs required.
                      </p>

                      <button
                        onClick={handleVerificationSubmit}
                        style={{ width: '100%', background: 'var(--success)', color: '#fff', padding: '0.8rem', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none', borderBottom: '4px solid #080', boxShadow: 'var(--shadow-flat-sm)' }}
                      >
                        Confirm and Continue
                      </button>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/*               ADMIN VIEW                   */}
      {/* ========================================== */}
      {isUserAdmin && (
        <div>
          
          {/* KPI Dashboard Cards */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ border: '2px solid var(--border-color)', padding: '1rem', background: '#fff', boxShadow: 'var(--shadow-flat-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Inventory Assets</span>
                <Laptop size={18} />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-family-title)', marginTop: '0.5rem' }}>
                {totalAssetsCount}
              </div>
            </div>

            <div style={{ border: '2px solid var(--border-color)', padding: '1rem', background: 'var(--accent-light)', boxShadow: 'var(--shadow-flat-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Checked Out</span>
                <CheckCircle size={18} color="var(--accent)" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-family-title)', marginTop: '0.5rem', color: 'var(--accent)' }}>
                {checkedOutCount}
              </div>
            </div>

            <div style={{ border: '2px solid var(--border-color)', padding: '1rem', background: 'var(--warning-light)', boxShadow: 'var(--shadow-flat-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Under Repair</span>
                <AlertTriangle size={18} color="var(--warning)" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-family-title)', marginTop: '0.5rem', color: 'var(--warning)' }}>
                {underRepairCount}
              </div>
            </div>

            <div style={{ border: '2px solid var(--border-color)', padding: '1rem', background: 'var(--danger-light)', boxShadow: 'var(--shadow-flat-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pending Alerts</span>
                <AlertTriangle size={18} color="var(--danger)" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-family-title)', marginTop: '0.5rem', color: 'var(--danger)' }}>
                {pendingAlertsCount}
              </div>
            </div>
          </section>

          {/* ================= ADMIN TAB: INVENTORY ================= */}
          {adminTab === 'inventory' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
                {/* Search Bar */}
                <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '2px solid var(--border-color)', padding: '0.4rem 0.8rem', width: '100%', maxWidth: '400px', boxShadow: 'var(--shadow-flat-sm)' }}>
                  <Search size={18} style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }} />
                  <input
                    type="text"
                    placeholder="Search Tag ID, Brand, Assignee..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ border: 'none', width: '100%', fontFamily: 'inherit', fontWeight: 600, outline: 'none' }}
                  />
                  {searchTerm && <X size={16} style={{ cursor: 'pointer' }} onClick={() => setSearchTerm('')} />}
                </div>
                {/* Manual Add Asset button removed as requested */}
              </div>

              {/* Grouped Assets Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* 1. Grouped by Employee Section */}
                <div style={{ border: '2px solid var(--border-color)', background: '#fff', boxShadow: 'var(--shadow-flat)' }}>
                  <div style={{ background: '#111', color: '#fff', padding: '0.75rem 1rem', fontFamily: 'var(--font-family-title)', fontWeight: 900, textTransform: 'uppercase', fontSize: '1rem' }}>
                    Assigned Assets (Grouped by Employee)
                  </div>
                  
                  {groupedEmployees.assigned.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                      No assigned assets found.
                    </div>
                  ) : (
                    <div>
                      {groupedEmployees.assigned.map(group => (
                        <div key={group.email} style={{ borderBottom: '2.5px solid var(--border-color)', padding: '1rem', background: 'var(--bg-main)' }}>
                          
                          {/* Employee Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                            <div>
                              <span style={{ fontSize: '1.1rem', fontWeight: 900, fontFamily: 'var(--font-family-title)', color: 'var(--accent)', marginRight: '0.8rem' }}>
                                {group.name}
                              </span>
                              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                ({group.email})
                              </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', border: '1.5px solid var(--border-color)', background: '#fff', fontWeight: 900, borderRadius: '4px' }}>
                              {group.assets.length} {group.assets.length === 1 ? 'Device' : 'Devices'}
                            </span>
                          </div>

                          {/* Nested Assets List */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.8rem' }}>
                            {group.assets.map(asset => (
                              <div key={asset.assetTagId} style={{ background: '#fff', border: '2px solid var(--border-color)', padding: '0.8rem', display: 'flex', gap: '0.8rem', alignItems: 'center', boxShadow: 'var(--shadow-flat-sm)' }}>
                                {asset.assetPhoto ? (
                                  <img 
                                    src={asset.assetPhoto} 
                                    alt={asset.description} 
                                    style={{ width: '50px', height: '50px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                                  />
                                ) : (
                                  <div style={{ width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
                                    {asset.assetTagId.startsWith('SIM') ? <Wifi size={20} /> : <Laptop size={20} />}
                                  </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.2rem' }}>
                                    <span style={{ fontWeight: 900, fontFamily: 'var(--font-family-title)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {asset.assetTagId}
                                    </span>
                                    <span style={{ 
                                      fontSize: '0.65rem', padding: '0.08rem 0.3rem', border: '1px solid var(--border-color)', fontWeight: 800, textTransform: 'uppercase',
                                      background: asset.status === 'Under repair' ? 'var(--warning-light)' : 'var(--accent-light)',
                                      color: asset.status === 'Under repair' ? 'var(--warning)' : 'var(--accent)'
                                    }}>
                                      {asset.status}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {asset.description}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    Brand: {asset.brand}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                  <button 
                                    onClick={() => openEditModal(asset)}
                                    style={{ padding: '0.25rem 0.4rem', border: '1.5px solid var(--border-color)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: '1.5px 1.5px 0px var(--border-color)' }}
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteAsset(asset.assetTagId)}
                                    style={{ padding: '0.25rem 0.4rem', border: '1.5px solid var(--danger)', background: 'var(--danger-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: '1.5px 1.5px 0px var(--danger)' }}
                                  >
                                    <Trash2 size={12} color="var(--danger)" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Unassigned Available Stock Section */}
                <div style={{ border: '2px solid var(--border-color)', background: '#fff', boxShadow: 'var(--shadow-flat)' }}>
                  <div style={{ background: '#111', color: '#fff', padding: '0.75rem 1rem', fontFamily: 'var(--font-family-title)', fontWeight: 900, textTransform: 'uppercase', fontSize: '1rem' }}>
                    Available Stock / Unassigned Inventory
                  </div>
                  
                  {groupedEmployees.unassigned.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                      No available or unassigned inventory items in stock.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                        <thead>
                          <tr style={{ background: '#f5f5f5', color: '#111', borderBottom: '2px solid var(--border-color)' }}>
                            <th style={{ padding: '0.6rem 1rem', width: '60px', textAlign: 'center' }}>Photo</th>
                            <th style={{ padding: '0.6rem 1rem' }}>Asset Tag ID</th>
                            <th style={{ padding: '0.6rem 1rem' }}>Description</th>
                            <th style={{ padding: '0.6rem 1rem' }}>Brand</th>
                            <th style={{ padding: '0.6rem 1rem' }}>Status</th>
                            <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedEmployees.unassigned.map(asset => (
                            <tr key={asset.assetTagId} style={{ borderBottom: '1.5px solid var(--border-color)' }}>
                              <td style={{ padding: '0.4rem 1rem', textAlign: 'center' }}>
                                {asset.assetPhoto ? (
                                  <img 
                                    src={asset.assetPhoto} 
                                    alt={asset.description} 
                                    style={{ width: '36px', height: '36px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                                  />
                                ) : (
                                  <div style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', margin: '0 auto', background: '#fafafa' }}>
                                    {asset.assetTagId.startsWith('SIM') ? <Wifi size={16} /> : <Laptop size={16} />}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '0.4rem 1rem', fontWeight: 900, fontFamily: 'var(--font-family-title)' }}>
                                {asset.assetTagId}
                              </td>
                              <td style={{ padding: '0.4rem 1rem', fontWeight: 600 }}>{asset.description}</td>
                              <td style={{ padding: '0.4rem 1rem', fontWeight: 600 }}>{asset.brand}</td>
                              <td style={{ padding: '0.4rem 1rem' }}>
                                <span style={{ 
                                  padding: '0.15rem 0.4rem', border: '1px solid var(--border-color)', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase',
                                  background: asset.status === 'Available' ? 'var(--success-light)' : 'var(--warning-light)',
                                  color: asset.status === 'Available' ? 'var(--success)' : 'var(--warning)'
                                }}>
                                  {asset.status}
                                </span>
                              </td>
                              <td style={{ padding: '0.4rem 1rem', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                                  <button 
                                    onClick={() => openEditModal(asset)}
                                    style={{ padding: '0.25rem 0.4rem', border: '1.5px solid var(--border-color)', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: 'var(--shadow-flat-sm)' }}
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteAsset(asset.assetTagId)}
                                    style={{ padding: '0.25rem 0.4rem', border: '1.5px solid var(--danger)', background: 'var(--danger-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: '1.5px 1.5px 0px var(--danger)' }}
                                  >
                                    <Trash2 size={12} color="var(--danger)" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ================= ADMIN TAB: DECLARATIONS ================= */}
          {adminTab === 'verifications' && (
            <div>
              <div style={{ border: '2px solid var(--border-color)', background: '#fff', boxShadow: 'var(--shadow-flat)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#111', color: '#fff', borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>User</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Email</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Month</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Declared Assets</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Has Issues?</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Repaired Handed Over?</th>
                      <th style={{ padding: '0.75rem 1rem' }}>New Received?</th>
                      <th style={{ padding: '0.75rem 1rem' }}>New Asset Tag</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Submitted At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allVerifications.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>
                          No verifications or declarations submitted yet.
                        </td>
                      </tr>
                    ) : (
                      allVerifications.map(v => {
                        const decl_assets = v.assets || [];
                        const decl_text_list = [];
                        for (const da of decl_assets) {
                          if (da.type === "SIM") {
                            decl_text_list.push(`SIM: ${da.phoneNumber} (${da.provider})`);
                          } else {
                            decl_text_list.push(`${da.type}: ${da.code}`);
                          }
                        }
                        const decl_text = decl_text_list.join(', ') || 'None';

                        return (
                          <tr key={v.id} style={{ borderBottom: '1.5px solid var(--border-color)' }} className="table-row-hover">
                            <td style={{ padding: '0.6rem 1rem', fontWeight: 700 }}>{v.name}</td>
                            <td style={{ padding: '0.6rem 1rem', fontWeight: 600 }}>{v.email}</td>
                            <td style={{ padding: '0.6rem 1rem', fontWeight: 800 }}>{v.month}</td>
                            <td style={{ padding: '0.6rem 1rem', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={decl_text}>
                              {decl_text}
                            </td>
                            <td style={{ padding: '0.6rem 1rem' }}>
                              <span style={{ 
                                padding: '0.1rem 0.4rem', border: '1px solid var(--border-color)', fontSize: '0.72rem', fontWeight: 900,
                                background: v.hasIssues ? 'var(--danger-light)' : 'var(--success-light)',
                                color: v.hasIssues ? 'var(--danger)' : 'var(--success)'
                              }}>
                                {v.hasIssues ? 'YES' : 'NO'}
                              </span>
                            </td>
                            <td style={{ padding: '0.6rem 1rem', fontWeight: 600 }}>
                              {v.repairedHandedOver === true ? 'Yes' : (v.repairedHandedOver === false ? 'No' : 'N/A')}
                            </td>
                            <td style={{ padding: '0.6rem 1rem', fontWeight: 600 }}>
                              {v.newDeviceReceived === true ? 'Yes' : (v.newDeviceReceived === false ? 'No' : 'N/A')}
                            </td>
                            <td style={{ padding: '0.6rem 1rem', fontWeight: 800 }}>{v.newAssetTagId || 'N/A'}</td>
                            <td style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {v.submittedAt ? new Date(v.submittedAt).toLocaleString() : ''}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= ADMIN TAB: ALERTS ================= */}
          {adminTab === 'alerts' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {allNotifications.length === 0 ? (
                  <div style={{ padding: '3rem', border: '2px dashed var(--border-color)', textAlign: 'center', background: '#fff', fontWeight: 600, color: 'var(--text-muted)' }}>
                    No notifications or alerts received yet.
                  </div>
                ) : (
                  allNotifications.map(notif => {
                    const isIssue = notif.type === 'no_device_alert' || notif.type === 'verification_issue';
                    
                    return (
                      <div 
                        key={notif.id} 
                        style={{ 
                          border: '2px solid var(--border-color)', 
                          padding: '1.2rem', 
                          background: notif.resolved ? '#fff' : (isIssue ? 'var(--danger-light)' : 'var(--accent-light)'), 
                          boxShadow: 'var(--shadow-flat-sm)',
                          opacity: notif.resolved ? 0.75 : 1,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1rem',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
                          <div style={{ marginTop: '0.2rem' }}>
                            {notif.resolved ? (
                              <CheckCircle size={20} color="var(--success)" />
                            ) : (
                              isIssue ? <AlertTriangle size={20} color="var(--danger)" /> : <FileText size={20} color="var(--accent)" />
                            )}
                          </div>
                          <div>
                            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 900 }}>{notif.userName}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({notif.userEmail})</span>
                              <span style={{ 
                                fontSize: '0.7rem', padding: '0.1rem 0.4rem', border: '1px solid var(--border-color)', fontWeight: 900, textTransform: 'uppercase',
                                background: '#fff'
                              }}>
                                {notif.type}
                              </span>
                            </div>
                            <p style={{ margin: '0.4rem 0 0.2rem 0', fontWeight: 600, fontSize: '0.95rem' }}>{notif.message}</p>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {new Date(notif.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {!notif.resolved && (
                          <button
                            onClick={() => handleResolveAlert(notif.id)}
                            style={{ 
                              background: '#fff', 
                              border: '2px solid var(--border-color)', 
                              padding: '0.4rem 0.8rem', 
                              fontWeight: 900, 
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              boxShadow: 'var(--shadow-flat-sm)',
                              fontSize: '0.8rem'
                            }}
                          >
                            <Check size={14} /> Mark Resolved
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ================= ADMIN TAB: REPORTS ================= */}
          {adminTab === 'reports' && (
            <div style={{ background: '#fff', border: '2px solid var(--border-color)', padding: '2rem', boxShadow: 'var(--shadow-flat)', maxWidth: '500px' }}>
              <h3 style={{ fontFamily: 'var(--font-family-title)', fontSize: '1.3rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Download Asset Report
              </h3>
              
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.3rem' }}>
                  FILTER BY YEAR
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '2px solid var(--border-color)', fontFamily: 'inherit', fontWeight: 700, background: '#fff' }}
                >
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2025">2025</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.3rem' }}>
                  FILTER BY MONTH
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '2px solid var(--border-color)', fontFamily: 'inherit', fontWeight: 700, background: '#fff' }}
                >
                  <option value="All">All Months (Yearly Report)</option>
                  <option value="01">January</option>
                  <option value="02">February</option>
                  <option value="03">March</option>
                  <option value="04">April</option>
                  <option value="05">May</option>
                  <option value="06">June</option>
                  <option value="07">July</option>
                  <option value="08">August</option>
                  <option value="09">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>

              <button
                onClick={handleDownloadReport}
                style={{ width: '100%', background: 'var(--success)', color: '#fff', padding: '0.8rem', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none', borderBottom: '4px solid #080', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-flat-sm)' }}
              >
                <Download size={18} /> Export to Excel
              </button>
            </div>
          )}

        </div>
      )}

      {/* ========================================== */}
      {/*              MODAL: EDIT ASSET             */}
      {/* ========================================== */}
      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#fff', border: '3px solid var(--border-color)', padding: '1.5rem', width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow-flat-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-family-title)', fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                Edit Asset: {editingAsset?.assetTagId}
              </h2>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditAssetSubmit}>
              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.2rem' }}>
                  DESCRIPTION
                </label>
                <input
                  type="text"
                  required
                  value={assetForm.description}
                  onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem', border: '2px solid var(--border-color)', fontFamily: 'inherit', fontWeight: 600 }}
                  placeholder="e.g. HP Charger"
                />
              </div>

              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.2rem' }}>
                  BRAND
                </label>
                <input
                  type="text"
                  required
                  value={assetForm.brand}
                  onChange={(e) => setAssetForm({ ...assetForm, brand: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem', border: '2px solid var(--border-color)', fontFamily: 'inherit', fontWeight: 600 }}
                  placeholder="e.g. HP"
                />
              </div>

              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.2rem' }}>
                  PHOTO URL (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={assetForm.assetPhoto}
                  onChange={(e) => setAssetForm({ ...assetForm, assetPhoto: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem', border: '2px solid var(--border-color)', fontFamily: 'inherit', fontWeight: 600 }}
                  placeholder="https://example.com/photo.jpg"
                />
              </div>

              <div style={{ marginBottom: '0.8rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.2rem' }}>
                  STATUS
                </label>
                <select
                  value={assetForm.status}
                  onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem', border: '2px solid var(--border-color)', fontFamily: 'inherit', fontWeight: 700, background: '#fff' }}
                >
                  <option value="Available">Available</option>
                  <option value="Checked out">Checked out</option>
                  <option value="Under repair">Under repair</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.2rem' }}>
                  ASSIGNED TO (EMAIL / BLANK)
                </label>
                <input
                  type="text"
                  value={assetForm.assignedTo}
                  onChange={(e) => setAssetForm({ ...assetForm, assignedTo: e.target.value })}
                  style={{ width: '100%', padding: '0.4rem', border: '2px solid var(--border-color)', fontFamily: 'inherit', fontWeight: 600 }}
                  placeholder="employee@domain.com"
                />
              </div>

              <button
                type="submit"
                style={{ width: '100%', background: '#111', color: '#fff', padding: '0.6rem', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer', border: 'none', borderBottom: '4px solid #000', boxShadow: 'var(--shadow-flat-sm)' }}
              >
                Update Asset
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default AssetManager;
