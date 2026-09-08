/* Debug: what element is at the gear's viewport point? Usage: node scripts/demo-hit.cjs */
const WebSocket = require('ws');
const http = require('http');

http.get('http://127.0.0.1:9335/json', (res) => {
  let b = '';
  res.on('data', (c) => (b += c));
  res.on('end', () => {
    const page = JSON.parse(b).find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `(() => {
            const btns = [...document.querySelectorAll('button')];
            const gear = btns[btns.length - 1];
            const r = gear.getBoundingClientRect();
            const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
            const el = document.elementFromPoint(cx, cy);
            return JSON.stringify({
              gearRect: { x: r.x, y: r.y, w: r.width, h: r.height, cx, cy },
              underCursor: el ? (el.tagName + ' ' + (el.getAttribute('aria-label') || el.textContent.slice(0, 20))) : 'none',
              view: document.body.innerText.slice(0, 40).replace(/\\n/g, '|')
            });
          })()`,
          returnByValue: true,
        },
      }));
    });
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.id === 1) { console.log(m.result.result.value); ws.close(); process.exit(0); }
    });
  });
});
