const STORAGE_KEY = 'xPostCheckOwnPosts';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

chrome.storage.local.get([STORAGE_KEY]).then((data) => {
  const now = Date.now();
  const posts = (data[STORAGE_KEY] || []).filter((entry) => {
    const at = Date.parse(entry.at || '');
    return Number.isFinite(at) && at >= now - WEEK_MS;
  });
  const el = document.getElementById('cache');
  el.textContent = posts.length
    ? `本机近 7 天已缓存 ${posts.length} 条自己发过的正文。`
    : '还没有本机发帖缓存。用这个浏览器发出去的帖才会记下来。';
});
