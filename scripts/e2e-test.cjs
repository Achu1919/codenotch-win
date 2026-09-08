/* CDP-driven E2E for the widget: real mouse events, screenshots at each step. */
const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');

const OUT = process.argv[2] || 'e2e';
const CLICK = process.argv[3] === 'click';

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

function cdpSend(ws, id, method, params) {
  return new Promise((resolve) => {
    const onMsg = (raw) => {
      const m = JSON.parse(raw);
      if (m.id === id) {
        ws.off('message', onMsg);
        resolve(m.result ?? m);
      }
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ id, method, params: params ?? {} }));
  });
}

(async () => {
  const url = await getWsUrl();
  if (!url) { console.log('NO_TAB'); process.exit(1); }
  const ws = new WebSocket(url);
  await new Promise((r) => ws.on('open', r));
  let id = 0;

  // window bounds (viewport-relative math)
  await cdpSend(ws, ++id, 'Page.enable');
  const { windowId } = await cdpSend(ws, ++id, 'Browser.getWindowForTarget');
  const { bounds } = await cdpSend(ws, ++id, 'Browser.getWindowBounds', { windowId });

  const evalJs = async (expr) => {
    const r = await cdpSend(ws, ++id, 'Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result ? r.result.value : undefined;
  };

  const shot = async (name) => {
    const r = await cdpSend(ws, ++id, 'Page.captureScreenshot', { format: 'png' });
    if (r.data) fs.writeFileSync(`C:/Users/gopal/projects/forge/codenotch-win/e2e-${OUT}-${name}.png`, Buffer.from(r.data, 'base64'));
  };

  // 1. collapsed state
  const state0 = await evalJs(`(() => {
    const card = document.getElementById('notch-card');
    const rect = card.getBoundingClientRect();
    return JSON.stringify({ w: rect.width, h: rect.height, x: rect.x, y: rect.y,
      rings: document.querySelectorAll('svg').length });
  })()`);
  console.log('COLLAPSED:', state0);
  await shot('1-collapsed');

  const card = JSON.parse(state0);
  const cx = Math.round(card.x + card.w / 2);
  const cy = Math.round(card.y + card.h / 2);

  // 2. real mouse move onto the card center
  await cdpSend(ws, ++id, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy, buttons: 0 });
  await new Promise((r) => setTimeout(r, 600));

  const state1 = await evalJs(`(() => {
    const card = document.getElementById('notch-card');
    const rect = card.getBoundingClientRect();
    const badges = [...document.querySelectorAll('span')].map(s => s.textContent).slice(0, 8);
    return JSON.stringify({ w: rect.width, h: rect.height, badges });
  })()`);
  console.log('AFTER HOVER:', state1);
  await shot('2-expanded');

  if (CLICK) {
    // 3. click the gear (settings) — top-right of the card
    const gearBox = await evalJs(`(() => {
      const btns = [...document.querySelectorAll('button')];
      const gear = btns[btns.length - 1];
      const r = gear.getBoundingClientRect();
      return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    })()`);
    const g = JSON.parse(gearBox);
    await cdpSend(ws, ++id, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(g.x), y: Math.round(g.y) });
    await new Promise((r) => setTimeout(r, 150));
    await cdpSend(ws, ++id, 'Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(g.x), y: Math.round(g.y), button: 'left', clickCount: 1 });
    await cdpSend(ws, ++id, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(g.x), y: Math.round(g.y), button: 'left', clickCount: 1 });
    await new Promise((r) => setTimeout(r, 600));
    console.log('AFTER GEAR CLICK:', await evalJs(`document.body.innerText.slice(0, 300)`));
    await shot('3-settings');
  }

  ws.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
