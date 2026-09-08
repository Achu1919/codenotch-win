/* Move the demo instance window to a given screen rect. Usage: node scripts/demo-move.cjs X Y */
const WebSocket = require('ws');
const http = require('http');

const port = process.env.CN_PORT || '9335';
const X = parseInt(process.argv[2] || '1632', 10);
const Y = parseInt(process.argv[3] || '16', 10);

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
        // windowState normal first (setWindowBounds ignores x/y while maximized)
        await cdp('Browser.setWindowBounds', { windowId: r1.windowId, bounds: { windowState: 'normal' } });
        await cdp('Browser.setWindowBounds', { windowId: r1.windowId, bounds: { x: X, y: Y, windowState: 'normal' } });
        const r2 = await cdp('Browser.getWindowBounds', { windowId: r1.windowId });
        console.log('NOW AT:', JSON.stringify(r2.bounds));
        ws.close();
        process.exit(0);
      })();
    });
  });
}).on('error', (e) => { console.log('ERR', e.message); process.exit(1); });
