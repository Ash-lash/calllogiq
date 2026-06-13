import React, { useState, useRef, useEffect } from 'react';
import { Mail, Lock, User, Briefcase, KeyRound } from 'lucide-react';

function Auth({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('Sales');
  
  // OTP Verification States
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCodes, setOtpCodes] = useState(Array(6).fill(''));
  const otpInputsRef = useRef([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister 
      ? { email, password, name, domain }
      : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setSuccessMsg(data.message || 'OTP Sent successfully!');
      setShowOtpModal(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return; // Only allow numbers
    
    const newOtp = [...otpCodes];
    newOtp[index] = value.substr(value.length - 1); // Get last typed char
    setOtpCodes(newOtp);

    // Auto focus next input
    if (value && index < 5) {
      otpInputsRef.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      const newOtp = [...otpCodes];
      
      // If current is empty, focus previous and clear it
      if (!otpCodes[index] && index > 0) {
        newOtp[index - 1] = '';
        setOtpCodes(newOtp);
        otpInputsRef.current[index - 1].focus();
      } else {
        newOtp[index] = '';
        setOtpCodes(newOtp);
      }
    }
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    setError('');
    const fullOtp = otpCodes.join('');
    if (fullOtp.length < 6) {
      setError('Please enter all 6 digits of the OTP code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: fullOtp })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'OTP verification failed');
      }

      setShowOtpModal(false);
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Seed Admin helper function
  const handleSeedAdmin = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/seed-admin', { method: 'POST' });
      const data = await res.json();
      setSuccessMsg(`${data.message}. You can now sign in with admin@calllogiq.com / admin123`);
      setEmail('admin@calllogiq.com');
      setPassword('admin123');
      setIsRegister(false);
    } catch (err) {
      setError('Failed to seed admin user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">CallLogIQ</div>
          <div className="auth-subtitle">
            {isRegister ? 'Register your employee account' : 'Sign in to access your dashboard'}
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        <form onSubmit={handleAuthSubmit}>
          {isRegister && (
            <>
              <div className="form-group">
                <label className="form-label">Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Enter your full name" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    style={{ paddingLeft: '2.5rem' }}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Domain (Department)</label>
                <div style={{ position: 'relative' }}>
                  <Briefcase size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)', zIndex: 10 }} />
                  <select 
                    className="form-select" 
                    value={domain} 
                    onChange={e => setDomain(e.target.value)}
                    style={{ paddingLeft: '2.5rem' }}
                  >
                    <option value="Sales">Sales</option>
                    <option value="Accounts">Accounts</option>
                    <option value="Support">Support</option>
                    <option value="HR">HR</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
              <input 
                type="email" 
                className="form-input" 
                placeholder="you@company.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                style={{ paddingLeft: '2.5rem' }}
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                style={{ paddingLeft: '2.5rem' }}
                required 
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Sending OTP...' : isRegister ? 'Register & Send OTP' : 'Sign In & Send OTP'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          <button 
            onClick={() => { setIsRegister(!isRegister); setError(''); setSuccessMsg(''); }} 
            className="btn btn-outline"
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
          </button>
        </div>

        {/* Development Seed Admin Assist Banner */}
        <div style={{ marginTop: '2rem', paddingTop: '1.2rem', borderTop: '1px solid var(--border-light)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
            Testing Admin functionality?
          </span>
          <button 
            onClick={handleSeedAdmin} 
            className="btn btn-secondary" 
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', width: '100%' }}
          >
            Seed & Autofill Admin Credentials
          </button>
        </div>
      </div>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-icon">
              <KeyRound size={48} style={{ margin: '0 auto' }} />
            </div>
            <h3 className="modal-title">Verification Required</h3>
            <p className="modal-desc">
              We have sent a 6-digit OTP code to <strong>{email}</strong>. 
              Please check your server console/terminal log to find the generated code!
            </p>
            
            {error && <div className="alert alert-danger" style={{ padding: '0.6rem', fontSize: '0.8rem' }}>{error}</div>}

            <form onSubmit={handleOtpVerify}>
              <div className="otp-box-wrapper">
                {otpCodes.map((val, idx) => (
                  <input
                    key={idx}
                    type="text"
                    maxLength={1}
                    className="otp-input"
                    value={val}
                    onChange={e => handleOtpChange(idx, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(idx, e)}
                    ref={el => otpInputsRef.current[idx] = el}
                    autoFocus={idx === 0}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }} 
                  onClick={() => { setShowOtpModal(false); setOtpCodes(Array(6).fill('')); }}
                >
                  Back
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Auth;
