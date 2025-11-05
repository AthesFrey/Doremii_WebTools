// dev-process.js — split + copy保留空格 + hex ccase + 按钮同尺寸
document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // ========== 通用工具 ==========
  function parseUintToBigInt(str) {
    // 支持分组后有空格
    str = String(str ?? '').replace(/\s+/g, '').trim();
    if (/^\d+$/.test(str)) return BigInt(str);
    return null;
  }
  const toHex = (bi) => bi.toString(16).toUpperCase();
  const toBin = (bi) => bi.toString(2);
  function alertIf(cond, msg) { if (cond) { alert(msg); return true; } return false; }

  // ========== 4位分组 ==========
  function groupBy4(str) {
    const raw = String(str || '').replace(/\s+/g, '');
    if (!raw) return '';
    let out = '';
    let cnt = 0;
    for (let i = raw.length - 1; i >= 0; i--) {
      out = raw[i] + out;
      cnt++;
      if (cnt === 4 && i !== 0) {
        out = ' ' + out;
        cnt = 0;
      }
    }
    return out;
  }
  function toggleSplitOnInput(inputId) {
    const el = $(inputId);
    if (!el) return;
    const raw = (el.value || '').replace(/\s+/g, '');
    if (!raw) return;
    if (el.dataset.split === '1') {
      el.value = raw;
      el.dataset.split = '0';
    } else {
      el.value = groupBy4(raw);
      el.dataset.split = '1';
    }
  }

  // ========== 三个转换 ==========
  $('decimal-convert').addEventListener('click', () => {
    const dec = parseUintToBigInt($('decimal-input').value);
    if (alertIf(dec === null, '请输入有效的十进制非负整数')) return;
    $('hex-input').value = toHex(dec);
    $('hex-input').dataset.split = '0';
    $('binary-input').value = toBin(dec);
    $('binary-input').dataset.split = '0';
  });

  $('hex-convert').addEventListener('click', () => {
    const val = $('hex-input').value.replace(/\s+/g, '').trim();
    if (alertIf(!/^[0-9A-Fa-f]+$/.test(val), '请输入有效的十六进制（0-9 A-F）')) return;
    const dec = BigInt('0x' + val);
    $('decimal-input').value = dec.toString(10);
    $('decimal-input').dataset.split = '0';
    $('binary-input').value = toBin(dec);
    $('binary-input').dataset.split = '0';
  });

  $('binary-convert').addEventListener('click', () => {
    const val = $('binary-input').value.replace(/\s+/g, '').trim();
    if (alertIf(!/^[01]+$/.test(val), '请输入有效的二进制（0/1）')) return;
    const dec = BigInt('0b' + val);
    $('decimal-input').value = dec.toString(10);
    $('decimal-input').dataset.split = '0';
    $('hex-input').value = toHex(dec);
    $('hex-input').dataset.split = '0';
  });

  // ========== 复制：保留当前显示（含空格） ==========
  function copyInput(id, btn) {
    const el = $(id);
    const textToCopy = el.value || '';
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(textToCopy);
      } else {
        el.focus();
        el.select();
        document.execCommand('copy');
      }
    } catch (e) {
      /* ignore */
    }
    if (btn) {
      const old = btn.textContent;
      btn.textContent = 'copied';
      setTimeout(() => { btn.textContent = old; }, 900);
    }
  }
  $('decimal-copy').addEventListener('click', (e) => copyInput('decimal-input', e.currentTarget));
  $('hex-copy').addEventListener('click',     (e) => copyInput('hex-input', e.currentTarget));
  $('binary-copy').addEventListener('click',  (e) => copyInput('binary-input', e.currentTarget));

  // ========== split 按钮 ==========
  if ($('decimal-split')) $('decimal-split').addEventListener('click', () => toggleSplitOnInput('decimal-input'));
  if ($('hex-split'))     $('hex-split').addEventListener('click', () => toggleSplitOnInput('hex-input'));
  if ($('binary-split'))  $('binary-split').addEventListener('click', () => toggleSplitOnInput('binary-input'));

  // ========== hex ccase 按钮 ==========
  if ($('hex-ccase')) {
    $('hex-ccase').addEventListener('click', () => {
      const el = $('hex-input');
      if (!el) return;
      const val = el.value || '';

      // 有小写 -> 全变大写；否则如果有大写 -> 全变小写；都没有就不动
      if (/[a-f]/.test(val)) {
        el.value = val.replace(/[a-f]/g, (c) => c.toUpperCase());
      } else if (/[A-F]/.test(val)) {
        el.value = val.replace(/[A-F]/g, (c) => c.toLowerCase());
      }
      // 不改 el.dataset.split，这样你要再 split 还是手动点
    });
  }

  // ========== factor & 位运算 ==========
  function ensureFactorBadge() {
    const input = $('factor-input');
    let badge = document.getElementById('factor-binary-preview');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'factor-binary-preview';
      badge.className = 'binary-badge';
      badge.style.marginLeft = '8px';
      input.insertAdjacentElement('afterend', badge);
    }
    return badge;
  }
  function showFactorBinaryPreview(B) {
    const badge = ensureFactorBadge();
    const bin = toBin(B);
    const hex = toHex(B);
    badge.textContent = `='${bin}'b ='${hex}'h`;
  }

  function renderResults(opName, decBI) {
    const decStr = decBI.toString(10);
    const hexStr = toHex(decBI);
    const binStr = toBin(decBI);
    $('process-label').textContent = `process results: ${opName}`;
    $('result-box').innerHTML = [
      `<div class="row result-row">Decimal: <span class="val">${decStr}</span> <button class="btn copy" data-copy="${decStr}">copy</button></div>`,
      `<div class="row result-row">Hex: <span class="val">${hexStr}</span> <button class="btn copy" data-copy="${hexStr}">copy</button></div>`,
      `<div class="row result-row">Binary: <span class="val">${binStr}</span> <button class="btn copy" data-copy="${binStr}">copy</button></div>`
    ].join('');
  }

  $('result-box').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-copy]');
    if (!btn) return;
    const text = btn.getAttribute('data-copy') || '';
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      const old = btn.textContent;
      btn.textContent = 'copied';
      setTimeout(() => { btn.textContent = 'copy'; }, 900);
    } catch {}
  });

  function getOperands() {
    const A = parseUintToBigInt($('decimal-input').value);
    const B = parseUintToBigInt($('factor-input').value);
    if (alertIf(A === null, '上方 decimal 输入无效，请输入十进制非负整数')) return null;
    if (alertIf(B === null, 'factor 输入无效，请输入十进制非负整数')) return null;
    return { A, B };
  }

  $('bitand-btn').addEventListener('click', () => {
    const ops = getOperands(); if (!ops) return;
    const { A, B } = ops;
    showFactorBinaryPreview(B);
    renderResults('bitand', (A & B));
  });

  $('bitor-btn').addEventListener('click', () => {
    const ops = getOperands(); if (!ops) return;
    const { A, B } = ops;
    showFactorBinaryPreview(B);
    renderResults('bitor', (A | B));
  });

  $('bitxor-btn').addEventListener('click', () => {
    const ops = getOperands(); if (!ops) return;
    const { A, B } = ops;
    showFactorBinaryPreview(B);
    renderResults('bitxor', (A ^ B));
  });
});


