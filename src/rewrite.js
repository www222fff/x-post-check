(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.XPostCheckRewrite = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function stripSpamBait(text) {
    return String(text || '')
      .replace(/[，, ]*(?:互关|互粉|互fo|有fo必回|关注必回|f4f|follow\s*(?:for|4)\s*follow|follow\s*back)[。.!！]?/gi, '')
      .replace(/[，, ]*(?:转评赞|三连|点赞转发送|like\s+and\s+retweet|rt\s+to\s+win)[。.!！]?/gi, '')
      .replace(/[，, ]*(?:加(?:我)?微信|私信(?:领取|获取)|link\s+in\s+bio|dm\s+me)[。.!！]?/gi, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[，,]{2,}/g, '，')
      .trim();
  }

  function addOriginalTake(text) {
    const value = String(text || '').trim();
    if (/我认为|我觉得|我的看法|问题在于|i think|in my view/i.test(value)) return value;
    const cleaned = value
      .replace(/^(?:转自|搬运|侵删|出处见评论)[:：]?\s*/gm, '')
      .trim();
    if (/[\u3400-\u9fff]/.test(cleaned)) {
      return `${cleaned}\n\n我觉得真正值得看的是这一点：`;
    }
    return `${cleaned}\n\nThe part I actually care about is this:`;
  }

  function rewrite(text, findings) {
    const items = Array.isArray(findings) ? findings : [];
    if (items.some((item) => item.severity === 'forbid' || item.severity === 'drop')) {
      return {
        ok: false,
        text: String(text || ''),
        message: '高危或零容忍项不会改写，请直接删掉相关内容。',
      };
    }

    let next = String(text || '');
    const actions = [];

    if (items.some((item) => item.checkId === 'spam-bait')) {
      const stripped = stripSpamBait(next);
      if (stripped !== next) {
        next = stripped;
        actions.push('已去掉互关、转评赞、站外领取等互动诱饵');
      }
    }

    if (items.some((item) => item.checkId === 'repost-style' || item.checkId === 'own-duplicate')) {
      next = addOriginalTake(next);
      actions.push('已去掉搬运话术，并留出一句你自己的判断');
    }

    const nsfw = items.filter((item) => item.checkId === 'unlabeled-nsfw' || item.checkId === 'gore');
    if (nsfw.length) {
      actions.push('正文未改成人内容本身。请在发帖设置里打开敏感/成人内容标记');
    }

    if (!actions.length) {
      return { ok: false, text: next, message: '没有可自动改的黄档项。' };
    }

    return { ok: true, text: next.trim(), message: actions.join('；') };
  }

  return { rewrite, stripSpamBait, addOriginalTake };
});
