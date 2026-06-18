import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, Briefcase, MapPin, Upload, Check, Laptop } from 'lucide-react';
import API_BASE from '../api';

const AVATARS = [
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Jack',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Midnight'
];

const compressImage = (base64Str, maxWidth = 400, maxHeight = 400, quality = 0.7) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

function UserProfile({ user: initialUser, token, onProfileUpdate }) {
  const [user, setUser] = useState(initialUser);
  const [name, setName] = useState(initialUser.name || '');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState('');
  const [assetsInfo, setAssetsInfo] = useState({ verifiedThisMonth: false, myAssets: [] });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchAssets();
  }, [token]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setName(data.name || '');
        setPhone(data.phone || '');
        setPhoto(data.photo || '');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/assets/verifications/my-latest`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAssetsInfo(data);
      }
    } catch (err) {
      console.error('Error fetching assets:', err);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ text: 'Only image files are allowed', type: 'danger' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const compressed = await compressImage(event.target.result, 400, 400, 0.7);
      setPhoto(compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await fetch(`${API_BASE}/api/users/update-profile-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, phone, photo })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      setUser(data.user);
      if (onProfileUpdate) {
        onProfileUpdate(data.token, data.user);
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      <div className="header-banner" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em', margin: 0 }}>
          User Profile Settings
        </h2>
        <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Manage your personal details, profile picture, and review checked-out assets.
        </p>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1.5rem' }}>
          {message.text}
        </div>
      )}

      <div className="dashboard-grid-2">
        {/* Profile Settings Form */}
        <div className="card">
          <div className="card-title-bar">
            <h3>Update Information</h3>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {/* Profile Photo Display & Upload */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
              <div style={{ position: 'relative' }}>
                {photo ? (
                  <img 
                    src={photo} 
                    alt="Profile" 
                    style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #111111' }} 
                  />
                ) : (
                  <div 
                    style={{ 
                      width: '120px', 
                      height: '120px', 
                      borderRadius: '50%', 
                      background: 'var(--primary)', 
                      color: '#ffffff', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '3rem', 
                      fontWeight: 800, 
                      border: '3px solid #111111' 
                    }}
                  >
                    {name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <label className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Upload size={14} />
                  Upload Photo
                  <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                >
                  Choose Avatar
                </button>
              </div>

              {showAvatarPicker && (
                <div style={{ 
                  display: 'flex', 
                  gap: '0.5rem', 
                  background: '#f3f4f6', 
                  padding: '0.5rem', 
                  borderRadius: '6px', 
                  border: '1px solid #ddd',
                  justifyContent: 'center' 
                }}>
                  {AVATARS.map((avUrl, index) => (
                    <img 
                      key={index} 
                      src={avUrl} 
                      alt={`Avatar ${index}`} 
                      style={{ 
                        width: '45px', 
                        height: '45px', 
                        borderRadius: '50%', 
                        cursor: 'pointer', 
                        border: photo === avUrl ? '3px solid var(--primary)' : '1px solid #ccc',
                        background: '#fff',
                        transition: 'transform 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                      onClick={() => {
                        setPhoto(avUrl);
                        setShowAvatarPicker(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 800 }}>Full Name</label>
              <input 
                type="text" 
                className="form-input" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 800 }}>PRIMARY OFFICIAL PHONE NUMBER</label>
              <input 
                type="tel" 
                className="form-input" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                placeholder="e.g. +91 98765 43210" 
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
              {loading ? 'Saving Changes...' : 'Save Profile Settings'}
            </button>
          </form>
        </div>

        {/* Personal Details & Asset Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Personal Card */}
          <div className="card">
            <div className="card-title-bar">
              <h3>Personal Credentials</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={16} color="var(--text-secondary)" />
                <span style={{ color: 'var(--text-secondary)' }}>Email:</span>
                <strong>{user.email}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={16} color="var(--text-secondary)" />
                <span style={{ color: 'var(--text-secondary)' }}>Domain:</span>
                <strong>{user.domain} Department</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={16} color="var(--text-secondary)" />
                <span style={{ color: 'var(--text-secondary)' }}>Branch:</span>
                <strong>{user.branch || 'Pending'}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={16} color="var(--text-secondary)" />
                <span style={{ color: 'var(--text-secondary)' }}>Role:</span>
                <span className="badge badge-success" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          {/* Checked-out Assets */}
          <div className="card">
            <div className="card-title-bar">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Laptop size={18} />
                Checked-out Assets
              </h3>
            </div>

            {assetsInfo.myAssets && assetsInfo.myAssets.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {assetsInfo.myAssets.map(asset => (
                  <div 
                    key={asset.assetTagId}
                    style={{ 
                      padding: '0.75rem', 
                      border: '1.5px solid #111111', 
                      borderRadius: '6px', 
                      backgroundColor: 'var(--bg-main)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{asset.assetName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tag ID: {asset.assetTagId} ({asset.category})</div>
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                      {asset.status || 'Assigned'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No assets currently checked out or assigned to you.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserProfile;
