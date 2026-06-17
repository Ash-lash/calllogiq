import React, { useState, useEffect } from 'react';
import { Mail, Lock, Briefcase, Calculator, Headphones, Users, Cpu, ArrowLeft, Shield } from 'lucide-react';

function Auth({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('employee'); // 'employee' or 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Domain Selection Flow States
  const [needsDomain, setNeedsDomain] = useState(false);
  const [pendingGoogleToken, setPendingGoogleToken] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');

  // Load Google Identity Services script dynamically
  useEffect(() => {
    const loadGoogleScript = () => {
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

        renderGoogleButton();
      }
    };

    if (window.google) {
      initializeGoogleSignIn();
    } else {
      loadGoogleScript();
    }
  }, [activeTab, needsDomain]);

  // Re-render Google button when active tab switches back to employee
  const renderGoogleButton = () => {
    setTimeout(() => {
      const btnContainer = document.getElementById("google-signin-btn");
      if (window.google && btnContainer) {
        window.google.accounts.id.renderButton(
          btnContainer,
          { 
            theme: "filled_blue", 
            size: "large", 
            width: 320, 
            type: "standard", 
            shape: "pill", 
            text: "signin_with", 
            logo_alignment: "left" 
          }
        );
      }
    }, 100);
  };

  const handleGoogleLoginSuccess = async (response) => {
    setLoading(true);
    setError('');
    const idToken = response.credential;
    
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Google Sign-In failed');
      }

      // Check if user requires domain selection
      if (data.needsDomain) {
        setPendingGoogleToken(idToken);
        setNeedsDomain(true);
      } else {
        onLoginSuccess(data.token, data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDomainConfirm = async (e) => {
    e.preventDefault();
    if (!selectedDomain) {
      setError('Please select a department domain.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: pendingGoogleToken, domain: selectedDomain })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Account setup failed');
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

  // Domain Config Options
  const domains = [
    { id: 'Sales', label: 'Sales', icon: Briefcase, color: '#4f46e5', desc: 'Outbound sales & lead conversion' },
    { id: 'Accounts', label: 'Accounts', icon: Calculator, color: '#7c3aed', desc: 'Billing, payouts & bookkeeping' },
    { id: 'Support', label: 'Support', icon: Headphones, color: '#059669', desc: 'Customer queries & resolution' },
    { id: 'HR', label: 'HR', icon: Users, color: '#ea580c', desc: 'Recruitment & team welfare' },
    { id: 'Operations', label: 'Operations', icon: Cpu, color: '#dc2626', desc: 'Infrastructure & logistics' }
  ];

  return (
    <div className="auth-page-wrapper">
      {/* 2030 Ambient Glowing Blobs */}
      <div className="glowing-blob-1"></div>
      <div className="glowing-blob-2"></div>

      {/* Local styles injection for jaw-dropping visual effects */}
      <style>{`
        .auth-page-wrapper {
          position: relative;
          min-height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f4f6fc;
          font-family: 'Outfit', sans-serif;
          overflow: hidden;
        }

        .glowing-blob-1 {
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0, 0, 0, 0) 70%);
          top: -200px;
          left: -100px;
          animation: floatBlob 15s infinite alternate ease-in-out;
          pointer-events: none;
        }

        .glowing-blob-2 {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, rgba(0, 0, 0, 0) 70%);
          bottom: -150px;
          right: -100px;
          animation: floatBlob 20s infinite alternate-reverse ease-in-out;
          pointer-events: none;
        }

        @keyframes floatBlob {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(80px, 40px) scale(1.1); }
        }

        .futuristic-card {
          position: relative;
          width: 480px;
          padding: 2.75rem 2.5rem;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(25px);
          -webkit-backdrop-filter: blur(25px);
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: 28px;
          box-shadow: 0 25px 50px -12px rgba(79, 70, 229, 0.08);
          z-index: 10;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .futuristic-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 28px;
          padding: 1.5px;
          background: linear-gradient(135deg, rgba(79, 70, 229, 0.15) 0%, rgba(255, 255, 255, 0.4) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        .lottie-container {
          display: flex;
          justify-content: center;
          margin-bottom: 0.5rem;
          transition: all 0.4s ease;
        }

        .brand-title {
          font-family: 'Outfit', sans-serif;
          font-size: 2.35rem;
          font-weight: 900;
          text-align: center;
          letter-spacing: -0.035em;
          background: linear-gradient(135deg, #1e293b 30%, #475569 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 0.25rem;
        }

        .brand-subtitle {
          font-size: 0.98rem;
          color: #475569;
          text-align: center;
          margin-bottom: 2rem;
          font-weight: 500;
        }

        /* Capsule Switcher */
        .capsule-switcher {
          display: flex;
          position: relative;
          background: rgba(241, 245, 249, 0.9);
          padding: 4px;
          border-radius: 9999px;
          border: 1px solid rgba(99, 102, 241, 0.08);
          margin-bottom: 2.5rem;
          cursor: pointer;
        }

        .switcher-slider {
          position: absolute;
          width: calc(50% - 4px);
          height: calc(100% - 8px);
          background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
          border-radius: 9999px;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 15px rgba(79, 70, 229, 0.35);
        }

        .switcher-slider.admin-active {
          transform: translateX(100%);
        }

        .switcher-tab {
          flex: 1;
          text-align: center;
          padding: 10px 0;
          font-size: 0.95rem;
          font-weight: 700;
          color: #64748b;
          z-index: 2;
          transition: color 0.3s ease;
          background: none;
          border: none;
          outline: none;
          cursor: pointer;
        }

        .switcher-tab.active {
          color: #ffffff;
        }

        /* Form Controls */
        .input-group {
          margin-bottom: 1.5rem;
        }

        .input-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 0.5rem;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-field {
          width: 100%;
          padding: 14px 14px 14px 44px;
          background: #f1f5f9;
          border: 1px solid rgba(99, 102, 241, 0.08);
          border-radius: 14px;
          color: #0f172a;
          font-size: 0.95rem;
          outline: none;
          transition: all 0.3s ease;
        }

        .input-field:focus {
          border-color: #6366f1;
          background: #ffffff;
          box-shadow: 0 0 15px rgba(79, 70, 229, 0.15);
        }

        .input-icon {
          position: absolute;
          left: 14px;
          color: #64748b;
          transition: color 0.3s ease;
        }

        .input-field:focus + .input-icon {
          color: #4f46e5;
        }

        /* Interactive Domain Cards */
        .domain-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.8rem;
          margin: 1.5rem 0 2rem 0;
          max-height: 320px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .domain-grid::-webkit-scrollbar {
          width: 4px;
        }
        .domain-grid::-webkit-scrollbar-thumb {
          background: rgba(79, 70, 229, 0.15);
          border-radius: 99px;
        }

        .domain-item-card {
          display: flex;
          align-items: center;
          padding: 14px;
          background: #f1f5f9;
          border: 1px solid rgba(99, 102, 241, 0.08);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .domain-item-card:hover {
          background: #ffffff;
          transform: translateY(-2px);
          border-color: rgba(99, 102, 241, 0.25);
          box-shadow: var(--shadow-sm);
        }

        .domain-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          margin-right: 14px;
          transition: all 0.3s ease;
        }

        .domain-label {
          font-weight: 800;
          font-size: 1rem;
          color: #0f172a;
          letter-spacing: -0.015em;
        }

        .domain-desc {
          font-size: 0.78rem;
          color: #475569;
          margin-top: 2px;
        }

        /* Sign In Button */
        .glowing-btn {
          width: 100%;
          padding: 15px;
          background: var(--gradient-primary);
          border: none;
          outline: none;
          color: #ffffff;
          font-weight: 700;
          font-size: 1rem;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 10px 20px -10px rgba(79, 70, 229, 0.4);
        }

        .glowing-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 25px -5px rgba(79, 70, 229, 0.55);
        }

        .glowing-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .glowing-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Google Integration Styling */
        .google-btn-container {
          display: flex;
          justify-content: center;
          margin: 1.5rem 0;
          filter: drop-shadow(0 4px 12px rgba(79, 70, 229, 0.12));
          transition: transform 0.25s ease;
        }
        
        .google-btn-container:hover {
          transform: scale(1.02);
        }

        .info-disclaimer {
          text-align: center;
          font-size: 0.72rem;
          line-height: 1.4;
          color: #64748b;
          margin-top: 2rem;
        }
      `}</style>

      <div className="futuristic-card">
        {/* Render Lottie Logo (Google GSI scripts will welcome you) */}
        {!needsDomain && (
          <div className="lottie-container">
            <div className="lottie-logo-wrapper">
              <lottie-player
                src="/loginAnimation.json"
                background="transparent"
                speed="1.2"
                style={{ width: '150px', height: '150px' }}
                loop
                autoplay
              ></lottie-player>
            </div>
          </div>
        )}

        {/* Header Title */}
        <h2 className="brand-title">
          {needsDomain ? 'Select Department' : 'CallLogIQ'}
        </h2>
        <p className="brand-subtitle">
          {needsDomain 
            ? 'Complete your account setup to enter the workspace' 
            : 'Sign in to access your portal'}
        </p>

        {error && (
          <div className="alert alert-danger" style={{ 
            background: 'rgba(220, 38, 38, 0.15)', 
            border: '1px solid rgba(220, 38, 38, 0.3)',
            color: '#f87171',
            borderRadius: '12px',
            padding: '12px',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* CONDITIONAL BODY: Needs Domain Selection */}
        {needsDomain ? (
          <form onSubmit={handleDomainConfirm}>
            <span className="input-label">Choose your Domain</span>
            
            <div className="domain-grid">
              {domains.map((dom) => {
                const Icon = dom.icon;
                const isSelected = selectedDomain === dom.id;
                return (
                  <div
                    key={dom.id}
                    className="domain-item-card"
                    onClick={() => {
                      setSelectedDomain(dom.id);
                      setError('');
                    }}
                    style={{
                      borderColor: isSelected ? dom.color : 'rgba(255, 255, 255, 0.08)',
                      boxShadow: isSelected ? `0 0 15px ${dom.color}25` : 'none',
                      background: isSelected ? 'rgba(31, 41, 55, 0.7)' : 'rgba(31, 41, 55, 0.4)'
                    }}
                  >
                    <div className="domain-icon-wrapper" style={{
                      background: isSelected ? dom.color : 'rgba(255, 255, 255, 0.05)',
                      color: isSelected ? '#ffffff' : dom.color
                    }}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <div className="domain-label">{dom.label}</div>
                      <div className="domain-desc">{dom.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button
                type="button"
                className="glowing-btn"
                style={{ 
                  flex: 1, 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: 'none'
                }}
                onClick={() => {
                  setNeedsDomain(false);
                  setPendingGoogleToken('');
                  setSelectedDomain('');
                  setError('');
                }}
                disabled={loading}
              >
                Cancel
              </button>
              
              <button
                type="submit"
                className="glowing-btn"
                style={{ flex: 2 }}
                disabled={loading || !selectedDomain}
              >
                {loading ? 'Completing Setup...' : 'Enter Dashboard'}
              </button>
            </div>
          </form>
        ) : (
          /* STANDARD AUTH FLOW: Login forms & Google Sign-In */
          <>
            {/* iOS style switcher */}
            <div className="capsule-switcher" onClick={() => {
              setActiveTab(activeTab === 'employee' ? 'admin' : 'employee');
              setError('');
            }}>
              <div className={`switcher-slider ${activeTab === 'admin' ? 'admin-active' : ''}`}></div>
              <button className={`switcher-tab ${activeTab === 'employee' ? 'active' : ''}`}>Employee</button>
              <button className={`switcher-tab ${activeTab === 'admin' ? 'active' : ''}`}>Administrator</button>
            </div>

            {/* TAB 1: Employee Access */}
            {activeTab === 'employee' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="input-label" style={{ marginBottom: '1rem' }}>Secure SSO Sign-In</span>
                
                <div id="google-signin-btn" className="google-btn-container" style={{ minHeight: '46px' }}></div>
                
                <p className="info-disclaimer">
                  Click the Google Sign-in button above to authorize access. If this is your first sign-in, you will be prompted to select your domain.
                </p>
              </div>
            )}

            {/* TAB 2: Administrator Access */}
            {activeTab === 'admin' && (
              <form onSubmit={handleAdminSubmit}>
                <div className="input-group">
                  <label className="input-label">Admin Email</label>
                  <div className="input-wrapper">
                    <input 
                      type="email" 
                      className="input-field" 
                      placeholder="vtredusolutions@gmail.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required 
                    />
                    <Mail size={18} className="input-icon" />
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: '2rem' }}>
                  <label className="input-label">Password</label>
                  <div className="input-wrapper">
                    <input 
                      type="password" 
                      className="input-field" 
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required 
                    />
                    <Lock size={18} className="input-icon" />
                  </div>
                </div>

                <button type="submit" className="glowing-btn" disabled={loading}>
                  {loading ? 'Authenticating System...' : 'Access Admin Dashboard'}
                </button>
                
                <p className="info-disclaimer">
                  <Shield size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  Local login is strictly reserved for system administrators. Users must sign in via employee SSO.
                </p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Auth;
