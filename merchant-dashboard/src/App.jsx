import React, { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

const API = import.meta.env.VITE_API_URL || ''

const C = {
  sidebar:'#111318', accent:'#c8a870', accentLight:'rgba(200,168,112,0.12)', accentMid:'rgba(200,168,112,0.28)',
  accentDark:'#f1e8d8', bg:'#0f0608', white:'#111318', border:'rgba(232,224,208,0.10)',
  text:'#e8e0d0', textDark:'#f6efe1', textMuted:'rgba(232,224,208,0.62)',
  red:'#d97b7b', redLight:'rgba(217,123,123,0.12)', yellow:'#d4aa55', yellowLight:'rgba(212,170,85,0.14)',
  purple:'#9b7bbb', purpleLight:'rgba(155,123,187,0.14)', blue:'#7fa8c9', blueLight:'rgba(127,168,201,0.14)',
}

const NAV = [
  { id:'dashboard', label:'Dashboard',   icon:'▦' },
  { id:'pos',       label:'POS Devices', icon:'🖥' },
  { id:'customers', label:'Customers',   icon:'👥' },
  { id:'payments',  label:'Payments',    icon:'💳' },
  { id:'transactions', label:'Transactions', icon:'📊' },
  { id:'settings',  label:'Settings',    icon:'⚙'  },
]

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
const fmt = n => (n||0).toFixed(2)

const CSS = `
*{box-sizing:border-box}
body{
  margin:0;
  font-family:'Cormorant',Georgia,serif;
  color:${C.text};
  background-color:${C.bg};
  background-image:
    repeating-linear-gradient(90deg,transparent 0,transparent 14px,rgba(255,255,255,.014) 14px,rgba(255,255,255,.014) 15px),
    repeating-linear-gradient(89deg,transparent 0,transparent 32px,rgba(0,0,0,.11) 32px,rgba(0,0,0,.11) 34px),
    linear-gradient(175deg,#1e0a0e 0%,#0f0608 40%,#160810 70%,#120608 100%);
}
button,input,textarea,select{font:inherit}
h1,h2,h3,h4,h5,h6{font-family:'Cormorant SC','Cormorant',serif;letter-spacing:.08em;font-weight:500}
.lift{transition:transform .18s,box-shadow .18s}
.lift:hover{transform:translateY(-3px);box-shadow:0 18px 38px rgba(0,0,0,.32)!important}
.lsm{transition:transform .15s}
.lsm:hover{transform:translateY(-2px)}
.nb{transition:background .15s,transform .15s,color .15s}
.nb:hover{background:rgba(200,168,112,.10)!important;transform:translateX(3px)}
.rh{transition:background .12s}
.rh:hover{background:rgba(200,168,112,.08)!important;cursor:pointer}
input:focus,textarea:focus{
  border-color:${C.accent}!important;
  box-shadow:0 0 0 3px rgba(200,168,112,.12);
  outline:none
}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-thumb{background:${C.accent};border-radius:3px}

/* MOBILE RESPONSIVE STYLES */
@keyframes slideInLeft {
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
`

export class ErrorBoundary extends React.Component {
  state = { err: null }
  static getDerivedStateFromError(e) { return { err: e } }
  render() {
    if (this.state.err) return (
      <div style={{padding:'2rem',background:'#fee2e2',minHeight:'100vh',fontFamily:'monospace'}}>
        <h2 style={{color:'#dc2626'}}>Dashboard Error</h2>
        <p style={{color:'#7f1d1d',marginTop:'1rem'}}>{this.state.err.message}</p>
        <pre style={{fontSize:'0.75rem',color:'#7f1d1d',whiteSpace:'pre-wrap',marginTop:'1rem'}}>{this.state.err.stack}</pre>
        <button onClick={()=>window.location.reload()} style={{marginTop:'1rem',padding:'0.5rem 1.5rem',background:'#dc2626',color:'white',border:'none',borderRadius:'8px',cursor:'pointer'}}>Reload</button>
      </div>
    )
    return this.props.children
  }
}

export default function App() {
  const [token,    setToken]    = useState(localStorage.getItem('merchantToken'))
  const [merchant, setMerchant] = useState(() => { try { const s=localStorage.getItem('merchantData'); return s?JSON.parse(s):null } catch(e){return null} })
  const [tab,      setTab]      = useState('dashboard')
  const [msg,      setMsg]      = useState(null)
  const [verifying, setVerifying] = useState(!!localStorage.getItem('merchantToken'))
  const [sidebarOpen, setSidebarOpen] = useState(false) // Mobile sidebar state
  const [loginEmail,    setLoginEmail]    = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [posDevices,  setPosDevices]  = useState([])
  const [customers,   setCustomers]   = useState([])
  const [orders,      setOrders]      = useState([])
  const [transactions, setTransactions] = useState([])
  const [showAddCust, setShowAddCust] = useState(false)
  const [newPosData,  setNewPosData]  = useState(null)
  const [newCust,     setNewCust]     = useState({name:'',email:'',phone:'',billingAddress:''})
  const [selOrder,    setSelOrder]    = useState(null)
  const [pwForm,      setPwForm]      = useState({cur:'',nw:'',cf:''})
  const [profile,     setProfile]     = useState({businessName:'',email:'',phone:'',address:'',country:''})
  const [showChat,    setShowChat]    = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput,    setChatInput]    = useState('')
  const [chatUnread,   setChatUnread]   = useState(0)
  const chatEndRef = React.useRef(null)
  const [notifications, setNotifications] = useState([])
  const [showNotif,   setShowNotif]   = useState(false)
  const [systemOnline, setSystemOnline] = useState(true)
  const [systemMessage, setSystemMessage] = useState('')
  const [verifyCustomer, setVerifyCustomer] = useState(null) // customer being submitted for verification
  const [verifyDocs,  setVerifyDocs]  = useState([])        // uploaded documents
  const [verifyNotes, setVerifyNotes] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  // Notification sound
  const playNotifSound = React.useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      // Friendly notification tone (two soft beeps)
      osc.frequency.value = 523.25 // C5 note
      osc.type = 'sine'

      // First beep
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      osc.start(ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
      osc.stop(ctx.currentTime + 0.15)

      // Second beep after short pause
      setTimeout(() => {
        try {
          const ctx2 = new (window.AudioContext || window.webkitAudioContext)()
          const osc2 = ctx2.createOscillator()
          const gain2 = ctx2.createGain()
          
          osc2.connect(gain2)
          gain2.connect(ctx2.destination)
          
          osc2.frequency.value = 659.25 // E5 note
          osc2.type = 'sine'
          
          gain2.gain.setValueAtTime(0.3, ctx2.currentTime)
          osc2.start(ctx2.currentTime)
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + 0.15)
          osc2.stop(ctx2.currentTime + 0.15)
        } catch(e) {}
      }, 150)
    } catch(e) {}
  }, [])

  // Handle window resizing
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const H = { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }

  // Track previous unread counts
  const prevUnreadRef = React.useRef({ notifs: 0, chat: 0 })

  // Verify stored credentials on app load
  useEffect(() => {
    if (!token) {
      setVerifying(false);
      return;
    }

    const verifyCredentials = async () => {
      try {
        const res = await fetch(`${API}/merchant/pos-devices`, { headers: H });
        if (res.ok) {
          load();
        } else {
          // Invalid credentials - clear localStorage
          localStorage.removeItem('merchantToken');
          localStorage.removeItem('merchantData');
          setToken(null);
          setMerchant(null);
        }
      } catch (e) {
        // Network error, but let's still try to use cached credentials
        load();
      } finally {
        setVerifying(false);
      }
    };

    verifyCredentials();
  }, []);

  useEffect(() => {
    if (merchant) {
      setProfile({ businessName:merchant.businessName||'', email:merchant.email||'', phone:merchant.phone||'', address:merchant.address||'', country:merchant.country||'' })
    }
  }, [merchant])

  const load = () => {
    // Check system status first
    fetch(`${API}/system/status`).then(r=>r.json()).then(d=>{ if(d.online!==undefined){ setSystemOnline(d.online); setSystemMessage(d.message||'') } }).catch(()=>{})
    get(`${API}/merchant/pos-devices`, d => d.posDevices && setPosDevices(d.posDevices))
    get(`${API}/merchant/customers`,   d => d.customers  && setCustomers(d.customers))
    get(`${API}/merchant/orders`,      d => d.orders     && setOrders(d.orders))
    get(`${API}/merchant/transactions`, d => d.transactions && setTransactions(d.transactions))
    get(`${API}/merchant/notifications`, d => {
      if (d.notifications) {
        const newUnread = d.notifications.filter(n => !n.read).length
        if (newUnread > prevUnreadRef.current.notifs) {
          playNotifSound()
        }
        prevUnreadRef.current.notifs = newUnread
        setNotifications(d.notifications)
      }
    })
    loadChat()
  }

  const loadChat = async () => {
    try {
      const r = await fetch(`${API}/merchant/chat`, { headers: H })
      const d = await r.json()
      if (d.messages) {
        setChatMessages(d.messages)
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch (e) {}
  }

  const sendChatMsg = async (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    const text = chatInput.trim()
    setChatInput('')
    try {
      const r = await fetch(`${API}/merchant/chat`, {
        method: 'POST',
        headers: H,
        body: JSON.stringify({ message: text })
      })
      const d = await r.json()
      if (d.message) {
        setChatMessages(prev => [...prev, d.message])
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch (e) {}
  }

  // Poll notifications, chat unread and system status
  useEffect(() => {
    if (!token) return
    // Check system status immediately
    fetch(`${API}/system/status`).then(r=>r.json()).then(d=>{ if(d.online!==undefined){ setSystemOnline(d.online); setSystemMessage(d.message||'') } }).catch(()=>{})
    const interval = setInterval(async () => {
      try {
        // Poll notifications
        const notifR = await fetch(`${API}/merchant/notifications`, { headers: H })
        const notifD = await notifR.json()
        if (notifD.notifications) {
          const newUnread = notifD.notifications.filter(n => !n.read).length
          if (newUnread > prevUnreadRef.current.notifs) {
            playNotifSound()
          }
          prevUnreadRef.current.notifs = newUnread
          setNotifications(notifD.notifications)
        }

        // Poll chat unread
        const chatR = await fetch(`${API}/merchant/chat/unread`, { headers: H })
        const chatD = await chatR.json()
        if (chatD.unread !== undefined) {
          if (chatD.unread > prevUnreadRef.current.chat) {
            playNotifSound()
          }
          prevUnreadRef.current.chat = chatD.unread
          setChatUnread(chatD.unread)
        }

        // Poll system status
        const sysR = await fetch(`${API}/system/status`)
        const sysD = await sysR.json()
        if (sysD.online !== undefined) {
          setSystemOnline(sysD.online)
          setSystemMessage(sysD.message || '')
        }
      } catch (e) {}
    }, 2000)
    return () => clearInterval(interval)
  }, [token, playNotifSound])

  const openChat = () => {
    setShowChat(true)
    loadChat()
  }

  const get = async (url, cb) => { try { const r=await fetch(url,{headers:H}); cb(await r.json()) } catch(e){} }
  const post = async (url, body) => { const r=await fetch(url,{method:'POST',headers:H,body:JSON.stringify(body)}); return r.json() }
  const put  = async (url, body) => { const r=await fetch(url,{method:'PUT', headers:H,body:JSON.stringify(body)}); return r.json() }

  const login = async e => {
    e.preventDefault()
    try {
      const r = await fetch(`${API}/merchant/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:loginEmail,password:loginPassword})})
      const d = await r.json()
      if (d.token) {
        const m = d.merchant || {email:loginEmail,businessName:'Your Store'}
        setToken(d.token); setMerchant(m)
        localStorage.setItem('merchantToken',d.token)
        localStorage.setItem('merchantData',JSON.stringify(m))
        setMsg(null)
      } else setMsg({t:'e',text:d.error||'Login failed'})
    } catch { setMsg({t:'e',text:'Cannot connect to server'}) }
  }

  const logout = () => {
    setToken(null); setMerchant(null)
    localStorage.removeItem('merchantToken'); localStorage.removeItem('merchantData')
  }

  const addPos = async () => {
    try {
      const d = await post(`${API}/merchant/pos-devices`,{})
      if (d.pos_id) { setNewPosData(d); get(`${API}/merchant/pos-devices`,d=>d.posDevices&&setPosDevices(d.posDevices)) }
      else setMsg({t:'e',text:d.error||'Failed'})
    } catch(e){}
  }

  const addCust = async e => {
    e.preventDefault()
    try {
      const d = await post(`${API}/merchant/customers`, newCust)
      if (d.customer) {
        setNewCust({name:'',email:'',phone:'',billingAddress:''}); setShowAddCust(false)
        setMsg({t:'s',text:'Customer added!'}); setTimeout(()=>setMsg(null),3000)
        get(`${API}/merchant/customers`,d=>d.customers&&setCustomers(d.customers))
      } else setMsg({t:'e',text:d.error||'Failed'})
    } catch(e){}
  }

  const handleDocUpload = (e) => {
    const files = Array.from(e.target.files)
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setVerifyDocs(prev => [...prev, { name: file.name, type: file.type, base64: ev.target.result }])
      }
      reader.readAsDataURL(file)
    })
  }

  const submitVerification = async () => {
    if (!verifyCustomer) return
    if (verifyDocs.length === 0) { setMsg({t:'e', text:'Please upload at least one document'}); return }
    setVerifyLoading(true)
    try {
      const r = await fetch(`${API}/merchant/customers/${verifyCustomer.id}/verify`, {
        method:'POST', headers:H, body: JSON.stringify({ documents: verifyDocs, notes: verifyNotes })
      })
      const d = await r.json()
      if (d.verificationId) {
        setVerifyCustomer(null); setVerifyDocs([]); setVerifyNotes('')
        setMsg({t:'s', text:'Verification submitted. Your POS devices are paused pending admin review.'})
        setTimeout(()=>setMsg(null),7000)
        load()
      } else { setMsg({t:'e', text:d.error||'Failed to submit'}) }
    } catch(e){ setMsg({t:'e', text:'Error submitting'}) }
    setVerifyLoading(false)
  }

  const markNotifRead = async (id) => {
    try {
      await post(`${API}/merchant/notifications/${id}/read`, {})
      setNotifications(prev => prev.map(n => n.id===id ? {...n,read:true} : n))
    } catch(e){}
  }

  const saveProfile = async e => {
    e.preventDefault()
    try {
      const d = await put(`${API}/merchant/profile`,{name:profile.businessName,businessName:profile.businessName,phone:profile.phone,address:profile.address,country:profile.country})
      if (d.merchant) {
        const m = {...merchant,...d.merchant}; setMerchant(m); localStorage.setItem('merchantData',JSON.stringify(m))
        setMsg({t:'s',text:'Profile updated!'}); setTimeout(()=>setMsg(null),3000)
      } else setMsg({t:'e',text:d.error||'Failed'})
    } catch(e){}
  }

  const changePw = async e => {
    e.preventDefault()
    if (pwForm.nw!==pwForm.cf) { setMsg({t:'e',text:'Passwords do not match'}); return }
    try {
      const d = await put(`${API}/merchant/password`,{currentPassword:pwForm.cur,newPassword:pwForm.nw})
      if (d.message) { setPwForm({cur:'',nw:'',cf:''}); setMsg({t:'s',text:'Password changed!'}); setTimeout(()=>setMsg(null),3000) }
      else setMsg({t:'e',text:d.error||'Failed'})
    } catch(e){}
  }

  const exportCSV = () => {
    const rows = [['Order ID','Amount','Customer','POS','Status'],...orders.map(o=>[o.orderId,`${o.currency} ${fmt(o.amount)}`,o.customer?.name||'Walk-in',o.posDevice?.posId||'N/A',o.status])]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}))
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  const nav = t => { setTab(t); setSelOrder(null); setShowAddCust(false); setNewPosData(null); setMsg(null) }

  const chart7 = Array.from({length:7}).map((_,i) => {
    const d = new Date(); d.setDate(d.getDate()-6+i)
    const ds = d.toDateString()
    const day = d.toLocaleDateString('en-US',{weekday:'short'})
    const rev = orders.filter(o=>o.status==='paid'&&new Date(o.createdAt).toDateString()===ds).reduce((a,o)=>a+(o.amount||0),0)
    const cnt = orders.filter(o=>new Date(o.createdAt).toDateString()===ds).length
    return { day, rev:+rev.toFixed(2), cnt }
  })

  const totalRev = orders.filter(o=>o.status==='paid').reduce((a,o)=>a+(o.amount||0),0)
  const todayRev = orders.filter(o=>o.status==='paid'&&new Date(o.createdAt).toDateString()===new Date().toDateString()).reduce((a,o)=>a+(o.amount||0),0)
  const initials = (merchant?.businessName||merchant?.name||'M').charAt(0).toUpperCase()

  // VERIFYING
  if (verifying) return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem',background:'radial-gradient(circle at top, rgba(200,168,112,0.12), transparent 30%), linear-gradient(175deg,#1e0a0e 0%,#0f0608 40%,#160810 70%,#120608 100%)'}}>
        <div className="lift" style={{background:C.white,borderRadius:'28px',padding:'2.5rem',width:'100%',maxWidth:'420px',boxShadow:'0 30px 90px rgba(0,0,0,0.45)',border:`1px solid ${C.border}`,textAlign:'center'}}>
          <img src="/logo.png" alt="Logo" style={{height:'52px',objectFit:'contain',marginBottom:'1rem'}} onError={e=>e.target.style.display='none'}/>
          <h1 style={{fontSize:'1.8rem',fontWeight:'600',color:C.text,margin:0}}>Merchant Portal</h1>
          <p style={{color:C.textMuted,fontSize:'0.875rem',margin:'0.25rem 0 2rem',fontFamily:'DM Mono, monospace',letterSpacing:'0.08em',textTransform:'uppercase'}}>Verifying session...</p>
          <div style={{fontSize:'3rem',animation:'pulse 1.5s ease-in-out infinite'}}>⏳</div>
        </div>
      </div>
    </>
  )

  // LOGIN
  if (!token) return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem',background:'radial-gradient(circle at top, rgba(200,168,112,0.12), transparent 30%), linear-gradient(175deg,#1e0a0e 0%,#0f0608 40%,#160810 70%,#120608 100%)'}}>
        <div className="lift" style={{background:C.white,borderRadius:'28px',padding:'2.5rem',width:'100%',maxWidth:'420px',boxShadow:'0 30px 90px rgba(0,0,0,0.45)',border:`1px solid ${C.border}`}}>
          <div style={{textAlign:'center',marginBottom:'2rem'}}>
            <img src="/logo.png" alt="Logo" style={{height:'52px',objectFit:'contain',marginBottom:'1rem'}} onError={e=>e.target.style.display='none'}/>
            <h1 style={{fontSize:'1.8rem',fontWeight:'600',color:C.text,margin:0}}>Merchant Portal</h1>
            <p style={{color:C.textMuted,fontSize:'0.875rem',margin:'0.25rem 0 0',fontFamily:'DM Mono, monospace',letterSpacing:'0.08em',textTransform:'uppercase'}}>Sign in to your dashboard</p>
          </div>
          {msg && <div style={{padding:'0.75rem',background:msg.t==='e'?C.redLight:C.accentLight,color:msg.t==='e'?C.red:C.accentDark,borderRadius:'10px',marginBottom:'1rem',fontSize:'0.875rem'}}>{msg.text}</div>}
          <form onSubmit={login}>
            <div style={{marginBottom:'1rem'}}>
              <label style={{display:'block',fontSize:'0.72rem',fontWeight:'500',color:C.textMuted,marginBottom:'0.375rem',fontFamily:'DM Mono, monospace',letterSpacing:'0.1em',textTransform:'uppercase'}}>Email</label>
              <input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} required style={INP} placeholder="merchant@email.com"/>
            </div>
            <div style={{marginBottom:'1.5rem'}}>
              <label style={{display:'block',fontSize:'0.72rem',fontWeight:'500',color:C.textMuted,marginBottom:'0.375rem',fontFamily:'DM Mono, monospace',letterSpacing:'0.1em',textTransform:'uppercase'}}>Password</label>
              <input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} required style={INP} placeholder="••••••••"/>
            </div>
            <button type="submit" className="lift" style={{...BP,width:'100%',padding:'0.875rem',fontSize:'1rem'}}>Sign In</button>
          </form>
        </div>
      </div>
    </>
  )

  // MAINTENANCE SCREEN — system offline
  if (token && !systemOnline) return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'radial-gradient(circle at top, rgba(200,168,112,0.12), transparent 30%), linear-gradient(175deg,#1e0a0e 0%,#0f0608 40%,#160810 70%,#120608 100%)',padding:'2rem'}}>
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:'28px',padding:'2.5rem',width:'100%',maxWidth:'420px',textAlign:'center',boxShadow:'0 30px 90px rgba(0,0,0,0.45)'}}>
          <div style={{fontSize:'4rem',marginBottom:'1rem'}}>🔴</div>
          <h1 style={{fontSize:'1.7rem',fontWeight:'600',color:C.text,marginBottom:'0.5rem'}}>System Unavailable</h1>
          <p style={{color:'#6b7280',fontSize:'0.95rem',marginBottom:'1.5rem',lineHeight:1.6}}>
            {systemMessage || 'The system is currently offline for maintenance. Please try again later.'}
          </p>
          <div style={{background:'#fef3c7',border:'1px solid #fde68a',borderRadius:'12px',padding:'1rem',marginBottom:'1.5rem'}}>
            <p style={{fontSize:'0.8rem',color:'#92400e',fontWeight:'600',margin:0}}>Your account and data are safe. The system will be back online shortly.</p>
          </div>
          <button onClick={()=>load()} style={{width:'100%',padding:'0.875rem',background:`linear-gradient(135deg,${C.accent},#9f7c42)`,color:'#111318',border:'none',borderRadius:'12px',fontSize:'1rem',fontWeight:'700',cursor:'pointer'}}>
            Try Again
          </button>
          <button onClick={logout} style={{width:'100%',padding:'0.75rem',background:'none',color:'#6b7280',border:'none',fontSize:'0.875rem',cursor:'pointer',marginTop:'0.5rem'}}>
            Sign Out
          </button>
        </div>
      </div>
    </>
  )

  // SHELL
  return (
    <>
      <style>{CSS}</style>
      <div style={{display:'flex',minHeight:'100vh',background:'radial-gradient(circle at top, rgba(200,168,112,0.1), transparent 20%), linear-gradient(175deg,#1e0a0e 0%,#0f0608 40%,#160810 70%,#120608 100%)'}}>

        {/* MOBILE SIDEBAR OVERLAY */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position:'fixed',
              top:0, left:0, right:0, bottom:0,
              background:'rgba(0,0,0,0.5)',
              zIndex:99,
              animation:'fadeIn 0.2s ease-out'
            }}
          />
        )}

        {/* SIDEBAR */}
        <aside style={{
          width:'220px',
          background:C.sidebar,
          display:'flex',
          flexDirection:'column',
          position: isMobile ? 'fixed' : 'sticky',
          top:0,
          height:'100vh',
          flexShrink:0,
          zIndex: isMobile ? 100 : 1,
          transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
          transition: isMobile ? 'transform 0.3s ease-out' : 'none',
          boxShadow: isMobile && sidebarOpen ? '0 8px 32px rgba(0,0,0,0.3)' : 'none'
        }}>
          <div style={{padding:'1.25rem',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',gap:'0.75rem'}}>
            <img src="/logo.png" alt="Logo" style={{height:'34px',objectFit:'contain',borderRadius:'6px'}} onError={e=>e.target.style.display='none'}/>
            <span style={{color:'white',fontWeight:'800',fontSize:'0.95rem'}}>PrimeStack</span>
          </div>
          <div style={{padding:'0.875rem 1.25rem',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',gap:'0.625rem'}}>
            <div style={{width:'34px',height:'34px',background:'rgba(22,163,74,0.3)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:C.accentMid,fontWeight:'800',fontSize:'0.875rem',flexShrink:0}}>{initials}</div>
            <div style={{minWidth:0}}>
              <p style={{color:'white',fontSize:'0.8rem',fontWeight:'700',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{merchant?.businessName||'Merchant'}</p>
              <p style={{color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',margin:0}}>#{merchant?.merchantId||'—'}</p>
            </div>
          </div>
          <nav style={{flex:1,padding:'1rem 0.75rem',overflowY:'auto'}}>
            <p style={{color:'rgba(255,255,255,0.3)',fontSize:'0.65rem',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.1em',padding:'0 0.625rem',margin:'0 0 0.5rem'}}>Menu</p>
            {NAV.map(n=>(
              <button key={n.id} className="nb" onClick={()=>{nav(n.id); if(isMobile) setSidebarOpen(false);}}
                style={{width:'100%',display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.625rem 0.75rem',background:tab===n.id?C.accent:'transparent',color:tab===n.id?'white':'rgba(255,255,255,0.65)',border:'none',borderRadius:'10px',cursor:'pointer',fontSize:'0.875rem',fontWeight:tab===n.id?'700':'400',textAlign:'left',marginBottom:'2px'}}>
                <span style={{fontSize:'1rem',width:'20px',textAlign:'center'}}>{n.icon}</span>
                {n.label}
                {tab===n.id&&<span style={{marginLeft:'auto',width:'6px',height:'6px',background:'white',borderRadius:'50%'}}/>}
              </button>
            ))}
          </nav>
          <div style={{padding:'0.875rem 0.75rem',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
            <button className="nb" onClick={logout} style={{width:'100%',display:'flex',alignItems:'center',gap:'0.625rem',padding:'0.625rem 0.75rem',background:'rgba(239,68,68,0.12)',color:'#fca5a5',border:'none',borderRadius:'10px',cursor:'pointer',fontSize:'0.875rem',fontWeight:'600'}}>
              <span>🚪</span> Sign Out
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>
          <header style={{
            background:C.white,
            borderBottom:`1px solid ${C.border}`,
            padding: isMobile ? '0 1rem' : '0 2rem',
            height:'62px',
            display:'flex',
            alignItems:'center',
            justifyContent:'space-between',
            flexShrink:0,
            boxShadow:'0 1px 8px rgba(22,163,74,0.07)'
          }}>
            <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
              {/* HAMBURGER MENU BUTTON (only mobile) */}
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  style={{
                    background:'none',
                    border:'none',
                    cursor:'pointer',
                    padding:'0.3rem 0.5rem',
                    fontSize:'1.3rem',
                    color:C.text
                  }}
                >
                  ☰
                </button>
              )}
              <div>
                <h1 style={{fontSize:'1.1rem',fontWeight:'800',color:C.text,margin:0}}>{NAV.find(n=>n.id===tab)?.label||'Dashboard'}</h1>
                <p style={{fontSize:'0.72rem',color:C.textMuted,margin:0}}>{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap: isMobile ? '0.5rem' : '0.875rem'}}>
              {/* Notification Bell */}
              <div style={{position:'relative'}}>
                <button onClick={()=>setShowNotif(!showNotif)}
                  style={{background:'none',border:`1.5px solid ${C.border}`,borderRadius:'10px',padding:'0.4rem 0.6rem',cursor:'pointer',fontSize:'1.1rem',position:'relative'}}>
                  🔔
                  {notifications.filter(n=>!n.read).length>0&&(
                    <span style={{position:'absolute',top:'-4px',right:'-4px',background:C.red,color:'white',borderRadius:'50%',width:'16px',height:'16px',fontSize:'0.65rem',fontWeight:'800',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {notifications.filter(n=>!n.read).length}
                    </span>
                  )}
                </button>
                {showNotif&&(
                  <div style={{
                    position:'absolute',
                    right: isMobile ? '-50px' : 0,
                    top:'110%',
                    width: isMobile ? '90vw' : '340px',
                    background:C.white,
                    borderRadius:'14px',
                    boxShadow:'0 8px 32px rgba(0,0,0,0.15)',
                    border:`1px solid ${C.border}`,
                    zIndex:100,
                    maxHeight:'400px',
                    overflowY:'auto'
                  }}>
                    <div style={{padding:'0.875rem 1rem',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <p style={{fontWeight:'700',color:C.text,margin:0,fontSize:'0.9rem'}}>Notifications</p>
                      <button onClick={()=>setShowNotif(false)} style={{background:'none',border:'none',cursor:'pointer',color:C.textMuted,fontSize:'1rem'}}>✕</button>
                    </div>
                    {notifications.length===0
                      ?<p style={{padding:'1.5rem',textAlign:'center',color:C.textMuted,fontSize:'0.875rem'}}>No notifications</p>
                      :notifications.map(n=>(
                        <div key={n.id} onClick={()=>markNotifRead(n.id)}
                          style={{padding:'0.875rem 1rem',borderBottom:`1px solid ${C.border}`,cursor:'pointer',background:n.read?'transparent':C.accentLight,transition:'background 0.15s'}}>
                          <div style={{display:'flex',alignItems:'flex-start',gap:'0.625rem'}}>
                            <span style={{fontSize:'1.1rem',marginTop:'0.1rem'}}>
                              {n.type==='verification_approved'?'✅':n.type==='verification_rejected'?'❌':'🔔'}
                            </span>
                            <div>
                              <p style={{fontSize:'0.8rem',fontWeight:'700',color:C.textDark,margin:'0 0 0.2rem'}}>{n.title}</p>
                              <p style={{fontSize:'0.75rem',color:C.textMuted,margin:'0 0 0.25rem',lineHeight:1.4}}>{n.message}</p>
                              <p style={{fontSize:'0.7rem',color:C.textMuted,margin:0}}>{new Date(n.createdAt).toLocaleString()}</p>
                            </div>
                            {!n.read&&<span style={{width:'8px',height:'8px',background:C.accent,borderRadius:'50%',flexShrink:0,marginTop:'0.25rem'}}/>}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
              {/* Hide the merchant info on mobile to save space */}
              {!isMobile && (
                <div style={{textAlign:'right'}}>
                  <p style={{fontSize:'0.8rem',fontWeight:'600',color:C.text,margin:0}}>{merchant?.businessName||'Merchant'}</p>
                  <p style={{fontSize:'0.7rem',color:C.textMuted,margin:0}}>{merchant?.email}</p>
                </div>
              )}
              {!isMobile && (
                <div style={{width:'38px',height:'38px',background:`linear-gradient(135deg,${C.accent},${C.accentDark})`,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:'800',fontSize:'0.9rem',boxShadow:'0 2px 8px rgba(22,163,74,0.4)'}}>{initials}</div>
              )}
            </div>
          </header>

          {msg&&<div style={{margin: isMobile ? '1rem 1rem 0' : '1rem 2rem 0',padding:'0.875rem 1rem',borderRadius:'12px',fontSize:'0.875rem',fontWeight:'500',background:msg.t==='s'?C.accentLight:C.redLight,color:msg.t==='s'?C.accentDark:C.red,border:`1px solid ${msg.t==='s'?C.accentMid:'#fecaca'}`}}>{msg.text}</div>}

          <main style={{flex:1,padding: isMobile ? '1rem' : '1.5rem 2rem',overflowY:'auto'}}>

            {/* DASHBOARD */}
            {tab==='dashboard'&&(
              <div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(185px,1fr))',gap:'1rem',marginBottom:'1.5rem'}}>
                  {[
                    {l:'Total Revenue',   v:`$${fmt(totalRev)}`, icon:'💰',g:'linear-gradient(135deg,#16a34a,#15803d)', s:`${orders.filter(o=>o.status==='paid').length} paid`},
                    {l:"Today's Revenue", v:`$${fmt(todayRev)}`, icon:'📈',g:'linear-gradient(135deg,#3b82f6,#2563eb)', s:'today'},
                    {l:'Total Orders',    v:orders.length,        icon:'📋',g:'linear-gradient(135deg,#8b5cf6,#7c3aed)',s:`${orders.filter(o=>o.status==='pending').length} pending`},
                    {l:'Failed',          v:orders.filter(o=>o.status==='failed').length, icon:'⚠',g:'linear-gradient(135deg,#ef4444,#dc2626)',s:'need attention'},
                    {l:'POS Devices',     v:posDevices.length,    icon:'🖥',g:'linear-gradient(135deg,#0d9488,#0f766e)',s:`${posDevices.filter(p=>p.status==='active').length} active`},
                    {l:'Customers',       v:customers.length,     icon:'👥',g:'linear-gradient(135deg,#f59e0b,#d97706)',s:'registered'},
                  ].map(c=>(
                    <div key={c.l} className="lift" style={{background:C.white,borderRadius:'14px',padding:'1.25rem',boxShadow:'0 2px 8px rgba(22,163,74,0.08)',border:`1px solid ${C.border}`}}>
                      <div style={{width:'42px',height:'42px',background:c.g,borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',marginBottom:'0.875rem',boxShadow:'0 4px 12px rgba(0,0,0,0.15)'}}>{c.icon}</div>
                      <p style={{fontSize:'1.875rem',fontWeight:'800',color:C.textDark,margin:'0 0 0.125rem',lineHeight:1}}>{c.v}</p>
                      <p style={{fontSize:'0.72rem',fontWeight:'600',color:C.textMuted,margin:'0 0 0.1rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>{c.l}</p>
                      <p style={{fontSize:'0.72rem',color:C.accent,margin:0,fontWeight:'500'}}>{c.s}</p>
                    </div>
                  ))}
                </div>

                <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',gap:'1rem',marginBottom:'1.5rem'}}>
                  <div style={{background:C.white,borderRadius:'14px',padding:'1.25rem',border:`1px solid ${C.border}`,boxShadow:'0 2px 8px rgba(22,163,74,0.08)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
                      <div><h3 style={{fontSize:'0.9rem',fontWeight:'700',color:C.text,margin:0}}>Revenue Overview</h3><p style={{fontSize:'0.75rem',color:C.textMuted,margin:0}}>Last 7 days</p></div>
                      <span style={{background:C.accentLight,color:C.accentDark,padding:'0.25rem 0.625rem',borderRadius:'20px',fontSize:'0.72rem',fontWeight:'700'}}>LIVE</span>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={chart7} margin={{top:5,right:5,left:-20,bottom:0}}>
                        <defs><linearGradient id="mg1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.accent} stopOpacity={0.3}/><stop offset="95%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                        <XAxis dataKey="day" tick={{fontSize:11,fill:C.textMuted}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:11,fill:C.textMuted}} axisLine={false} tickLine={false}/>
                        <Tooltip contentStyle={{borderRadius:'10px',border:`1px solid ${C.border}`,fontSize:'0.8rem'}}/>
                        <Area type="monotone" dataKey="rev" stroke={C.accent} strokeWidth={2.5} fill="url(#mg1)" name="Revenue ($)"/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{background:C.white,borderRadius:'14px',padding:'1.25rem',border:`1px solid ${C.border}`,boxShadow:'0 2px 8px rgba(22,163,74,0.08)'}}>
                    <div style={{marginBottom:'1rem'}}><h3 style={{fontSize:'0.9rem',fontWeight:'700',color:C.text,margin:0}}>Daily Orders</h3><p style={{fontSize:'0.75rem',color:C.textMuted,margin:0}}>Last 7 days</p></div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={chart7} margin={{top:5,right:5,left:-20,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                        <XAxis dataKey="day" tick={{fontSize:11,fill:C.textMuted}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:11,fill:C.textMuted}} axisLine={false} tickLine={false} allowDecimals={false}/>
                        <Tooltip contentStyle={{borderRadius:'10px',border:`1px solid ${C.border}`,fontSize:'0.8rem'}}/>
                        <Bar dataKey="cnt" fill={C.accent} radius={[6,6,0,0]} name="Orders"/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr auto',gap:'1rem',alignItems:'start'}}>
                  <Card title="Recent Orders" extra={<Lnk onClick={()=>nav('payments')}>View all</Lnk>}>
                    <Tbl heads={['Order ID','Amount','Customer','Status','Date']}
                      rows={orders.slice(0,6).map(o=>[
                        <B accent>{o.orderId}</B>,
                        <B>{o.currency} {fmt(o.amount)}</B>,
                        o.customer?.name||'Walk-in',
                        <Bdg s={o.status}/>,
                        <Sm>{new Date(o.createdAt).toLocaleDateString()}</Sm>
                      ])}
                      onRow={i=>{setSelOrder(orders[i]);setTab('payments')}}
                      empty="No orders yet"/>
                  </Card>
                  <div style={{display:'flex',flexDirection:'column',gap:'0.75rem',minWidth:'195px'}}>
                    {[{l:'Add POS Device',icon:'➕',id:'pos'},{l:'Add Customer',icon:'👤',id:'customers'},{l:'View Payments',icon:'💳',id:'payments'},{l:'Settings',icon:'⚙',id:'settings'}].map(a=>(
                      <button key={a.id} className="lift" onClick={()=>nav(a.id)}
                        style={{background:C.white,border:`1.5px solid ${C.border}`,borderRadius:'12px',padding:'0.875rem 1rem',cursor:'pointer',textAlign:'left',boxShadow:'0 1px 4px rgba(22,163,74,0.07)',display:'flex',alignItems:'center',gap:'0.625rem',width:'100%'}}>
                        <span style={{fontSize:'1.25rem'}}>{a.icon}</span>
                        <span style={{fontSize:'0.85rem',fontWeight:'600',color:C.textDark}}>{a.l}</span>
                        <span style={{marginLeft:'auto',color:C.textMuted}}>&#8250;</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* POS DEVICES */}
            {tab==='pos'&&(
              <div>
                <PH title="POS Devices" sub={`${posDevices.length} total`} action={<button className="lsm" onClick={addPos} style={BP}>+ Add POS</button>}/>
                {newPosData&&(
                  <div className="lift" style={{background:C.white,borderRadius:'14px',border:`2px solid ${C.accent}`,padding:'1.5rem',marginBottom:'1.5rem',maxWidth:'460px'}}>
                    <h3 style={{fontSize:'1rem',fontWeight:'700',color:C.text,margin:'0 0 1rem'}}>&#127881; New POS Device Ready</h3>
                    <div style={{background:C.bg,borderRadius:'10px',padding:'1.25rem',textAlign:'center',border:`1px solid ${C.border}`,marginBottom:'1rem'}}>
                      <p style={{fontSize:'0.72rem',color:C.textMuted,fontWeight:'700',textTransform:'uppercase',margin:'0 0 0.25rem'}}>POS ID</p>
                      <p style={{fontWeight:'700',color:C.textDark,margin:'0 0 1rem'}}>{newPosData.pos_id}</p>
                      <p style={{fontSize:'0.72rem',color:C.textMuted,fontWeight:'700',textTransform:'uppercase',margin:'0 0 0.5rem'}}>Activation Code</p>
                      <div style={{fontFamily:'monospace',fontSize:'2rem',fontWeight:'800',letterSpacing:'0.3rem',color:C.accent,background:C.white,borderRadius:'10px',padding:'0.75rem',border:`2px dashed ${C.accentMid}`}}>{newPosData.activation_code}</div>
                    </div>
                    <p style={{fontSize:'0.8rem',color:C.textMuted,margin:'0 0 1rem'}}>Enter this code on your POS device to activate it.</p>
                    <button className="lsm" style={BP} onClick={()=>setNewPosData(null)}>Done</button>
                  </div>
                )}
                <Card>
                  <Tbl heads={['POS ID','Status','Last Seen','Mode']}
                    rows={posDevices.map(p=>[
                      <B accent>{p.posId}</B>,<Bdg s={p.status}/>,
                      p.lastSeenAt?new Date(p.lastSeenAt).toLocaleString():'Never',
                      <span style={{background:C.purpleLight,color:C.purple,padding:'0.2rem 0.5rem',borderRadius:'6px',fontSize:'0.72rem',fontWeight:'700'}}>MOTO</span>
                    ])}
                    empty="No POS devices yet"/>
                </Card>
              </div>
            )}

            {/* CUSTOMERS */}
            {tab==='customers'&&(
              <div>
                <PH title="Customers" sub={`${customers.length} total`} action={<button className="lsm" onClick={()=>setShowAddCust(true)} style={BP}>+ Add Customer</button>}/>
                {showAddCust&&(
                  <div style={{maxWidth:'520px',marginBottom:'1.5rem'}}>
                    <Back onClick={()=>setShowAddCust(false)} label="Cancel"/>
                    <Card title="Add Customer">
                      <form onSubmit={addCust}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
                          <Fld l="Name"><input type="text" value={newCust.name} onChange={e=>setNewCust({...newCust,name:e.target.value})} required style={INP} placeholder="Full name"/></Fld>
                          <Fld l="Email"><input type="email" value={newCust.email} onChange={e=>setNewCust({...newCust,email:e.target.value})} style={INP} placeholder="email@example.com"/></Fld>
                          <Fld l="Phone"><input type="text" value={newCust.phone} onChange={e=>setNewCust({...newCust,phone:e.target.value})} style={INP} placeholder="+1 555 0000"/></Fld>
                          <Fld l="Billing Address"><input type="text" value={newCust.billingAddress} onChange={e=>setNewCust({...newCust,billingAddress:e.target.value})} style={INP} placeholder="123 Main St"/></Fld>
                        </div>
                        <button type="submit" className="lsm" style={{...BP,marginTop:'0.5rem'}}>Save Customer</button>
                      </form>
                    </Card>
                  </div>
                )}

                {/* Verification submission modal */}
                {verifyCustomer&&(
                  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:'1rem'}}>
                    <div style={{background:C.white,borderRadius:'16px',padding:'2rem',width:'100%',maxWidth:'520px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',maxHeight:'90vh',overflowY:'auto'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
                        <h2 style={{fontSize:'1rem',fontWeight:'800',color:C.text,margin:0}}>Submit Customer for Verification</h2>
                        <button onClick={()=>{setVerifyCustomer(null);setVerifyDocs([]);setVerifyNotes('')}} style={{background:'none',border:'none',cursor:'pointer',color:C.textMuted,fontSize:'1.2rem'}}>✕</button>
                      </div>

                      <div style={{background:C.accentLight,borderRadius:'10px',padding:'0.875rem',marginBottom:'1.25rem',border:`1px solid ${C.accentMid}`}}>
                        <p style={{fontSize:'0.8rem',fontWeight:'700',color:C.accentDark,margin:'0 0 0.25rem'}}>Customer: {verifyCustomer.name}</p>
                        <p style={{fontSize:'0.75rem',color:C.accentDark,margin:0}}>Submitting this will pause ALL your POS devices until admin approves.</p>
                      </div>

                      <div style={{marginBottom:'1.25rem'}}>
                        <label style={{display:'block',fontSize:'0.8rem',fontWeight:'700',color:C.text,marginBottom:'0.375rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>
                          Upload Documents *
                        </label>
                        <div style={{border:`2px dashed ${C.border}`,borderRadius:'12px',padding:'1.5rem',textAlign:'center',background:C.bg,cursor:'pointer'}}
                          onClick={()=>document.getElementById('doc-upload').click()}>
                          <p style={{fontSize:'1.5rem',margin:'0 0 0.5rem'}}>📄</p>
                          <p style={{fontSize:'0.875rem',fontWeight:'600',color:C.text,margin:'0 0 0.25rem'}}>Click to upload documents</p>
                          <p style={{fontSize:'0.75rem',color:C.textMuted,margin:0}}>PDF, JPG, PNG — ID, passport, utility bill etc.</p>
                          <input id="doc-upload" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleDocUpload} style={{display:'none'}}/>
                        </div>
                        {verifyDocs.length>0&&(
                          <div style={{marginTop:'0.75rem',display:'flex',flexDirection:'column',gap:'0.375rem'}}>
                            {verifyDocs.map((d,i)=>(
                              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:C.accentLight,padding:'0.5rem 0.75rem',borderRadius:'8px'}}>
                                <span style={{fontSize:'0.8rem',fontWeight:'600',color:C.text}}>📎 {d.name}</span>
                                <button onClick={()=>setVerifyDocs(prev=>prev.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:C.red,fontSize:'1rem'}}>✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{marginBottom:'1.5rem'}}>
                        <label style={{display:'block',fontSize:'0.8rem',fontWeight:'700',color:C.text,marginBottom:'0.375rem',textTransform:'uppercase',letterSpacing:'0.05em'}}>Notes (optional)</label>
                        <textarea value={verifyNotes} onChange={e=>setVerifyNotes(e.target.value)} rows={3}
                          style={{...INP,resize:'vertical',fontFamily:'inherit'}} placeholder="Any additional information for admin review..."/>
                      </div>

                      <div style={{display:'flex',gap:'0.75rem'}}>
                        <button onClick={()=>{setVerifyCustomer(null);setVerifyDocs([]);setVerifyNotes('')}} style={BS}>Cancel</button>
                        <button onClick={submitVerification} disabled={verifyLoading||verifyDocs.length===0}
                          style={{...BP,flex:1,opacity:(verifyLoading||verifyDocs.length===0)?0.6:1}}>
                          {verifyLoading?'Submitting...':'Submit for Verification'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <Card>
                  <Tbl heads={['Name','Email','Phone','Address','Action']}
                    rows={customers.map(c=>[
                      <B>{c.name}</B>,
                      c.email||'—',
                      c.phone||'—',
                      c.billingAddress||'—',
                      <button onClick={()=>setVerifyCustomer(c)} className="lsm"
                        style={{padding:'0.3rem 0.75rem',background:C.accentLight,color:C.accentDark,border:`1px solid ${C.accentMid}`,borderRadius:'8px',fontSize:'0.75rem',fontWeight:'700',cursor:'pointer'}}>
                        Verify
                      </button>
                    ])}
                    empty="No customers yet"/>
                </Card>
              </div>
            )}

            {/* PAYMENTS */}
            {tab==='payments'&&!selOrder&&(
              <div>
                <PH title="Payments" sub={`${orders.length} total · $${fmt(totalRev)} revenue`} action={<button className="lsm" onClick={exportCSV} style={BS}>&#8595; Export CSV</button>}/>
                <Card>
                  <Tbl heads={['Order ID','Amount','Customer','POS','Status','Date']}
                    rows={orders.map(o=>[
                      <B accent>{o.orderId}</B>,<B>{o.currency} {fmt(o.amount)}</B>,
                      o.customer?.name||'Walk-in', o.posDevice?.posId||'N/A',
                      <Bdg s={o.status}/>, new Date(o.createdAt).toLocaleDateString()
                    ])}
                    onRow={i=>setSelOrder(orders[i])}
                    empty="No payments yet"/>
                </Card>
              </div>
            )}

            {/* ORDER DETAIL */}
            {tab==='payments'&&selOrder&&(
              <div style={{maxWidth:'580px'}}>
                <Back onClick={()=>setSelOrder(null)} label="Back to Payments"/>
                <Card title="Order Details">
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.875rem',marginBottom:'1.25rem'}}>
                    {[['Order ID',selOrder.orderId],['Amount',`${selOrder.currency} ${fmt(selOrder.amount)}`],
                      ['Customer',selOrder.customer?.name||'Walk-in'],['POS',selOrder.posDevice?.posId||'N/A'],
                      ['Date',new Date(selOrder.createdAt).toLocaleString()],
                      ...(selOrder.payment?.cardBrand?[['Card',`${selOrder.payment.cardBrand.toUpperCase()} .... ${selOrder.payment.cardLast4}`]]:[]),
                    ].map(([k,v])=><IBox key={k} k={k} v={String(v)}/>)}
                    <div style={{background:C.accentLight,borderRadius:'10px',padding:'0.875rem'}}><p style={{fontSize:'0.68rem',color:C.accent,fontWeight:'700',textTransform:'uppercase',margin:'0 0 0.3rem'}}>Status</p><Bdg s={selOrder.status}/></div>
                  </div>
                  {selOrder.payment?.receiptUrl&&<a href={selOrder.payment.receiptUrl} target="_blank" rel="noreferrer" style={{...BS,textDecoration:'none',display:'inline-flex'}}>&#128196; Receipt</a>}
                </Card>
              </div>
            )}

            {/* TRANSACTIONS */}
            {tab==='transactions'&&(
              <div>
                <PH title="Transactions" sub={`${transactions.length} total`}/>
                <Card>
                  <Tbl heads={['Transaction ID','Amount','Type','POS Device','Date']}
                    rows={transactions.map(t=>[
                      <B accent>{t.id}</B>,
                      <B>{t.currency} {fmt(t.amount)}</B>,
                      <span style={{textTransform:'capitalize'}}>{t.type}</span>,
                      t.posDevice?.posId || 'N/A',
                      new Date(t.createdAt).toLocaleString()
                    ])}
                    empty="No transactions yet"/>
                </Card>
              </div>
            )}

            {/* SETTINGS */}
            {tab==='settings'&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem',maxWidth:'860px'}}>
                <Card title="Business Profile">
                  <form onSubmit={saveProfile}>
                    {[['businessName','text','Business Name',true],['email','email','Email',true],['phone','text','Phone',false],['address','text','Address',false],['country','text','Country',false]].map(([f,t,l,r])=>(
                      <Fld key={f} l={l}><input type={t} value={profile[f]} onChange={e=>setProfile({...profile,[f]:e.target.value})} required={r} style={{...INP,...(f==='email'?{background:'#f9fafb',color:C.textMuted}:{})}} readOnly={f==='email'} disabled={f==='email'}/></Fld>
                    ))}
                    <div style={{background:C.bg,borderRadius:'10px',padding:'0.75rem',marginBottom:'1rem',border:`1px solid ${C.border}`}}>
                      <p style={{fontSize:'0.68rem',color:C.accent,fontWeight:'700',textTransform:'uppercase',margin:'0 0 0.2rem'}}>Merchant ID</p>
                      <p style={{fontSize:'0.875rem',fontWeight:'700',color:C.textDark,margin:0}}>{merchant?.merchantId||'—'}</p>
                    </div>
                    <button type="submit" className="lsm" style={BP}>Save Profile</button>
                  </form>
                </Card>
                <Card title="Change Password">
                  <form onSubmit={changePw}>
                    {[['cur','Current Password'],['nw','New Password (min 8)'],['cf','Confirm Password']].map(([f,l])=>(
                      <Fld key={f} l={l}><input type="password" value={pwForm[f]} onChange={e=>setPwForm({...pwForm,[f]:e.target.value})} required minLength={f==='cur'?1:8} style={INP} placeholder="••••••••"/></Fld>
                    ))}
                    <button type="submit" className="lsm" style={{...BP,background:'#7c3aed'}}>Change Password</button>
                  </form>
                </Card>
              </div>
            )}

          </main>
        </div>
      </div>

      {/* Chat Button */}
      <button
        onClick={openChat}
        className="lift"
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #16a34a, #15803d)',
          color: 'white',
          border: 'none',
          fontSize: '1.5rem',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(22,163,74,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}
      >
        💬
        {chatUnread > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: '#ef4444',
            color: 'white',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            fontSize: '0.7rem',
            fontWeight: '800',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {chatUnread}
          </span>
        )}
      </button>

      {/* Chat Modal */}
      {showChat && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          padding: '2rem',
          zIndex: 100
        }} onClick={() => setShowChat(false)}>
          <div style={{
            width: '100%',
            maxWidth: '450px',
            height: '600px',
            background: 'white',
            borderRadius: '20px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            {/* Chat Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1a3a28, #2d6a4f)',
              padding: '1rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '1rem', fontWeight: '800' }}>
                  Chat with Admin
                </h3>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>
                  We'll get back to you shortly
                </p>
              </div>
              <button onClick={() => setShowChat(false)} style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '1.25rem',
                cursor: 'pointer'
              }}>✕</button>
            </div>

            {/* Chat Messages */}
            <div style={{
              flex: 1,
              padding: '1rem',
              overflowY: 'auto',
              background: '#f0fdf4',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              {chatMessages.length === 0 ? (
                <p style={{
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  marginTop: '2rem'
                }}>
                  No messages yet. Start a conversation!
                </p>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: msg.sender === 'merchant' ? 'flex-end' : 'flex-start'
                  }}>
                    <div style={{
                      maxWidth: '80%',
                      padding: '0.75rem 1rem',
                      borderRadius: '16px',
                      background: msg.sender === 'merchant' ? '#16a34a' : 'white',
                      color: msg.sender === 'merchant' ? 'white' : '#111827',
                      fontSize: '0.875rem',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                      borderBottomRightRadius: msg.sender === 'merchant' ? '4px' : '16px',
                      borderBottomLeftRadius: msg.sender === 'merchant' ? '16px' : '4px'
                    }}>
                      <p style={{ margin: 0, wordBreak: 'break-word' }}>{msg.message}</p>
                      <p style={{
                        margin: '0.25rem 0 0 0',
                        fontSize: '0.65rem',
                        opacity: 0.7,
                        textAlign: 'right'
                      }}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={sendChatMsg} style={{
              padding: '1rem',
              background: 'white',
              borderTop: '1px solid #d1fae5',
              display: 'flex',
              gap: '0.75rem'
            }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type your message..."
                style={{
                  ...INP,
                  flex: 1,
                  marginBottom: 0
                }}
              />
              <button type="submit" disabled={!chatInput.trim()} style={{
                ...BP,
                opacity: chatInput.trim() ? 1 : 0.5,
                cursor: chatInput.trim() ? 'pointer' : 'not-allowed'
              }}>
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// COMPONENTS
function Bdg({s}){const m={active:{bg:'#dcfce7',c:'#15803d'},paid:{bg:'#dcfce7',c:'#15803d'},suspended:{bg:'#fee2e2',c:'#dc2626'},failed:{bg:'#fee2e2',c:'#dc2626'},disabled:{bg:'#fee2e2',c:'#dc2626'},pending:{bg:'#fef3c7',c:'#b45309'}};const x=m[s]||{bg:'#f3f4f6',c:'#6b7280'};return <span style={{background:x.bg,color:x.c,padding:'0.2rem 0.65rem',borderRadius:'20px',fontSize:'0.75rem',fontWeight:'700',display:'inline-block'}}>{cap(s)}</span>}
function B({children,accent}){return <span style={{fontWeight:'700',color:accent?'#16a34a':'#111827'}}>{children}</span>}
function Sm({children}){return <span style={{fontSize:'0.8rem',color:'#6b7280'}}>{children}</span>}
function Lnk({onClick,children}){return <button onClick={onClick} style={{fontSize:'0.8rem',color:'#16a34a',background:'none',border:'none',cursor:'pointer',fontWeight:'600'}}>{children}</button>}
function IBox({k,v}){return <div style={{background:'#f0fdf4',borderRadius:'10px',padding:'0.875rem',border:'1px solid #d1fae5'}}><p style={{fontSize:'0.68rem',color:'#16a34a',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 0.3rem'}}>{k}</p><p style={{fontSize:'0.875rem',fontWeight:'700',color:'#111827',margin:0,wordBreak:'break-all'}}>{v}</p></div>}
function Card({title,extra,children}){return <div style={{background:'#fff',borderRadius:'14px',border:'1px solid #d1fae5',boxShadow:'0 2px 8px rgba(22,163,74,0.07)',overflow:'hidden',marginBottom:'1rem'}}>{(title||extra)&&<div style={{padding:'1rem 1.25rem',borderBottom:'1px solid #d1fae5',display:'flex',justifyContent:'space-between',alignItems:'center'}}>{title&&<h2 style={{fontSize:'0.9rem',fontWeight:'700',color:'#14532d',margin:0}}>{title}</h2>}{extra}</div>}{children}</div>}
function Tbl({heads,rows,onRow,empty}){return <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:'#f0fdf4'}}>{heads.map(h=><th key={h} style={{padding:'0.7rem 1.25rem',textAlign:'left',fontSize:'0.7rem',color:'#16a34a',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.06em',borderBottom:'1px solid #d1fae5'}}>{h}</th>)}</tr></thead><tbody>{rows.length===0?<tr><td colSpan={heads.length} style={{padding:'3rem',textAlign:'center',color:'#6b7280',fontSize:'0.875rem'}}>{empty}</td></tr>:rows.map((row,i)=><tr key={i} className="rh" onClick={()=>onRow&&onRow(i)} style={{borderTop:'1px solid #d1fae5'}}>{row.map((cell,j)=><td key={j} style={{padding:'0.85rem 1.25rem',fontSize:'0.875rem',color:'#6b7280'}}>{cell}</td>)}</tr>)}</tbody></table>}
function PH({title,sub,action}){return <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}><div><h2 style={{fontSize:'1.1rem',fontWeight:'800',color:'#14532d',margin:0}}>{title}</h2>{sub&&<p style={{fontSize:'0.8rem',color:'#6b7280',margin:0}}>{sub}</p>}</div>{action}</div>}
function Back({onClick,label}){return <button onClick={onClick} className="lsm" style={{display:'flex',alignItems:'center',gap:'0.375rem',background:'none',border:'none',color:'#16a34a',cursor:'pointer',fontSize:'0.875rem',fontWeight:'600',padding:0,marginBottom:'1rem'}}>&#8592; {label}</button>}
function Fld({l,children}){return <div style={{marginBottom:'1rem'}}><label style={{display:'block',fontSize:'0.8rem',fontWeight:'700',color:'#14532d',marginBottom:'0.375rem'}}>{l}</label>{children}</div>}

const INP = {width:'100%',padding:'0.625rem 0.875rem',border:`1.5px solid ${C.border}`,borderRadius:'10px',fontSize:'0.875rem',boxSizing:'border-box',color:C.textDark,background:C.white}
const BP  = {display:'inline-flex',alignItems:'center',gap:'0.375rem',padding:'0.625rem 1.25rem',background:`linear-gradient(135deg,${C.accent},#9f7c42)`,color:'#111318',border:'none',borderRadius:'10px',fontSize:'0.875rem',fontWeight:'700',cursor:'pointer'}
const BS  = {display:'inline-flex',alignItems:'center',gap:'0.375rem',padding:'0.625rem 1.25rem',background:C.white,color:C.textDark,border:`1.5px solid ${C.border}`,borderRadius:'10px',fontSize:'0.875rem',fontWeight:'600',cursor:'pointer'}
