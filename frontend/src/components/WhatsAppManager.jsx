import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Bot, Settings, MessageSquare, Megaphone, Plus, Trash2, 
  Play, RefreshCw, Smartphone, Search, CheckCircle, AlertCircle, 
  HelpCircle, Check, Eye, LayoutDashboard
} from 'lucide-react';
import API_BASE from '../api';

export default function WhatsAppManager({ user, token }) {
  const [portal, setPortal] = useState('gyc'); // 'gyc' | 'vtr'
  const [activeSubTab, setActiveSubTab] = useState('dashboard'); // 'dashboard' | 'inbox' | 'broadcast' | 'chatbot' | 'settings'

  // Lists
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [chatbots, setChatbots] = useState([]);

  // Dashboard Metrics
  const [stats, setStats] = useState({
    totalChats: 0,
    totalMessagesSent: 0,
    totalMessagesReceived: 0,
    totalBroadcasts: 0,
    totalChatbots: 0
  });

  // Selections & Inputs
  const [selectedChat, setSelectedChat] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Modals & Form States
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    name: '',
    templateName: '',
    languageCode: 'en_US',
    contactsInput: '',
    variablesInput: ''
  });

  const [showChatbotModal, setShowChatbotModal] = useState(false);
  const [chatbotForm, setChatbotForm] = useState({
    triggerWord: '',
    triggerType: 'contains', // 'contains' | 'exact'
    replyText: ''
  });

  const messagesEndRef = useRef(null);

  // GYC vs VTR Phone Details
  const portalDetails = {
    gyc: {
      name: 'Get Your College',
      number: '+91 91503 91925',
      phoneId: '756235530895765'
    },
    vtr: {
      name: 'VTR Edu Solutions',
      number: '+91 98843 62838',
      phoneId: '670955309440508'
    }
  };

  // Fetch initial data based on portal
  useEffect(() => {
    fetchChats();
    fetchStats();
    if (activeSubTab === 'broadcast') fetchBroadcasts();
    if (activeSubTab === 'chatbot') fetchChatbots();
  }, [portal, activeSubTab]);

  // Scroll to bottom of messages when new ones arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Polling for new messages in active chat
  useEffect(() => {
    if (activeSubTab !== 'inbox' || !selectedChat) return;
    const interval = setInterval(() => {
      fetchMessages(selectedChat.number, false);
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedChat, activeSubTab]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/stats?portal=${portal}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/chats?portal=${portal}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChats(data);
        // Default select first chat if none selected
        if (data.length > 0 && !selectedChat) {
          setSelectedChat(data[0]);
          fetchMessages(data[0].number);
        }
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  };

  const fetchMessages = async (chatNumber, showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/chats/${chatNumber}/messages?portal=${portal}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !selectedChat) return;
    
    setSendingMessage(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/chats/${selectedChat.number}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          portal,
          body: replyText
        })
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages(prev => [...prev, newMsg]);
        setReplyText('');
        fetchChats(); // refresh last message details
      } else {
        const errData = await res.json();
        alert(`Failed to send: ${errData.error || 'Server error'}`);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const fetchBroadcasts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/broadcasts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(data.filter(b => b.portal === portal));
      }
    } catch (err) {
      console.error('Error fetching broadcasts:', err);
    }
  };

  const handleCreateBroadcast = async (e) => {
    if (e) e.preventDefault();
    const { name, templateName, languageCode, contactsInput, variablesInput } = broadcastForm;
    if (!name || !templateName || !contactsInput) {
      alert('Campaign Name, Template Name, and Contacts are required!');
      return;
    }

    const contactsList = contactsInput
      .split('\n')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    const variablesList = variablesInput
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0);

    try {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/broadcasts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          portal,
          templateName,
          languageCode,
          contacts: contactsList,
          variables: variablesList
        })
      });
      if (res.ok) {
        setShowBroadcastModal(false);
        setBroadcastForm({ name: '', templateName: '', languageCode: 'en_US', contactsInput: '', variablesInput: '' });
        fetchBroadcasts();
      }
    } catch (err) {
      console.error('Error creating broadcast:', err);
    }
  };

  const fetchChatbots = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/chatbots`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatbots(data.filter(b => b.portal === portal));
      }
    } catch (err) {
      console.error('Error fetching chatbots:', err);
    }
  };

  const handleCreateChatbot = async (e) => {
    if (e) e.preventDefault();
    const { triggerWord, triggerType, replyText } = chatbotForm;
    if (!triggerWord || !replyText) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/chatbots`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          portal,
          triggerWord,
          triggerType,
          replyText
        })
      });
      if (res.ok) {
        setShowChatbotModal(false);
        setChatbotForm({ triggerWord: '', triggerType: 'contains', replyText: '' });
        fetchChatbots();
      }
    } catch (err) {
      console.error('Error creating chatbot:', err);
    }
  };

  const handleDeleteChatbot = async (id) => {
    if (!confirm('Are you sure you want to delete this auto-responder rule?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/chatbots/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchChatbots();
      }
    } catch (err) {
      console.error('Error deleting chatbot:', err);
    }
  };

  const handleToggleChatbotActive = async (bot) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/chatbots/${bot.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...bot,
          active: !bot.active
        })
      });
      if (res.ok) {
        fetchChatbots();
      }
    } catch (err) {
      console.error('Error toggling chatbot:', err);
    }
  };

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    fetchMessages(chat.number);
  };

  // Filters chat lists based on search
  const filteredChats = chats.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.number.includes(searchQuery)
  );

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', boxSizing: 'border-box' }}>
      
      {/* Top Banner Header: Switching Portal Accounts */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1rem',
        borderBottom: '2.5px solid #111111',
        paddingBottom: '16px',
        flexShrink: 0
      }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
            WhatsApp Manager
          </h1>
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#666', fontWeight: 500 }}>
            Manage chat portals, auto-responders, and broadcasts
          </p>
        </div>
        
        {/* Portal Switcher Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => { setPortal('gyc'); setSelectedChat(null); setMessages([]); }}
            style={{
              padding: '8px 16px',
              fontSize: '0.9rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              backgroundColor: portal === 'gyc' ? '#111111' : '#ffffff',
              color: portal === 'gyc' ? '#ffffff' : '#111111',
              border: '2.5px solid #111111',
              boxShadow: portal === 'gyc' ? 'none' : '2px 2px 0px #111111',
              cursor: 'pointer',
              transform: portal === 'gyc' ? 'translate(2px, 2px)' : 'none',
              transition: 'all 0.1s ease'
            }}
          >
            🏫 Get Your College
          </button>
          <button 
            onClick={() => { setPortal('vtr'); setSelectedChat(null); setMessages([]); }}
            style={{
              padding: '8px 16px',
              fontSize: '0.9rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              backgroundColor: portal === 'vtr' ? '#111111' : '#ffffff',
              color: portal === 'vtr' ? '#ffffff' : '#111111',
              border: '2.5px solid #111111',
              boxShadow: portal === 'vtr' ? 'none' : '2px 2px 0px #111111',
              cursor: 'pointer',
              transform: portal === 'vtr' ? 'translate(2px, 2px)' : 'none',
              transition: 'all 0.1s ease'
            }}
          >
            🎓 VTR Edu Solutions
          </button>
        </div>
      </div>

      {/* Inner Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexShrink: 0 }}>
        <button 
          onClick={() => setActiveSubTab('dashboard')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', fontSize: '0.85rem', fontWeight: 700,
            border: '2px solid #111111',
            borderRadius: '4px',
            backgroundColor: activeSubTab === 'dashboard' ? '#fee2e2' : '#ffffff',
            cursor: 'pointer'
          }}
        >
          <LayoutDashboard size={16} /> Overview Dashboard
        </button>
        <button 
          onClick={() => setActiveSubTab('inbox')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', fontSize: '0.85rem', fontWeight: 700,
            border: '2px solid #111111',
            borderRadius: '4px',
            backgroundColor: activeSubTab === 'inbox' ? '#fcf0d5' : '#ffffff',
            cursor: 'pointer'
          }}
        >
          <MessageSquare size={16} /> Chat Inbox
        </button>
        <button 
          onClick={() => setActiveSubTab('broadcast')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', fontSize: '0.85rem', fontWeight: 700,
            border: '2px solid #111111',
            borderRadius: '4px',
            backgroundColor: activeSubTab === 'broadcast' ? '#dcfce7' : '#ffffff',
            cursor: 'pointer'
          }}
        >
          <Megaphone size={16} /> Bulk Broadcasts
        </button>
        <button 
          onClick={() => setActiveSubTab('chatbot')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', fontSize: '0.85rem', fontWeight: 700,
            border: '2px solid #111111',
            borderRadius: '4px',
            backgroundColor: activeSubTab === 'chatbot' ? '#dbeafe' : '#ffffff',
            cursor: 'pointer'
          }}
        >
          <Bot size={16} /> Auto-Responders
        </button>
        <button 
          onClick={() => setActiveSubTab('settings')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', fontSize: '0.85rem', fontWeight: 700,
            border: '2px solid #111111',
            borderRadius: '4px',
            backgroundColor: activeSubTab === 'settings' ? '#f3e8ff' : '#ffffff',
            cursor: 'pointer'
          }}
        >
          <Settings size={16} /> API Settings
        </button>
      </div>

      {/* Main Inner Tab Workspace Section */}
      <div style={{ 
        flex: 1, 
        border: '2.5px solid #111111', 
        borderRadius: '8px', 
        backgroundColor: '#ffffff', 
        boxShadow: '4px 4px 0px #111111',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* ========================================== */}
        {/* TAB 0: OVERVIEW DASHBOARD                  */}
        {/* ========================================== */}
        {/* ========================================== */}
        {/* TAB 0: OVERVIEW DASHBOARD                  */}
        {/* ========================================== */}
        {activeSubTab === 'dashboard' && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dashboard Overview</h3>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>Real-time campaigns, limits, and service credentials balance</span>
              </div>
              <button 
                onClick={() => { fetchStats(); fetchChats(); }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ffffff',
                  color: '#111',
                  border: '2.5px solid #111111',
                  borderRadius: '4px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '3px 3px 0px #111111',
                  transition: 'transform 0.1s',
                }}
              >
                <RefreshCw size={15} /> Refresh Data
              </button>
            </div>

            {/* Top row: Welcome + Account Status */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              
              {/* Left Welcome Card */}
              <div style={{ 
                flex: '1.5 1 500px',
                border: '3px solid #111111',
                borderRadius: '8px',
                padding: '24px',
                backgroundColor: '#f5f3ff', 
                boxShadow: '6px 6px 0px #111111',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '260px'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '1.4rem', fontWeight: 900, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Welcome back, {portalDetails[portal].name}! 👋
                  </h4>
                  
                  {/* Dashboard stats rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px dashed #cccccc' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#444' }}>Total Campaigns</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#111' }}>{stats.totalCampaigns || stats.totalBroadcasts || 0}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px dashed #cccccc' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#444' }}>Today's Campaigns</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#22c55e' }}>{stats.todaysCampaigns || 0}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px dashed #cccccc' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#444' }}>Messages to unique phones (last 7 days)</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#2563eb' }}>{stats.uniquePhones7Days || 0}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '4px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#444' }}>Messages to unique phones (last 24 hours)</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ea580c' }}>{stats.uniquePhones24Hours || 0}</span>
                    </div>

                  </div>
                </div>

                <div style={{ marginTop: '20px', fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', backgroundColor: '#fee2e2', padding: '6px 12px', borderRadius: '4px', border: '1.5px solid #ef4444', alignSelf: 'flex-start' }}>
                  Your plan expiring on: {stats.planExpiry || '28 Feb 2027'}
                </div>
              </div>

              {/* Right Account Status Card */}
              <div style={{ 
                flex: '1 1 320px',
                border: '3px solid #111111',
                borderRadius: '8px',
                padding: '24px',
                backgroundColor: '#ffffff',
                boxShadow: '6px 6px 0px #111111',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '2.5px solid #111111' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', color: '#666' }}>Channel Info</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 900, backgroundColor: '#dcfce7', color: '#15803d', border: '1.5px solid #15803d', padding: '4px 8px', borderRadius: '4px' }}>
                    <span style={{ width: '6px', height: '6px', backgroundColor: '#15803d', borderRadius: '50%' }}></span>
                    CONNECTED
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ color: '#666', fontSize: '0.72rem', fontWeight: 700 }}>Phone Number</span>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{portalDetails[portal].number}</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ color: '#666', fontSize: '0.72rem', fontWeight: 700 }}>Verified Name</span>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{portalDetails[portal].name}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ color: '#666', fontSize: '0.72rem', fontWeight: 700 }}>Quality Rating</span>
                    <span style={{ fontWeight: 800, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      🟢 Green (High Quality)
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ color: '#666', fontSize: '0.72rem', fontWeight: 700 }}>Messaging Limit</span>
                    <span style={{ fontWeight: 800 }}>100K messages/day</span>
                  </div>

                </div>
              </div>

            </div>

            {/* Bottom row: Credits Grid */}
            <div>
              <h4 style={{ margin: '0 0 16px 0', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.95rem' }}>Service Balances & Credits</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                
                {/* WABA Credits */}
                <div style={{ border: '2.5px solid #111111', borderRadius: '6px', padding: '16px', backgroundColor: '#e0e7ff', boxShadow: '4px 4px 0px #111111' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.75rem', color: '#4338ca', textTransform: 'uppercase' }}>WABA Credits</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, backgroundColor: '#c7d2fe', color: '#4338ca', padding: '2px 6px', borderRadius: '4px', border: '1px solid #4338ca' }}>PLAN1</span>
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1e1b4b' }}>{stats.wabaCredits || '₹1,247.4'}</div>
                  <div style={{ fontSize: '0.7rem', color: '#4f46e5', marginTop: '4px', fontWeight: 700 }}>WhatsApp conversation balance</div>
                </div>

                {/* AI Credits */}
                <div style={{ border: '2.5px solid #111111', borderRadius: '6px', padding: '16px', backgroundColor: '#e0f2fe', boxShadow: '4px 4px 0px #111111' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.75rem', color: '#0369a1', textTransform: 'uppercase' }}>AI Credits</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, backgroundColor: '#bae6fd', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', border: '1px solid #0369a1' }}>Gemini</span>
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0c4a6e' }}>{stats.aiCredits || 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#0284c7', marginTop: '4px', fontWeight: 700 }}>Model tokens & auto-responder AI</div>
                </div>

                {/* Voice Credits */}
                <div style={{ border: '2.5px solid #111111', borderRadius: '6px', padding: '16px', backgroundColor: '#dcfce7', boxShadow: '4px 4px 0px #111111' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.75rem', color: '#15803d', textTransform: 'uppercase' }}>Voice Credits</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, backgroundColor: '#bbf7d0', color: '#15803d', padding: '2px 6px', borderRadius: '4px', border: '1px solid #15803d' }}>IVR</span>
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#052e16' }}>{stats.voiceCredits || 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#16a34a', marginTop: '4px', fontWeight: 700 }}>Call logs & voice notifications</div>
                </div>

                {/* RCS Credits */}
                <div style={{ border: '2.5px solid #111111', borderRadius: '6px', padding: '16px', backgroundColor: '#fef9c3', boxShadow: '4px 4px 0px #111111' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.75rem', color: '#a21caf', textTransform: 'uppercase' }}>RCS Credits</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, backgroundColor: '#fef08a', color: '#a21caf', padding: '2px 6px', borderRadius: '4px', border: '1px solid #a21caf' }}>RichSMS</span>
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#4a044e' }}>{stats.rcsCredits || 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#d946ef', marginTop: '4px', fontWeight: 700 }}>Next-gen SMS marketing campaigns</div>
                </div>

              </div>
            </div>

            {/* Next Steps / Testing Help banner if no chats */}
            {stats.totalChats === 0 && (
              <div style={{ border: '2.5px solid #111111', borderRadius: '6px', padding: '16px', backgroundColor: '#fffbeb', display: 'flex', gap: '12px', alignItems: 'flex-start', boxShadow: '4px 4px 0px #111111' }}>
                <AlertCircle size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h5 style={{ margin: '0 0 4px 0', fontWeight: 800, fontSize: '0.9rem', color: '#92400e' }}>No Conversations Stored Yet</h5>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#b45309', lineHeight: '1.4' }}>
                    To test your webhook setup and see chats appear here:
                    <ol style={{ paddingLeft: '16px', margin: '4px 0 0 0' }}>
                      <li>Send a test WhatsApp message from your personal phone to <strong>{portalDetails[portal].number}</strong>.</li>
                      <li>Our webhook will process the incoming message, save it, and it will show up instantly under the <strong>Chat Inbox</strong>!</li>
                    </ol>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 1: REAL-TIME CHAT INBOX                 */}
        {/* ========================================== */}
        {activeSubTab === 'inbox' && (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            
            {/* Left sidebar chats list */}
            <div style={{ width: '320px', borderRight: '2px solid #111111', display: 'flex', flexDirection: 'column', backgroundColor: '#fcfcfc' }}>
              
              {/* Searchbox */}
              <div style={{ padding: '12px', borderBottom: '2px solid #111111', position: 'relative' }}>
                <input 
                  type="text"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 8px 8px 30px',
                    fontSize: '0.85rem',
                    border: '2px solid #111111',
                    borderRadius: '4px',
                    boxSizing: 'border-box'
                  }}
                />
                <Search size={14} style={{ position: 'absolute', left: '22px', top: '21px', color: '#666' }} />
              </div>
              
              {/* List */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredChats.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '0.85rem' }}>
                    No conversations found.
                  </div>
                ) : (
                  filteredChats.map(chat => {
                    const isSelected = selectedChat && selectedChat.number === chat.number;
                    return (
                      <div 
                        key={chat.id}
                        onClick={() => handleSelectChat(chat)}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #eee',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#fcf0d5' : '#ffffff',
                          transition: 'background-color 0.1s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111' }}>
                            {chat.name}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#888' }}>
                            {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: '#666', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                            {chat.lastMessage || 'No messages yet'}
                          </span>
                          {chat.unreadCount > 0 && (
                            <span style={{ 
                              backgroundColor: '#ef4444', 
                              color: '#fff', 
                              fontSize: '0.65rem', 
                              fontWeight: 700, 
                              padding: '2px 6px', 
                              borderRadius: '10px'
                            }}>
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right message log details */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f9f9f9' }}>
              {selectedChat ? (
                <>
                  {/* Chat header details */}
                  <div style={{ padding: '12px 20px', borderBottom: '2px solid #111111', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontWeight: 800 }}>{selectedChat.name}</h4>
                      <span style={{ fontSize: '0.75rem', color: '#888' }}>+{selectedChat.number}</span>
                    </div>
                    <button 
                      onClick={() => fetchMessages(selectedChat.number, true)}
                      style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title="Refresh Chat"
                    >
                      <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    </button>
                  </div>

                  {/* Messages Bubble History */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {loading && messages.length === 0 ? (
                      <div style={{ margin: 'auto', textAlign: 'center', color: '#888' }}>
                        Loading chat history...
                      </div>
                    ) : messages.length === 0 ? (
                      <div style={{ margin: 'auto', textAlign: 'center', color: '#aaa', fontSize: '0.85rem' }}>
                        No message history. Write a message below to start chatting.
                      </div>
                    ) : (
                      messages.map(msg => {
                        const isMe = msg.fromMe;
                        return (
                          <div 
                            key={msg.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignSelf: isMe ? 'flex-end' : 'flex-start',
                              maxWidth: '65%'
                            }}
                          >
                            <div style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              border: '2px solid #111111',
                              boxShadow: '2px 2px 0px #111111',
                              backgroundColor: isMe ? '#dbeafe' : '#ffffff',
                              color: '#111111',
                              fontSize: '0.85rem',
                              lineHeight: '1.4',
                              wordBreak: 'break-word'
                            }}>
                              {msg.body}
                            </div>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              fontSize: '0.65rem', 
                              color: '#888', 
                              marginTop: '4px',
                              alignSelf: isMe ? 'flex-end' : 'flex-start'
                            }}>
                              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isMe && (
                                <span>
                                  {msg.status === 'read' ? '🔵 Read' : msg.status === 'delivered' ? '✓✓' : '✓'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input box */}
                  <form onSubmit={handleSendMessage} style={{ padding: '16px', borderTop: '2px solid #111111', backgroundColor: '#fff', display: 'flex', gap: '8px' }}>
                    <input 
                      type="text"
                      placeholder="Type your reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      disabled={sendingMessage}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        border: '2.5px solid #111111',
                        borderRadius: '4px',
                        fontSize: '0.9rem',
                        outline: 'none',
                        boxShadow: '1px 1px 0px #111111'
                      }}
                    />
                    <button 
                      type="submit"
                      disabled={sendingMessage || !replyText.trim()}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#111111',
                        color: '#fff',
                        border: '2.5px solid #111111',
                        borderRadius: '4px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Send size={16} /> Send
                    </button>
                  </form>
                </>
              ) : (
                <div style={{ margin: 'auto', textAlign: 'center', color: '#999' }}>
                  <MessageSquare size={48} style={{ opacity: 0.2, marginBottom: '12px' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>No Chat Selected</p>
                  <span style={{ fontSize: '0.8rem' }}>Select a contact from the sidebar list to start messaging.</span>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: BULK BROADCAST CAMPAIGNS            */}
        {/* ========================================== */}
        {activeSubTab === 'broadcast' && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800 }}>Broadcast Campaigns</h3>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>Run bulk WhatsApp campaigns using Meta message templates</span>
              </div>
              <button 
                onClick={() => setShowBroadcastModal(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#22c55e',
                  color: '#fff',
                  border: '2px solid #111111',
                  borderRadius: '4px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '2px 2px 0px #111111'
                }}
              >
                <Plus size={16} /> New Broadcast
              </button>
            </div>

            {/* Campaigns List Table */}
            <div style={{ border: '2px solid #111111', borderRadius: '6px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #111111' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 800 }}>Campaign Name</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800 }}>Template Name</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800 }}>Recipients</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800 }}>Success / Failed</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800 }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {broadcasts.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#999' }}>
                        No broadcast campaigns triggered yet. Click "New Broadcast" to start.
                      </td>
                    </tr>
                  ) : (
                    broadcasts.map(bc => (
                      <tr key={bc.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>{bc.name}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{bc.templateName}</td>
                        <td style={{ padding: '12px 16px' }}>{bc.totalContacts}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ color: '#22c55e', fontWeight: 700 }}>{bc.successCount || 0}</span> / <span style={{ color: '#ef4444', fontWeight: 700 }}>{bc.failedCount || 0}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            fontWeight: 700, 
                            padding: '3px 8px', 
                            borderRadius: '12px',
                            backgroundColor: bc.status === 'completed' ? '#dcfce7' : bc.status === 'running' ? '#dbeafe' : '#f3f4f6',
                            color: bc.status === 'completed' ? '#15803d' : bc.status === 'running' ? '#1e40af' : '#1f2937',
                            border: '1px solid #111'
                          }}>
                            {bc.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#666' }}>
                          {new Date(bc.createdAt).toLocaleDateString()} {new Date(bc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: CHATBOT AUTO-RESPONDERS             */}
        {/* ========================================== */}
        {activeSubTab === 'chatbot' && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800 }}>Auto-Responders</h3>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>Configure keyword-based auto-replies to automate customer FAQ responses</span>
              </div>
              <button 
                onClick={() => setShowChatbotModal(true)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: '2px solid #111111',
                  borderRadius: '4px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '2px 2px 0px #111111'
                }}
              >
                <Plus size={16} /> Add New Rule
              </button>
            </div>

            {/* Chatbots Rule List Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {chatbots.length === 0 ? (
                <div style={{ padding: '48px', border: '2px dashed #ccc', borderRadius: '6px', textAlign: 'center', color: '#999' }}>
                  No auto-responder rules defined yet. Create your first automated rule!
                </div>
              ) : (
                chatbots.map(bot => (
                  <div 
                    key={bot.id}
                    style={{
                      border: '2px solid #111111',
                      borderRadius: '6px',
                      padding: '16px',
                      boxShadow: '2px 2px 0px #111111',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: bot.active ? '#ffffff' : '#f9f9f9',
                      opacity: bot.active ? 1 : 0.7
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 700, 
                          backgroundColor: bot.triggerType === 'exact' ? '#fee2e2' : '#fef9c3',
                          color: bot.triggerType === 'exact' ? '#991b1b' : '#854d0e',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid #111'
                        }}>
                          {bot.triggerType.toUpperCase()}
                        </span>
                        <h4 style={{ margin: 0, fontWeight: 800 }}>If message triggers keyword: "{bot.triggerWord}"</h4>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#333', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        💬 Auto-reply: <strong>{bot.replyText}</strong>
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Active Toggle Switch */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                        <input 
                          type="checkbox"
                          checked={bot.active}
                          onChange={() => handleToggleChatbotActive(bot)}
                        />
                        {bot.active ? 'Active' : 'Inactive'}
                      </label>
                      
                      {/* Delete */}
                      <button 
                        onClick={() => handleDeleteChatbot(bot.id)}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          border: '2px solid #111111',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* ========================================== */}
        {/* TAB 4: API CONFIGURATION SETTINGS          */}
        {/* ========================================== */}
        {activeSubTab === 'settings' && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0', fontWeight: 800 }}>Account & API Setup Status</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Account Details Banner */}
              <div style={{ border: '2px solid #111111', borderRadius: '6px', padding: '16px', backgroundColor: '#fafafa', boxShadow: '2px 2px 0px #111111' }}>
                <h4 style={{ margin: '0 0 12px 0', fontWeight: 800 }}>Current Configuration: {portalDetails[portal].name}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                  <div>
                    <strong>Portal Name:</strong> {portalDetails[portal].name}
                  </div>
                  <div>
                    <strong>Phone Number ID:</strong> <code style={{ backgroundColor: '#e2e8f0', padding: '2px 4px', borderRadius: '2px' }}>{portalDetails[portal].phoneId}</code>
                  </div>
                  <div>
                    <strong>Display Number:</strong> {portalDetails[portal].number}
                  </div>
                  <div>
                    <strong>WABA Account ID:</strong> <code style={{ backgroundColor: '#e2e8f0', padding: '2px 4px', borderRadius: '2px' }}>2410097762707241</code>
                  </div>
                </div>
              </div>

              {/* Webhook Configuration Guide */}
              <div style={{ border: '2px solid #111111', borderRadius: '6px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Meta Webhook Integration Instructions</h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#666' }}>
                  Configure these settings inside the Meta Developer App Dashboard to push new incoming customer messages to CallLogiq in real-time.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '10px', backgroundColor: '#fcfcfc' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Callback URL</div>
                    <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                      {`${window.location.protocol}//${window.location.host}/api/admin/whatsapp/webhook`}
                    </code>
                  </div>
                  <div style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '10px', backgroundColor: '#fcfcfc' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Verify Token</div>
                    <code style={{ fontSize: '0.8rem' }}>calllogiq_whatsapp_verify_token_2026</code>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                  <strong>How to set it up:</strong>
                  <ol style={{ paddingLeft: '20px', margin: '8px 0' }}>
                    <li>Log in to <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>developers.facebook.com</a>.</li>
                    <li>Open your WhatsApp App (<strong>CallLogIQ</strong>).</li>
                    <li>In the left sidebar, click <strong>WhatsApp</strong> &gt; <strong>Configuration</strong>.</li>
                    <li>Click <strong>Edit</strong> in the Webhooks box, copy the Callback URL and Verify Token from above, and click <strong>Verify and save</strong>.</li>
                    <li>Click <strong>Manage</strong> next to Webhook Fields, and click <strong>Subscribe</strong> to the <strong>messages</strong> and <strong>message_deliveries</strong> fields.</li>
                  </ol>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* ========================================== */}
      {/* MODAL: TRIGGER NEW BROADCAST               */}
      {/* ========================================== */}
      {showBroadcastModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            border: '3px solid #111111',
            borderRadius: '8px',
            padding: '24px',
            width: '500px',
            boxShadow: '6px 6px 0px #111111',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ margin: 0, fontWeight: 900, textTransform: 'uppercase' }}>Launch Bulk Campaign</h3>
            <form onSubmit={handleCreateBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Campaign Name</label>
                <input 
                  type="text"
                  placeholder="e.g. June Admissions Blast"
                  required
                  value={broadcastForm.name}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '2px solid #111', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Template Name (from Meta Manager)</label>
                <input 
                  type="text"
                  placeholder="e.g. gyc_admission_alert"
                  required
                  value={broadcastForm.templateName}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, templateName: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '2px solid #111', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Language Code</label>
                  <input 
                    type="text"
                    value={broadcastForm.languageCode}
                    onChange={(e) => setBroadcastForm(prev => ({ ...prev, languageCode: e.target.value }))}
                    style={{ width: '100%', padding: '8px', border: '2px solid #111', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Template Variables (comma-sep)</label>
                  <input 
                    type="text"
                    placeholder="e.g. John, Monday"
                    value={broadcastForm.variablesInput}
                    onChange={(e) => setBroadcastForm(prev => ({ ...prev, variablesInput: e.target.value }))}
                    style={{ width: '100%', padding: '8px', border: '2px solid #111', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Recipient Contact Numbers (one per line, e.g. 919876543210)</label>
                <textarea 
                  placeholder="919876543210&#10;919999999999"
                  required
                  rows="5"
                  value={broadcastForm.contactsInput}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, contactsInput: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '2px solid #111', borderRadius: '4px', boxSizing: 'border-box', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button 
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  style={{ padding: '8px 16px', border: '2px solid #111', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ padding: '8px 16px', backgroundColor: '#22c55e', color: '#fff', border: '2px solid #111', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                >
                  Launch Campaign
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: ADD CHATBOT AUTO-RESPONDER RULE      */}
      {/* ========================================== */}
      {showChatbotModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            border: '3px solid #111111',
            borderRadius: '8px',
            padding: '24px',
            width: '450px',
            boxShadow: '6px 6px 0px #111111',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ margin: 0, fontWeight: 900, textTransform: 'uppercase' }}>Add Automated Rule</h3>
            <form onSubmit={handleCreateChatbot} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Trigger Keyword / Phrase</label>
                <input 
                  type="text"
                  placeholder="e.g. fees"
                  required
                  value={chatbotForm.triggerWord}
                  onChange={(e) => setChatbotForm(prev => ({ ...prev, triggerWord: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '2px solid #111', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Match Type</label>
                <select 
                  value={chatbotForm.triggerType}
                  onChange={(e) => setChatbotForm(prev => ({ ...prev, triggerType: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '2px solid #111', borderRadius: '4px', boxSizing: 'border-box', fontWeight: 600 }}
                >
                  <option value="contains">Contains (responds if keyword is present anywhere)</option>
                  <option value="exact">Exact Match (responds only if message is exactly the keyword)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>Reply Message</label>
                <textarea 
                  placeholder="e.g. Our current fees structure can be found at..."
                  required
                  rows="4"
                  value={chatbotForm.replyText}
                  onChange={(e) => setChatbotForm(prev => ({ ...prev, replyText: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '2px solid #111', borderRadius: '4px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button 
                  type="button"
                  onClick={() => setShowChatbotModal(false)}
                  style={{ padding: '8px 16px', border: '2px solid #111', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: '#fff', border: '2px solid #111', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                >
                  Create Rule
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
