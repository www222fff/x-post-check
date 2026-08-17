# X Post Check

Chrome 扩展：在 `x.com` 发帖框下方做 **For You 推荐资格预检**。

不是 X 官方审核。绿灯只表示：按已公开的 X Rules 和 [`xai-org/x-algorithm`](https://github.com/xai-org/x-algorithm) visibility labels，未见明显问题。

## 第一版查什么

| 检查 | 对齐 | 结果 |
|---|---|---|
| 零容忍 | 儿童性剥削 / NCII / 非法交易 / 自杀教唆 | 红，不改写 |
| 仇恨、暴力威胁、人肉、选举误导 | `HATEFUL_CONDUCT` `VIOLENT_SPEECH` `FOSNR_ABUSE` `CIVIC_INTEGRITY` | 红，不改写 |
| 可疑短链 | `MALICIOUS_URL` | 红 |
| 互关、转评赞、站外领取 | `SPAM_HIGH_RECALL` | 黄，可去掉诱饵 |
| 未打标成人/血腥描述 | `NSFW_TEXT` `GORE_AND_VIOLENCE_HIGH_PRECISION` | 黄，提示打标 |
| 和自己近 7 天帖高度重复 | `DropDuplicatesFilter` | 黄，不算搬运 |
| 搬运话术 / 纯转述 | Original Content Rewards | 黄，补一句自己的判断 |

一个月前自己的旧帖不会被标成问题。

## 安装

1. Chrome 打开 `chrome://extensions`
2. 打开「开发者模式」
3. 「加载已解压的扩展程序」
4. 选克隆下来的仓库目录
5. 打开 https://x.com 登录后写一条帖，发帖框下方会出现检查面板；写好后点「检查」才会出结果

自己的近帖只来自你在本机点过「发帖」的正文，存在浏览器本地。不扫描时间线，不采集别人的帖，不请求 X 接口，也不做热帖指纹库。安装后尚未用这个浏览器发过的旧帖，不会进入重复检查。

## 本地测试

```bash
node scripts/test-detect.js
```

## 不会做的事

- 不搜全网视频
- 不扫描、不爬取时间线上的帖子
- 不建立热帖/他人媒体指纹库
- 不调用未公开的 Grok 违规模型
- 不把零容忍内容改到能发
- 不自动发帖
