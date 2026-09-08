/* Verify demo instance position + ring state. Usage: node scripts/demo-check.cjs */
const WebSocket = require('ws');
const http = require('http');

const port = process.env.CN_PORT || '9335';

http.get(`http://127.0.0.1:${port}/json`, (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    const tabs = JSON.parse(body);
    const page = tabs.find((t) => t.type === 'page' && /CodeNotch/i.test(t.title));
    if (!page) { console.log('NO_TAB'); process.exit(1); }
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    ws.on('open', () => {
      const cdp = (method, params) => new Promise((resolve) => {
        const onMsg = (raw) => {
          const m = JSON.parse(raw);
          if (m.id === id) { ws.off('message', onMsg); resolve(m.result ?? m); }
        };
        ws.on('message', onMsg);
        ws.send(JSON.stringify({ id, method, params: params ?? {} }));
      });
      (async () => {
        const r1 = await cdp('Browser.getWindowForTarget');
        const r2 = await cdp('Browser.getWindowBounds', { windowId: r1.windowId });
        console.log('WINDOW BOUNDS:', JSON.stringify(r2.bounds));
        const r3 = await cdp('Runtime.evaluate', {
          expression: `(async () => {
            const snaps = await window.notch.getSnapshots();
            const card = document.getElementById('notch-card').getBoundingClientRect();
            return JSON.stringify({
              cardInView: { x: card.x, y: card.y, w: card.width, h: card.height },
              providers: snaps.map(s => s.id + ':' + s.status)
            });
          })()`,
          awaitPromise: true,
          returnByValue: true,
        });
        console.log('STATE:', r3.result.value);
        ws.close();
        process.exit(0);
      })();
    });
  });
}).on('error', (e) => { console.log('ERR', e.message); process.exit(1); });
