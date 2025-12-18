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

  function base64UrlToBytes(b64url) {
    // Base64URL -> Base64
    let b64 = String(b64url || '')
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    // 补 padding 到 4 的倍数
    while (b64.length % 4 !== 0) b64 += '=';

    const bin = window.atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ---------- 私钥（32 bytes）生成：输出 43 chars Base64URL（无 padding） ----------
  function generatePrivateString() {
    const priv = nacl.randomBytes(32); // 32 bytes
    return bytesToBase64Url(priv);     // 43 chars
  }

  // ---------- 历史（localStorage） ----------
  const LS_KEY = 'x25519_keys_history_v1';
  const MAX_HIST = 5; // ✅ 恢复为最多 5 个 key pair

  function loadHistory() {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];

      const list = arr.filter(function (x) {
        return x && typeof x.priv === 'string' && typeof x.pub === 'string';
      });

      // ✅ 关键：读取时也裁剪，避免旧数据“无限显示”
      return list.slice(0, MAX_HIST);
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, MAX_HIST)));
    } catch (e) {}
  }

  function pushHistory(pair) {
    const list = loadHistory();
    list.unshift(pair);
    saveHistory(list);
  }

  // ---------- UI ----------
  function bindUI() {
    const btnGen   = doc.getElementById('x-generate');
    const privEl   = doc.getElementById('x-priv');
    const pubEl    = doc.getElementById('x-pub');
    const btnCpSk  = doc.getElementById('x-copy-priv');
    const btnCpPk  = doc.getElementById('x-copy-pub');
    const histWrap = doc.getElementById('x-hist');
    const privIn   = doc.getElementById('x-priv-input');
    const btnCalc  = doc.getElementById('x-calc-pub');

    if (!btnGen || !privEl || !pubEl || !btnCpSk || !btnCpPk || !histWrap) {
      console.warn('x25519-keygen：找不到某些 DOM 元素，请检查 HTML 中的 id。');
      return;
    }

    function copyText(text, btn) {
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          const old = btn.textContent;
          btn.textContent = 'Copied';
          setTimeout(function () { btn.textContent = old; }, 700);
        }).catch(function () {});
      } else {
        // fallback
        const ta = doc.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        doc.body.appendChild(ta);
        ta.select();
        try { doc.execCommand('copy'); } catch (e) {}
        doc.body.removeChild(ta);
        const old = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = old; }, 700);
      }
    }

    function renderHistory() {
      const list = loadHistory(); // ✅ 已保证最多 5 个
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
        bSk.className = 'x-hist-copy';
        bSk.textContent = 'Copy';
        bSk.dataset.value = p.priv;
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
        bPk.className = 'x-hist-copy';
        bPk.textContent = 'Copy';
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

    // 从输入的私钥推导公钥（不影响 Generate）
    function calcPubFromPrivInput() {
      try {
        if (!privIn) throw new Error('未找到私钥输入框（x-priv-input）');

        let s = String(privIn.value || '').trim();
        s = s.replace(/\s+/g, ''); // 去掉空格/换行，方便粘贴
        s = s.replace(/^sk\s*:\s*/i, ''); // 兼容粘贴 "sk: xxxx"
        s = s.replace(/^private\s*key\s*:\s*/i, ''); // 兼容粘贴 "Private key: xxxx"
        s = s.trim();

        if (!s) throw new Error('请输入私钥');
        if (s.length !== 43) throw new Error('私钥应为 43 字符 Base64URL（无填充）');
        if (!/^[A-Za-z0-9\-_]{43}$/.test(s)) {
          throw new Error('私钥包含非法字符，只允许 A-Z a-z 0-9 - _');
        }

        const privBytes = base64UrlToBytes(s);
        if (privBytes.length !== 32) {
          throw new Error('私钥解码后不是 32 字节（现在是 ' + privBytes.length + '）');
        }

        const pubBytes = nacl.scalarMult.base(privBytes);
        const pubStr = bytesToBase64Url(pubBytes);

        // 回填到原有展示区域 + 历史
        privIn.value = s;
        privEl.textContent = s;
        pubEl.textContent = pubStr;

        pushHistory({ priv: s, pub: pubStr });
        renderHistory();
      } catch (e) {
        privEl.textContent = '错误：' + (e.message || e);
        pubEl.textContent = '';
        console.error(e);
      }
    }

    if (btnCalc && privIn) {
      btnCalc.addEventListener('click', calcPubFromPrivInput);
      privIn.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          calcPubFromPrivInput();
        }
      });
    }

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

