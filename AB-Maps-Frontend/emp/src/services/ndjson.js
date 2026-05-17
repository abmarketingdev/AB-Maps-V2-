/**
 * NDJSON streaming helper for progressive loading
 */

export async function streamNdjson(
  url,
  headers,
  onItem,
  onDone,
  onError,
  signal
) {
  try {
    const res = await fetch(url, { headers, cache: 'no-store', signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    const isNdjson = contentType.includes('application/x-ndjson');
    if (!res.body) throw new Error('No response body');

    if (isNdjson) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line) continue;
          onItem(JSON.parse(line));
        }
      }
      if (buf.trim()) onItem(JSON.parse(buf));
      onDone && onDone();
      return;
    }

    // Fallback JSON (handle array or object shapes)
    const data = await res.json();
    if (Array.isArray(data)) {
      for (const item of data) onItem(item);
    } else {
      const list = data.results || data.items || [];
      for (const item of list) onItem(item);
    }
    onDone && onDone();
  } catch (err) {
    onError && onError(err);
  }
}



