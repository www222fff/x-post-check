(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.XPostCheckDetect = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const ZERO_TOLERANCE = [
    { id: 'csam', re: /儿童色情|幼女|萝莉色|儿童裸|child\s*porn|\bcsam\b|sexualiz(?:e|ing)\s+minors?|\bunderage\s+(?:girl|boy|sex)/i, why: '儿童性剥削零容忍' },
    { id: 'ncii', re: /未经同意.{0,12}(?:裸|私密|床照)|偷拍(?:裸|私密)|revenge\s*porn|non[-\s]?consensual\s+(?:nude|intimate)/i, why: '非自愿私密影像（NCII）' },
    { id: 'suicide', re: /(?:怎么|如何)(?:自杀|自尽)|自杀方法|割腕教程|encourage\s+(?:suicide|self[-\s]?harm)|suicide\s+(?:method|how to)/i, why: '自杀/自残教唆' },
    { id: 'illegal', re: /(?:出|卖|收)(?:冰毒|海洛因|芬太尼)|贩枪|卖枪不走|sex\s*traffick|(?:buy|sell)\s+(?:fentanyl|heroin|cocaine)\b/i, why: '非法商品或犯罪交易' },
  ];

  const HATE_VIOLENCE_CIVIC = [
    { id: 'hate', re: /(?:滚回|该死的|灭绝|都该杀).{0,12}(?:人|族|教徒)|kill\s+all\s+(?:jews|muslims|blacks|gays)|you\s+people\s+should\s+die/i, why: '仇恨言论，对齐 HATEFUL_CONDUCT' },
    { id: 'violent-speech', re: /(?:我要|准备|今晚)(?:杀了|砍死|弄死)你|i(?:['’]ll| will)\s+kill\s+you|bomb\s+the\s+(?:school|office)/i, why: '暴力威胁，对齐 VIOLENT_SPEECH' },
    { id: 'harass', re: /人肉(?:搜索)?他|曝光他家庭地址|raid\s+this\s+account|doxx?\s+him/i, why: '骚扰/人肉，对齐 FOSNR_ABUSE' },
    { id: 'civic', re: /选举日改到|不用去投票.{0,8}作废|投票站其实在|election\s+(?:was\s+moved|cancelled)|polls?\s+are\s+fake/i, why: '选举误导，对齐 CIVIC_INTEGRITY' },
  ];

  const SPAM_BAIT = [
    { id: 'mutual', re: /互关|互粉|互fo|有fo必回|关注必回|\bf4f\b|follow\s*(?:for|4)\s*follow|follow\s*back/i, why: '互关互粉，对齐 SPAM_HIGH_RECALL' },
    { id: 'engage', re: /转评赞|三连|点赞转发送|评论区(?:扣|打|回).{0,4}(?:1|领取)|like\s+and\s+retweet|rt\s+to\s+win|comment\s+\S+\s+to\s+(?:get|win)/i, why: '互动诱饵，对齐 SPAM_HIGH_RECALL' },
    { id: 'promo', re: /加(?:我)?微信|私信(?:领取|获取)|link\s+in\s+bio|\bdm\s+me\b|扫码(?:进群|领取)/i, why: '站外引流，对齐 Platform Manipulation' },
  ];

  const NSFW_TEXT = [
    { id: 'explicit', re: /(?:裸照|色情片|口交|内射|约炮过夜|全裸视频)|\b(?:onlyfans\s+nude|full\s+nudity|porn\s+video)\b/i, why: '成人内容文本，对齐 NSFW_TEXT' },
    { id: 'arousal', re: /(?:看片|黄片|色情直播).{0,8}(?:链接|免费)|\bxxx\s+video\b|\bnsfw\b.{0,12}(?:photo|video|pic)/i, why: '色情导向文本，对齐 NSFW_HIGH_RECALL' },
  ];

  const GORE = [
    { id: 'gore', re: /斩首视频|肢解过程|内脏流出来|gore\s+video|beheading\s+video/i, why: '血腥暴力媒体描述，对齐 GORE_AND_VIOLENCE_HIGH_PRECISION' },
  ];

  const REPOST_STYLE = [
    { id: 'repost-mark', re: /^(?:转自|搬运|侵删|出处见评论|转载请注明)/m, why: '搬运话术；原创分成可能不计' },
    { id: 'via-only', re: /^(?:via\s+@\w+\s*)+$/i, why: '只有来源没有自己的判断' },
  ];

  const SHORTENER = /https?:\/\/(?:t\.co|bit\.ly|tinyurl\.com|goo\.gl|ow\.ly)\//i;
  const SUSPICIOUS_URL = /https?:\/\/[^\s]+/gi;

  function normalizeText(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function bigrams(s) {
    const value = normalizeText(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    if (value.length < 2) return new Set(value ? [value] : []);
    const out = new Set();
    for (let i = 0; i < value.length - 1; i += 1) out.add(value.slice(i, i + 2));
    return out;
  }

  function jaccard(a, b) {
    const left = bigrams(a);
    const right = bigrams(b);
    if (!left.size || !right.size) return 0;
    let inter = 0;
    left.forEach((item) => { if (right.has(item)) inter += 1; });
    return inter / (left.size + right.size - inter);
  }

  function matchList(text, list) {
    const hits = [];
    for (const item of list) {
      if (item.re.test(text)) hits.push({ id: item.id, why: item.why });
    }
    return hits;
  }

  function collectUrls(text) {
    return String(text || '').match(SUSPICIOUS_URL) || [];
  }

  function looksLikeBareRepost(text) {
    const value = String(text || '').trim();
    if (value.length < 20) return false;
    const hasVoice = /我认为|我觉得|我的看法|我不同意|问题在于|关键是|i think|in my view|the issue is/i.test(value);
    const newsy = /据(?:报道|新华社|路透)|breaking:|just in:|sources say/i.test(value);
    const quoted = (value.match(/[「「].{12,}[」」]|".{20,}"/g) || []).length > 0;
    return !hasVoice && (newsy || quoted) && value.length < 180;
  }

  function detect(rawText, options = {}) {
    const text = String(rawText || '');
    const ownPosts = Array.isArray(options.ownPosts) ? options.ownPosts : [];
    const sensitiveLabelOn = Boolean(options.sensitiveLabelOn);
    const findings = [];

    const forbidHits = matchList(text, ZERO_TOLERANCE);
    for (const hit of forbidHits) {
      findings.push({
        id: `zero:${hit.id}`,
        checkId: 'zero-tolerance',
        severity: 'forbid',
        title: '不要发',
        why: hit.why,
        label: null,
        effect: '零容忍，不提供改写',
        fixable: false,
      });
    }

    const dropHits = matchList(text, HATE_VIOLENCE_CIVIC);
    for (const hit of dropHits) {
      findings.push({
        id: `speech:${hit.id}`,
        checkId: 'hate-violence-civic',
        severity: 'drop',
        title: '高危言论',
        why: hit.why,
        label: hit.why.includes('HATEFUL') ? 'HATEFUL_CONDUCT'
          : hit.why.includes('VIOLENT') ? 'VIOLENT_SPEECH'
            : hit.why.includes('CIVIC') ? 'CIVIC_INTEGRITY' : 'FOSNR_ABUSE',
        effect: '通常只能留在作者主页',
        fixable: false,
      });
    }

    const urls = collectUrls(text);
    if (urls.some((url) => SHORTENER.test(url) && /free|prize|wallet|airdrop|login/i.test(text))) {
      findings.push({
        id: 'url:shortener',
        checkId: 'malicious-url',
        severity: 'drop',
        title: '可疑短链',
        why: '短链配领取/钱包话术，对齐 MALICIOUS_URL',
        label: 'MALICIOUS_URL',
        effect: '不对非粉丝推荐',
        fixable: false,
      });
    }

    for (const hit of matchList(text, SPAM_BAIT)) {
      findings.push({
        id: `spam:${hit.id}`,
        checkId: 'spam-bait',
        severity: 'interstitial',
        title: '垃圾互动',
        why: hit.why,
        label: 'SPAM_HIGH_RECALL',
        effect: '不对非粉丝推荐；严重可到 SPAM 整站不展示',
        fixable: true,
      });
    }

    for (const hit of matchList(text, NSFW_TEXT)) {
      findings.push({
        id: `nsfw:${hit.id}`,
        checkId: 'unlabeled-nsfw',
        severity: sensitiveLabelOn ? 'allow-note' : 'interstitial',
        title: sensitiveLabelOn ? '已打标的成人内容' : '未打标成人内容',
        why: hit.why + (sensitiveLabelOn ? '；已检测到敏感标记' : '；未检测到敏感标记'),
        label: 'NSFW_TEXT',
        effect: sensitiveLabelOn
          ? '打标后仍不对未成年人/未登录推荐，但比未打标安全'
          : '可能遮挡，并对非粉丝 DROP',
        fixable: !sensitiveLabelOn,
      });
    }

    for (const hit of matchList(text, GORE)) {
      findings.push({
        id: `gore:${hit.id}`,
        checkId: 'gore',
        severity: sensitiveLabelOn ? 'allow-note' : 'interstitial',
        title: '暴力画面描述',
        why: hit.why,
        label: 'GORE_AND_VIOLENCE_HIGH_PRECISION',
        effect: '应打标；美化暴力则不是打标能解决的',
        fixable: !sensitiveLabelOn,
      });
    }

    const now = options.now || Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    let bestOwn = null;
    for (const post of ownPosts) {
      const at = Date.parse(post.at || post.createdAt || '') || 0;
      if (at && at < weekAgo) continue;
      const other = post.text || '';
      if (normalizeText(other) === normalizeText(text) && other) {
        bestOwn = { post, score: 1 };
        break;
      }
      const score = jaccard(text, other);
      if (score >= 0.72 && (!bestOwn || score > bestOwn.score)) bestOwn = { post, score };
    }
    if (bestOwn && normalizeText(text).length >= 12) {
      findings.push({
        id: 'own-dup',
        checkId: 'own-duplicate',
        severity: 'interstitial',
        title: '和自己近期帖很像',
        why: `与自己近 7 天内容相似度 ${Math.round(bestOwn.score * 100)}%，对齐去重而不是搬运条款`,
        label: 'DropDuplicatesFilter',
        effect: '可能不再推给新观众',
        fixable: true,
        extra: { similarText: String(bestOwn.post.text || '').slice(0, 140) },
      });
    }

    for (const hit of matchList(text, REPOST_STYLE)) {
      findings.push({
        id: `repost:${hit.id}`,
        checkId: 'repost-style',
        severity: 'interstitial',
        title: '搬运话术',
        why: hit.why,
        label: 'Original Content Rewards',
        effect: '不一定删帖，但推荐和分成都差',
        fixable: true,
      });
    }
    if (looksLikeBareRepost(text) && !findings.some((item) => item.checkId === 'repost-style')) {
      findings.push({
        id: 'repost:bare',
        checkId: 'repost-style',
        severity: 'interstitial',
        title: '缺少自己的判断',
        why: '像在转述新闻或摘句，没有补上自己的观点',
        label: 'Original Content Rewards',
        effect: '原创分成可能不计',
        fixable: true,
      });
    }

    const order = { forbid: 0, drop: 1, interstitial: 2, 'allow-note': 3 };
    findings.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

    let verdict = 'allow';
    if (findings.some((item) => item.severity === 'forbid')) verdict = 'forbid';
    else if (findings.some((item) => item.severity === 'drop')) verdict = 'drop';
    else if (findings.some((item) => item.severity === 'interstitial')) verdict = 'interstitial';

    return {
      verdict,
      findings: findings.filter((item) => item.severity !== 'allow-note' || verdict === 'allow'),
      notes: findings.filter((item) => item.severity === 'allow-note'),
      normalized: normalizeText(text),
    };
  }

  return { detect, normalizeText, jaccard };
});
