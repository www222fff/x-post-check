const path = require('path');
const detectApi = require(path.join(__dirname, '..', 'src', 'detect.js'));
const rewriteApi = require(path.join(__dirname, '..', 'src', 'rewrite.js'));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const spam = detectApi.detect('互关必回，转评赞抽奖，加微信领取');
assert(spam.verdict === 'interstitial', 'spam should be interstitial');
assert(spam.findings.some((item) => item.label === 'SPAM_HIGH_RECALL'), 'spam label missing');

const nsfw = detectApi.detect('新全裸视频来了');
assert(nsfw.verdict === 'interstitial', 'unlabeled nsfw should be interstitial');
assert(nsfw.findings.some((item) => item.label === 'NSFW_TEXT'), 'nsfw label missing');

const labeled = detectApi.detect('新全裸视频来了', { sensitiveLabelOn: true });
assert(labeled.verdict === 'allow', 'labeled nsfw should not block posting');

const hate = detectApi.detect('you people should die');
assert(hate.verdict === 'drop', 'hate should drop');

const forbid = detectApi.detect('suicide how to method');
assert(forbid.verdict === 'forbid', 'suicide encouragement should forbid');

const own = detectApi.detect('先把成本算清楚再决定要不要做大', {
  ownPosts: [{ text: '先把成本算清楚再决定要不要做大', at: new Date().toISOString() }],
});
assert(own.findings.some((item) => item.checkId === 'own-duplicate'), 'own duplicate missed');

const oldOwn = detectApi.detect('先把成本算清楚再决定要不要做大', {
  ownPosts: [{ text: '先把成本算清楚再决定要不要做大', at: '2026-01-01T00:00:00.000Z' }],
  now: Date.parse('2026-08-17T00:00:00.000Z'),
});
assert(!oldOwn.findings.some((item) => item.checkId === 'own-duplicate'), 'month-old own post should not flag');

const rewritten = rewriteApi.rewrite('这个模型确实快，互关必回', spam.findings);
assert(rewritten.ok, 'spam rewrite should work');
assert(!/互关/.test(rewritten.text), 'spam phrase should be removed');

const noRewrite = rewriteApi.rewrite('you people should die', hate.findings);
assert(!noRewrite.ok, 'drop items must not be rewritten');

const repost = detectApi.detect('转自 @foo：据报道市场今天大跌');
assert(repost.verdict === 'interstitial', 'repost style should be interstitial');
assert(repost.findings.some((item) => item.checkId === 'repost-style'), 'repost style missed');

const ownApi = require(path.join(__dirname, '..', 'src', 'own-posts.js'));
assert(typeof ownApi.harvestVisibleOwnPosts !== 'function', 'timeline harvest must stay removed');

console.log('x-post-check detector tests passed');
