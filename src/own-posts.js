(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.XPostCheckOwnPosts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STORAGE_KEY = 'xPostCheckOwnPosts';
  const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

  function prune(entries, now = Date.now()) {
    const cutoff = now - RETENTION_MS;
    const seen = new Set();
    const out = [];
    for (const entry of Array.isArray(entries) ? entries : []) {
      const at = Date.parse(entry.at || '') || 0;
      if (!at || at < cutoff) continue;
      const key = entry.id || `${entry.text}|${at}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(entry);
    }
    return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 80);
  }

  async function loadOwnPosts() {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return [];
    const data = await chrome.storage.local.get([STORAGE_KEY]);
    return prune(data[STORAGE_KEY] || []);
  }

  async function saveOwnPosts(entries) {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    await chrome.storage.local.set({ [STORAGE_KEY]: prune(entries) });
  }

  async function rememberPost(post) {
    const text = String(post?.text || '').trim();
    if (text.length < 8) return;
    const current = await loadOwnPosts();
    if (current[0]?.text === text) return;
    current.unshift({
      id: post.id || '',
      text,
      href: post.href || '',
      at: post.at || new Date().toISOString(),
    });
    await saveOwnPosts(current);
  }

  return {
    STORAGE_KEY,
    RETENTION_MS,
    prune,
    loadOwnPosts,
    saveOwnPosts,
    rememberPost,
  };
});
