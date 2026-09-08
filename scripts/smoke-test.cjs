/* Smoke test: run the compiled providers against the real endpoints.
   Prints window data only — never tokens. */
const { OpenCodeProvider } = require('./dist/main/providers/opencode.js');
const { CodexProvider } = require('./dist/main/providers/codex.js');
const { loadOpenCodeCredential } = require('./dist/main/providers/opencode.js');

function redact(s) {
  if (!s) return s;
  return s.replace(/([A-Za-z0-9_-]{12})[A-Za-z0-9._-]{8,}/g, '$1…REDACTED');
}

(async () => {
  console.log('=== OpenCode Go ===');
  const cred = loadOpenCodeCredential();
  console.log('credential found:', !!cred, '| source:', cred ? cred.source : null);
  const oc = new OpenCodeProvider();
  console.log('credentialInfo:', JSON.stringify(oc.credentialInfo()));
  try {
    const snap = await oc.fetchSnapshot();
    console.log('STATUS:', snap.status);
    console.log('windows:', JSON.stringify(snap.windows, null, 2));
    console.log('account:', JSON.stringify(snap.account));
  } catch (e) {
    console.log('FETCH FAILED:', e.type, '-', e.message);
  }

  console.log('\n=== Codex ===');
  const cx = new CodexProvider();
  console.log('credentialInfo:', JSON.stringify(cx.credentialInfo()));
  try {
    const snap = await cx.fetchSnapshot();
    console.log('STATUS:', snap.status);
    console.log('windows:', JSON.stringify(snap.windows, null, 2));
    console.log('account:', JSON.stringify(redact(JSON.stringify(snap.account))));
  } catch (e) {
    console.log('FETCH FAILED:', e.type, '-', redact(e.message));
  }
})();
