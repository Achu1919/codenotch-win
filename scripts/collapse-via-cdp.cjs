/* Click the settings Back button via CDP, then move the cursor off the card. */
const WebSocket = require('ws');
const http = require('http');

function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9333/json', (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        const tabs = JSON.parse(body);
        const page = tabs.find((t) => t.type === 'page' && /CodeNotch/i.test(t.title));
        resolve(page ? page.webSocketDebuggerUrl : null);
      });
    }).on('error', reject);
  });
}

(async () => {
  const url = await getWsUrl();
  if (!url) { console.log('NO_TAB'); process.exit(1); }
  const ws = new WebSocket(url);
  await new Promise((r) => ws.on('open', r));
  let id = 0;
  const cdp = (method, params) => new Promise((resolve) => {
    const onMsg = (raw) => {
      const m = JSON.parse(raw);
      if (m.id === id) { ws.off('message', onMsg); resolve(m.result ?? m); }
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ id, method, params: params ?? {} }));
  });
  const evalJs = async (expr) => {
    const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result ? r.result.value : undefined;
  };

  // Back button = first button in settings view
  const back = await evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Back');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  })()`);
  if (back) {
    const p = JSON.parse(back);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(p.x), y: Math.round(p.y) });
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(p.x), y: Math.round(p.y), button: 'left', clickCount: 1 });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(p.x), y: Math.round(p.y), button: 'left', clickCount: 1 });
    await new Promise((r) => setTimeout(r, 400));
  }
  // move cursor far away so the card collapses + window goes click-through
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
  await new Promise((r) => setTimeout(r, 500));
  console.log('STATE:', await evalJs(`document.getElementById('notch-card').getBoundingClientRect().width`));
  ws.close();
})();
