/* Verify the PACKAGED exe shows live provider data. Usage: node scripts/verify-packaged.cjs */
const WebSocket = require('ws');
const http = require('http');

http.get('http://127.0.0.1:9334/json', (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    const tabs = JSON.parse(body);
    const page = tabs.find((t) => t.type === 'page' && /CodeNotch/i.test(t.title));
    if (!page) { console.log('NO_TAB'); process.exit(1); }
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `(async () => {
            const snaps = await window.notch.getSnapshots();
            const creds = await window.notch.getCredentials();
            return JSON.stringify({
              providers: snaps.map(s => ({ id: s.id, status: s.status, windows: s.windows.map(w => w.label + ' ' + Math.round(w.usedFraction*100) + '%') })),
              creds: creds.map(c => ({ p: c.provider, found: c.found }))
            });
          })()`,
          awaitPromise: true,
          returnByValue: true,
        },
      }));
    });
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.id === 1) {
        console.log(m.result.result.value);
        ws.close();
        process.exit(0);
      }
    });
  });
});
