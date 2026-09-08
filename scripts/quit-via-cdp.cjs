/* Gracefully quit the running CodeNotch via its own renderer (calls notch.quit()). */
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
  if (!url) { console.log('NO_TAB (already quit?)'); process.exit(0); }
  const ws = new WebSocket(url);
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression: 'window.notch.quit()', returnByValue: true },
  }));
  await new Promise((r) => setTimeout(r, 1500));
  ws.close();
  console.log('QUIT_SENT');
})();
