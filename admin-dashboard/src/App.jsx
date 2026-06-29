import React, { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

const API = import.meta.env.VITE_API_URL || ''

// Error boundary — shows crash reason instead of blank page
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{padding:'2rem',fontFamily:'monospace',background:'#fee2e2',minHeight:'100vh'}}>
        <h2 style={{color:'#dc2626'}}>⚠ Dashboard Error</h2>
        <p style={{color:'#7f1d1d',marginTop:'1rem'}}>{this.state.error?.message}</p>
        <pre style={{marginTop:'1rem',fontSize:'0.8rem',color:'#7f1d1d',whiteSpace:'pre-wrap'}}>{this.state.error?.stack}</pre>
        <button onClick={()=>window.location.reload()} style={{marginTop:'1rem',padding:'0.5rem 1rem',background:'#dc2626',color:'white',border:'none',borderRadius:'6px',cursor:'pointer'}}>Reload</button>
      </div>
    )
    return this.props.children
  }
}

/* ── Theme ────────────────────────────────────────────────────────────────── */
const C = {
  sidebar:      '#111318',
  sidebarHov:   'rgba(200,168,112,0.08)',
  accent:       '#c8a870',
  accentLight:  'rgba(200,168,112,0.12)',
  accentMid:    'rgba(200,168,112,0.28)',
  accentDark:   '#f1e8d8',
  bg:           '#0f0608',
  white:        '#111318',
  border:       'rgba(232,224,208,0.10)',
  borderGray:   'rgba(232,224,208,0.10)',
  text:         '#e8e0d0',
  textDark:     '#f6efe1',
  textMuted:    'rgba(232,224,208,0.62)',
  red:          '#ef4444',
  redLight:     'rgba(239,68,68,0.12)',
  yellow:       '#d4aa55',
  yellowLight:  'rgba(212,170,85,0.14)',
  blue:         '#7fa8c9',
  blueLight:    'rgba(127,168,201,0.14)',
  purple:       '#9b7bbb',
  purpleLight:  'rgba(155,123,187,0.14)',
}

const NAV_ITEMS = [
  { id:'dashboard',    label:'Dashboard',    icon:'▦' },
  { id:'merchants',    label:'Merchants',    icon:'🏪' },
  { id:'pos-devices',  label:'POS Devices',  icon:'🖥' },
  { id:'transactions', label:'Transactions', icon:'💳' },
  { id:'disputes',     label:'Disputes',     icon:'⚠' },
  { id:'verifications',label:'Verifications',icon:'🔍' },
  { id:'webhooks',     label:'Webhooks',     icon:'🔔' },
  { id:'settings',     label:'Settings',     icon:'⚙' },
  { id:'profile',      label:'Profile',      icon:'👤' },
]

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

