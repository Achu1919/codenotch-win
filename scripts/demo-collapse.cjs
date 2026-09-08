/* Collapse the widget by dispatching mouseleave on the card (React handles it
   identically to a real cursor leave). Usage: node scripts/demo-collapse.cjs [port] */
const WebSocket = require('ws');
const http = require('http');

const port = process.argv[2] || '9335';
http.get(`http://127.0.0.1:${port}/json`, (res) => {
  let b = '';
  res.on('data', (c) => (b += c));
  res.on('end', () => {
    const page = JSON.parse(b).find((t) => t.type === 'page');
    if (!page) { console.log('NO_TAB'); process.exit(1); }
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `(() => {
            const card = document.getElementById('notch-card');
            card.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false, cancelable: true }));
            card.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, cancelable: true }));
            return 'dispatched';
          })()`,
          returnByValue: true,
        },
      }));
    });
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.id === 1) { console.log(m.result.result.value); ws.close(); setTimeout(() => process.exit(0), 400); }
    });
  });
}).on('error', () => { console.log('CDP_DOWN'); process.exit(1); });
