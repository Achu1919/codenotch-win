/* Gracefully quit a CodeNotch running with debug port 9334 (the packaged test instance). */
const WebSocket = require('ws');
const http = require('http');

http.get('http://127.0.0.1:9334/json', (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    const tabs = JSON.parse(body);
    const page = tabs.find((t) => t.type === 'page' && /CodeNotch/i.test(t.title));
    if (!page) { console.log('NO_TAB'); process.exit(0); }
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'window.notch.quit()' } }));
      setTimeout(() => { ws.close(); console.log('QUIT_SENT'); process.exit(0); }, 1500);
    });
  });
}).on('error', () => { console.log('NO_DEBUG_PORT'); process.exit(0); });
