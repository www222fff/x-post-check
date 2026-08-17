(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.XPostCheckRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /**
   * 规则对齐两套公开来源：
   * 1. X Rules（help.x.com / ToS 报告）
   * 2. xai-org/x-algorithm visibility filtering 标签
   *
   * 每条规则都带 label + effect，UI 必须展示依据，不能只写「有风险」。
   */
  return {
    version: '2026-08-17',
    sources: {
      rules: 'X Rules / California ToS report H2 2025',
      algorithm: 'https://github.com/xai-org/x-algorithm',
    },
    verdicts: {
      allow: { key: 'ALLOW', label: '可以发', hint: '按已公开规则，未见明显推荐/合规问题' },
      interstitial: { key: 'INTERSTITIAL', label: '能发但可能遮挡或限流', hint: '可能加内容警告，或不对非粉丝推荐' },
      drop: { key: 'DROP', label: '不建议发', hint: '可能不对非粉丝推荐、只留主页，或整站不展示' },
      forbid: { key: 'FORBID', label: '不要发', hint: '零容忍或高危违规，插件不提供改写' },
    },
    checks: [
      {
        id: 'zero-tolerance',
        title: '零容忍',
        xRule: 'Child sexual exploitation / NCII / illegal goods / suicide encouragement',
        labels: [],
        effect: '永久封号或执法上报；插件只提示删除，不改写',
      },
      {
        id: 'hate-violence-civic',
        title: '仇恨 / 暴力言论 / 选举误导 / 辱骂',
        xRule: 'Hateful conduct, Violent speech, Abuse/Harassment, Civic integrity',
        labels: ['HATEFUL_CONDUCT', 'VIOLENT_SPEECH', 'FOSNR_ABUSE', 'CIVIC_INTEGRITY'],
        effect: 'Discoverability restricted to profile + visibility notice',
      },
      {
        id: 'malicious-url',
        title: '恶意链接',
        xRule: 'Platform manipulation / malicious links',
        labels: ['MALICIOUS_URL', 'DO_NOT_AMPLIFY'],
        effect: 'Hidden from recommendations to non-followers',
      },
      {
        id: 'spam-bait',
        title: '垃圾互动 / 互关 / 领取',
        xRule: 'Platform Manipulation and Spam',
        labels: ['SPAM_HIGH_RECALL', 'SPAM'],
        effect: '高召回：不对非粉丝推荐；高置信：整站不展示',
      },
      {
        id: 'unlabeled-nsfw',
        title: '未打标成人内容',
        xRule: 'Adult Content: consensual adult nudity/sexual behavior must be labeled and not in avatar/banner',
        labels: ['NSFW_TEXT', 'NSFW_HIGH_RECALL', 'NSFW_HIGH_PRECISION', 'EGREGIOUS_NSFW'],
        effect: '遮挡 + 不对非粉丝/未成年人/未登录推荐',
      },
      {
        id: 'gore',
        title: '未打标暴力画面描述',
        xRule: 'Violent media must be labeled; violent speech is not allowed',
        labels: ['GORE_AND_VIOLENCE_HIGH_PRECISION'],
        effect: '内容警告 + 限制分发',
      },
      {
        id: 'own-duplicate',
        title: '与自己近 7 天帖高度重复',
        xRule: '非搬运条款；对齐 DropDuplicatesFilter / 近重复去重',
        labels: ['DropDuplicatesFilter'],
        effect: '可能不再向新观众推荐；不视为侵权',
      },
      {
        id: 'repost-style',
        title: '低原创转述 / 搬运话术',
        xRule: 'Copyright still requires a rights-holder claim; Original Content Rewards treats copies as non-original',
        labels: ['media known-item match', 'Original Content Rewards'],
        effect: '不一定删帖，但推荐和分成都差',
      },
    ],
  };
});
