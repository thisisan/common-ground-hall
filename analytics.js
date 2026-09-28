// Aggregate events only: no profile IDs, names, contact values, searches or URLs.
export function createTracker(base, { disabled = false } = {}) {
  if (!base || disabled || navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return () => {};
  let session;
  try {
    session = sessionStorage.getItem('sky-wall:visit');
    if (!session) { session = crypto.randomUUID(); sessionStorage.setItem('sky-wall:visit', session); }
  } catch { session = crypto.randomUUID(); }
  let source = 'direct';
  try {
    const host = new URL(document.referrer).hostname;
    if (host !== location.hostname) source = /(^|\.)google\.[a-z.]+$/.test(host) ? 'google' : /(^|\.)instagram\.com$/.test(host) ? 'instagram' : /(^|\.)facebook\.com$/.test(host) ? 'facebook' : /(^|\.)threads\.(com|net)$/.test(host) ? 'threads' : /(^|\.)hku\.hk$/.test(host) ? 'hku' : 'other';
  } catch {}
  return event => {
    if (!['page_view','profile_open','contact_open','contact_click'].includes(event)) return;
    void fetch(`${base}/api/hall`, { method: 'POST', credentials: 'omit', keepalive: true, headers: {'Content-Type':'text/plain;charset=UTF-8'}, body: JSON.stringify({action:'track',event,source,session}) }).catch(() => {});
  };
}
