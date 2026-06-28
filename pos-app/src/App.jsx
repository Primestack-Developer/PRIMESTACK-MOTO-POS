import React, { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || ''

/* ── Global CSS ─────────────────────────────────────────────────────────────── */
const G = `
  * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
  body {
    font-family:'Cormorant',Georgia,serif;
    background-color:#0f0608;
    background-image:
      repeating-linear-gradient(90deg,transparent 0,transparent 14px,rgba(255,255,255,.014) 14px,rgba(255,255,255,.014) 15px),
      repeating-linear-gradient(89deg,transparent 0,transparent 32px,rgba(0,0,0,.11) 32px,rgba(0,0,0,.11) 34px),
      linear-gradient(175deg,#1e0a0e 0%,#0f0608 40%,#160810 70%,#120608 100%);
    color:#e8e0d0;
    min-height:100dvh;
    overscroll-behavior:none;
    -webkit-font-smoothing:antialiased;
  }
  button,input,textarea,select{font:inherit}
  .scr { max-width:480px; margin:0 auto; padding:1.25rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom)); min-height:100dvh; display:flex; flex-direction:column; justify-content:center; }
  .scr-top { justify-content:flex-start; padding-top:1.25rem; }
  .card { background:#111318; border-radius:24px; padding:1.75rem; box-shadow:0 20px 48px rgba(0,0,0,.34); border:1px solid rgba(232,224,208,.10); }
  .lift { transition:transform .18s,box-shadow .18s; }
  .lift:active { transform:scale(0.97); }
  .lift:hover { transform:translateY(-3px); box-shadow:0 18px 40px rgba(0,0,0,.38)!important; }
  .sm { transition:transform .15s; }
  .sm:active { transform:scale(0.97); }
  .rh { transition:background .12s; cursor:pointer; }
  .rh:active { background:rgba(200,168,112,.10)!important; }
  .g-btn { width:100%; padding:1.1rem; background:linear-gradient(135deg,#c8a870,#9f7c42); color:#111318; border:none; border-radius:16px; font-size:1.05rem; font-weight:700; cursor:pointer; margin-top:0.5rem; box-shadow:0 8px 24px rgba(200,168,112,.18); transition:transform .15s; min-height:52px; }
  .g-btn:active { transform:scale(0.97); }
  .g-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
  .o-btn { width:100%; padding:0.875rem; background:#111318; color:#e8e0d0; border:1.5px solid rgba(232,224,208,.10); border-radius:14px; font-size:0.95rem; font-weight:600; cursor:pointer; margin-top:0.5rem; transition:transform .15s,background .15s; }
  .o-btn:hover { transform:translateY(-2px); background:rgba(255,255,255,.04); }
  .r-btn { width:100%; padding:0.875rem; background:#ef4444; color:#fff; border:none; border-radius:14px; font-size:0.95rem; font-weight:700; cursor:pointer; margin-top:0.5rem; }
  .inp { width:100%; padding:0.875rem 1rem; border:1.5px solid rgba(232,224,208,.10); border-radius:12px; font-size:1rem; background:rgba(255,255,255,.03); color:#f6efe1; outline:none; transition:border-color .15s,box-shadow .15s; }
  .inp:focus { border-color:#c8a870; box-shadow:0 0 0 3px rgba(200,168,112,.12); }
  .inp-xl { font-size:2.5rem; text-align:center; font-weight:800; }
  .inp-code { font-size:1.75rem; text-align:center; letter-spacing:0.5rem; font-weight:800; }
  .lbl { display:block; font-size:0.72rem; font-weight:500; color:rgba(232,224,208,.62); margin-bottom:0.375rem; text-transform:uppercase; letter-spacing:0.12em; font-family:'DM Mono',monospace; }
  .fg { margin-bottom:1rem; }
  .bdg-g { background:rgba(200,168,112,.12); color:#c8a870; padding:0.2rem 0.65rem; border-radius:20px; font-size:0.75rem; font-weight:700; }
  .bdg-r { background:#fee2e2; color:#dc2626; padding:0.2rem 0.65rem; border-radius:20px; font-size:0.75rem; font-weight:700; }
  .bdg-y { background:rgba(212,170,85,.14); color:#d4aa55; padding:0.2rem 0.65rem; border-radius:20px; font-size:0.75rem; font-weight:700; }
  .info-box { background:rgba(255,255,255,.03); border-radius:14px; padding:1rem; border:1px solid rgba(232,224,208,.10); margin-bottom:1rem; }
  .info-row { display:flex; justify-content:space-between; align-items:center; padding:0.3rem 0; border-bottom:1px solid rgba(232,224,208,.06); }
  .info-k { font-size:0.8rem; color:rgba(232,224,208,.62); font-weight:600; }
  .info-v { font-size:0.875rem; font-weight:700; color:#f6efe1; }
  @media print { body { display:none; } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .pulse { animation:pulse 1.5s ease-in-out infinite; }
`

/* ── Tiny helpers ───────────────────────────────────────────────────────────── */
const Bdg = ({ s }) => {
  if (s === 'paid') return <span className="bdg-g">Paid</span>
  if (s === 'failed') return <span className="bdg-r">Failed</span>
  return <span className="bdg-y">Pending</span>
}

const InfoRow = ({ k, v }) => (
  <div className="info-row">
    <span className="info-k">{k}</span>
    <span className="info-v">{v}</span>
  </div>
)

const Logo = () => (
  <img src="/logo.png" alt="PrimeStack"
    style={{ height: '38px', objectFit: 'contain', marginBottom: '0.5rem' }}
    onError={e => { e.target.style.display = 'none' }} />
)

const BackBtn = ({ onClick }) => (
  <button onClick={onClick} className="o-btn"
    style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.875rem', marginBottom: '1rem', marginTop: 0 }}>
    Back
  </button>
)

/* ── Main App ───────────────────────────────────────────────────────────────── */
const APP_VERSION = '1.0.1'; // Increment this to force clear cache

export default function App() {
  // Clear cache on version change
  React.useEffect(() => {
    const storedVersion = localStorage.getItem('posAppVersion');
    if (storedVersion !== APP_VERSION) {
      localStorage.clear();
      localStorage.setItem('posAppVersion', APP_VERSION);
    }
  }, []);

  const [creds, setCreds] = useState(() => {
    try { const s = localStorage.getItem('posCredentials'); return s ? JSON.parse(s) : null } catch { return null }
  })
  const [code, setCode]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [verifying, setVerifying] = useState(!!localStorage.getItem('posCredentials'))
  const [msg, setMsg]           = useState('')
  const [systemOnline, setSystemOnline] = useState(true)
  const [systemMessage, setSystemMessage] = useState('')
  const [view, setView]         = useState('activation')
  const [customers, setCustomers] = useState([])
  const [orders, setOrders]      = useState([])
  const [selOrder, setSelOrder]   = useState(null)
  const [pendingCreds, setPendingCreds] = useState(null)
  const [polling, setPolling]   = useState(false)
  const [curOrder, setCurOrder] = useState(null)
  const [linkOpened, setLinkOpened] = useState(false)
  const [pd, setPd] = useState({ amount: '', description: '', customerId: '', customerName: 'Walk-in Customer' })
  const [newCust, setNewCust]     = useState({ name: '', email: '', phone: '', billingAddress: '' })

  const token = creds ? creds.api_token : null;
  const AH = token ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } : {};

  // Verify stored credentials on app load - CLEAR OLD DATA FIRST if needed!
  useEffect(() => {
    if (!creds) {
      setVerifying(false);
      return;
    }

    const verifyCredentials = async () => {
      try {
        const res = await fetch(API + '/pos/customers', { headers: AH });
        if (res.ok) {
          // Credentials are valid, let's also get fresh device/merchant info
          // But for now proceed to home
          setView('home');
        } else {
          // Invalid credentials - CLEAR EVERYTHING!
          localStorage.removeItem('posCredentials');
          setCreds(null);
          setView('activation');
        }
      } catch (e) {
        // Network error - still use cached but let's let user know?
        setView('home');
      } finally {
        setVerifying(false);
      }
    };

    verifyCredentials();
  }, []);

  // Check SYSTEM STATUS and device/merchant status periodically
  useEffect(() => {
    // Always check system status, even if not logged in
    const checkSystemStatus = async () => {
      try {
        const res = await fetch(API + '/system/status');
        if (res.ok) {
          const data = await res.json();
          setSystemOnline(data.online);
          setSystemMessage(data.message || '');
        }
      } catch (e) {
        // If we can't reach server, assume online?
        setSystemOnline(true);
      }
    };

    // Check immediately on mount
    checkSystemStatus();

    // Check every 5 seconds
    const interval = setInterval(checkSystemStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Check device/merchant status periodically
  useEffect(() => {
    if (!token) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(API + '/pos/customers', { headers: AH });
        if (!res.ok) {
          const data = await res.json();
          if (data.error === 'POS device is disabled' || data.error === 'Merchant account is suspended') {
            setView('suspended');
          }
        }
      } catch (e) {}
    };

    // Check every 5 seconds
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [token]);

  // Play success sound
  const playSuccessSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const beep = (freq, start, dur) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
        gain.gain.setValueAtTime(0.8, ctx.currentTime + start)
        osc.start(ctx.currentTime + start)
        osc.stop(ctx.currentTime + start + dur)
      }
      beep(880, 0, 0.15)
      beep(1100, 0.2, 0.15)
      beep(1320, 0.4, 0.2)
    } catch(e) {}
  }

  // Play failure sound
  const playFailureSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const beep = (freq, start, dur) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
        gain.gain.setValueAtTime(0.8, ctx.currentTime + start)
        osc.start(ctx.currentTime + start)
        osc.stop(ctx.currentTime + start + dur)
      }
      beep(440, 0, 0.2)
      beep(330, 0.3, 0.3)
    } catch(e) {}
  }

  useEffect(() => { if (creds) loadCustomers() }, [creds])

  const loadCustomers = async () => {
    try {
      const r = await fetch(API + '/pos/customers', { headers: AH })
      const d = await r.json()
      setCustomers(Array.isArray(d) ? d : (d.customers || []))
    } catch (e) { console.error(e) }
  }

  const loadOrders = async () => {
    try {
      const r = await fetch(API + '/pos/orders', { headers: AH })
      const d = await r.json()
      setOrders(Array.isArray(d) ? d : (d.orders || []))
    } catch (e) { console.error(e) }
  }

  const doActivate = async (e) => {
    e.preventDefault()
    setLoading(true); setMsg('')
    try {
      const body = JSON.stringify({
        activation_code: code,
        device_info: { model: 'Web POS', serial: 'SN' + Date.now(), os: 'Web' }
      })
      const r = await fetch(API + '/pos/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
      const d = await r.json()
      if (d.api_token) {
        setPendingCreds({ merchant_id: d.merchant_id, merchant_name: d.merchant_name, pos_id: d.pos_id, api_token: d.api_token })
        setView('activation-success')
      } else {
        setMsg(d.error || 'Activation failed')
      }
    } catch (err) {
      setMsg('Cannot connect to server')
    }
    setLoading(false)
  }

  const completeActivation = () => {
    if (!pendingCreds) return
    localStorage.setItem('posCredentials', JSON.stringify(pendingCreds))
    setCreds(pendingCreds)
    setPendingCreds(null)
    setCode('')
    setView('home')
  }

  const doLogout = () => {
    // CLEAR ALL LOCAL STORAGE!
    localStorage.clear()
    setCreds(null)
    setView('activation')
    setPd({ amount: '', description: '', customerId: '', customerName: 'Walk-in Customer' })
    setCode('')
    setCustomers([])
    setOrders([])
    setSelOrder(null)
    setPendingCreds(null)
    setPolling(false)
    setCurOrder(null)
    setLinkOpened(false)
    setNewCust({ name: '', email: '', phone: '', billingAddress: '' })
    setMsg('')
  }

  const doAddCust = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const r = await fetch(API + '/pos/customers', { method: 'POST', headers: AH, body: JSON.stringify(newCust) })
      const d = await r.json()
      const customer = d.customer || d
      if (customer?.id) {
        setNewCust({ name: '', email: '', phone: '', billingAddress: '' })
        await loadCustomers()
        setPd({ ...pd, customerId: customer.id, customerName: customer.name })
        setView('customer-selection')
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const doCreateOrder = async () => {
    setLoading(true)
    setLinkOpened(false)
    const paymentWindow = window.open('', '_blank')
    try {
      const amount = parseFloat(pd.amount)

      if (!amount || amount <= 0) {
        setMsg('Enter a valid amount')
        if (paymentWindow) paymentWindow.close()
        setLoading(false)
        return
      }

      const body = JSON.stringify({
        amount: Math.round(amount * 100),
        currency: 'usd',
        description: pd.description || null,
        customer_id: pd.customerId || null,
        customer_name: pd.customerName || null
      })
      const r = await fetch(API + '/pos/moto/orders', { method: 'POST', headers: AH, body })
      const d = await r.json()

      if (!r.ok || d.error) {
        if (paymentWindow) paymentWindow.close()
        playFailureSound()
        setMsg(d.error || d.message || 'Payment failed')
        setView('failed')
      } else if (d.card_entry_url) {
        const order = {
          order_id: d.order_id,
          paymentIntentId: d.payment_intent_id,
          card_entry_url: d.card_entry_url,
          payment: null
        }
        setMsg('')
        setCurOrder(order)
        if (paymentWindow) {
          paymentWindow.location.href = d.card_entry_url
          setLinkOpened(true)
        }
        setView('processing')
        startPolling(d.order_id)
      } else {
        if (paymentWindow) paymentWindow.close()
        playFailureSound()
        setMsg(d.message || d.error || 'Failed to create order')
        setView('failed')
        setTimeout(() => setMsg(''), 5000)
      }
    } catch (e) {
      if (paymentWindow) paymentWindow.close()
      playFailureSound()
      setMsg('Error creating order')
      setView('failed')
      setTimeout(() => setMsg(''), 5000)
    }
    setLoading(false)
  }

  const startPolling = (orderId) => {
    setPolling(true)
    const iv = setInterval(async () => {
      try {
        const r = await fetch(API + '/pos/moto/orders/' + orderId, { headers: AH })
        const d = await r.json()
        if (d.status === 'paid') {
          clearInterval(iv)
          playSuccessSound()
          setCurOrder({ orderId: d.order_id, payment: d.card_brand ? { cardBrand: d.card_brand, cardLast4: d.last4 } : null })
          setView('success')
          setPolling(false)
        } else if (d.status === 'failed') {
          clearInterval(iv)
          playFailureSound()
          setView('failed')
          setPolling(false)
        } else if (d.status === 'flagged') {
          clearInterval(iv)
          playFailureSound()
          setView('flagged')
          setPolling(false)
        }
      } catch (e) {}
    }, 2000)
  }

  const doReset = () => {
    setPd({ amount: '', description: '', customerId: '', customerName: 'Walk-in Customer' })
    setCurOrder(null)
    setLinkOpened(false)
    setMsg('')
    setView('home')
  }

  const selectCust = (c) => {
    setPd({ ...pd, customerId: c ? c.id : '', customerName: c ? c.name : 'Walk-in Customer' })
    setView('confirm-payment')
  }

  const doPrint = (order, payment, amount, custName, desc) => {
    const w = window.open('', '_blank', 'width=400,height=620')
    if (!w) return
    const date = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const cardLine = payment && payment.cardBrand ? payment.cardBrand.toUpperCase() + ' ' + payment.cardLast4 : 'N/A'
    w.document.write('<!DOCTYPE html><html><head><title>Receipt</title><style>'
      + '* {margin:0;padding:0;box-sizing:border-box} body{font-family:Courier New,monospace;font-size:13px;padding:20px;max-width:320px;margin:0 auto}'
      + '.c{text-align:center} .d{border-top:1px dashed #000;margin:10px 0} .r{display:flex;justify-content:space-between;margin:4px 0}'
      + '.big{font-size:18px;font-weight:bold} .ok{font-size:15px;font-weight:bold;color:#059669;margin:8px 0}'
      + '@media print{.np{display:none}}'
      + '</style></head><body>'
      + '<div class="c"><div style="font-size:16px;font-weight:bold;margin-bottom:4px">' + (creds ? creds.merchant_name : 'PrimeStack MOTO POS') + '</div>'
      + '<div style="font-size:11px;margin-bottom:8px">MOTO Payment Receipt</div></div>'
      + '<div class="d"></div>'
      + '<div class="r"><span>Date:</span><span>' + date + '</span></div>'
      + '<div class="r"><span>Order ID:</span><span>' + (order ? (order.orderId || order.order_id || 'N/A') : 'N/A') + '</span></div>'
      + '<div class="r"><span>POS ID:</span><span>' + (creds ? creds.pos_id : 'N/A') + '</span></div>'
      + '<div class="d"></div>'
      + '<div class="r"><span>Customer:</span><span>' + (custName || 'Walk-in') + '</span></div>'
      + (desc ? '<div class="r"><span>Desc:</span><span>' + desc + '</span></div>' : '')
      + '<div class="d"></div>'
      + '<div class="r big"><span>TOTAL</span><span>$' + parseFloat(amount || 0).toFixed(2) + '</span></div>'
      + '<div class="d"></div>'
      + '<div class="r"><span>Card:</span><span>' + cardLine + '</span></div>'
      + '<div class="r"><span>Type:</span><span>MOTO</span></div>'
      + '<div class="ok c">PAYMENT APPROVED</div>'
      + '<div class="d"></div>'
      + '<div class="c" style="font-size:11px;margin-top:8px">Thank you<br/>Powered by PrimeStack</div>'
      + '<div class="np c" style="margin-top:20px"><button onclick="window.print()" style="padding:10px 30px;background:#16a34a;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px">Print</button></div>'
      + '<script>setTimeout(function(){window.print()},500)</script>'
      + '</body></html>')
    w.document.close()
  }

  /* ── SCREENS ──────────────────────────────────────────────────────────────── */

  // MAINTENANCE SCREEN - SHOW FIRST IF SYSTEM IS OFFLINE!
  if (!systemOnline) return (
    <>
      <style>{G}</style>
      <div className="scr">
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔴</div>
          <h1 style={{ fontSize: '1.7rem', fontWeight: '600', color: '#e8e0d0', marginBottom: '0.5rem' }}>System Unavailable</h1>
          <p style={{ color: 'rgba(232,224,208,0.62)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            {systemMessage || 'The system is currently offline for maintenance. Please try again later.'}
          </p>
          <div style={{ background: 'rgba(212,170,85,0.14)', border: '1px solid rgba(212,170,85,0.28)', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.8rem', color: '#d4aa55', fontWeight: '600', margin: 0 }}>Your account and data are safe. The system will be back online shortly.</p>
          </div>
          {creds && (
            <button onClick={doLogout} style={{ width: '100%', padding: '0.75rem', background: 'none', color: 'rgba(232,224,208,0.62)', border: 'none', fontSize: '0.875rem', cursor: 'pointer', marginTop: '0.5rem' }}>
              Logout
            </button>
          )}
        </div>
      </div>
    </>
  )

  if (verifying) return (
    <>
      <style>{G}</style>
      <div className="scr">
        <div className="card" style={{ textAlign: 'center' }}>
          <Logo />
          <h1 style={{ fontSize: '1.55rem', fontWeight: '600', color: '#e8e0d0', marginBottom: '0.25rem' }}>PrimeStack MOTO POS</h1>
          <p style={{ color: 'rgba(232,224,208,0.62)', fontSize: '0.875rem', marginBottom: '2rem', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Verifying device...</p>
          <div className="pulse" style={{ fontSize: '2rem' }}>⏳</div>
        </div>
      </div>
    </>
  )

  if (view === 'activation') return (
    <>
      <style>{G}</style>
      <div className="scr">
        <div className="card lift" style={{ textAlign: 'center' }}>
          <Logo />
          <h1 style={{ fontSize: '1.55rem', fontWeight: '600', color: '#e8e0d0', marginBottom: '0.25rem' }}>PrimeStack MOTO POS</h1>
          <p style={{ color: 'rgba(232,224,208,0.62)', fontSize: '0.875rem', marginBottom: '2rem', fontFamily: 'DM Mono, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Enter your activation code</p>
          {msg && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.875rem' }}>{msg}</div>}
          <form onSubmit={doActivate}>
            <div className="fg">
              <label className="lbl">Activation Code</label>
              <input className="inp inp-code" type="text" value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX" maxLength={9} required />
            </div>
            <button type="submit" className="g-btn lift" disabled={loading || code.length < 9}>
              {loading ? 'Activating...' : 'Activate Device'}
            </button>
          </form>
        </div>
      </div>
    </>
  )

  if (view === 'activation-success') return (
    <>
      <style>{G}</style>
      <div className="scr">
        <div className="card lift" style={{ textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg,#c8a870,#9f7c42)', color:'#111318', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.75rem' }}>
            ✓
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#c8a870', marginBottom: '1.5rem' }}>Activation Successful!</h1>
          <div className="info-box" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
            <InfoRow k="Merchant" v={pendingCreds ? pendingCreds.merchant_name : ''} />
            <InfoRow k="POS ID" v={pendingCreds ? pendingCreds.pos_id : ''} />
          </div>
          <button onClick={completeActivation} className="g-btn lift">Continue to POS</button>
        </div>
      </div>
    </>
  )

  if (view === 'suspended') return (
    <>
      <style>{G}</style>
      <div className="scr">
        <div className="card lift" style={{ textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2.5rem' }}>
            ⚠️
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#dc2626', marginBottom: '1rem' }}>Device Disabled</h1>
          <p style={{ color: 'rgba(232,224,208,0.62)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            This POS device has been disabled or the merchant account is suspended. Please contact the administrator for more information.
          </p>
          <button onClick={doLogout} className="g-btn lift" style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
            Log Out
          </button>
        </div>
      </div>
    </>
  )

  if (view === 'home') return (
    <>
      <style>{G}</style>
      <div className="scr scr-top">
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <Logo />
            <div>
              <h1 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#e8e0d0', margin: 0 }}>MOTO POS</h1>
              <span className="bdg-g">Active</span>
            </div>
          </div>
          <div className="info-box" style={{ marginBottom: 0 }}>
            <InfoRow k="Merchant" v={creds ? creds.merchant_name : ''} />
            <InfoRow k="POS ID" v={creds ? creds.pos_id : ''} />
          </div>
        </div>
        <button onClick={() => setView('amount-entry')} className="g-btn lift" style={{ fontSize: '1.05rem', padding: '1.2rem', marginBottom: '0.75rem' }}>
          💳 Create MOTO Payment
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <button onClick={() => setView('customer-selection')} className="o-btn sm" style={{ margin: 0 }}>👤 Customers</button>
          <button onClick={() => { loadOrders(); setView('orders') }} className="o-btn sm" style={{ margin: 0 }}>📋 Orders</button>
        </div>
        <button onClick={() => setView('settings')} className="o-btn sm">⚙ Settings</button>
      </div>
    </>
  )

  if (view === 'amount-entry') return (
    <>
      <style>{G}</style>
      <div className="scr">
        <div className="card">
          <BackBtn onClick={() => setView('home')} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#e8e0d0', marginBottom: '1.5rem', textAlign: 'center' }}>Create MOTO Payment</h2>
          <form onSubmit={e => { e.preventDefault(); setView('customer-selection') }}>
            <div className="fg">
              <label className="lbl">Amount (USD)</label>
              <input className="inp inp-xl" type="number" step="0.01" min="0.01" max="10000"
                value={pd.amount} onChange={e => setPd({ ...pd, amount: e.target.value })}
                placeholder="0.00" required />
              {pd.amount && parseFloat(pd.amount) > 10000 && (
                <p style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: '600', marginTop: '0.5rem', textAlign: 'center' }}>
                  Maximum transaction limit is $10,000.00
                </p>
              )}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(232,224,208,0.10)', borderRadius: '10px', padding: '0.625rem 0.875rem', marginBottom: '1rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: '#c8a870', fontWeight: '600', margin: 0 }}>Maximum per transaction: $10,000.00</p>
            </div>
            <div className="fg">
              <label className="lbl">Description (optional)</label>
              <input className="inp" type="text" value={pd.description}
                onChange={e => setPd({ ...pd, description: e.target.value })}
                placeholder="Product or service" />
            </div>
            <button type="submit" className="g-btn lift"
              disabled={!pd.amount || parseFloat(pd.amount) <= 0 || parseFloat(pd.amount) > 10000}>
              Next: Select Customer
            </button>
          </form>
        </div>
      </div>
    </>
  )

  if (view === 'customer-selection') return (
    <>
      <style>{G}</style>
      <div className="scr scr-top">
        <div className="card">
          <BackBtn onClick={() => setView('amount-entry')} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#e8e0d0', marginBottom: '0.25rem' }}>Select Customer</h2>
          <p style={{ color: 'rgba(232,224,208,0.62)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Amount: <strong style={{ color: '#e8e0d0' }}>${parseFloat(pd.amount || 0).toFixed(2)}</strong>
          </p>
          <button onClick={() => selectCust(null)} className="o-btn sm" style={{ background: '#dbeafe', borderColor: '#bfdbfe', color: '#1e40af', textAlign: 'left', marginBottom: '0.75rem' }}>
            👤 Walk-in Customer
          </button>
          {customers.length > 0 && (
            <div>
              <p style={{ fontSize: '0.72rem', color: 'rgba(232,224,208,0.62)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0.5rem 0', fontFamily: 'DM Mono, monospace' }}>Registered Customers</p>
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                {customers.map(c => {
                  const isVerified = c.verification?.status === 'approved';
                  return (
                    <button key={c.id} onClick={() => {
                      if (!isVerified) {
                        setMsg('This customer is not verified. Please contact admin to approve their verification.');
                        setTimeout(() => setMsg(''), 5000);
                      } else {
                        selectCust(c);
                      }
                    }} className="o-btn sm"
                      style={{ 
                        textAlign: 'left', 
                        marginBottom: '0.375rem', 
                        padding: '0.75rem 1rem', 
                        fontSize: '0.875rem',
                        opacity: isVerified ? 1 : 0.6,
                        cursor: isVerified ? 'pointer' : 'not-allowed'
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{c.name}</strong>
                          {c.email ? <span style={{ color: 'rgba(232,224,208,0.62)', fontSize: '0.8rem', display: 'block' }}>{c.email}</span> : null}
                        </div>
                        {isVerified ? (
                          <span className="bdg-g">Verified</span>
                        ) : (
                          <span className="bdg-y">Pending</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <button onClick={() => setView('add-customer')} className="g-btn" style={{ marginBottom: '0.5rem' }}>+ New Customer</button>
          <button onClick={() => setView('confirm-payment')} className="o-btn">Skip</button>
        </div>
      </div>
    </>
  )

  if (view === 'add-customer') return (
    <>
      <style>{G}</style>
      <div className="scr">
        <div className="card">
          <BackBtn onClick={() => setView('customer-selection')} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#e8e0d0', marginBottom: '1.5rem' }}>Add Customer</h2>
          <form onSubmit={doAddCust}>
            <div className="fg"><label className="lbl">Full Name *</label><input className="inp" type="text" value={newCust.name} onChange={e => setNewCust({ ...newCust, name: e.target.value })} required placeholder="John Smith" /></div>
            <div className="fg"><label className="lbl">Email</label><input className="inp" type="email" value={newCust.email} onChange={e => setNewCust({ ...newCust, email: e.target.value })} placeholder="john@email.com" /></div>
            <div className="fg"><label className="lbl">Phone</label><input className="inp" type="text" value={newCust.phone} onChange={e => setNewCust({ ...newCust, phone: e.target.value })} placeholder="+1 555 0000" /></div>
            <div className="fg"><label className="lbl">Billing Address</label><input className="inp" type="text" value={newCust.billingAddress} onChange={e => setNewCust({ ...newCust, billingAddress: e.target.value })} placeholder="123 Main St" /></div>
            <button type="submit" className="g-btn lift" disabled={loading}>{loading ? 'Saving...' : 'Save Customer'}</button>
          </form>
        </div>
      </div>
    </>
  )

  if (view === 'confirm-payment') return (
    <>
      <style>{G}</style>
      <div className="scr">
        <div className="card">
          <BackBtn onClick={() => setView('customer-selection')} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#e8e0d0', marginBottom: '1.5rem', textAlign: 'center' }}>Confirm Payment</h2>

          <div style={{ background: 'linear-gradient(135deg,#c8a870,#9f7c42)', borderRadius: '16px', padding: '1.75rem', textAlign: 'center', marginBottom: '1.5rem', boxShadow: '0 8px 24px rgba(200,168,112,0.22)' }}>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Total Amount</p>
            <p style={{ color: 'white', fontSize: '3rem', fontWeight: '800', lineHeight: 1 }}>${parseFloat(pd.amount || 0).toFixed(2)}</p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', marginTop: '0.5rem' }}>USD — MOTO Payment</p>
          </div>

          <div className="info-box">
            <InfoRow k="Customer" v={pd.customerName} />
            {pd.description ? <InfoRow k="Description" v={pd.description} /> : null}
            <InfoRow k="Type" v="MOTO (Card Not Present)" />
          </div>

          {msg && (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.85rem 1rem', borderRadius: '12px', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: '600' }}>
              {msg}
            </div>
          )}

          {/* Option A — Name confirmation warning */}
          {pd.customerId && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '12px', padding: '1rem', marginTop: '1rem', marginBottom: '0.5rem' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#92400e', margin: '0 0 0.5rem' }}>
                Important — Cardholder Name Check
              </p>
              <p style={{ fontSize: '0.8rem', color: '#78350f', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                The cardholder name on the card <strong>must match exactly</strong>:
              </p>
              <div style={{ background: 'white', borderRadius: '8px', padding: '0.625rem 0.875rem', border: '1px solid #fde68a', marginBottom: '0.75rem' }}>
                <p style={{ fontSize: '1rem', fontWeight: '800', color: '#111318', margin: 0, textAlign: 'center', letterSpacing: '0.02em' }}>
                  {pd.customerName}
                </p>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#92400e', margin: 0 }}>
                If a different name is entered, the payment will be <strong>automatically refunded</strong> and blocked.
              </p>
            </div>
          )}

          <div className="info-box" style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '0.72rem', color: '#c8a870', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem', fontFamily: 'DM Mono, monospace' }}>
              Stripe Hosted Card Entry
            </p>
            <p style={{ fontSize: '0.85rem', color: 'rgba(232,224,208,0.72)', lineHeight: 1.5, margin: 0 }}>
              The card page will open in Stripe Checkout. Do not enter or store card details on this POS device.
            </p>
          </div>

          <button onClick={doCreateOrder} className="g-btn lift" style={{ padding: '1.2rem', fontSize: '1.05rem', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Opening Stripe...' : 'Open Stripe Card Entry'}
          </button>
        </div>
      </div>
    </>
  )

  if (view === 'processing') return (
    <>
      <style>{G}</style>
      <div className="scr">
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="pulse" style={{ fontSize: '3rem', marginBottom: '1rem' }}>💳</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#e8e0d0', marginBottom: '0.5rem' }}>Processing Payment</h2>
          <p style={{ color: 'rgba(232,224,208,0.62)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {polling ? 'Waiting for payment confirmation...' : 'Stripe payment window opened in new tab'}
          </p>
          <div className="info-box" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
            <InfoRow k="Amount" v={'$' + parseFloat(pd.amount || 0).toFixed(2)} />
            <InfoRow k="Order ID" v={curOrder ? (curOrder.order_id || 'Processing...') : 'Processing...'} />
            <InfoRow k="Customer" v={pd.customerName} />
          </div>

          {/* Only show payment page link ONCE — when page hasn't been opened yet */}
          {!linkOpened && curOrder && curOrder.card_entry_url && (
            <div>
              <a href={curOrder.card_entry_url} target="_blank" rel="noreferrer"
                onClick={() => setLinkOpened(true)}
                style={{ display: 'block', padding: '0.875rem', background: '#1e40af', color: 'white', borderRadius: '14px', textDecoration: 'none', fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                Open Payment Page
              </a>
            </div>
          )}

          {linkOpened && (
            <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '12px', padding: '0.875rem', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#c8a870', margin: 0 }}>
                Payment page opened. Waiting for customer to complete payment...
              </p>
            </div>
          )}

          {polling && <p style={{ color: '#c8a870', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>Checking payment status...</p>}
          <button onClick={doReset} className="o-btn">Cancel</button>
        </div>
      </div>
    </>
  )

  if (view === 'success') return (
    <>
      <style>{G}</style>
      <div className="scr">
        <div className="card lift" style={{ textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg,#c8a870,#9f7c42)', color:'#111318', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(200,168,112,0.22)' }}>✓</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#c8a870', marginBottom: '0.5rem' }}>Payment Successful!</h2>
          <p style={{ fontSize: '2.75rem', fontWeight: '800', color: '#e8e0d0', margin: '1rem 0' }}>
            ${parseFloat(pd.amount || 0).toFixed(2)}
          </p>
          {curOrder && curOrder.payment && curOrder.payment.cardBrand && (
            <p style={{ color: 'rgba(232,224,208,0.62)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Card: {curOrder.payment.cardBrand.toUpperCase()} .... {curOrder.payment.cardLast4}
            </p>
          )}
          {curOrder && curOrder.orderId && (
            <p style={{ color: 'rgba(232,224,208,0.62)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>Order: {curOrder.orderId} | MOTO</p>
          )}
          <button onClick={() => doPrint(curOrder, curOrder ? curOrder.payment : null, pd.amount, pd.customerName, pd.description)}
            className="o-btn sm" style={{ marginBottom: '0.5rem' }}>
            🖨 Print Receipt
          </button>
          <button onClick={doReset} className="g-btn lift">New Payment</button>
          <button onClick={() => { loadOrders(); setView('orders') }} className="o-btn sm" style={{ marginTop: '0.5rem' }}>View Orders</button>
        </div>
      </div>
    </>
  )

  if (view === 'failed') return (
    <>
      <style>{G}</style>
      <div className="scr">
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 1rem' }}>✗</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#dc2626', marginBottom: '0.5rem' }}>Payment Failed</h2>
          <p style={{ color: 'rgba(232,224,208,0.62)', marginBottom: '1.5rem' }}>{msg || 'The payment was declined or failed to process.'}</p>
          <button onClick={() => setView('confirm-payment')} className="g-btn">Try Again</button>
          <button onClick={doReset} className="o-btn">New Payment</button>
        </div>
      </div>
    </>
  )

  if (view === 'flagged') return (
    <>
      <style>{G}</style>
      <div className="scr">
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', background: '#fef3c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 1rem' }}>🚫</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#92400e', marginBottom: '0.5rem' }}>Payment Blocked</h2>
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: '700', color: '#92400e', margin: '0 0 0.5rem' }}>Name Mismatch Detected</p>
            <p style={{ fontSize: '0.8rem', color: '#78350f', margin: 0, lineHeight: 1.5 }}>
              The cardholder name did not match the registered customer name. The payment has been <strong>automatically refunded</strong>. No funds were taken.
            </p>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'rgba(232,224,208,0.62)', marginBottom: '1.5rem' }}>
            Please ask the customer to use the card registered under: <strong style={{ color: '#e8e0d0' }}>{pd.customerName}</strong>
          </p>
          <button onClick={() => setView('confirm-payment')} className="g-btn">Try Again</button>
          <button onClick={doReset} className="o-btn">New Payment</button>
        </div>
      </div>
    </>
  )

  if (view === 'orders') return (
    <>
      <style>{G}</style>
      <div className="scr scr-top">
        <div className="card">
          <BackBtn onClick={() => setView('home')} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#e8e0d0', marginBottom: '1.25rem' }}>Orders</h2>
          {orders.length === 0
            ? <p style={{ textAlign: 'center', color: 'rgba(232,224,208,0.62)', padding: '2rem 0' }}>No orders yet</p>
            : <div style={{ maxHeight: '520px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {orders.map(o => (
                  <button key={o.id} onClick={() => { setSelOrder(o); setView('order-details') }} className="rh"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(232,224,208,0.10)', borderRadius: '12px', padding: '1rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', cursor: 'pointer' }}>
                    <div>
                      <p style={{ fontWeight: '700', color: '#e8e0d0', fontSize: '0.875rem', margin: 0 }}>{o.orderId}</p>
                      <p style={{ fontSize: '0.75rem', color: 'rgba(232,224,208,0.62)', margin: 0 }}>{new Date(o.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: '800', color: '#f6efe1', margin: '0 0 0.25rem' }}>{o.currency} {(o.amount || 0).toFixed(2)}</p>
                      <Bdg s={o.status} />
                    </div>
                  </button>
                ))}
              </div>
          }
        </div>
      </div>
    </>
  )

  if (view === 'order-details' && selOrder) return (
    <>
      <style>{G}</style>
      <div className="scr">
        <div className="card">
          <BackBtn onClick={() => setView('orders')} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#e8e0d0', marginBottom: '1.25rem' }}>Order Details</h2>
          <div className="info-box">
            <InfoRow k="Order ID" v={selOrder.orderId} />
            <InfoRow k="Amount" v={selOrder.currency + ' ' + (selOrder.amount || 0).toFixed(2)} />
            <InfoRow k="Customer" v={selOrder.customer ? selOrder.customer.name : 'Walk-in'} />
            {selOrder.payment && selOrder.payment.cardBrand && (
              <InfoRow k="Card" v={selOrder.payment.cardBrand.toUpperCase() + ' .... ' + selOrder.payment.cardLast4} />
            )}
            <InfoRow k="POS" v={selOrder.posDevice ? selOrder.posDevice.posId : 'N/A'} />
            <InfoRow k="Date" v={new Date(selOrder.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
            <div className="info-row">
              <span className="info-k">Status</span>
              <Bdg s={selOrder.status} />
            </div>
          </div>
          <button onClick={() => doPrint(selOrder, selOrder.payment, selOrder.amount, selOrder.customer ? selOrder.customer.name : 'Walk-in', selOrder.description)}
            className="o-btn sm">
            🖨 Print Receipt
          </button>
        </div>
      </div>
    </>
  )

  if (view === 'settings') return (
    <>
      <style>{G}</style>
      <div className="scr">
        <div className="card">
          <BackBtn onClick={() => setView('home')} />
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <Logo />
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#e8e0d0' }}>Settings</h2>
          </div>
          <div className="info-box">
            <InfoRow k="Merchant" v={creds ? creds.merchant_name : ''} />
            <InfoRow k="POS ID" v={creds ? creds.pos_id : ''} />
            <InfoRow k="Version" v="1.0.0" />
            <InfoRow k="Mode" v="MOTO" />
          </div>
          <button onClick={() => { loadCustomers(); loadOrders() }} className="o-btn sm" style={{ marginBottom: '0.5rem' }}>
            Sync Data
          </button>
          <button onClick={doLogout} className="r-btn">Logout / Deactivate POS</button>
        </div>
      </div>
    </>
  )

  return null
}
