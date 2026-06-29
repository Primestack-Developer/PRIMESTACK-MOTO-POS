const http = require('http');

function post(path, body, headers, cb) {
  const b = JSON.stringify(body);
  const h = { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) };
  const r = http.request({ hostname: 'localhost', port: 3001, path, method: 'POST', headers: h }, res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => cb(res.statusCode, JSON.parse(d)));
  });
  r.write(b); r.end();
}
function get(path, headers, cb) {
  const r = http.request({ hostname: 'localhost', port: 3001, path, headers }, res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => cb(res.statusCode, JSON.parse(d)));
  });
  r.end();
}

// 1. Admin login
post('/admin/login', { email: 'admin@primestack.com', password: 'admin123' }, {}, (s, d) => {
  if (s !== 200) { console.log('Admin login failed:', d); return; }
  const adminToken = d.token;
  
  // 2. Get merchants
  get('/admin/merchants', { Authorization: 'Bearer ' + adminToken }, (s, d) => {
    const merchant = d.merchants?.[0];
    if (!merchant) { console.log('No merchants found'); return; }
    console.log('Using merchant:', merchant.email);
    
    // 3. Get POS devices
    get('/admin/pos-devices', { Authorization: 'Bearer ' + adminToken }, (s, d) => {
      const pos = d.posDevices?.find(p => p.merchantId === merchant.id && p.status === 'active');
      if (!pos) { console.log('No active POS found. Devices:', JSON.stringify(d.posDevices?.map(p => ({id:p.posId, status:p.status, merchant:p.merchantId})))); return; }
      console.log('Using POS:', pos.posId, '| status:', pos.status);
      
      // 4. Get POS token by re-activating
      post('/pos/activate', { activation_code: pos.activationCode, device_info: { model: 'Test', serial: 'TEST001' } }, {}, (s, d) => {
        if (!d.api_token) { console.log('Activation failed:', JSON.stringify(d)); return; }
        const posToken = d.api_token;
        console.log('POS token obtained');
        
        // 5. Try creating MOTO order
        post('/pos/moto/orders', 
          { amount: 1000, currency: 'usd', description: 'Test payment' },
          { Authorization: 'Bearer ' + posToken },
          (s, d) => {
            console.log('MOTO order status:', s);
            console.log('Response:', JSON.stringify(d));
          }
        );
      });
    });
  });
});