// ========== 原来的布局补丁，保留 ==========
(function(){
  function relocateConvertButtons(){
    var $ = function(id){ return document.getElementById(id); };
    var pairs = [
      { convert: 'decimal-convert', copy: 'decimal-copy', input: 'decimal-input' },
      { convert: 'hex-convert',     copy: 'hex-copy',     input: 'hex-input'     },
      { convert: 'binary-convert',  copy: 'binary-copy',  input: 'binary-input'  }
    ];
    pairs.forEach(function (p) {
      var convertBtn = $(p.convert);
      var copyBtn = $(p.copy);
      var inputEl = $(p.input);
      if (convertBtn && copyBtn && copyBtn.parentElement) {
        try {
          copyBtn.parentElement.insertBefore(convertBtn, copyBtn);
          convertBtn.style.marginRight = '8px';
        } catch (e) {}
      }
      if (inputEl) {
        inputEl.style.flex = '1 1 100%';
        inputEl.style.width = '100%';
        inputEl.style.maxWidth = '100%';
        inputEl.style.minWidth = '0';
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', relocateConvertButtons);
  } else {
    relocateConvertButtons();
  }
})();


// ========== 样式补丁：把 ccase 也加进去，跟 copy/split 一样大 ==========
(function(){
  function injectSizingStyles(){
    var css = ""
    + "#decimal-convert, #hex-convert, #binary-convert,"
    + " #decimal-copy, #hex-copy, #binary-copy,"
    + " #decimal-split, #hex-split, #binary-split,"
    + " #hex-ccase,"
    + " #result-box .btn.copy {"
    + "  font-size: 16px;"
    + "  line-height: 1.15;"
    + "  min-height: 40px;"
    + "  padding-top: 8px; padding-bottom: 8px;"
    + " }"
    + "#bitand-btn, #bitor-btn, #bitxor-btn {"
    + "  font-size: 16px;"
    + "  line-height: 1.15;"
    + "  min-height: 40px;"
    + "  padding-top: 8px; padding-bottom: 8px;"
    + " }";
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSizingStyles);
  } else {
    injectSizingStyles();
  }
})();
