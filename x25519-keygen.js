// x25519-keygen.js
// 依赖：先加载本地 tweetnacl-fast-1.0.3.min.js，提供 nacl.scalarMult.base(X25519)

(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  if (!window.nacl || !nacl.scalarMult || !nacl.scalarMult.base) {
    console.error('TweetNaCl 未就绪：请先加载 nacl-fast.min.js（tweetnacl-fast-1.0.3.min.js）');
    return;
  }

  const doc = window.document;
  const MAX_HISTORY = 5;
  const STORAGE_KEY = 'x25519_keygen_pairs_v1';

  // ---------- Base64URL <-> bytes ----------
  function bytesToBase64Url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    let b64 = window.btoa(bin); // 标准 Base64
    return b64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  function base64UrlToBytes(str) {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4 !== 0) s += '=';
    const bin = window.atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }

  // ---------- 受限随机私钥（43 chars, 无 4；6/8 权重更高） ----------
  const BASE_ALL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz012356789-_'; // 去掉 4
  const CHAR_OTHERS = BASE_ALL.split('').filter(function (c) {
    return c !== '6' && c !== '8';
  });
  const WEIGHTED = CHAR_OTHERS
    .concat(Array(3).fill('6'))
    .concat(Array(3).fill('8'));

  function rnd(max) {
    const buf = new Uint32Array(1);
    if (!window.crypto || !window.crypto.getRandomValues) {
      throw new Error('当前环境不支持 crypto.getRandomValues');
    }
    window.crypto.getRandomValues(buf);
    return buf[0] % max;
  }

  function pickChar() {
    return WEIGHTED[rnd(WEIGHTED.length)];
  }

  function generatePrivateString() {
    let s = '';
    for (let i = 0; i < 43; i++) {
      s += pickChar();
    }
    if (s.indexOf('4') >= 0) {
      s = s.replace(/4/g, '6');
    }
    return s;
  }

  // ---------- 历史存取 ----------
  function loadHistory() {
    if (!('localStorage' in window)) return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    if (!('localStorage' in window)) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(list.slice(0, MAX_HISTORY))
      );
    } catch (e) { /* ignore */ }
  }

  function pushHistory(pair) {
    const list = loadHistory();
    const merged = [pair].concat(list);
    const seen = new Set();
    const dedup = [];
    for (let i = 0; i < merged.length; i++) {
      const p = merged[i];
      if (seen.has(p.priv)) continue;
      seen.add(p.priv);
      dedup.push(p);
      if (dedup.length >= MAX_HISTORY) break;
    }
    saveHistory(dedup);
    return dedup;
  }

  // ---------- UI 绑定 ----------
  function bindUI() {
    const btnGen   = doc.getElementById('x-generate');
    const privEl   = doc.getElementById('x-priv');
    const pubEl    = doc.getElementById('x-pub');
    const btnCpSk  = doc.getElementById('x-copy-priv');
    const btnCpPk  = doc.getElementById('x-copy-pub');
    const histWrap = doc.getElementById('x-hist');

    if (!btnGen || !privEl || !pubEl || !btnCpSk || !btnCpPk || !histWrap) {
      console.warn('x25519-keygen：找不到某些 DOM 元素，请检查 HTML 中的 id。');
      return;
    }

    function copyText(text, btn) {
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          const old = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = old; }, 900);
        }).catch(function () {
          window.alert('复制失败，请手动选择文本复制。');
        });
      } else {
        window.prompt('复制以下内容：', text);
      }
    }

    function renderHistory() {
      const list = loadHistory();
      histWrap.innerHTML = '';

      list.forEach(function (p, i) {
        // 第一行：sk
        const rowSk = doc.createElement('div');
        rowSk.className = 'x-hist-row';

        const idxSk = doc.createElement('div');
        idxSk.className = 'x-hist-index';
        idxSk.textContent = String(i + 1) + '.';

        const textSk = doc.createElement('div');
        textSk.className = 'x-hist-text';
        textSk.textContent = 'sk: ' + p.priv;

        const bSk = doc.createElement('button');
        bSk.className = 'x-btn-ghost';
        bSk.textContent = 'Copy sk';
        bSk.dataset.value = p.priv;              // 用 data-value 存真实内容
        bSk.addEventListener('click', function () {
          copyText(bSk.dataset.value, bSk);
        });

        rowSk.appendChild(idxSk);
        rowSk.appendChild(textSk);
        rowSk.appendChild(bSk);
        histWrap.appendChild(rowSk);

        // 第二行：pk
        const rowPk = doc.createElement('div');
        rowPk.className = 'x-hist-row';

        const idxPk = doc.createElement('div');
        idxPk.className = 'x-hist-index';
        idxPk.textContent = '';

        const textPk = doc.createElement('div');
        textPk.className = 'x-hist-text';
        textPk.textContent = 'pk: ' + p.pub;

        const bPk = doc.createElement('button');
        bPk.className = 'x-btn-ghost';
        bPk.textContent = 'Copy pk';
        bPk.dataset.value = p.pub;
        bPk.addEventListener('click', function () {
          copyText(bPk.dataset.value, bPk);
        });

        rowPk.appendChild(idxPk);
        rowPk.appendChild(textPk);
        rowPk.appendChild(bPk);
        histWrap.appendChild(rowPk);
      });
    }

    // 最新一对的 Copy
    btnCpSk.addEventListener('click', function () {
      copyText(privEl.textContent.trim(), btnCpSk);
    });
    btnCpPk.addEventListener('click', function () {
      copyText(pubEl.textContent.trim(), btnCpPk);
    });

    // 生成一对 key
    btnGen.addEventListener('click', function () {
      try {
        const privStr = generatePrivateString();

        if (privStr.length !== 43) {
          throw new Error('内部错误：私钥字符串长度不是 43（现在是 ' + privStr.length + '）');
        }

        const privBytes = base64UrlToBytes(privStr);
        if (privBytes.length !== 32) {
          throw new Error('内部错误：私钥字节长度不是 32（现在是 ' + privBytes.length + '）');
        }

        const pubBytes = nacl.scalarMult.base(privBytes);
        const pubStr = bytesToBase64Url(pubBytes);

        privEl.textContent = privStr;
        pubEl.textContent = pubStr;

        pushHistory({ priv: privStr, pub: pubStr });
        renderHistory();
      } catch (e) {
        privEl.textContent = '错误：' + (e.message || e);
        pubEl.textContent = '';
        console.error(e);
      }
    });

    renderHistory();
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', bindUI);
  } else {
    bindUI();
  }

})();
