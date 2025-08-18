// dev-process.js  —  Programmer Calculator (finalized behavior)
// - No 5s binary flash; factor input stays decimal
// - Factor's binary is shown to the right badge as ='XXX'b
// - Uses BigInt for correctness; supports very large non-negative integers
// - Results area shows Decimal/Hex/Binary with working copy buttons


document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // ----- Helpers -----
  function parseUintToBigInt(str) {
    str = String(str ?? '').trim();
    if (/^\d+$/.test(str)) return BigInt(str);
    return null;
  }
  const toHex = (bi) => bi.toString(16).toUpperCase();
  const toBin = (bi) => bi.toString(2);

  function alertIf(cond, msg) { if (cond) { alert(msg); return true; } return false; }

  // ----- Top 3 conversions -----
  $('decimal-convert').addEventListener('click', () => {
    const dec = parseUintToBigInt($('decimal-input').value);
    if (alertIf(dec === null, '请输入有效的十进制非负整数')) return;
    $('hex-input').value    = toHex(dec);
    $('binary-input').value = toBin(dec);
  });

  $('hex-convert').addEventListener('click', () => {
    const val = $('hex-input').value.trim();
    if (alertIf(!/^[0-9A-Fa-f]+$/.test(val), '请输入有效的十六进制（0-9 A-F）')) return;
    const dec = BigInt('0x' + val);
    $('decimal-input').value = dec.toString(10);
    $('binary-input').value  = toBin(dec);
  });

  $('binary-convert').addEventListener('click', () => {
    const val = $('binary-input').value.trim();
    if (alertIf(!/^[01]+$/.test(val), '请输入有效的二进制（0/1）')) return;
    const dec = BigInt('0b' + val);
    $('decimal-input').value = dec.toString(10);
    $('hex-input').value     = toHex(dec);
  });

  // ----- Copy for input fields -----
  function copyInput(id, btn) {
    const el = $(id);
    el.focus(); el.select();
    try {
      const ok = document.execCommand('copy');
      if (!ok && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(el.value || '');
      }
    } catch (e) {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(el.value || '');
    }
    if (btn) { const old = btn.textContent; btn.textContent = 'copied'; setTimeout(() => btn.textContent = 'copy', 900); }
  }
  $('decimal-copy').addEventListener('click', (e) => copyInput('decimal-input', e.currentTarget));
  $('hex-copy').addEventListener('click',     (e) => copyInput('hex-input', e.currentTarget));
  $('binary-copy').addEventListener('click',  (e) => copyInput('binary-input', e.currentTarget));

  // ----- Factor binary preview badge (right side) -----
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
  
  
  // ----- Factor binary preview badge (right side) -----
  function showFactorBinaryPreview(B) {
    const badge = ensureFactorBadge();
    const bin = toBin(B);      // 二进制
    const hex = toHex(B);      // 十六进制
    badge.textContent = `='${bin}'b ='${hex}'h`;
  }


  // ----- Results rendering and copy (event delegation) -----
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

  // ----- Bitwise ops using BigInt (align to MATLAB style for non-negative ints) -----
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
