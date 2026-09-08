export function createAPI(getBaseURL) {
  return async (action, values = {}) => {
    const base = getBaseURL(); if (!base) throw new Error('Connect your omg.dev backend in Wall setup first.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      // text/plain keeps GitHub Pages → omg.dev requests simple CORS requests.
      // Authentication is an opaque, server-verified session token in the body;
      // it never appears in a query string, link, or browser history.
      const response = await fetch(`${base}/api/hall`, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ ...values, action }), signal: controller.signal });
      const result = await response.json();
      if (!response.ok) { const error = new Error(result.error || 'The request failed. Please try again.'); error.status = response.status; throw error; }
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The server took too long to respond. Please try again.');
      throw error;
    } finally { clearTimeout(timer); }
  };
}