/* ── Tiny hover-lift style injected once ─────────────────────────────────── */
const GLOBAL_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    color: #e8e0d0;
    background-color: #0f0608;
    background-image:
      repeating-linear-gradient(90deg, transparent 0, transparent 14px, rgba(255,255,255,0.014) 14px, rgba(255,255,255,0.014) 15px),
      repeating-linear-gradient(89deg, transparent 0, transparent 32px, rgba(0,0,0,0.11) 32px, rgba(0,0,0,0.11) 34px),
      linear-gradient(175deg, #1e0a0e 0%, #0f0608 40%, #160810 70%, #120608 100%);
  }
  button, input, textarea, select { font: inherit; }
  h1, h2, h3, h4, h5, h6 { font-family: inherit; letter-spacing: 0; font-weight: 600; }
  .lift { transition: transform 0.18s ease, box-shadow 0.18s ease; }
  .lift:hover { transform: translateY(-3px); box-shadow: 0 20px 44px rgba(0,0,0,0.34) !important; }
  .lift-sm { transition: transform 0.15s ease; }
  .lift-sm:hover { transform: translateY(-2px); }
  .nav-btn { transition: background 0.15s, color 0.15s, transform 0.15s; }
  .nav-btn:hover { background: rgba(200,168,112,0.10) !important; transform: translateX(3px); }
  .row-hover { transition: background 0.12s; }
  .row-hover:hover { background: rgba(200,168,112,0.08) !important; cursor: pointer; }
  input:focus, textarea:focus { border-color: #c8a870 !important; box-shadow: 0 0 0 3px rgba(200,168,112,0.12); }
  .message-input { background:#000 !important; color:#fff !important; border-color:#000 !important; }
  .message-input::placeholder { color:rgba(255,255,255,0.68); }
  @keyframes marqueeScroll { from{transform:translateX(100%)} to{transform:translateX(-100%)} }
  .marquee-track { display:inline-block; white-space:nowrap; min-width:100%; animation:marqueeScroll 24s linear infinite; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #c8a870; border-radius: 3px; }
  @keyframes bellPulse { 0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 50%{transform:scale(1.12);box-shadow:0 0 0 10px rgba(239,68,68,0)} }
  @keyframes loginFloat { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(0,-16px,0)} }
  @keyframes loginPulse { 0%,100%{opacity:0.45} 50%{opacity:0.85} }
  .login-shell { min-height:100vh; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; padding:2rem; }
  .login-grid { position:relative; z-index:2; width:min(1120px, 100%); display:grid; grid-template-columns:1.05fr 0.95fr; gap:1.5rem; align-items:stretch; }
  .login-card { position:relative; border:1px solid rgba(232,224,208,0.10); background:rgba(17,19,24,0.9); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); box-shadow:0 28px 90px rgba(0,0,0,0.42); border-radius:30px; overflow:hidden; }
  .login-card::before { content:''; position:absolute; inset:0; border-radius:inherit; border:1px solid rgba(200,168,112,0.12); pointer-events:none; }
  .login-info { padding:2.3rem; display:flex; flex-direction:column; justify-content:space-between; min-height:640px; }
  .login-form-card { padding:2.1rem; display:flex; flex-direction:column; justify-content:center; min-height:640px; }
  .login-overline { display:inline-flex; align-items:center; gap:0.5rem; width:max-content; padding:0.45rem 0.8rem; border-radius:999px; border:1px solid rgba(232,224,208,0.10); background:rgba(255,255,255,0.03); color:#c8a870; font-size:0.72rem; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; font-family:inherit; }
  .login-title { margin:1rem 0 0.75rem; color:#f6efe1; font-size:clamp(2.2rem, 5vw, 4rem); line-height:0.96; letter-spacing:0.12em; max-width:9ch; }
  .login-copy { margin:0; color:rgba(232,224,208,0.62); font-size:1rem; line-height:1.7; max-width:56ch; }
  .login-feature-list { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:0.85rem; margin-top:1.6rem; }
  .login-feature { padding:1rem; border-radius:18px; background:rgba(255,255,255,0.03); border:1px solid rgba(232,224,208,0.08); }
  .login-feature-label { margin:0 0 0.35rem; color:#c8a870; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.04em; font-weight:600; font-family:inherit; }
  .login-feature-value { margin:0; color:#f6efe1; font-size:0.95rem; font-weight:600; line-height:1.4; }
  .login-preview { margin-top:auto; border-radius:22px; padding:1.15rem; background:linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03)); border:1px solid rgba(232,224,208,0.08); }
  .login-preview-top { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
  .login-preview-chip { display:inline-flex; align-items:center; gap:0.45rem; padding:0.35rem 0.7rem; border-radius:999px; background:rgba(255,255,255,0.04); color:#f6efe1; font-size:0.75rem; font-weight:600; }
  .login-preview-line { height:10px; border-radius:999px; background:linear-gradient(90deg, rgba(200,168,112,0.18), rgba(255,255,255,0.04)); margin-bottom:0.75rem; }
  .login-preview-line:last-child { margin-bottom:0; width:72%; }
  .login-logo-wrap { display:flex; align-items:center; gap:0.9rem; margin-bottom:1.1rem; }
  .login-logo-mark { width:56px; height:56px; border-radius:18px; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, var(--login-accent), var(--login-accent-2)); color:#111318; font-size:1.35rem; box-shadow:0 14px 36px rgba(200,168,112,0.16); }
  .login-panel-title { margin:0; color:#f6efe1; font-size:1.9rem; font-weight:600; letter-spacing:0.08em; }
  .login-panel-copy { margin:0.3rem 0 0; color:rgba(232,224,208,0.62); font-size:0.92rem; font-family:inherit; letter-spacing:0.03em; text-transform:uppercase; }
  .login-mode-switch { display:flex; gap:0.4rem; margin:1.35rem 0 1.25rem; padding:0.3rem; background:rgba(255,255,255,0.03); border:1px solid rgba(232,224,208,0.08); border-radius:16px; }
  .login-mode-btn { flex:1; border:none; border-radius:12px; padding:0.8rem 0.9rem; background:transparent; color:rgba(232,224,208,0.62); font-size:0.8rem; font-weight:600; cursor:pointer; transition:all 0.18s ease; letter-spacing:0.04em; text-transform:uppercase; font-family:inherit; }
  .login-mode-btn.active { background:rgba(200,168,112,0.12); color:#f6efe1; box-shadow:0 10px 28px rgba(0,0,0,0.18); }
  .login-field-label { display:block; margin-bottom:0.45rem; color:rgba(232,224,208,0.62); font-size:0.74rem; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; font-family:inherit; }
  .login-alert { padding:0.85rem 0.95rem; border-radius:16px; margin-bottom:1rem; font-size:0.88rem; border:1px solid transparent; }
  .login-alert.error { background:rgba(239,68,68,0.12); color:#fecaca; border-color:rgba(248,113,113,0.20); }
  .login-alert.success { background:rgba(200,168,112,0.12); color:#f6efe1; border-color:rgba(200,168,112,0.20); }
  .login-submit { width:100%; padding:0.95rem 1rem; border:none; border-radius:16px; background:linear-gradient(135deg, var(--login-accent), var(--login-accent-2)); color:#111318; font-size:0.96rem; font-weight:700; cursor:pointer; box-shadow:0 16px 36px rgba(200,168,112,0.18); }
  .login-note { margin-top:0.9rem; padding:0.9rem 0.95rem; border-radius:16px; background:rgba(212,170,85,0.12); border:1px solid rgba(212,170,85,0.20); color:#f4dfb5; font-size:0.82rem; line-height:1.6; }
  .login-theme-panel { position:absolute; left:2rem; bottom:2rem; z-index:3; padding:0.5rem; border-radius:999px; border:1px solid rgba(232,224,208,0.12); background:rgba(17,19,24,0.72); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); box-shadow:0 12px 32px rgba(0,0,0,0.35); }
  .login-theme-thumbs { display:flex; align-items:center; gap:0.55rem; }
  .login-theme-thumb { width:22px; height:22px; border-radius:999px; border:2px solid transparent; cursor:pointer; transition:transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
  .login-theme-thumb:hover { transform:scale(1.14); }
  .login-theme-thumb.active { border-color:#f6efe1; transform:scale(1.14); box-shadow:0 0 14px rgba(200,168,112,0.28); }
  .login-bg-orb { position:absolute; border-radius:50%; filter:blur(12px); animation:loginFloat 10s ease-in-out infinite; opacity:0.65; pointer-events:none; }
  .login-bg-orb.one { width:380px; height:380px; top:-80px; left:-60px; background:radial-gradient(circle, rgba(200,168,112,0.18), transparent 70%); }
  .login-bg-orb.two { width:440px; height:440px; right:-120px; top:8%; background:radial-gradient(circle, rgba(110,42,42,0.24), transparent 72%); animation-duration:14s; }
  .login-bg-orb.three { width:320px; height:320px; bottom:-90px; right:18%; background:radial-gradient(circle, rgba(255,255,255,0.10), transparent 72%); animation-duration:12s; }
  .login-grid-lines { position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size:34px 34px; mask-image:radial-gradient(circle at center, black 40%, transparent 88%); opacity:0.16; pointer-events:none; }
  .login-ring { position:absolute; inset:auto 12% 8% auto; width:340px; height:340px; border-radius:50%; border:1px solid rgba(232,224,208,0.08); box-shadow:inset 0 0 0 1px rgba(255,255,255,0.02); animation:loginPulse 4.5s ease-in-out infinite; pointer-events:none; }
  .login-ring::before, .login-ring::after { content:''; position:absolute; inset:28px; border-radius:50%; border:1px solid rgba(232,224,208,0.06); }
  .login-ring::after { inset:62px; border-color:rgba(232,224,208,0.04); }
  @media (max-width: 980px) {
    .login-grid { grid-template-columns:1fr; }
    .login-info, .login-form-card { min-height:auto; }
    .login-feature-list { grid-template-columns:1fr; }
    .login-theme-panel { position:static; margin-top:1.25rem; width:max-content; }
  }
  @media (max-width: 640px) {
    .login-shell { padding:1rem; }
    .login-info, .login-form-card { padding:1.25rem; }
    .login-logo-wrap { flex-direction:column; align-items:flex-start; }
  }
`

const LOGIN_THEMES = [
  {
    name: 'Reserve',
    accent: '#c8a870',
    accent2: '#9f7c42',
    background: 'radial-gradient(circle at top, rgba(200,168,112,0.12), transparent 30%), linear-gradient(175deg,#1e0a0e 0%,#0f0608 40%,#160810 70%,#120608 100%)',
    badge: 'PrimeStack Reserve',
    heading: 'Luxury control for every Moto POS operation.',
    copy: 'The dashboard keeps every workflow intact while carrying the same dark-charcoal, deep-burgundy, and warm-gold language from your shared theme.',
  },
  {
    name: 'Burgundy',
    accent: '#b88d63',
    accent2: '#6e2a2a',
    background: 'radial-gradient(circle at 18% 16%, rgba(184,141,99,0.14), transparent 34%), radial-gradient(circle at 88% 10%, rgba(110,42,42,0.18), transparent 34%), linear-gradient(175deg,#1e0a0e 0%,#0f0608 40%,#160810 70%,#120608 100%)',
    badge: 'Evening Service',
    heading: 'Refined access built for live operations.',
    copy: 'This keeps the same premium visual family while giving you a slightly richer burgundy mood on the login surface.',
  },
  {
    name: 'Ledger',
    accent: '#d4b27a',
    accent2: '#704d2f',
    background: 'radial-gradient(circle at 20% 18%, rgba(212,178,122,0.16), transparent 32%), radial-gradient(circle at 82% 14%, rgba(112,77,47,0.18), transparent 32%), linear-gradient(175deg,#1e0a0e 0%,#0f0608 40%,#160810 70%,#120608 100%)',
    badge: 'House Ledger',
    heading: 'Warm gold surfaces for merchants, verifications, and risk review.',
    copy: 'A third variation in the same family, built to stay close to the CodePen mood instead of drifting into a different design language.',
  },
]

export { ErrorBoundary }
export default function App() {
  const [token,  setToken]  = useState(localStorage.getItem('adminToken'))
  const [admin,  setAdmin]  = useState(() => { const s=localStorage.getItem('adminData'); return s?JSON.parse(s):null })
  const [tab,    setTab]    = useState('dashboard')
  const [showAddMerchant, setShowAddMerchant] = useState(false)
  const [loginEmail,    setLoginEmail]    = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginMode,     setLoginMode]     = useState('password') // 'password' | 'recovery'
  const [loginTheme,    setLoginTheme]    = useState(0)
  const [recoveryKey,   setRecoveryKey]   = useState('')
  const [msg, setMsg] = useState(null)

  const [merchants,   setMerchants]   = useState([])
  const [posDevices,  setPosDevices]  = useState([])
  const [orders,      setOrders]      = useState([])
  const [transactions, setTransactions] = useState([])
  const [webhooks,    setWebhooks]    = useState([])
  const [verifications, setVerifications] = useState([])
  const [selVerif,    setSelVerif]    = useState(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [disputes,    setDisputes]    = useState([])
  const [fraudFlags,  setFraudFlags]  = useState([])
  const [selDispute,  setSelDispute]  = useState(null)
  const [adminNotifs, setAdminNotifs] = useState([])
  const [showNotif,   setShowNotif]   = useState(false)
  const [showChat,    setShowChat]    = useState(false)
  const [chatMerchant, setChatMerchant] = useState(null) // selected merchant for chat
  const [conversations, setConversations] = useState([])
  const [chatMessages,  setChatMessages]  = useState([])
  const [chatInput,     setChatInput]     = useState('')
  const chatEndRef = React.useRef(null)

  const [selMerchant, setSelMerchant] = useState(null)
  const [selPos,      setSelPos]      = useState(null)
  const [selPayment,  setSelPayment]  = useState(null)
  const [selTransaction, setSelTransaction] = useState(null)
  const [selWebhook,  setSelWebhook]  = useState(null)
  const [filterMerchantId, setFilterMerchantId] = useState(null)
  const [systemOnline, setSystemOnline] = useState(true)
  const [systemMsg,    setSystemMsg]    = useState('')
  const [togglingSystem, setTogglingSystem] = useState(false) // filter POS/payments by merchant

  const [newM, setNewM] = useState({ name:'', email:'', phone:'', address:'', country:'' })

  const H = { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }

  // Continuous alarm — keeps ringing until admin clicks a notification
  const alarmRef = React.useRef(null)
  const alarmCtxRef = React.useRef(null)

  const stopAlarm = React.useCallback(() => {
    if (alarmRef.current) {
      clearInterval(alarmRef.current)
      alarmRef.current = null
    }
    if (alarmCtxRef.current) {
      try { alarmCtxRef.current.close() } catch(e){}
      alarmCtxRef.current = null
    }
  }, [])

  const playAlarm = React.useCallback(() => {
    stopAlarm() // reset before starting
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      alarmCtxRef.current = ctx

      const ringOnce = () => {
        try {
          // Loud urgent alarm pattern: 3 rapid beeps
          const beep = (freq, start, dur) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.type = 'square'
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
            gain.gain.setValueAtTime(0.8, ctx.currentTime + start)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
            osc.start(ctx.currentTime + start)
            osc.stop(ctx.currentTime + start + dur + 0.01)
          }
          beep(880, 0.00, 0.12)
          beep(880, 0.15, 0.12)
          beep(1100, 0.30, 0.20)
        } catch(e){}
      }

      ringOnce()
      // Keep ringing every 2 seconds
      alarmRef.current = setInterval(ringOnce, 2000)
    } catch(e){ console.log('Audio not available:', e.message) }
  }, [stopAlarm])

  useEffect(() => {
    if (token) { load() }
  }, [token])

  const load = () => {
    fetchJSON(`${API}/admin/merchants`,    H, d => d.merchants   && setMerchants(d.merchants))
    fetchJSON(`${API}/admin/pos-devices`,  H, d => d.posDevices  && setPosDevices(d.posDevices))
    fetchJSON(`${API}/admin/orders`,       H, d => d.orders      && setOrders(d.orders))
    fetchJSON(`${API}/admin/transactions`, H, d => d.transactions && setTransactions(d.transactions))
    fetchJSON(`${API}/admin/webhook-logs`, H, d => d.webhookLogs && setWebhooks(d.webhookLogs))
    loadVerifications()
    fetchJSON(`${API}/admin/notifications`,H, d => d.notifications && setAdminNotifs(d.notifications))
    fetchJSON(`${API}/system/status`,      {}, d => { if(d.online!==undefined){ setSystemOnline(d.online); setSystemMsg(d.message||'') } })
    fetchJSON(`${API}/admin/disputes`,     H, d => d.disputes   && setDisputes(d.disputes))
    fetchJSON(`${API}/admin/fraud-flags`,  H, d => d.fraudFlags && setFraudFlags(d.fraudFlags))
  }

  const loadVerifications = async () => {
    try {
      const r = await fetch(`${API}/admin/verifications`, { headers: H })
      const d = await r.json()
      if (d.verifications) setVerifications(d.verifications)
    } catch(e) {}
  }

  // Poll notifications, transactions, and chat conversations every 2 seconds for real-time updates
  useEffect(() => {
    if (!token) return
    const interval = setInterval(async () => {
      try {
        // Poll notifications
        const notifR = await fetch(`${API}/admin/notifications`, { headers: H })
        const notifD = await notifR.json()
        if (notifD.notifications) {
          setAdminNotifs(prev => {
            const newUnread = notifD.notifications.filter(n => !n.read).length
            const prevUnread = prev.filter(n => !n.read).length
            if (newUnread > prevUnread) {
              playAlarm()
            }
            return notifD.notifications
          })
        }

        // Poll transactions
        const txR = await fetch(`${API}/admin/transactions`, { headers: H })
        const txD = await txR.json()
        if (txD.transactions) {
          setTransactions(txD.transactions)
        }

        await loadVerifications()

        // Poll chat conversations
        const chatR = await fetch(`${API}/admin/chats`, { headers: H })
        const chatD = await chatR.json()
        if (chatD.conversations) setConversations(chatD.conversations)
      } catch(e) {}
    }, 2000)
    return () => clearInterval(interval)
  }, [token, playAlarm])

  const fetchJSON = async (url, headers, cb) => {
    try { const r = await fetch(url,{headers}); cb(await r.json()) } catch(e){}
  }

  const handleLogin = async e => {
    e.preventDefault()
    try {
      const r = await fetch(`${API}/admin/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:loginEmail,password:loginPassword}) })
      const d = await r.json()
      if (d.token) {
        const a = d.admin || { name:'Admin', email:loginEmail }
        setToken(d.token); setAdmin(a)
        localStorage.setItem('adminToken',d.token)
        localStorage.setItem('adminData',JSON.stringify(a))
        setMsg(null)
      } else setMsg({t:'e', text:d.error||'Login failed'})
    } catch { setMsg({t:'e', text:'Cannot connect to server'}) }
  }

  const handleRecoveryLogin = async e => {
    e.preventDefault()
    try {
      const r = await fetch(`${API}/admin/login/recovery`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ recoveryKey })
      })
      const d = await r.json()
      if (d.token) {
        const a = d.admin || { name:'Admin', email:'' }
        setToken(d.token); setAdmin(a)
        localStorage.setItem('adminToken', d.token)
        localStorage.setItem('adminData', JSON.stringify(a))
        setMsg(null); setRecoveryKey('')
        if (d.newRecoveryKey) {
          setTimeout(() => alert('NEW RECOVERY KEY — SAVE THIS NOW:\n\n' + d.newRecoveryKey + '\n\nThis will not be shown again.'), 500)
        }
      } else { setMsg({t:'e', text: d.error||'Invalid recovery key'}) }
    } catch { setMsg({t:'e', text:'Cannot connect to server'}) }
  }

  const handleLogout = () => {
    setToken(null); setAdmin(null)
    localStorage.removeItem('adminToken'); localStorage.removeItem('adminData')
  }

  const handleAddMerchant = async e => {
    e.preventDefault()
    try {
      const r = await fetch(`${API}/admin/merchants`, {method:'POST',headers:H,body:JSON.stringify(newM)})
      const d = await r.json()
      if (d.merchant_id) {
        setMsg({t:'s', text:`✅ Merchant created! Login: ${d.login_email} | Password: ${d.temp_password}`})
        setNewM({name:'',email:'',phone:'',address:'',country:''})
        setShowAddMerchant(false)
        fetchJSON(`${API}/admin/merchants`, H, d => d.merchants && setMerchants(d.merchants))
      } else setMsg({t:'e', text:d.error||'Failed'})
    } catch(e){}
  }

  const toggleMerchant = async (merchantId, cur) => {
    const ns = cur==='active'?'suspended':'active'
    const r = await fetch(`${API}/admin/merchants/${merchantId}/status`,{method:'POST',headers:H,body:JSON.stringify({status:ns})})
    const d = await r.json()
    if (d.merchant_id) {
      fetchJSON(`${API}/admin/merchants`, H, d => d.merchants && setMerchants(d.merchants))
      setSelMerchant(p => p ? {...p,status:ns} : null)
    }
  }

  const resetMerchantPassword = async (merchantId) => {
    if (!confirm('Are you sure you want to reset this merchant\'s password?')) return;
    try {
      const r = await fetch(`${API}/admin/merchants/${merchantId}/reset-password`, {
        method: 'POST',
        headers: H
      });
      const d = await r.json();
      if (d.temp_password) {
        setMsg({
          t: 's',
          text: `✅ Password reset! New temporary password: ${d.temp_password}`
        });
      } else {
        setMsg({ t: 'e', text: d.error || 'Failed to reset password' });
      }
    } catch (e) {
      setMsg({ t: 'e', text: 'Error resetting password' });
    }
  }

  const deleteMerchant = async (merchantId) => {
    if (!confirm('WARNING: This will delete the merchant and ALL their data (POS, orders, customers, chat, etc.)! Are you 100% sure?')) return;
    try {
      const r = await fetch(`${API}/admin/merchants/${merchantId}`, {
        method: 'DELETE',
        headers: H
      });
      const d = await r.json();
      if (d.message) {
        setMsg({ t: 's', text: '✅ Merchant deleted successfully!' });
        // Reload merchants
        fetchJSON(`${API}/admin/merchants`, H, d => d.merchants && setMerchants(d.merchants));
        // Go back to merchant list
        setSelMerchant(null);
      } else {
        setMsg({ t: 'e', text: d.error || 'Failed to delete merchant' });
      }
    } catch (e) {
      setMsg({ t: 'e', text: 'Error deleting merchant' });
    }
  }

  const createPosDevice = async (merchantId) => {
    try {
      const r = await fetch(`${API}/admin/merchants/${merchantId}/pos-devices`, {
        method: 'POST',
        headers: H
      });
      const d = await r.json();
      if (d.activation_code) {
        setMsg({ 
          t: 's', 
          text: `✅ POS Device created! POS ID: ${d.pos_id}, Activation Code: ${d.activation_code}` 
        });
        // Reload pos devices
        fetchJSON(`${API}/admin/pos-devices`, H, d => d.posDevices && setPosDevices(d.posDevices));
      } else {
        setMsg({ t: 'e', text: d.error || 'Failed to create POS device' });
      }
    } catch (e) {
      setMsg({ t: 'e', text: 'Error creating POS device' });
    }
  }

  const togglePos = async (posId, cur) => {
    const ns = cur==='active'?'disabled':'active'
    const r = await fetch(`${API}/admin/pos-devices/${posId}/status`,{method:'POST',headers:H,body:JSON.stringify({status:ns})})
    const d = await r.json()
    if (d.pos_id) {
      fetchJSON(`${API}/admin/pos-devices`, H, d => d.posDevices && setPosDevices(d.posDevices))
      setSelPos(p => p ? {...p,status:ns} : null)
    }
  }

  const deletePosDevice = async (posId) => {
    if (!confirm('Delete this POS device? This action cannot be undone.')) return
    try {
      const r = await fetch(`${API}/admin/pos-devices/${posId}`, { method:'DELETE', headers:H })
      const d = await r.json()
      if (d.message) {
        setMsg({ t:'s', text:'POS device deleted successfully.' })
        setSelPos(null)
        fetchJSON(`${API}/admin/pos-devices`, H, d => d.posDevices && setPosDevices(d.posDevices))
      } else {
        setMsg({ t:'e', text:d.error || 'Failed to delete POS device' })
      }
    } catch(e) {
      setMsg({ t:'e', text:'Error deleting POS device' })
    }
  }



  // Start alarm when new unread notifications arrive, stop when all read
  const prevUnreadRef = React.useRef(0)
  useEffect(() => {
    const unread = adminNotifs.filter(n=>!n.read).length
    if (unread > prevUnreadRef.current) {
      playAlarm()
    } else if (unread === 0) {
      stopAlarm()
    }
    prevUnreadRef.current = unread
  }, [adminNotifs, playAlarm, stopAlarm])

  // Stop alarm when component unmounts
  useEffect(() => { return () => stopAlarm() }, [stopAlarm])

  const playNotifSound = () => {} // kept for compatibility — alarm handles sound now

  const markNotifRead = async (id) => {
    try {
      await fetch(`${API}/admin/notifications/${id}/read`, { method:'POST', headers:H })
      setAdminNotifs(prev => {
        const updated = prev.map(n => n.id===id ? {...n,read:true} : n)
        if (updated.filter(n=>!n.read).length === 0) stopAlarm()
        return updated
      })
    } catch(e){}
  }

  const markAllRead = async () => {
    try {
      await fetch(`${API}/admin/notifications/read-all`, { method:'POST', headers:H })
      setAdminNotifs(prev => prev.map(n => ({...n,read:true})))
      stopAlarm()
    } catch(e){}
  }

  const toggleSystem = async () => {
    setTogglingSystem(true)
    try {
      const newOnline = !systemOnline
      const r = await fetch(`${API}/admin/system/toggle`, {
        method: 'POST', headers: H,
        body: JSON.stringify({ online: newOnline, message: newOnline ? 'System is operational' : 'System is currently offline for maintenance. Please try again later.' })
      })
      const d = await r.json()
      if (d.online !== undefined) {
        setSystemOnline(d.online)
        setSystemMsg(d.message)
        setMsg({ t: 's', text: `System set to ${d.online ? 'ONLINE' : 'OFFLINE'}. All merchants notified.` })
        setTimeout(() => setMsg(null), 4000)
      }
    } catch(e) { console.error(e) }
    setTogglingSystem(false)
  }

  const loadConversations = async () => {
    try {
      const r = await fetch(`${API}/admin/chats`, { headers: H })
      const d = await r.json()
      if (d.conversations) setConversations(d.conversations)
    } catch(e){}
  }

  const openChat = async (merchant) => {
    setChatMerchant(merchant)
    try {
      const r = await fetch(`${API}/admin/chats/${merchant.merchantId}`, { headers: H })
      const d = await r.json()
      if (d.messages) { setChatMessages(d.messages); setTimeout(() => chatEndRef.current?.scrollIntoView({behavior:'smooth'}), 100) }
    } catch(e){}
  }

  const sendChatMsg = async () => {
    if (!chatInput.trim() || !chatMerchant) return
    const text = chatInput.trim()
    setChatInput('')
    try {
      const r = await fetch(`${API}/admin/chats/${chatMerchant.merchantId}`, {
        method: 'POST', headers: H, body: JSON.stringify({ message: text })
      })
      const d = await r.json()
      if (d.message) {
        setChatMessages(prev => [...prev, d.message])
        setTimeout(() => chatEndRef.current?.scrollIntoView({behavior:'smooth'}), 100)
      }
    } catch(e){}
  }

  const reviewVerification = async (id, action) => {
    try {
      const r = await fetch(`${API}/admin/verifications/${id}/review`, {
        method:'POST', headers:H, body:JSON.stringify({action, notes:reviewNotes})
      })
      const d = await r.json()
      if (d.message) {
        setSelVerif(null); setReviewNotes('')
        load()
      }
    } catch(e){ console.error(e) }
  }

  const exportCSV = () => {
    const rows = [['Order ID','Merchant','Amount','Status','POS ID'],
      ...orders.map(o=>[o.orderId,o.merchant?.businessName||'Unknown',`${o.currency} ${o.amount.toFixed(2)}`,o.status,o.posDevice?.posId||'N/A'])]
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}))
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const parseWebhookPayload = (webhook) => {
    try { return JSON.parse(webhook.payload || '{}') } catch { return {} }
  }

  const webhookMerchantName = (webhook) => {
    const payload = parseWebhookPayload(webhook)
    return payload.dashboard_merchant_name || payload.metadata?.merchant_name || payload.metadata?.merchant_id || 'Unknown'
  }

  const handleDownload = (doc) => {
    try {
      // Convert base64 to blob
      const base64Data = doc.base64.split(',')[1];
      const byteString = atob(base64Data);
      const mimeString = doc.base64.split(',')[0].split(':')[1].split(';')[0];
      
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([ab], { type: mimeString });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      a.click();
      
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
    }
  }

  const navTo = t => {
    setTab(t)
    setSelMerchant(null); setSelPos(null); setSelPayment(null); setSelWebhook(null)
    setSelVerif(null); setSelDispute(null); setShowAddMerchant(false); setMsg(null)
    setFilterMerchantId(null)
    if (t === 'verifications') loadVerifications()
  }

  const navToFiltered = (t, merchantId) => {
    setTab(t)
    setSelMerchant(null); setSelPos(null); setSelPayment(null); setSelWebhook(null)
    setSelVerif(null); setShowAddMerchant(false); setMsg(null)
    setFilterMerchantId(merchantId) // keep filter for this merchant
  }

  // ── Chart data — safe, never crashes on empty ──────────────────────────────
  const last7 = Array.from({length:7}).map((_,i) => {
    try {
      const d = new Date(); d.setDate(d.getDate()-6+i)
      const ds = d.toDateString()
      const label = d.toLocaleDateString('en-US',{weekday:'short'})
      const vol = (orders||[]).filter(o=>o.status==='paid'&&new Date(o.createdAt).toDateString()===ds).reduce((a,o)=>a+(o.amount||0),0)
      const cnt = (orders||[]).filter(o=>new Date(o.createdAt).toDateString()===ds).length
      return { day:label, volume:+vol.toFixed(2), orders:cnt }
    } catch(e) { return {day:'',volume:0,orders:0} }
  })

  const todayVol = (orders||[]).filter(o=>o.status==='paid'&&new Date(o.createdAt).toDateString()===new Date().toDateString()).reduce((a,o)=>a+(o.amount||0),0)
  const totalVol = (orders||[]).filter(o=>o.status==='paid').reduce((a,o)=>a+(o.amount||0),0)

  // Filtered data when navigating from merchant detail
  const filteredPosDevices = filterMerchantId ? (posDevices||[]).filter(p=>p.merchantId===filterMerchantId) : posDevices
  const filteredOrders     = filterMerchantId ? (orders||[]).filter(o=>o.merchantId===filterMerchantId)     : orders
  const filterLabel        = filterMerchantId ? merchants.find(m=>m.id===filterMerchantId) : null
  const activeLoginTheme = LOGIN_THEMES[loginTheme] || LOGIN_THEMES[0]

  // ── LOGIN PAGE ──────────────────────────────────────────────────────────────
  if (!token) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div
        className="login-shell"
        style={{
          background: activeLoginTheme.background,
          '--login-accent': activeLoginTheme.accent,
          '--login-accent-2': activeLoginTheme.accent2,
        }}
      >
        <div className="login-bg-orb one" />
        <div className="login-bg-orb two" />
        <div className="login-bg-orb three" />
        <div className="login-grid-lines" />
        <div className="login-ring" />

        <div className="login-grid">
          <section className="login-card login-info">
            <div>
              <span className="login-overline">{activeLoginTheme.badge}</span>
              <h1 className="login-title">{activeLoginTheme.heading}</h1>
              <p className="login-copy">{activeLoginTheme.copy}</p>

              <div className="login-feature-list">
                <div className="login-feature">
                  <p className="login-feature-label">Access</p>
                  <p className="login-feature-value">Admin password and recovery key modes stay active.</p>
                </div>
                <div className="login-feature">
                  <p className="login-feature-label">Monitoring</p>
                  <p className="login-feature-value">Transactions, verifications, and merchant alerts are one sign-in away.</p>
                </div>
                <div className="login-feature">
                  <p className="login-feature-label">Theme</p>
                  <p className="login-feature-value">{activeLoginTheme.name} is applied live from the selector below.</p>
                </div>
              </div>
            </div>

            <div className="login-preview">
              <div className="login-preview-top">
                <span className="login-preview-chip">Live Admin Surface</span>
                <span className="login-preview-chip">Secure Session</span>
              </div>
              <div className="login-preview-line" style={{width:'88%'}} />
              <div className="login-preview-line" style={{width:'96%'}} />
              <div className="login-preview-line" style={{width:'78%'}} />
            </div>
          </section>

          <section className="login-card login-form-card">
            <div className="login-logo-wrap">
              <div className="login-logo-mark">
                <img src="/logo.png" alt="PrimeStack" style={{height:'34px',width:'34px',objectFit:'contain'}} onError={e=>{e.target.style.display='none'}} />
              </div>
              <div>
                <h2 className="login-panel-title">Admin Login</h2>
                <p className="login-panel-copy">
                  {loginMode==='password' ? 'Sign in to PrimeStack Moto POS' : 'Use your one-time emergency recovery key'}
                </p>
              </div>
            </div>

            <div className="login-mode-switch">
              {[['password','Password'],['recovery','Recovery Key']].map(([m,l])=>(
                <button
                  key={m}
                  type="button"
                  className={`login-mode-btn ${loginMode===m ? 'active' : ''}`}
                  onClick={()=>{setLoginMode(m);setMsg(null)}}
                >
                  {l}
                </button>
              ))}
            </div>

            {msg && <div className={`login-alert ${msg.t==='e' ? 'error' : 'success'}`}>{msg.text}</div>}

            {loginMode==='password' && (
              <form onSubmit={handleLogin}>
                <div style={{marginBottom:'1rem'}}>
                  <label className="login-field-label">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e=>setLoginEmail(e.target.value)}
                    required
                    placeholder="admin@primestack.com"
                    style={{...INP, background:'rgba(255,255,255,0.06)', color:'#fff', border:'1.5px solid rgba(255,255,255,0.12)'}}
                  />
                </div>
                <div style={{marginBottom:'1.2rem'}}>
                  <label className="login-field-label">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e=>setLoginPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{...INP, background:'rgba(255,255,255,0.06)', color:'#fff', border:'1.5px solid rgba(255,255,255,0.12)'}}
                  />
                </div>
                <button type="submit" className="lift login-submit">Access Dashboard</button>
              </form>
            )}

            {loginMode==='recovery' && (
              <form onSubmit={handleRecoveryLogin}>
                <div style={{marginBottom:'1rem'}}>
                  <label className="login-field-label">Recovery Key</label>
                  <input
                    type="text"
                    value={recoveryKey}
                    onChange={e=>setRecoveryKey(e.target.value.toUpperCase())}
                    required
                    placeholder="PS-RK-XXXXXXXXXXXXXXXXXXXXXXXX"
                    style={{...INP, background:'rgba(255,255,255,0.06)', color:'#fff', border:'1.5px solid rgba(255,255,255,0.12)', fontFamily:'monospace', fontSize:'0.8rem', letterSpacing:'0.04em'}}
                  />
                </div>
                <div className="login-note">
                  This key works once only. After successful access, save the newly generated replacement key immediately.
                </div>
                <button type="submit" className="lift login-submit" style={{marginTop:'1rem'}}>
                  Emergency Access
                </button>
              </form>
            )}
          </section>
        </div>

        <div className="login-theme-panel">
          <div className="login-theme-thumbs">
            {LOGIN_THEMES.map((theme, index)=>(
              <button
                key={theme.name}
                type="button"
                className={`login-theme-thumb ${loginTheme===index ? 'active' : ''}`}
                onClick={()=>setLoginTheme(index)}
                title={theme.name}
                style={{background:`linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`}}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )

  // ── MAIN SHELL ──────────────────────────────────────────────────────────────
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{display:'flex',minHeight:'100vh',background:C.bg}}>

        {/* ── SIDEBAR ── */}
        <aside style={{width:'230px',background:C.sidebar,display:'flex',flexDirection:'column',position:'sticky',top:0,height:'100vh',flexShrink:0}}>
          {/* Logo */}
          <div style={{padding:'1.25rem',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',gap:'0.75rem'}}>
            <img src="/logo.png" alt="Logo" style={{height:'36px',objectFit:'contain',borderRadius:'8px'}} onError={e=>e.target.style.display='none'} />
            <span style={{color:'white',fontWeight:'800',fontSize:'1rem',letterSpacing:'-0.01em'}}>PrimeStack</span>
          </div>

          {/* Admin chip */}
          <div style={{padding:'0.875rem 1.25rem',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',gap:'0.625rem'}}>
            <div style={{width:'34px',height:'34px',background:'rgba(22,163,74,0.3)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:C.accentMid,fontWeight:'800',fontSize:'0.875rem',flexShrink:0}}>
              {admin?.name?.charAt(0)||'A'}
            </div>
            <div style={{minWidth:0}}>
              <p style={{color:'white',fontSize:'0.8rem',fontWeight:'700',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{admin?.name||'Admin'}</p>
              <p style={{color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',margin:0}}>Administrator</p>
            </div>
          </div>

          {/* Nav */}
          <nav style={{flex:1,padding:'1rem 0.75rem',overflowY:'auto'}}>
            <p style={{color:'rgba(255,255,255,0.3)',fontSize:'0.65rem',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.1em',padding:'0 0.625rem',marginBottom:'0.5rem',marginTop:0}}>Main Menu</p>
            {NAV_ITEMS.map(n=>(
              <button key={n.id} className="nav-btn"
                onClick={()=>navTo(n.id)}
                style={{width:'100%',display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.625rem 0.75rem',
                  background:tab===n.id?C.accent:'transparent',
                  color:tab===n.id?'white':'rgba(255,255,255,0.65)',
                  border:'none',borderRadius:'10px',cursor:'pointer',fontSize:'0.875rem',
                  fontWeight:tab===n.id?'700':'400',textAlign:'left',marginBottom:'2px'}}>
                <span style={{fontSize:'1rem',width:'20px',textAlign:'center'}}>{n.icon}</span>
                {n.label}
                {tab===n.id && <span style={{marginLeft:'auto',width:'6px',height:'6px',background:'white',borderRadius:'50%'}} />}
              </button>
            ))}
          </nav>

          {/* Logout */}
          <div style={{padding:'0.875rem 0.75rem',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
            <button className="nav-btn" onClick={handleLogout}
              style={{width:'100%',display:'flex',alignItems:'center',gap:'0.625rem',padding:'0.625rem 0.75rem',background:'rgba(239,68,68,0.12)',color:'#fca5a5',border:'none',borderRadius:'10px',cursor:'pointer',fontSize:'0.875rem',fontWeight:'600'}}>
              <span>🚪</span> Sign Out
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>
          {/* Header */}
          <header style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:'0 2rem',height:'62px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,boxShadow:'0 1px 8px rgba(22,163,74,0.07)'}}>
            <div>
              <h1 style={{fontSize:'1.1rem',fontWeight:'800',color:C.text,margin:0}}>{NAV_ITEMS.find(n=>n.id===tab)?.label||'Dashboard'}</h1>
              <p style={{fontSize:'0.72rem',color:C.textMuted,margin:0}}>{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'0.875rem'}}>

              {/* System Status Toggle */}
              <div style={{display:'flex',alignItems:'center',gap:'0.625rem',background:systemOnline?'rgba(200,168,112,0.12)':'#fee2e2',padding:'0.375rem 0.875rem',borderRadius:'20px',border:`1px solid ${systemOnline?'#d8bf8c':'#fca5a5'}`}}>
                <span style={{width:'8px',height:'8px',borderRadius:'50%',background:systemOnline?'#c8a870':'#ef4444',boxShadow:systemOnline?'0 0 6px #c8a870':'0 0 6px #ef4444',flexShrink:0,animation:!systemOnline?'pulse 1s infinite':'none'}}/>
                <span style={{fontSize:'0.75rem',fontWeight:'700',color:systemOnline?'#f4dfb5':'#dc2626'}}>{systemOnline?'ONLINE':'OFFLINE'}</span>
                <button onClick={toggleSystem} disabled={togglingSystem}
                  style={{background:systemOnline?'#ef4444':'#c8a870',color:'white',border:'none',borderRadius:'12px',padding:'0.2rem 0.625rem',fontSize:'0.72rem',fontWeight:'700',cursor:'pointer',opacity:togglingSystem?0.6:1}}>
                  {togglingSystem?'...':(systemOnline?'Go Offline':'Go Online')}
                </button>
              </div>

              {/* Notification Bell */}
              <div style={{position:'relative'}}>
                <button onClick={()=>setShowNotif(!showNotif)}
                  style={{width:'40px',height:'40px',background:adminNotifs.filter(n=>!n.read).length>0?'#fee2e2':C.white,border:`1.5px solid ${adminNotifs.filter(n=>!n.read).length>0?'#fca5a5':C.border}`,borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'1.1rem',position:'relative',flexShrink:0,transition:'all 0.3s',animation:adminNotifs.filter(n=>!n.read).length>0?'bellPulse 1s ease-in-out infinite':'none'}}>
                  🔔
                  {adminNotifs.filter(n=>!n.read).length>0&&(
                    <span style={{position:'absolute',top:'-5px',right:'-5px',background:C.red,color:'white',borderRadius:'50%',minWidth:'18px',height:'18px',fontSize:'0.65rem',fontWeight:'800',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 3px'}}>
                      {adminNotifs.filter(n=>!n.read).length}
                    </span>
                  )}
                </button>

                {/* Dropdown panel */}
                {showNotif&&(
                  <div style={{position:'absolute',right:0,top:'110%',width:'360px',background:C.white,borderRadius:'16px',boxShadow:'0 12px 40px rgba(0,0,0,0.15)',border:`1px solid ${C.border}`,zIndex:1000,maxHeight:'480px',display:'flex',flexDirection:'column'}}>
                    <div style={{padding:'0.875rem 1.125rem',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
                      <div>
                        <p style={{fontWeight:'800',color:C.text,margin:0,fontSize:'0.9rem'}}>Notifications</p>
                        <p style={{fontSize:'0.72rem',color:C.textMuted,margin:0}}>{adminNotifs.filter(n=>!n.read).length} unread</p>
                      </div>
                      <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
                        {adminNotifs.filter(n=>!n.read).length>0&&(
                          <button onClick={markAllRead} style={{fontSize:'0.72rem',color:C.accent,background:'none',border:'none',cursor:'pointer',fontWeight:'600'}}>Mark all read</button>
                        )}
                        <button onClick={()=>setShowNotif(false)} style={{background:'none',border:'none',cursor:'pointer',color:C.textMuted,fontSize:'1rem',lineHeight:1}}>✕</button>
                      </div>
                    </div>
                    <div style={{overflowY:'auto',flex:1}}>
                      {adminNotifs.length===0
                        ?<p style={{padding:'2rem',textAlign:'center',color:C.textMuted,fontSize:'0.875rem'}}>No notifications yet</p>
                        :adminNotifs.map(n=>(
                          <div key={n.id} onClick={()=>{markNotifRead(n.id); if(n.type==='verification_submitted'){navTo('verifications')}; setShowNotif(false)}}
                            style={{padding:'0.875rem 1.125rem',borderBottom:`1px solid ${C.border}`,cursor:'pointer',background:n.read?'transparent':C.accentLight,transition:'background 0.15s',display:'flex',gap:'0.75rem',alignItems:'flex-start'}}>
                            <div style={{width:'34px',height:'34px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',flexShrink:0,
                              background: n.type==='verification_submitted'?'#dbeafe':n.type==='payment_flagged'?'#fee2e2':n.type==='payment_succeeded'?C.accentLight:'#f3f4f6'}}>
                              {n.type==='verification_submitted'?'🔍':n.type==='payment_flagged'?'🚫':n.type==='payment_succeeded'?'✅':'🔔'}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{fontSize:'0.8rem',fontWeight:'700',color:C.textDark,margin:'0 0 0.2rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{n.title}</p>
                              <p style={{fontSize:'0.75rem',color:C.textMuted,margin:'0 0 0.25rem',lineHeight:1.4}}>{n.message}</p>
                              <p style={{fontSize:'0.68rem',color:C.textMuted,margin:0}}>{new Date(n.createdAt).toLocaleString()}</p>
                            </div>
                            {!n.read&&<span style={{width:'8px',height:'8px',background:C.accent,borderRadius:'50%',flexShrink:0,marginTop:'0.3rem'}}/>}
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>

              <div style={{textAlign:'right'}}>
                <p style={{fontSize:'0.8rem',fontWeight:'600',color:C.text,margin:0}}>{admin?.name}</p>
                <p style={{fontSize:'0.7rem',color:C.textMuted,margin:0}}>{admin?.email}</p>
              </div>
              <div style={{width:'38px',height:'38px',background:`linear-gradient(135deg,${C.accent},${C.accentDark})`,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'800',fontSize:'0.9rem',boxShadow:'0 2px 8px rgba(22,163,74,0.4)'}}>
                {admin?.name?.charAt(0)||'A'}
              </div>
            </div>
          </header>

          <div style={{height:'34px',background:'#000',color:'#fff',display:'flex',alignItems:'center',overflow:'hidden',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
            <div className="marquee-track" style={{fontSize:'0.85rem',fontWeight:'700',letterSpacing:'0.02em'}}>
              Admin Control Center — Merchant Verification, POS Management, Settlement Monitoring.
            </div>
          </div>

          {/* Message */}
          {msg && (
            <div style={{margin:'1rem 2rem 0',padding:'0.875rem 1rem',borderRadius:'12px',fontSize:'0.875rem',fontWeight:'500',
              background:msg.t==='s'?C.accentLight:C.redLight,color:msg.t==='s'?C.accentDark:C.red,
              border:`1px solid ${msg.t==='s'?C.accentMid:'#fecaca'}`}}>
              {msg.text}
            </div>
          )}

          {/* Page content */}
          <main style={{flex:1,padding:'1.5rem 2rem',overflowY:'auto'}}>

            {/* ══ DASHBOARD ══ */}
            {tab==='dashboard' && (
              <div>
                {/* Stat cards */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:'1rem',marginBottom:'1.5rem'}}>
                  {[
                    {label:'Total Merchants',    val:merchants.length,                                  icon:'🏪', grad:'linear-gradient(135deg,#c8a870,#9f7c42)', sub:`${merchants.filter(m=>m.status==='active').length} active`},
                    {label:'Active POS Devices', val:posDevices.filter(p=>p.status==='active').length,  icon:'🖥',  grad:'linear-gradient(135deg,#3b82f6,#2563eb)', sub:`${posDevices.length} total`},
                    {label:"Today's Volume",      val:`$${todayVol.toFixed(2)}`,                         icon:'💰', grad:'linear-gradient(135deg,#8b5cf6,#7c3aed)', sub:'payments today'},
                    {label:'All-Time Volume',    val:`$${totalVol.toFixed(2)}`,                         icon:'📈', grad:'linear-gradient(135deg,#c8a870,#0d9488)', sub:`${orders.filter(o=>o.status==='paid').length} paid`},
                    {label:'Total Orders',       val:orders.length,                                     icon:'📋', grad:'linear-gradient(135deg,#f59e0b,#d97706)', sub:`${orders.filter(o=>o.status==='pending').length} pending`},
                    {label:'Failed Payments',    val:orders.filter(o=>o.status==='failed').length,      icon:'⚠',  grad:'linear-gradient(135deg,#ef4444,#dc2626)', sub:'need attention'},
                    {label:'Pending Verifications', val:verifications.filter(v=>v.status==='pending').length, icon:'🔍', grad:'linear-gradient(135deg,#f59e0b,#d97706)', sub:'awaiting review'},
                  ].map(c=>(
                    <div key={c.label} className="lift"
                      style={{background:C.white,borderRadius:'14px',padding:'1.25rem',boxShadow:'0 2px 8px rgba(22,163,74,0.08)',border:`1px solid ${C.border}`,cursor:'default'}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'0.875rem'}}>
                        <div style={{width:'42px',height:'42px',background:c.grad,borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',boxShadow:'0 4px 12px rgba(0,0,0,0.15)'}}>
                          {c.icon}
                        </div>
                      </div>
                      <p style={{fontSize:'1.875rem',fontWeight:'800',color:C.textDark,margin:'0 0 0.125rem',lineHeight:1}}>{c.val}</p>
                      <p style={{fontSize:'0.75rem',fontWeight:'600',color:C.textMuted,margin:'0 0 0.125rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>{c.label}</p>
                      <p style={{fontSize:'0.72rem',color:C.accent,margin:0,fontWeight:'500'}}>{c.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Charts row */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',marginBottom:'1.5rem'}}>
                  {/* Revenue area chart */}
                  <div style={{background:C.white,borderRadius:'14px',padding:'1.25rem',boxShadow:'0 2px 8px rgba(22,163,74,0.08)',border:`1px solid ${C.border}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
                      <div>
                        <h3 style={{fontSize:'0.9rem',fontWeight:'700',color:C.text,margin:0}}>Revenue Overview</h3>
                        <p style={{fontSize:'0.75rem',color:C.textMuted,margin:0}}>Last 7 days</p>
                      </div>
                      <span style={{background:C.accentLight,color:C.accentDark,padding:'0.25rem 0.625rem',borderRadius:'20px',fontSize:'0.72rem',fontWeight:'700'}}>LIVE</span>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={last7} margin={{top:5,right:5,left:-20,bottom:0}}>
                        <defs>
                          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={C.accent} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={C.accent} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="day" tick={{fontSize:11,fill:C.textMuted}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize:11,fill:C.textMuted}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{borderRadius:'10px',border:`1px solid ${C.border}`,fontSize:'0.8rem'}} />
                        <Area type="monotone" dataKey="volume" stroke={C.accent} strokeWidth={2.5} fill="url(#rev)" name="Revenue ($)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Orders bar chart */}
                  <div style={{background:C.white,borderRadius:'14px',padding:'1.25rem',boxShadow:'0 2px 8px rgba(22,163,74,0.08)',border:`1px solid ${C.border}`}}>
                    <div style={{marginBottom:'1rem'}}>
                      <h3 style={{fontSize:'0.9rem',fontWeight:'700',color:C.text,margin:0}}>Daily Orders</h3>
                      <p style={{fontSize:'0.75rem',color:C.textMuted,margin:0}}>Last 7 days</p>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={last7} margin={{top:5,right:5,left:-20,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="day" tick={{fontSize:11,fill:C.textMuted}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize:11,fill:C.textMuted}} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{borderRadius:'10px',border:`1px solid ${C.border}`,fontSize:'0.8rem'}} />
                        <Bar dataKey="orders" fill={C.accent} radius={[6,6,0,0]} name="Orders" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recent payments + quick actions */}
                <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:'1rem',alignItems:'start'}}>
                  <WCard title="Recent Payments" action={<button onClick={()=>navTo('payments')} style={{fontSize:'0.8rem',color:C.accent,background:'none',border:'none',cursor:'pointer',fontWeight:'600'}}>View all →</button>}>
                    <Tbl
                      heads={['Order ID','Merchant','Amount','Status','Date']}
                      rows={orders.slice(0,6).map(o=>[
                        <span style={{fontWeight:'700',color:C.accent,fontSize:'0.8rem'}}>{o.orderId}</span>,
                        <span style={{fontSize:'0.85rem'}}>{o.merchant?.businessName||o.merchant?.name||'Unknown'}</span>,
                        <span style={{fontWeight:'700',fontSize:'0.85rem'}}>{o.currency} {o.amount.toFixed(2)}</span>,
                        <Bdg s={o.status}/>,
                        <span style={{fontSize:'0.8rem',color:C.textMuted}}>{new Date(o.createdAt).toLocaleDateString()}</span>
                      ])}
                      onRow={i=>{ setSelPayment(orders[i]); navTo('payments') }}
                      empty="No payments yet"
                    />
                  </WCard>

                  {/* Quick actions */}
                  <div style={{display:'flex',flexDirection:'column',gap:'0.75rem',minWidth:'200px'}}>
                    {[
                      {label:'Add Merchant',  icon:'➕', tab:'merchants',   color:C.accent},
                      {label:'POS Devices',   icon:'🖥',  tab:'pos-devices', color:C.blue},
                      {label:'Payments',      icon:'💳', tab:'payments',    color:C.purple},
                      {label:'Webhooks',      icon:'🔔', tab:'webhooks',    color:C.yellow},
                    ].map(a=>(
                      <button key={a.tab} className="lift" onClick={()=>navTo(a.tab)}
                        style={{background:C.white,border:`1.5px solid ${C.border}`,borderRadius:'12px',padding:'0.875rem 1rem',cursor:'pointer',textAlign:'left',boxShadow:'0 1px 4px rgba(22,163,74,0.07)',display:'flex',alignItems:'center',gap:'0.625rem'}}>
                        <span style={{fontSize:'1.25rem'}}>{a.icon}</span>
                        <span style={{fontSize:'0.85rem',fontWeight:'600',color:C.textDark}}>{a.label}</span>
                        <span style={{marginLeft:'auto',color:C.textMuted,fontSize:'0.8rem'}}>→</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══ MERCHANTS LIST ══ */}
            {tab==='merchants' && !selMerchant && !showAddMerchant && (
              <div>
                <PgHead title="Merchants" sub={`${merchants.length} total`}
                  action={<Btn className="lift" onClick={()=>setShowAddMerchant(true)} style={BTNP}>➕ Add Merchant</Btn>} />
                <WCard>
                  <Tbl heads={['Merchant ID','Business Name','Email','Country','Status','Chat','Actions']}
                    rows={merchants.map(m=>[
                      <span style={{fontWeight:'700',color:C.accent}}>{m.merchantId}</span>,
                      <span style={{fontWeight:'600',color:C.textDark}}>{m.businessName||m.name}</span>,
                      m.email, m.country, <Bdg s={m.status}/>,
                      <button onClick={e=>{e.stopPropagation();loadConversations();setChatMerchant(m);openChat(m);setShowChat(true)}}
                        style={{background:'#dbeafe',border:'1px solid #bfdbfe',borderRadius:'8px',padding:'0.2rem 0.5rem',cursor:'pointer',fontSize:'1rem'}}>
                        💬
                      </button>,
                      <button onClick={e=>{e.stopPropagation();deleteMerchant(m.merchantId)}}
                        style={{background:'#fce4ec',border:'1px solid #f48fb1',borderRadius:'8px',padding:'0.2rem 0.5rem',cursor:'pointer',fontSize:'1rem',color:'#c62828'}}>
                        🗑️
                      </button>
                    ])}
                    onRow={i=>setSelMerchant(merchants[i])} empty="No merchants yet" />
                </WCard>
              </div>
            )}

            {/* ══ ADD MERCHANT ══ */}
            {tab==='merchants' && showAddMerchant && (
              <div style={{maxWidth:'560px'}}>
                <Back onClick={()=>setShowAddMerchant(false)} label="Back to Merchants"/>
                <WCard title="Add New Merchant">
                  <form onSubmit={handleAddMerchant}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
                      {[['name','text','Full Name'],['email','email','Email'],['phone','text','Phone'],['country','text','Country']].map(([f,t,l])=>(
                        <Fld key={f} label={l}><input type={t} value={newM[f]} onChange={e=>setNewM({...newM,[f]:e.target.value})} required style={INP} /></Fld>
                      ))}
                    </div>
                    <Fld label="Address"><input type="text" value={newM.address} onChange={e=>setNewM({...newM,address:e.target.value})} required style={INP} /></Fld>
                    <button type="submit" className="lift" style={BTNP}>Create Merchant</button>
                  </form>
                </WCard>
              </div>
            )}

            {/* ══ MERCHANT DETAIL ══ */}
            {tab==='merchants' && selMerchant && (
              <div style={{maxWidth:'660px'}}>
                <Back onClick={()=>setSelMerchant(null)} label="Back to Merchants"/>
                <WCard title="Merchant Details">
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem',marginBottom:'1.5rem'}}>
                    {[['Merchant ID',selMerchant.merchantId],['Business Name',selMerchant.businessName||selMerchant.name],
                      ['Email',selMerchant.email],['Phone',selMerchant.phone],['Country',selMerchant.country],
                      ['POS Devices',posDevices.filter(p=>p.merchantId===selMerchant.id).length],
                      ['Total Volume','$'+orders.filter(o=>o.merchant?.id===selMerchant.id).reduce((a,o)=>a+o.amount,0).toFixed(2)],
                    ].map(([k,v])=><InfoBox key={k} k={k} v={v}/>)}
                    <div style={{background:C.accentLight,borderRadius:'10px',padding:'0.875rem'}}>
                      <p style={{fontSize:'0.7rem',color:C.accent,fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.05em',margin:'0 0 0.25rem'}}>Status</p>
                      <Bdg s={selMerchant.status}/>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap'}}>
                    <button className="lift-sm" style={BTNS} onClick={()=>navToFiltered('pos-devices', selMerchant.id)}>View POS Devices</button>
                    <button className="lift-sm" style={BTNS} onClick={()=>navToFiltered('payments', selMerchant.id)}>View Payments</button>
                    <button className="lift-sm" style={{...BTNS, background:'#e3f2fd', borderColor:'#bbdefb', color:'#1565c0'}}
                      onClick={()=>createPosDevice(selMerchant.merchantId)}>
                      🖥️ Add POS Device
                    </button>
                    <button className="lift-sm" style={{...BTNS, background:'#fff3cd', borderColor:'#ffc107', color:'#856404'}}
                      onClick={()=>resetMerchantPassword(selMerchant.merchantId)}>
                      🔑 Reset Password
                    </button>
                    <button className="lift-sm" style={selMerchant.status==='active'?BTND:BTNP}
                      onClick={()=>toggleMerchant(selMerchant.merchantId,selMerchant.status)}>
                      {selMerchant.status==='active'?'🔒 Suspend':'✅ Activate'}
                    </button>
                    <button className="lift-sm" style={{...BTNS, background:'#fce4ec', borderColor:'#f48fb1', color:'#c62828'}}
                      onClick={()=>deleteMerchant(selMerchant.merchantId)}>
                      🗑️ Delete Merchant
                    </button>
                  </div>
                </WCard>
              </div>
            )}

            {/* ══ POS DEVICES ══ */}
            {tab==='pos-devices' && !selPos && (
              <div>
                <PgHead title="POS Devices"
                  sub={filterLabel ? `${filteredPosDevices.length} device(s) for ${filterLabel.businessName||filterLabel.name}` : `${posDevices.length} total · ${posDevices.filter(p=>p.status==='active').length} active`}
                  action={filterMerchantId && <button className="lift-sm" style={BTNS} onClick={()=>setFilterMerchantId(null)}>✕ Clear Filter</button>} />
                {filterLabel && (
                  <div style={{background:'#dbeafe',border:'1px solid #bfdbfe',borderRadius:'10px',padding:'0.75rem 1rem',marginBottom:'1rem',fontSize:'0.875rem',color:'#1e40af',fontWeight:'600'}}>
                    Filtered by: <strong>{filterLabel.businessName||filterLabel.name}</strong> ({filterLabel.merchantId})
                  </div>
                )}
                <WCard>
                  <Tbl heads={['POS ID','Merchant','Status','Last Seen','Mode']}
                    rows={filteredPosDevices.map(p=>[
                      <span style={{fontWeight:'700',color:C.accent}}>{p.posId}</span>,
                      p.merchant?.businessName||p.merchant?.name||'Unknown',
                      <Bdg s={p.status}/>,
                      p.lastSeenAt?new Date(p.lastSeenAt).toLocaleString():'Never',
                      <span style={{background:C.purpleLight,color:C.purple,padding:'0.2rem 0.5rem',borderRadius:'6px',fontSize:'0.72rem',fontWeight:'700'}}>MOTO</span>
                    ])}
                    onRow={i=>setSelPos(filteredPosDevices[i])} empty="No POS devices found" />
                </WCard>
              </div>
            )}

            {/* ══ POS DETAIL ══ */}
            {tab==='pos-devices' && selPos && (
              <div style={{maxWidth:'560px'}}>
                <Back onClick={()=>setSelPos(null)} label="Back to POS Devices"/>
                <WCard title="POS Device Details">
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem',marginBottom:'1.25rem'}}>
                    {[['POS ID',selPos.posId],['Merchant',selPos.merchant?.businessName||selPos.merchant?.name||'Unknown'],
                      ['Device Model',selPos.deviceModel||'Unknown'],['Serial',selPos.deviceSerial||'Unknown'],
                      ['Last Seen',selPos.lastSeenAt?new Date(selPos.lastSeenAt).toLocaleString():'Never'],['Mode','MOTO'],
                    ].map(([k,v])=><InfoBox key={k} k={k} v={v}/>)}
                    <div style={{background:C.accentLight,borderRadius:'10px',padding:'0.875rem'}}>
                      <p style={{fontSize:'0.7rem',color:C.accent,fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.05em',margin:'0 0 0.25rem'}}>Status</p>
                      <Bdg s={selPos.status}/>
                    </div>
                  </div>

                  {/* Activation Code — prominent display */}
                  <div style={{background:'linear-gradient(135deg,#1a3a28,#2d6a4f)',borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem',textAlign:'center'}}>
                    <p style={{fontSize:'0.7rem',color:'rgba(255,255,255,0.6)',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.1em',margin:'0 0 0.625rem'}}>
                      Activation Code
                    </p>
                    <div style={{fontFamily:'monospace',fontSize:'2rem',fontWeight:'800',letterSpacing:'0.4rem',color:'#d8bf8c',background:'rgba(0,0,0,0.25)',borderRadius:'10px',padding:'0.75rem 1rem',border:'1px dashed rgba(134,239,172,0.5)',display:'inline-block',minWidth:'220px'}}>
                      {selPos.activationCode || '—'}
                    </div>
                    <p style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.45)',margin:'0.625rem 0 0'}}>
                      Enter this code on the POS device to activate
                    </p>
                  </div>

                  <button className="lift-sm" style={selPos.status==='active'?BTND:BTNP}
                    onClick={()=>togglePos(selPos.posId,selPos.status)}>
                    {selPos.status==='active'?'🔒 Disable POS':'✅ Enable POS'}
                  </button>
                  <button className="lift-sm" style={{...BTND,marginTop:'0.75rem',background:'#dc2626'}}
                    onClick={()=>deletePosDevice(selPos.posId)}>
                    Delete POS Device
                  </button>
                </WCard>
              </div>
            )}

            {/* ══ TRANSACTIONS ══ */}
            {tab==='transactions' && !selTransaction && (
              <div>
                <PgHead title={filterLabel ? `Transactions — ${filterLabel.businessName||filterLabel.name}` : 'All Transactions'}
                  sub={`${transactions.length} total · $${transactions.filter(t=>t.status==='SUCCESS'||t.status==='paid').reduce((a,t)=>a+(t.amount||0),0).toFixed(2)} volume`}
                  action={
                    <div style={{display:'flex',gap:'0.5rem'}}>
                      {filterMerchantId && <button className="lift-sm" style={BTNS} onClick={()=>setFilterMerchantId(null)}>✕ Clear Filter</button>}
                      <button className="lift-sm" onClick={exportCSV} style={BTNS}>⬇ Export CSV</button>
                    </div>
                  } />
                {filterLabel && (
                  <div style={{background:'#dbeafe',border:'1px solid #bfdbfe',borderRadius:'10px',padding:'0.75rem 1rem',marginBottom:'1rem',fontSize:'0.875rem',color:'#1e40af',fontWeight:'600'}}>
                    Filtered by: <strong>{filterLabel.businessName||filterLabel.name}</strong> ({filterLabel.merchantId})
                  </div>
                )}
                <WCard>
                  <Tbl heads={['Transaction ID','Merchant','Amount','Card','Cardholder','POS','Status','Date']}
                    rows={(filterMerchantId ? transactions.filter(t => t.merchantId === filterMerchantId) : transactions).map(t=>[
                      <span style={{fontWeight:'700',color:C.accent}}>{t.id.substring(0, 12)}...</span>,
                      t.merchant?.businessName||t.merchant?.name||'Unknown',
                      <span style={{fontWeight:'700'}}>{t.currency} {t.amount.toFixed(2)}</span>,
                      t.cardBrand ? `${t.cardBrand.toUpperCase()} •••• ${t.cardLast4}` : '—',
                      t.cardholderName || '—',
                      t.posDevice?.posId || '—',
                      <Bdg s={t.status.toLowerCase()}/>,
                      new Date(t.createdAt).toLocaleString()
                    ])}
                    onRow={i=>setSelTransaction((filterMerchantId ? transactions.filter(t => t.merchantId === filterMerchantId) : transactions)[i])}
                    empty="No transactions yet" />
                </WCard>
              </div>
            )}

            {/* ══ TRANSACTION DETAIL ══ */}
            {tab==='transactions' && selTransaction && (
              <div style={{maxWidth:'680px'}}>
                <Back onClick={()=>setSelTransaction(null)} label="Back to Transactions"/>

                {/* Transaction Info */}
                <WCard title="Transaction Details">
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem',marginBottom:'0.5rem'}}>
                    {[['Transaction ID',selTransaction.id],
                      ['Merchant',selTransaction.merchant?.businessName||selTransaction.merchant?.name||'Unknown'],
                      ['Amount',`${selTransaction.currency} ${selTransaction.amount.toFixed(2)}`],
                      ['POS',selTransaction.posDevice?.posId||'N/A'],
                      ['Date',new Date(selTransaction.createdAt).toLocaleString()],
                      ...(selTransaction.cardBrand?[['Card',`${selTransaction.cardBrand.toUpperCase()} •••• ${selTransaction.cardLast4}`]]:[]),
                      ...(selTransaction.cardholderName?[['Cardholder Name',selTransaction.cardholderName]]:[]),
                      ...(selTransaction.customerName?[['Customer Name',selTransaction.customerName]]:[]),
                      ...(selTransaction.customerEmail?[['Customer Email',selTransaction.customerEmail]]:[]),
                      ...(selTransaction.riskLevel?[['Risk Level',cap(selTransaction.riskLevel)]]:[]),
                      ...(selTransaction.stripePaymentIntentId?[['Stripe Payment Intent',selTransaction.stripePaymentIntentId]]:[]),
                      ...(selTransaction.stripeChargeId?[['Stripe Charge',selTransaction.stripeChargeId]]:[]),
                    ].map(([k,v])=><InfoBox key={k} k={k} v={v}/>)}
                    <div style={{background:C.accentLight,borderRadius:'10px',padding:'0.875rem'}}>
                      <p style={{fontSize:'0.7rem',color:C.accent,fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.05em',margin:'0 0 0.25rem'}}>Status</p>
                      <Bdg s={selTransaction.status.toLowerCase()}/>
                    </div>
                  </div>
                </WCard>

                {/* Refunds */}
                {selTransaction.refunds && selTransaction.refunds.length > 0 && (
                  <WCard title="Refunds">
                    <Tbl heads={['Amount','Status','Reason','Date']}
                      rows={selTransaction.refunds.map(r=>[
                        `${r.currency} ${r.amount.toFixed(2)}`,
                        <Bdg s={r.status}/>,
                        r.reason || '—',
                        new Date(r.createdAt).toLocaleString()
                      ])}
                      empty="No refunds" />
                  </WCard>
                )}
              </div>
            )}

            {/* ══ DISPUTES ══ */}
            {tab==='disputes' && !selDispute && (
              <div>
                <PgHead title="Disputes & Chargebacks"
                  sub={`${disputes.filter(d=>d.status==='needs_response'||d.status==='warning_needs_response').length} need response · ${disputes.length} total`}/>
                {disputes.filter(d=>d.status==='needs_response'||d.status==='warning_needs_response').length>0&&(
                  <div style={{background:'#fee2e2',border:'1px solid #fca5a5',borderRadius:'12px',padding:'1rem',marginBottom:'1rem',display:'flex',alignItems:'center',gap:'0.75rem'}}>
                    <span style={{fontSize:'1.5rem'}}>🚨</span>
                    <div>
                      <p style={{fontWeight:'800',color:'#dc2626',margin:0,fontSize:'0.9rem'}}>Action Required</p>
                      <p style={{color:'#7f1d1d',fontSize:'0.8rem',margin:0}}>{disputes.filter(d=>d.status==='needs_response'||d.status==='warning_needs_response').length} dispute(s) require evidence submission. Missing the deadline means automatic loss.</p>
                    </div>
                  </div>
                )}
                <WCard title="Active Disputes">
                  <Tbl heads={['Order ID','Merchant','Amount','Reason','Risk','Status','Deadline']}
                    rows={disputes.map(d=>[
                      <span style={{fontWeight:'700',color:C.accent}}>{d.orderId}</span>,
                      d.merchant?.businessName||'Unknown',
                      <span style={{fontWeight:'700',color:'#dc2626'}}>${d.amount.toFixed(2)}</span>,
                      <span style={{fontSize:'0.75rem',background:'#fee2e2',color:'#dc2626',padding:'0.2rem 0.5rem',borderRadius:'6px',fontWeight:'600'}}>{d.reason}</span>,
                      <span style={{fontWeight:'700',color:d.riskScore>=80?'#dc2626':d.riskScore>=60?'#f59e0b':'#c8a870'}}>{d.riskScore}/100</span>,
                      <span style={{fontSize:'0.75rem',background:d.status.includes('won')?'rgba(200,168,112,0.12)':d.status.includes('lost')?'#fee2e2':'#fef3c7',color:d.status.includes('won')?'#f4dfb5':d.status.includes('lost')?'#dc2626':'#b45309',padding:'0.2rem 0.5rem',borderRadius:'6px',fontWeight:'600'}}>{d.status}</span>,
                      d.evidenceDeadline?<span style={{fontSize:'0.8rem',color:new Date(d.evidenceDeadline)<new Date()?'#dc2626':'#b45309',fontWeight:'600'}}>{new Date(d.evidenceDeadline).toLocaleDateString()}</span>:'—'
                    ])}
                    onRow={i=>setSelDispute(disputes[i])}
                    empty="No disputes yet — great!"/>
                </WCard>

                {fraudFlags.filter(f=>!f.resolved).length>0&&(
                  <WCard title="Fraud Flags — Unresolved">
                    <Tbl heads={['Order ID','Merchant','Type','Severity','Flagged At']}
                      rows={fraudFlags.filter(f=>!f.resolved).map(f=>[
                        f.orderId||'—',
                        f.merchant?.businessName||'Unknown',
                        <span style={{fontWeight:'600',color:'#dc2626'}}>{f.type}</span>,
                        <span style={{fontSize:'0.75rem',background:f.severity==='high'?'#fee2e2':f.severity==='medium'?'#fef3c7':'rgba(200,168,112,0.12)',color:f.severity==='high'?'#dc2626':f.severity==='medium'?'#b45309':'#f4dfb5',padding:'0.2rem 0.5rem',borderRadius:'6px',fontWeight:'700'}}>{f.severity.toUpperCase()}</span>,
                        new Date(f.createdAt).toLocaleDateString()
                      ])}
                      empty="No fraud flags"/>
                  </WCard>
                )}
              </div>
            )}

            {/* ══ DISPUTE DETAIL ══ */}
            {tab==='disputes' && selDispute && (
              <div style={{maxWidth:'680px'}}>
                <Back onClick={()=>setSelDispute(null)} label="Back to Disputes"/>
                <div style={{background:'#fee2e2',border:'1px solid #fca5a5',borderRadius:'12px',padding:'1rem',marginBottom:'1rem'}}>
                  <p style={{fontWeight:'800',color:'#dc2626',margin:'0 0 0.25rem',fontSize:'0.95rem'}}>🚨 Chargeback Alert</p>
                  <p style={{color:'#7f1d1d',fontSize:'0.825rem',margin:0,lineHeight:1.5}}>
                    Evidence deadline: <strong>{selDispute.evidenceDeadline?new Date(selDispute.evidenceDeadline).toLocaleDateString():'Unknown'}</strong>. You must submit evidence to Stripe before this date or the dispute will be automatically lost.
                  </p>
                </div>
                <WCard title="Dispute Details">
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem',marginBottom:'1.25rem'}}>
                    {[['Order ID',selDispute.orderId],['Stripe Dispute ID',selDispute.stripeDisputeId],
                      ['Amount',`$${selDispute.amount.toFixed(2)}`],['Reason',selDispute.reason],
                      ['Risk Score',`${selDispute.riskScore}/100`],['Evidence Submitted',selDispute.evidenceSubmitted?'YES':'NO'],
                      ['Merchant',selDispute.merchant?.businessName||'Unknown'],
                    ].map(([k,v])=><InfoBox key={k} k={k} v={String(v)}/>)}
                    <div style={{background:C.bg,borderRadius:'10px',padding:'0.875rem',border:`1px solid ${C.border}`}}>
                      <p style={{fontSize:'0.68rem',color:C.accent,fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 0.3rem'}}>Status</p>
                      <span style={{fontSize:'0.875rem',fontWeight:'700',color:selDispute.status.includes('won')?'#f4dfb5':selDispute.status.includes('lost')?'#dc2626':'#b45309'}}>{selDispute.status}</span>
                    </div>
                  </div>

                  <div style={{background:'#fef3c7',border:'1px solid #fde68a',borderRadius:'12px',padding:'1rem',marginBottom:'1.25rem'}}>
                    <p style={{fontWeight:'700',color:'#92400e',margin:'0 0 0.5rem',fontSize:'0.875rem'}}>How to Fight This Chargeback</p>
                    <ol style={{color:'#78350f',fontSize:'0.8rem',paddingLeft:'1.25rem',lineHeight:1.8,margin:0}}>
                      <li>Log in to your Stripe Dashboard → Disputes</li>
                      <li>Submit evidence: customer verification docs, signed agreement, communication records</li>
                      <li>Include the cardholder name match verification from this system</li>
                      <li>Submit before the deadline shown above</li>
                    </ol>
                  </div>

                  {!selDispute.evidenceSubmitted && (
                    <button onClick={async()=>{
                      await fetch(`${API}/admin/disputes/${selDispute.id}/evidence`,{method:'POST',headers:H,body:JSON.stringify({notes:'Evidence submitted via admin panel'})});
                      setSelDispute({...selDispute,evidenceSubmitted:true});
                      fetchJSON(`${API}/admin/disputes`,H,d=>d.disputes&&setDisputes(d.disputes));
                    }} style={{...BTNP,width:'100%',marginBottom:'0.5rem'}}>
                      ✅ Mark Evidence as Submitted
                    </button>
                  )}
                  <a href={`https://dashboard.stripe.com/disputes/${selDispute.stripeDisputeId}`} target="_blank" rel="noreferrer"
                    style={{...BTNS,textDecoration:'none',display:'inline-flex',width:'100%',justifyContent:'center'}}>
                    Open in Stripe Dashboard ↗
                  </a>
                </WCard>
              </div>
            )}

            {/* ══ VERIFICATIONS ══ */}
          {tab==='verifications' && !selVerif && (
            <div>
              <PgHead title="Customer Verifications"
                sub={`${verifications.filter(v=>v.status==='pending').length} pending · ${verifications.length} total`}/>
              <WCard>
                <Tbl heads={['Customer','Merchant','Documents','Status','Submitted','Action']}
                  rows={verifications.map(v=>[
                    <span style={{fontWeight:'700',color:C.textDark}}>{v.customer?.name}</span>,
                    v.merchant?.businessName||v.merchant?.name||'Unknown',
                    <span style={{fontWeight:'600',color:C.accent}}>{JSON.parse(v.documentUrls||'[]').length} file(s)</span>,
                    <Bdg s={v.status==='approved'?'active':v.status==='rejected'?'failed':'pending'}/>,
                    new Date(v.createdAt).toLocaleDateString(),
                    v.status==='pending'
                      ? <button onClick={()=>{setSelVerif(v);setReviewNotes('')}}
                          style={{padding:'0.3rem 0.75rem',background:'#dbeafe',color:'#1e40af',border:'1px solid #bfdbfe',borderRadius:'8px',fontSize:'0.75rem',fontWeight:'700',cursor:'pointer'}}>
                          Review
                        </button>
                      : <span style={{fontSize:'0.75rem',color:C.textMuted}}>{v.status==='approved'?'Approved':'Rejected'}</span>
                  ])}
                  onRow={i=>{ setSelVerif(verifications[i]); setReviewNotes('') }}
                  empty="No verification requests yet"/>
              </WCard>
            </div>
          )}

          {/* ══ VERIFICATION DETAIL ══ */}
          {tab==='verifications' && selVerif && (
            <div style={{maxWidth:'700px'}}>
              <Back onClick={()=>setSelVerif(null)} label="Back to Verifications"/>
              <WCard title="Verification Review">
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem',marginBottom:'1.5rem'}}>
                  <InfoBox k="Customer" v={selVerif.customer?.name||'Unknown'}/>
                  <InfoBox k="Merchant" v={selVerif.merchant?.businessName||selVerif.merchant?.name||'Unknown'}/>
                  <InfoBox k="Email" v={selVerif.customer?.email||'—'}/>
                  <InfoBox k="Phone" v={selVerif.customer?.phone||'—'}/>
                  <InfoBox k="Submitted" v={new Date(selVerif.createdAt).toLocaleString()}/>
                  <div style={{background:C.bg,borderRadius:'10px',padding:'0.875rem',border:`1px solid ${C.border}`}}>
                    <p style={{fontSize:'0.68rem',color:C.accent,fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 0.3rem'}}>Status</p>
                    <Bdg s={selVerif.status==='approved'?'active':selVerif.status==='rejected'?'failed':'pending'}/>
                  </div>
                </div>

                {selVerif.notes&&(
                  <div style={{background:C.bg,borderRadius:'10px',padding:'0.875rem',border:`1px solid ${C.border}`,marginBottom:'1.25rem'}}>
                    <p style={{fontSize:'0.68rem',color:C.accent,fontWeight:'700',textTransform:'uppercase',margin:'0 0 0.3rem'}}>Merchant Notes</p>
                    <p style={{fontSize:'0.875rem',color:C.textDark,margin:0}}>{selVerif.notes}</p>
                  </div>
                )}

                {/* Documents */}
                <div style={{marginBottom:'1.5rem'}}>
                  <p style={{fontSize:'0.8rem',fontWeight:'700',color:C.text,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.75rem'}}>
                    Uploaded Documents ({JSON.parse(selVerif.documentUrls||'[]').length})
                  </p>
                  <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                    {JSON.parse(selVerif.documentUrls||'[]').map((doc,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:C.bg,padding:'0.75rem 1rem',borderRadius:'10px',border:`1px solid ${C.border}`}}>
                        <span style={{fontSize:'0.875rem',fontWeight:'600',color:C.textDark}}>📎 {doc.name}</span>
                        <button onClick={()=>handleDownload(doc)}
                          style={{fontSize:'0.75rem',color:C.accent,fontWeight:'700',textDecoration:'none',padding:'0.25rem 0.75rem',background:C.accentLight,borderRadius:'6px',cursor:'pointer',border:'none'}}>
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {selVerif.status==='pending' && (
                  <div>
                    <div style={{marginBottom:'1rem'}}>
                      <label style={{display:'block',fontSize:'0.8rem',fontWeight:'700',color:C.text,marginBottom:'0.375rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>
                        Review Notes (optional)
                      </label>
                      <textarea value={reviewNotes} onChange={e=>setReviewNotes(e.target.value)} rows={3}
                        style={{width:'100%',padding:'0.75rem',border:`1.5px solid ${C.border}`,borderRadius:'10px',fontSize:'0.875rem',boxSizing:'border-box',fontFamily:'inherit',resize:'vertical',outline:'none'}}
                        placeholder="Reason for approval or rejection..."/>
                    </div>
                    <div style={{display:'flex',gap:'0.75rem'}}>
                      <button onClick={()=>reviewVerification(selVerif.id,'approved')}
                        style={{flex:1,padding:'0.75rem',background:`linear-gradient(135deg,${C.accent},${C.accentDark})`,color:'white',border:'none',borderRadius:'10px',fontSize:'0.875rem',fontWeight:'700',cursor:'pointer',boxShadow:'0 4px 14px rgba(22,163,74,0.35)'}}>
                        ✅ Approve — Enable POS
                      </button>
                      <button onClick={()=>reviewVerification(selVerif.id,'rejected')}
                        style={{flex:1,padding:'0.75rem',background:'#ef4444',color:'white',border:'none',borderRadius:'10px',fontSize:'0.875rem',fontWeight:'700',cursor:'pointer'}}>
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                )}

                {selVerif.status!=='pending'&&(
                  <div style={{background:selVerif.status==='approved'?C.accentLight:C.redLight,borderRadius:'10px',padding:'0.875rem',border:`1px solid ${selVerif.status==='approved'?C.accentMid:'#fecaca'}`}}>
                    <p style={{fontSize:'0.8rem',fontWeight:'700',color:selVerif.status==='approved'?C.accentDark:'#dc2626',margin:'0 0 0.25rem'}}>
                      {selVerif.status==='approved'?'Approved':'Rejected'} by {selVerif.reviewedBy}
                    </p>
                    <p style={{fontSize:'0.75rem',color:selVerif.status==='approved'?C.accentDark:'#dc2626',margin:0}}>
                      {selVerif.reviewedAt&&new Date(selVerif.reviewedAt).toLocaleString()}
                      {selVerif.notes&&` — ${selVerif.notes}`}
                    </p>
                  </div>
                )}
              </WCard>
            </div>
          )}

          {/* ══ WEBHOOKS ══ */}
            {tab==='webhooks' && !selWebhook && (
              <div>
                <PgHead title="Webhook Logs" sub={`${webhooks.length} events`}/>
                <WCard>
                  <Tbl heads={['Event Type','Merchant','Status','Received At']}
                    rows={webhooks.map(w=>[
                      <span style={{fontWeight:'700',color:C.textDark}}>{w.eventType}</span>,
                      <span style={{fontWeight:'700',color:C.textDark}}>{webhookMerchantName(w)}</span>,
                      <span style={{background:C.accentLight,color:C.accentDark,padding:'0.2rem 0.6rem',borderRadius:'20px',fontSize:'0.72rem',fontWeight:'700'}}>Processed</span>,
                      new Date(w.receivedAt||w.createdAt).toLocaleString()
                    ])}
                    onRow={i=>setSelWebhook(webhooks[i])} empty="No webhook events yet" />
                </WCard>
              </div>
            )}

            {/* ══ WEBHOOK DETAIL ══ */}
            {tab==='webhooks' && selWebhook && (
              <div style={{maxWidth:'720px'}}>
                <Back onClick={()=>setSelWebhook(null)} label="Back to Webhooks"/>
                <WCard title="Webhook Event">
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem',marginBottom:'1.25rem'}}>
                    <InfoBox k="Event Type" v={selWebhook.eventType}/>
                    <InfoBox k="Merchant" v={webhookMerchantName(selWebhook)}/>
                    <InfoBox k="Received At" v={new Date(selWebhook.receivedAt||selWebhook.createdAt).toLocaleString()}/>
                  </div>
                  <p style={{fontSize:'0.75rem',fontWeight:'700',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'0.5rem'}}>Raw Payload</p>
                  <pre style={{background:C.sidebar,color:C.accentMid,padding:'1.25rem',borderRadius:'12px',overflow:'auto',fontSize:'0.78rem',maxHeight:'400px',lineHeight:1.7,margin:0}}>
                    {JSON.stringify(JSON.parse(selWebhook.payload||'{}'),null,2)}
                  </pre>
                </WCard>
              </div>
            )}

            {/* ══ SETTINGS / PROFILE ══ */}
            {(tab==='settings'||tab==='profile') && (
              <div style={{maxWidth:'760px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem',alignItems:'start'}}>
                <WCard title={tab==='profile'?'Admin Profile':'System Info'}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr',gap:'0.875rem'}}>
                    {[['Name',admin?.name],['Email',admin?.email],
                      ...(tab==='settings'?[['API URL',API],['Version','1.0.0'],['Database','SQLite (dev) / PostgreSQL (prod)'],['Auth','JWT (7 day expiry)']]:[])
                    ].map(([k,v])=><InfoBox key={k} k={k} v={String(v||'')}/>)}
                  </div>
                </WCard>
                <div style={{display:'flex',flexDirection:'column',gap:'1.25rem'}}>
                  <WCard title="Change Password">
                    <form onSubmit={async e=>{
                      e.preventDefault(); const f=e.target
                      if(f.nw.value!==f.cf.value){setMsg({t:'e',text:'Passwords do not match'});return}
                      try{const r=await fetch(`${API}/admin/password`,{method:'PUT',headers:H,body:JSON.stringify({currentPassword:f.cur.value,newPassword:f.nw.value})});const d=await r.json();if(d.message){setMsg({t:'s',text:'Password updated!'});f.reset();setTimeout(()=>setMsg(null),3000)}else setMsg({t:'e',text:d.error||'Failed'})}catch(e){}
                    }}>
                      {[['cur','Current Password'],['nw','New Password'],['cf','Confirm New Password']].map(([n,l])=>(
                        <Fld key={n} label={l}><input name={n} type="password" required minLength={n==='cur'?1:8} style={INP} placeholder="••••••••"/></Fld>
                      ))}
                      <button type="submit" className="lift-sm" style={BTNP}>Update Password</button>
                    </form>
                  </WCard>
                  <WCard title="Security PIN">
                    <p style={{fontSize:'0.8rem',color:C.textMuted,marginBottom:'0.875rem'}}>6-digit PIN for high-security actions.</p>
                    <form onSubmit={async e=>{
                      e.preventDefault(); const f=e.target
                      try{const r=await fetch(`${API}/admin/pin/set`,{method:'POST',headers:H,body:JSON.stringify({pin:f.pin.value,currentPassword:f.pwd.value})});const d=await r.json();if(d.message){setMsg({t:'s',text:'PIN set!'});f.reset();setTimeout(()=>setMsg(null),3000)}else setMsg({t:'e',text:d.error||'Failed'})}catch(e){}
                    }}>
                      <Fld label="New 6-digit PIN"><input name="pin" type="password" required pattern="\d{6}" maxLength={6} style={INP} placeholder="000000"/></Fld>
                      <Fld label="Confirm with Password"><input name="pwd" type="password" required style={INP} placeholder="Current password"/></Fld>
                      <button type="submit" className="lift-sm" style={{...BTNP,background:'#7c3aed'}}>Set PIN</button>
                    </form>
                  </WCard>
                  <WCard title="Recovery Key">
                    <div style={{background:'#fef3c7',border:'1px solid #fde68a',borderRadius:'10px',padding:'0.75rem',marginBottom:'0.875rem'}}>
                      <p style={{fontSize:'0.78rem',color:'#92400e',fontWeight:'600',margin:'0 0 0.25rem'}}>Keep your recovery key safe</p>
                      <p style={{fontSize:'0.72rem',color:'#92400e',margin:0}}>Use it to unlock your account if locked out. Requires PIN to regenerate.</p>
                    </div>
                    <form onSubmit={async e=>{
                      e.preventDefault(); const f=e.target
                      try{const r=await fetch(`${API}/admin/recovery-key/regenerate`,{method:'POST',headers:H,body:JSON.stringify({pin:f.pin.value})});const d=await r.json();if(d.recoveryKey){alert('NEW RECOVERY KEY — SAVE THIS NOW:\n\n'+d.recoveryKey+'\n\nThis will NOT be shown again.');f.reset();setMsg({t:'s',text:'New key generated!'});setTimeout(()=>setMsg(null),5000)}else setMsg({t:'e',text:d.error||'Failed'})}catch(e){}
                    }}>
                      <Fld label="Confirm with PIN"><input name="pin" type="password" required pattern="\d{6}" maxLength={6} style={INP} placeholder="6-digit PIN"/></Fld>
                      <button type="submit" className="lift-sm" style={{...BTNP,background:'#dc2626'}}>Regenerate Recovery Key</button>
                    </form>
                  </WCard>
                </div>
              </div>
            )}

          </main>

          {/* ── FLOATING CHAT WIDGET ── */}
          {showChat && (
            <div style={{position:'fixed',bottom:'1.5rem',right:'1.5rem',width:'360px',height:'520px',background:C.white,borderRadius:'20px',boxShadow:'0 20px 60px rgba(0,0,0,0.2)',border:`1px solid ${C.border}`,display:'flex',flexDirection:'column',zIndex:2000}}>
              {/* Chat header */}
              <div style={{background:`linear-gradient(135deg,${C.sidebar},#2d6a4f)`,borderRadius:'20px 20px 0 0',padding:'1rem 1.25rem',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'0.625rem'}}>
                  <span style={{fontSize:'1.25rem'}}>💬</span>
                  <div>
                    <p style={{color:'white',fontWeight:'700',fontSize:'0.9rem',margin:0}}>{chatMerchant ? (chatMerchant.businessName||chatMerchant.name||chatMerchant.merchantCode) : 'Chat'}</p>
                    <p style={{color:'rgba(255,255,255,0.6)',fontSize:'0.72rem',margin:0}}>{chatMerchant ? chatMerchant.email : 'Select a merchant'}</p>
                  </div>
                </div>
                <div style={{display:'flex',gap:'0.5rem'}}>
                  {chatMerchant && <button onClick={()=>setChatMerchant(null)} style={{background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'8px',padding:'0.25rem 0.5rem',cursor:'pointer',color:'white',fontSize:'0.75rem',fontWeight:'600'}}>All Chats</button>}
                  <button onClick={()=>setShowChat(false)} style={{background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'8px',width:'28px',height:'28px',cursor:'pointer',color:'white',fontSize:'1rem',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                </div>
              </div>

              {!chatMerchant ? (
                /* Conversations list */
                <div style={{flex:1,overflowY:'auto',padding:'0.5rem'}}>
                  {conversations.length === 0
                    ? <p style={{textAlign:'center',color:C.textMuted,padding:'2rem',fontSize:'0.875rem'}}>No conversations yet</p>
                    : conversations.map(c => (
                      <button key={c.merchantId} onClick={()=>openChat(c)}
                        style={{width:'100%',background:'none',border:'none',padding:'0.75rem',borderRadius:'12px',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'2px'}}
                        onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                        onMouseLeave={e=>e.currentTarget.style.background='none'}>
                        <div style={{width:'40px',height:'40px',background:`linear-gradient(135deg,${C.accent},${C.accentDark})`,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'800',fontSize:'0.9rem',flexShrink:0}}>
                          {(c.name||'M').charAt(0).toUpperCase()}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <p style={{fontWeight:'700',color:C.textDark,fontSize:'0.875rem',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</p>
                            {c.unreadCount>0 && <span style={{background:C.red,color:'white',borderRadius:'50%',minWidth:'18px',height:'18px',fontSize:'0.65rem',fontWeight:'800',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 3px',flexShrink:0}}>{c.unreadCount}</span>}
                          </div>
                          <p style={{fontSize:'0.75rem',color:C.textMuted,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {c.lastMessage ? (c.lastMessage.sender==='admin'?'You: ':'')+c.lastMessage.message : 'No messages yet'}
                          </p>
                        </div>
                      </button>
                    ))
                  }
                </div>
              ) : (
                /* Messages view */
                <>
                  <div style={{flex:1,overflowY:'auto',padding:'0.875rem',display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                    {chatMessages.length===0 && <p style={{textAlign:'center',color:C.textMuted,fontSize:'0.8rem',padding:'1rem'}}>No messages yet. Say hello!</p>}
                    {chatMessages.map(m => (
                      <div key={m.id} style={{display:'flex',justifyContent:m.sender==='admin'?'flex-end':'flex-start'}}>
                        <div style={{maxWidth:'78%',padding:'0.625rem 0.875rem',borderRadius:m.sender==='admin'?'14px 14px 4px 14px':'14px 14px 14px 4px',
                          background:m.sender==='admin'?`linear-gradient(135deg,${C.accent},${C.accentDark})`:'#f3f4f6',
                          color:m.sender==='admin'?'white':C.textDark,
                          boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
                          <p style={{fontSize:'0.875rem',margin:'0 0 0.2rem',lineHeight:1.4}}>{m.message}</p>
                          <p style={{fontSize:'0.65rem',opacity:0.7,margin:0,textAlign:'right'}}>{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef}/>
                  </div>
                  <div style={{padding:'0.75rem',borderTop:`1px solid ${C.border}`,display:'flex',gap:'0.5rem',flexShrink:0}}>
                    <input className="message-input" value={chatInput} onChange={e=>setChatInput(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),sendChatMsg())}
                      placeholder="Type a message..." maxLength={1000}
                      style={{flex:1,padding:'0.625rem 0.875rem',border:'1.5px solid #000',borderRadius:'12px',fontSize:'0.875rem',outline:'none',background:'#000',color:'#fff'}} />
                    <button onClick={sendChatMsg} disabled={!chatInput.trim()}
                      style={{width:'40px',height:'40px',background:chatInput.trim()?`linear-gradient(135deg,${C.accent},${C.accentDark})`:'rgba(232,224,208,0.10)',border:'none',borderRadius:'12px',cursor:chatInput.trim()?'pointer':'not-allowed',color:'white',fontSize:'1.1rem',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      ➤
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Chat open button — bottom right when closed */}
          {!showChat && (
            <button onClick={()=>{loadConversations();setShowChat(true)}}
              style={{position:'fixed',bottom:'1.5rem',right:'1.5rem',width:'56px',height:'56px',background:`linear-gradient(135deg,${C.accent},${C.accentDark})`,border:'none',borderRadius:'50%',cursor:'pointer',boxShadow:'0 4px 20px rgba(22,163,74,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.5rem',zIndex:1000}}>
              💬
              {conversations.reduce((a,c)=>a+c.unreadCount,0)>0&&(
                <span style={{position:'absolute',top:'-2px',right:'-2px',background:C.red,color:'white',borderRadius:'50%',minWidth:'18px',height:'18px',fontSize:'0.65rem',fontWeight:'800',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {conversations.reduce((a,c)=>a+c.unreadCount,0)}
                </span>
              )}
            </button>
          )}

        </div>
      </div>
    </>
  )
}

// ── SHARED MINI-COMPONENTS ────────────────────────────────────────────────────

function Bdg({s}) {
  const m = {
    active:    {bg:'rgba(200,168,112,0.12)',c:'#f4dfb5'},  paid:      {bg:'rgba(200,168,112,0.12)',c:'#f4dfb5'},
    suspended: {bg:'#fee2e2',c:'#dc2626'},  failed:    {bg:'#fee2e2',c:'#dc2626'},
    disabled:  {bg:'#fee2e2',c:'#dc2626'},  pending:   {bg:'#fef3c7',c:'#b45309'},
    disputed:  {bg:'#fef3c7',c:'#dc2626'},  flagged:   {bg:'#fef3c7',c:'#dc2626'},
  }
  const x = m[s]||{bg:'#f3f4f6',c:'rgba(232,224,208,0.62)'}
  return <span style={{background:x.bg,color:x.c,padding:'0.2rem 0.65rem',borderRadius:'20px',fontSize:'0.75rem',fontWeight:'700',display:'inline-block'}}>{cap(s)}</span>
}

function WCard({title, action, children}) {
  return (
    <div style={{background:C.white,borderRadius:'14px',border:`1px solid ${C.border}`,boxShadow:'0 2px 8px rgba(22,163,74,0.07)',overflow:'hidden',marginBottom:'1rem'}}>
      {(title||action) && (
        <div style={{padding:'1rem 1.25rem',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          {title && <h2 style={{fontSize:'0.9rem',fontWeight:'700',color:C.text,margin:0}}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

function Tbl({heads, rows, onRow, empty}) {
  return (
    <table style={{width:'100%',borderCollapse:'collapse'}}>
      <thead><tr style={{background:'rgba(255,255,255,0.03)'}}>
        {heads.map(h=><th key={h} style={{padding:'0.7rem 1.25rem',textAlign:'left',fontSize:'0.7rem',color:C.accent,fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.06em',borderBottom:`1px solid ${C.border}`}}>{h}</th>)}
      </tr></thead>
      <tbody>
        {rows.length===0
          ? <tr><td colSpan={heads.length} style={{padding:'3rem',textAlign:'center',color:C.textMuted,fontSize:'0.875rem'}}>{empty}</td></tr>
          : rows.map((row,i)=>(
            <tr key={i} className="row-hover" onClick={()=>onRow&&onRow(i)} style={{borderTop:`1px solid ${C.border}`}}>
              {row.map((cell,j)=><td key={j} style={{padding:'0.85rem 1.25rem',fontSize:'0.875rem',color:C.textMuted}}>{cell}</td>)}
            </tr>
          ))
        }
      </tbody>
    </table>
  )
}

function InfoBox({k,v}) {
  return (
    <div style={{background:C.bg,borderRadius:'10px',padding:'0.875rem',border:`1px solid ${C.border}`}}>
      <p style={{fontSize:'0.68rem',color:C.accent,fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 0.3rem'}}>{k}</p>
      <p style={{fontSize:'0.875rem',fontWeight:'700',color:C.textDark,margin:0,wordBreak:'break-all'}}>{v}</p>
    </div>
  )
}

function PgHead({title, sub, action}) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
      <div>
        <h2 style={{fontSize:'1.1rem',fontWeight:'800',color:C.text,margin:0}}>{title}</h2>
        {sub && <p style={{fontSize:'0.8rem',color:C.textMuted,margin:0}}>{sub}</p>}
      </div>
      {action}
    </div>
  )
}

function Back({onClick, label}) {
  return (
    <button onClick={onClick} className="lift-sm"
      style={{display:'flex',alignItems:'center',gap:'0.375rem',background:'none',border:'none',color:C.accent,cursor:'pointer',fontSize:'0.875rem',fontWeight:'600',padding:0,marginBottom:'1rem'}}>
      ← {label}
    </button>
  )
}

function Fld({label, children}) {
  return (
    <div style={{marginBottom:'1rem'}}>
      <label style={{display:'block',fontSize:'0.8rem',fontWeight:'700',color:C.text,marginBottom:'0.375rem'}}>{label}</label>
      {children}
    </div>
  )
}

function Btn({children, style, ...props}) {
  return <button {...props} style={style}>{children}</button>
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const INP  = {width:'100%',padding:'0.625rem 0.875rem',border:`1.5px solid ${C.border}`,borderRadius:'10px',fontSize:'0.875rem',boxSizing:'border-box',outline:'none',color:C.textDark,background:C.white}
const BTNP = {display:'inline-flex',alignItems:'center',gap:'0.375rem',padding:'0.625rem 1.25rem',background:C.accent,color:'white',border:'none',borderRadius:'10px',fontSize:'0.875rem',fontWeight:'700',cursor:'pointer'}
const BTNS = {display:'inline-flex',alignItems:'center',gap:'0.375rem',padding:'0.625rem 1.25rem',background:C.white,color:C.textDark,border:`1.5px solid ${C.border}`,borderRadius:'10px',fontSize:'0.875rem',fontWeight:'600',cursor:'pointer'}
const BTND = {display:'inline-flex',alignItems:'center',gap:'0.375rem',padding:'0.625rem 1.25rem',background:'#ef4444',color:'white',border:'none',borderRadius:'10px',fontSize:'0.875rem',fontWeight:'700',cursor:'pointer'}
