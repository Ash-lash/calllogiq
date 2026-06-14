import React, { useState, useEffect } from 'react';
import { Mail, Lock } from 'lucide-react';

function Auth({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load Google Identity Services script dynamically
  useEffect(() => {
    const loadGoogleScript = () => {
      // Avoid duplicate script insertion
      if (document.getElementById('google-jssdk')) return;

      const script = document.createElement('script');
      script.id = 'google-jssdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initializeGoogleSignIn();
      };
      document.body.appendChild(script);
    };

    const initializeGoogleSignIn = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "1028448378393-placeholder.apps.googleusercontent.com",
          callback: handleGoogleLoginSuccess
        });

        window.google.accounts.id.renderButton(
          document.getElementById("google-signin-btn"),
          { 
            theme: "outline", 
            size: "large", 
            width: 320, 
            type: "standard", 
            shape: "pill", 
            text: "signin_with", 
            logo_alignment: "left" 
          }
        );
      }
    };

    if (window.google) {
      initializeGoogleSignIn();
    } else {
      loadGoogleScript();
    }
  }, []);

  const handleGoogleLoginSuccess = async (response) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: response.credential })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Google Sign-In failed');
      }
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: '440px', width: '100%' }}>
        <div className="auth-header">
          <div className="auth-logo">CallLogIQ</div>
          <div className="auth-subtitle">
            Sign in to access your dashboard
          </div>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        {/* Employee Access (Google OAuth) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Employee Access
          </span>
          <div id="google-signin-btn" style={{ minHeight: '40px' }}></div>
        </div>

        {/* Separator line */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', color: 'var(--text-secondary)' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }}></div>
          <span style={{ padding: '0 10px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            or Admin Access
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }}></div>
        </div>

        {/* Admin Login Form */}
        <form onSubmit={handleAdminSubmit}>
          <div className="form-group">
            <label className="form-label">Admin Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
              <input 
                type="email" 
                className="form-input" 
                placeholder="vtredusolutions@gmail.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                style={{ paddingLeft: '2.5rem' }}
                required 
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
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

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In as Admin'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Only authorized administrators can log in with email and password. Employees must use their Google accounts.
        </div>
      </div>
    </div>
  );
}

export default Auth;
