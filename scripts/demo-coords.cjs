/* Query on-screen coords of demo targets. Usage: node scripts/demo-coords.cjs <what>
   what: pill | expanded-gear | back-button. Prints JSON {x,y} in SCREEN coords. */
const WebSocket = require('ws');
const http = require('http');

const port = process.env.CN_PORT || '9335';
const WIN_X = parseInt(process.env.CN_WIN_X || '1632', 10);
const WIN_Y = parseInt(process.env.CN_WIN_Y || '16', 10);

const SELECTORS = {
  pill: `(() => { const r = document.getElementById('notch-card').getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()`,
  'expanded-gear': `(() => {
    const btns = [...document.querySelectorAll('button')];
    const gear = btns[btns.length - 1];
    const r = gear.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()`,
  'back-button': `(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Back');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()`,
};

const what = process.argv[2];
http.get(`http://127.0.0.1:${port}/json`, (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    const tabs = JSON.parse(body);
    const page = tabs.find((t) => t.type === 'page' && /CodeNotch/i.test(t.title));
    if (!page) { console.error('NO_TAB'); process.exit(1); }
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: SELECTORS[what], returnByValue: true },
      }));
    });
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.id === 1) {
        const v = m.result?.result?.value;
        if (!v) { console.error('NOT_FOUND'); process.exit(1); }
        console.log(JSON.stringify({ x: Math.round(WIN_X + v.x), y: Math.round(WIN_Y + v.y) }));
        ws.close();
        process.exit(0);
      }
    });
  });
}).on('error', (e) => { console.error('ERR', e.message); process.exit(1); });
