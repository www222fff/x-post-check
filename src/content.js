(() => {
  const PANEL_ATTR = 'data-x-post-check-root';
  const attached = new WeakSet();
  let ownPosts = [];
  let scanTimer = 0;

  const rules = globalThis.XPostCheckRules;
  const detectApi = globalThis.XPostCheckDetect;
  const rewriteApi = globalThis.XPostCheckRewrite;
  const ownApi = globalThis.XPostCheckOwnPosts;

  function qs(root, selector) {
    return root.querySelector(selector);
  }

  function closestComposer(node) {
    if (!node) return null;
    const dialog = node.closest('[role="dialog"]');
    if (dialog?.querySelector('[data-testid="tweetTextarea_0"]')) return dialog;
    let cur = node;
    for (let i = 0; i < 14 && cur && cur !== document.body; i += 1) {
      if (
        cur.querySelector?.('[data-testid="tweetTextarea_0"]')
        && cur.querySelector?.('[data-testid="toolBar"]')
      ) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return node.parentElement;
  }

  function composeText(editor) {
    if (!editor) return '';
    const pieces = Array.from(editor.querySelectorAll('[data-text="true"]'))
      .map((node) => node.textContent || '')
      .join('\n');
    return (pieces || editor.innerText || '').replace(/\u200b/g, '').trim();
  }

  function sensitiveLabelOn(composer) {
    if (!composer) return false;
    return Array.from(composer.querySelectorAll('span, button, [aria-label]')).some((el) => {
      if (el.children && el.children.length > 3) return false;
      const t = `${el.getAttribute('aria-label') || ''} ${el.innerText || ''}`.trim();
      return /敏感内容|成人内容|Content warning|Sensitive content|Marked as sensitive/i.test(t);
    });
  }

  function setEditorText(editor, text) {
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    const ok = document.execCommand('insertText', false, text);
    if (!ok) {
      editor.textContent = text;
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    }
  }

  function verdictMeta(verdict) {
    return rules.verdicts[verdict] || rules.verdicts.allow;
  }

  function render(panel, report, editor) {
    const box = qs(panel, '.xpc-body');
    const meta = verdictMeta(report.verdict);
    const findings = report.findings || [];
    const canFix = findings.some((item) => item.fixable);
    const cacheLine = ownPosts.length
      ? `已缓存 ${ownPosts.length} 条本机近 7 天发帖，用于查自己是否重复。`
      : '还没有本机发帖缓存。重复检查只覆盖你之后用这个浏览器发出的帖。';

    box.innerHTML = `
      <div class="xpc-verdict xpc-${report.verdict}">${meta.label}</div>
      <div class="xpc-hint">${meta.hint}</div>
      ${findings.length ? `<ul class="xpc-list">${findings.map((item) => `
        <li>
          <strong>${item.title}</strong>
          <span>${item.why}</span>
          ${item.label ? `<code>${item.label}</code>` : ''}
          <em>${item.effect}</em>
        </li>`).join('')}</ul>` : '<p class="xpc-empty">按已公开规则，未见明显推荐/合规问题。</p>'}
      <p class="xpc-cache">${cacheLine}</p>
      <div class="xpc-actions">
        <button type="button" class="xpc-run">检查</button>
        <button type="button" class="xpc-fix" ${canFix ? '' : 'disabled'}>帮忙改</button>
        <span class="xpc-msg"></span>
      </div>
    `;

    qs(box, '.xpc-run').addEventListener('click', () => runCheck(editor, panel));
    const msg = qs(box, '.xpc-msg');
    qs(box, '.xpc-fix').addEventListener('click', () => {
      const result = rewriteApi.rewrite(composeText(editor), findings);
      msg.textContent = result.message;
      if (result.ok) {
        setEditorText(editor, result.text);
        setTimeout(() => runCheck(editor, panel), 200);
      }
    });
  }

  function ensurePanel(editor) {
    const host = closestComposer(editor);
    if (!host) return null;
    let panel = host.querySelector(`[${PANEL_ATTR}]`);
    if (panel) return panel;
    panel = document.createElement('div');
    panel.setAttribute(PANEL_ATTR, '1');
    panel.className = 'xpc-panel';
    panel.innerHTML = `
      <div class="xpc-head">
        <span>X Post Check</span>
        <span class="xpc-sub">For You 预检 · 非官方审核</span>
      </div>
      <div class="xpc-body">
        <p class="xpc-empty">开始写帖后会按 X 公开规则检查。只读这个发帖框，不读时间线。</p>
      </div>
    `;
    const toolbar = host.querySelector('[data-testid="toolBar"]');
    if (toolbar?.parentElement) toolbar.parentElement.insertBefore(panel, toolbar.nextSibling);
    else host.appendChild(panel);
    return panel;
  }

  async function runCheck(editor, panel) {
    const text = composeText(editor);
    if (!text) {
      qs(panel, '.xpc-body').innerHTML = '<p class="xpc-empty">开始写帖后会按 X 公开规则检查。只读这个发帖框，不读时间线。</p>';
      return;
    }
    ownPosts = await ownApi.loadOwnPosts();
    const composer = closestComposer(editor);
    const report = detectApi.detect(text, {
      ownPosts,
      sensitiveLabelOn: sensitiveLabelOn(composer),
    });
    render(panel, report, editor);
  }

  function attach(editor) {
    const panel = ensurePanel(editor);
    if (!panel) return;
    if (attached.has(editor)) return;
    attached.add(editor);
    let timer = 0;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => runCheck(editor, panel), 280);
    };
    editor.addEventListener('input', schedule);
    editor.addEventListener('keyup', schedule);
    editor.addEventListener('paste', schedule);
    editor.addEventListener('focus', schedule);
  }

  function scanComposers() {
    document.querySelectorAll('[data-testid="tweetTextarea_0"]').forEach(attach);
  }

  function watchTweetButton() {
    document.addEventListener('click', (event) => {
      const btn = event.target?.closest?.('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
      if (!btn) return;
      const scope = closestComposer(btn) || document;
      const editor = scope.querySelector('[data-testid="tweetTextarea_0"]');
      const text = composeText(editor);
      if (!text) return;
      ownApi.rememberPost({ text, at: new Date().toISOString() }).then(async () => {
        ownPosts = await ownApi.loadOwnPosts();
      });
    }, true);
  }

  function boot() {
    scanComposers();
    watchTweetButton();
    ownApi.loadOwnPosts().then((posts) => { ownPosts = posts; });
    const observer = new MutationObserver(() => {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(scanComposers, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
