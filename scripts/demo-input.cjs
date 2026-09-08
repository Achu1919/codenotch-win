/* Drive renderer input via CDP (trusted events, like a real user).
   Usage: node scripts/demo-input.cjs move|click <viewportX> <viewportY> [port] */
const WebSocket = require('ws');
const http = require('http');

const [, , action, vx, vy, portArg] = process.argv;
const port = portArg || '9335';
const x = Math.round(parseFloat(vx));
const y = Math.round(parseFloat(vy));

http.get(`http://127.0.0.1:${port}/json`, (res) => {
  let b = '';
  res.on('data', (c) => (b += c));
  res.on('end', () => {
    const page = JSON.parse(b).find((t) => t.type === 'page');
    if (!page) { console.log('NO_TAB'); process.exit(1); }
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    ws.on('open', () => {
      const cdp = (method, params) => new Promise((resolve) => {
        const onMsg = (raw) => {
          const m = JSON.parse(raw);
          if (m.id === id) { ws.off('message', onMsg); resolve(m); }
        };
        ws.on('message', onMsg);
        ws.send(JSON.stringify({ id, method, params: params ?? {} }));
      });
      (async () => {
        if (action === 'move') {
          await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        } else if (action === 'click') {
          await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
          await new Promise((r) => setTimeout(r, 120));
          await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
          await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
        }
        console.log('OK', action, x, y);
        ws.close();
        process.exit(0);
      })();
    });
  });
}).on('error', (e) => { console.log('ERR', e.message); process.exit(1); });
