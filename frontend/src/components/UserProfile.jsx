import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, Briefcase, MapPin, Upload, Check, Laptop } from 'lucide-react';
import API_BASE from '../api';


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

// Ghibli filter variants — Kuwahara radius controls painterly smoothness
// Higher radius = smoother / more illustrated; lower = more detail retained
const GHIBLI_VARIANTS = [
  { kuwaharaRadius: 4, levels: 8, satBoost: 1.2, edgeThreshold: 38, litBoost: 1.1,  edgeDark: 0.80 }, // Soft pastel
  { kuwaharaRadius: 3, levels: 7, satBoost: 1.4, edgeThreshold: 50, litBoost: 1.05, edgeDark: 0.85 }, // Standard
  { kuwaharaRadius: 2, levels: 6, satBoost: 1.6, edgeThreshold: 40, litBoost: 1.00, edgeDark: 0.90 }, // Bold ink
];

const applyGhibliFilter = (base64Str, variant = GHIBLI_VARIANTS[1]) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Scale to 320px max — good balance of quality vs speed
      const maxDim = 320;
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; } }
      else        { if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; } }

      canvas.width = w; canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      const imgData = ctx.getImageData(0, 0, w, h);
      const src = imgData.data;
      const { kuwaharaRadius: kr, levels, satBoost, edgeThreshold, litBoost, edgeDark } = variant;

      // Clamp-safe pixel index
      const getIdx = (x, y) =>
        (Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4;

      // ─── HSL helpers ───────────────────────────────────────────────────────
      const rgbToHsl = (r, g, b) => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let hue = 0, sat = 0;
        const lit = (max + min) / 2;
        if (max !== min) {
          const d = max - min;
          sat = lit > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: hue = ((b - r) / d + 2) / 6; break;
            case b: hue = ((r - g) / d + 4) / 6; break;
          }
        }
        return [hue, sat, lit];
      };

      const hslToRgb = (h, s, l) => {
        if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hue2rgb = (t) => {
          if (t < 0) t += 1; if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };
        return [
          Math.round(hue2rgb(h + 1 / 3) * 255),
          Math.round(hue2rgb(h) * 255),
          Math.round(hue2rgb(h - 1 / 3) * 255),
        ];
      };

      // ─── PASS 1: Kuwahara filter ────────────────────────────────────────────
      // For each pixel, split into 4 overlapping square quadrants.
      // Pick the quadrant with lowest colour variance → use its mean colour.
      // This produces smooth painted / illustrated regions like real anime art.
      const painted = new Uint8ClampedArray(src.length);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const quads = [
            [[-kr, 0], [-kr, 0]],
            [[0, kr],  [-kr, 0]],
            [[-kr, 0], [0, kr]],
            [[0, kr],  [0, kr]],
          ];

          let bestVar = Infinity, bestR = 0, bestG = 0, bestB = 0;

          for (const [[x0, x1], [y0, y1]] of quads) {
            let sR = 0, sG = 0, sB = 0, sR2 = 0, sG2 = 0, sB2 = 0, n = 0;
            for (let dy = y0; dy <= y1; dy++) {
              for (let dx = x0; dx <= x1; dx++) {
                const i = getIdx(x + dx, y + dy);
                const r = src[i], g = src[i + 1], b = src[i + 2];
                sR += r; sG += g; sB += b;
                sR2 += r * r; sG2 += g * g; sB2 += b * b;
                n++;
              }
            }
            const mR = sR / n, mG = sG / n, mB = sB / n;
            const variance =
              (sR2 / n - mR * mR + sG2 / n - mG * mG + sB2 / n - mB * mB) / 3;
            if (variance < bestVar) {
              bestVar = variance; bestR = mR; bestG = mG; bestB = mB;
            }
          }

          const i = (y * w + x) * 4;
          painted[i] = bestR; painted[i + 1] = bestG;
          painted[i + 2] = bestB; painted[i + 3] = src[i + 3];
        }
      }

      // ─── PASS 2: Colour adjustment + posterization ──────────────────────────
      // Boost saturation (vivid Ghibli palette), adjust brightness, then
      // quantize to a small number of colour levels for the flat cel-shading look.
      const colored = new Uint8ClampedArray(painted.length);
      for (let i = 0; i < painted.length; i += 4) {
        let [hue, sat, lit] = rgbToHsl(painted[i], painted[i + 1], painted[i + 2]);
        sat = Math.min(1, sat * satBoost);
        lit = Math.min(1, lit * litBoost);
        const [r, g, b] = hslToRgb(hue, sat, lit);
        colored[i]     = Math.round(Math.round(r / 255 * levels) / levels * 255);
        colored[i + 1] = Math.round(Math.round(g / 255 * levels) / levels * 255);
        colored[i + 2] = Math.round(Math.round(b / 255 * levels) / levels * 255);
        colored[i + 3] = painted[i + 3];
      }

      // ─── PASS 3: Edge detection on ORIGINAL pixels ─────────────────────────
      // Run Sobel on the raw source so edges are crisp (not blurred by Kuwahara).
      const edges = new Float32Array(w * h);
      const getLum = (idx) =>
        0.2126 * src[idx] + 0.7152 * src[idx + 1] + 0.0722 * src[idx + 2];

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const tl = getLum(getIdx(x-1,y-1)), tc = getLum(getIdx(x,y-1)), tr = getLum(getIdx(x+1,y-1));
          const ml = getLum(getIdx(x-1,y  )),                              mr = getLum(getIdx(x+1,y  ));
          const bl = getLum(getIdx(x-1,y+1)), bc = getLum(getIdx(x,y+1)), br = getLum(getIdx(x+1,y+1));
          const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
          const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
          edges[y * w + x] = Math.sqrt(gx * gx + gy * gy);
        }
      }

      // ─── PASS 4: Composite — color regions + ink outlines ──────────────────
      const output = new Uint8ClampedArray(colored.length);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const edge = edges[y * w + x];
          if (edge > edgeThreshold) {
            // Gradient darkening: stronger edge = darker ink line
            const t = Math.min(1, (edge - edgeThreshold) / 90) * edgeDark;
            output[idx]     = Math.round(colored[idx]     * (1 - t));
            output[idx + 1] = Math.round(colored[idx + 1] * (1 - t));
            output[idx + 2] = Math.round(colored[idx + 2] * (1 - t));
          } else {
            output[idx]     = colored[idx];
            output[idx + 1] = colored[idx + 1];
            output[idx + 2] = colored[idx + 2];
          }
          output[idx + 3] = colored[idx + 3];
        }
      }

      ctx.putImageData(new ImageData(output, w, h), 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
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
  const [ghibliLoading, setGhibliLoading] = useState(false);
  const [ghibliVariants, setGhibliVariants] = useState([]);
  const [generatingVariants, setGeneratingVariants] = useState(false);

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

  const handleGhibliUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setMessage({ text: 'Only image files are allowed', type: 'danger' });
      return;
    }

    setGeneratingVariants(true);
    setGhibliVariants([]);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        // Generate all 3 variants in parallel
        const [v1, v2, v3] = await Promise.all(
          GHIBLI_VARIANTS.map(variant => applyGhibliFilter(event.target.result, variant))
        );
        setGhibliVariants([v1, v2, v3]);
      } catch (err) {
        console.error('Error generating Ghibli variants:', err);
        setMessage({ text: 'Failed to generate cartoon variants', type: 'danger' });
      } finally {
        setGeneratingVariants(false);
      }
    };
    reader.readAsDataURL(file);
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
                {ghibliLoading && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '3px solid #111111',
                    zIndex: 10
                  }}>
                    <span style={{ display: 'inline-block', fontSize: '1.5rem', animation: 'spin 1.2s linear infinite' }}>🎨</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginTop: '4px', color: '#111111' }}>Processing...</span>
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
                  background: '#f8f9fa',
                  border: '2px solid #111111',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  maxWidth: '100%',
                  boxShadow: '4px 4px 0 #111111'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#111111' }}>🎨 Ghibli Avatar Studio</span>
                    <button type="button" onClick={() => { setShowAvatarPicker(false); setGhibliVariants([]); }} style={{ background: 'none', border: 'none', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', color: '#666' }}>✕</button>
                  </div>

                  {generatingVariants ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem 0', gap: '0.5rem' }}>
                      <span style={{ display: 'inline-block', fontSize: '2rem', animation: 'spin 1.2s linear infinite' }}>🎨</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#555' }}>Generating 3 cartoon styles...</span>
                    </div>
                  ) : ghibliVariants.length === 3 ? (
                    <div>
                      <p style={{ fontSize: '0.75rem', color: '#555', marginBottom: '0.75rem', fontWeight: 600 }}>Pick your favourite style:</p>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {ghibliVariants.map((v, i) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                            <img
                              src={v}
                              alt={`Variant ${i + 1}`}
                              style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                cursor: 'pointer',
                                border: photo === v ? '3px solid var(--primary)' : '2px solid #ccc',
                                boxShadow: photo === v ? '0 0 0 3px rgba(0,0,0,0.15)' : 'none',
                                transition: 'transform 0.15s, border 0.15s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                              onClick={() => {
                                setPhoto(v);
                                setShowAvatarPicker(false);
                                setGhibliVariants([]);
                              }}
                            />
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>
                              {['Soft', 'Standard', 'Bold'][i]}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}>
                          <Upload size={12} /> Try a different photo
                          <input type="file" accept="image/*" onChange={handleGhibliUpload} style={{ display: 'none' }} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
                      <div style={{ fontSize: '2.5rem' }}>🖼️</div>
                      <p style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600, textAlign: 'center', margin: 0 }}>
                        Upload any photo — we'll generate<br/>3 Ghibli cartoon art styles for you to choose.
                      </p>
                      <label className="btn btn-primary" style={{ cursor: 'pointer', fontSize: '0.8rem', padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Upload size={14} />
                        Upload Photo
                        <input type="file" accept="image/*" onChange={handleGhibliUpload} style={{ display: 'none' }} />
                      </label>
                    </div>
                  )}
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
