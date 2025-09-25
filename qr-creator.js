/* qr-creator.js — Standalone QR Generator (深蓝系) + 2FA(TOTP)
 * 修复：主题变量不被覆盖；按钮文字不加粗（可由 --button-weight 调整）
 */
(function(){
  if (window.__QR_CREATOR_DEFINED__) return;
  window.__QR_CREATOR_DEFINED__ = true;

  class DoreQR extends HTMLElement {
    constructor(){
      super();
      this.root = this.attachShadow({mode:'open'});
      const accent = this.getAttribute('accent') || '#1e3a8a'; // 深蓝主色
      const font   = 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial';

      this.root.innerHTML = `
        <style>
          :host{
            --accent:${accent};                 /* 仅设置 accent，不覆盖其它主题变量 */
            display:block; max-width:520px; font-family:${font};
          }
          .card{
            margin:20px 0; padding:14px; color:var(--text, #0b1b34);
            background:var(--card-bg, #eff6ff);                 /* 默认蓝50 */
            border:1px solid var(--card-border, #93c5fd);       /* 默认蓝300 */
            border-radius:12px;
          }
          .row{ display:flex; align-items:flex-start; gap:10px; flex-wrap:wrap; }
          label{ font-size:13px; color:var(--muted, #1e3a8a); line-height:28px; }
          textarea{
            flex:1 1 100%;
            min-height:84px; max-height:132px;                   /* 约3行 */
            padding:12px 12px; border-radius:10px; outline:none;
            border:1px solid var(--card-border, #93c5fd);
            background:#fff; color:#0f172a; line-height:1.4; font-size:14px;
            resize:vertical;
          }
          textarea::placeholder{ color:#94a3b8; }
          .btns{ display:flex; gap:10px; flex-wrap:wrap; }
          button{
            padding:12px 18px; border:none; border-radius:12px; cursor:pointer;
            background:var(--button-bg, #1d4ed8);               /* 默认蓝700 */
            color:var(--button-fg, #ffffff);
            font-weight:var(--button-weight, 400);               /* 默认不加粗 */
            font-size:16px;
          }
          button.secondary{
            background:var(--button-bg-2, #0b1b34);              /* 更深蓝，区分第二按钮 */
            color:#ffffff;
          }
          button:active{ transform:translateY(1px); }
          .msg{ margin-top:8px; font-size:13px; color:var(--muted, #1e3a8a); word-break:break-all; }
          .result{
            margin-top:12px; padding:10px; border-radius:10px; display:inline-block; text-align:center;
            background:var(--result-bg, #ffffff); color:var(--result-fg, #000000);
            border:1px dashed var(--card-border, #93c5fd);
            max-width:100%;
          }
          .result img, .result svg{ display:block; max-width:100%; height:auto; margin:0 auto; }
        </style>

        <div class="card">
          <div class="row">
            <label>Text</label>
            <textarea placeholder="输入文本/网址；或输入 TOTP 密钥（Base32）。也可粘贴 otpauth://..."></textarea>
            <div class="btns">
              <button class="create">Create QR</button>
              <button class="create2fa secondary" title="将输入当作TOTP密钥，拼成 otpauth://totp/... 生成二维码">2FA QR</button>
            </div>
          </div>
          <div class="msg"></div>
          <div class="result" aria-live="polite"></div>
        </div>
      `;
    }

    connectedCallback(){
      if (this._inited) return; this._inited = true;

      // 二维码渲染参数
      const clamp = (v,min,max)=>Math.max(min, Math.min(max, v));
      const size  = clamp(Number(this.getAttribute('size')||420), 240, 1024); // 更大，贴近卡片宽
      const ecc   = String(this.getAttribute('ecc')||'M').toUpperCase();     // L/M/Q/H
      const fmt   = (this.getAttribute('format')||'svg').toLowerCase();      // svg|png
      const qzone = clamp(Number(this.getAttribute('qzone')||2), 0, 50);     // 白边

      // TOTP 参数（可通过属性覆盖）
      const issuerAttr    = this.getAttribute('issuer')    || (location && location.host) || 'doremii.top';
      const accountAttr   = this.getAttribute('account')   || 'user';
      const digitsAttr    = String(this.getAttribute('digits') || '6');      // 6 或 8
      const periodAttr    = String(this.getAttribute('period') || '30');     // 秒
      const algorithmAttr = (this.getAttribute('algorithm') || 'SHA1').toUpperCase();

      const API   = 'https://api.qrserver.com/v1/create-qr-code/';
      const $ = s => this.root.querySelector(s);
      const ta   = $('textarea');
      const btn  = $('.create');
      const btn2 = $('.create2fa');
      const msg  = $('.msg');
      const res  = $('.result');

      const renderQR = (text, meta) => {
        const t = (text||'').trim();
        if (!t){ res.innerHTML=''; msg.textContent='请输入要编码的文本'; ta.focus(); return; }
        const qs  = `?size=${size}x${size}&ecc=${ecc}&format=${fmt}&qzone=${qzone}&data=${encodeURIComponent(t)}`;
        const url = API + qs;
        res.innerHTML = '';
        const img = document.createElement('img');
        img.alt = 'QR'; img.width = size; img.height = size;
        img.setAttribute('referrerpolicy','no-referrer');
        img.src = url; res.appendChild(img);
        msg.textContent = (meta || `${t.length} chars`) + ` • ECC ${ecc} • ${size}px • ${fmt.toUpperCase()}`;
      };

      const normalizeBase32 = (raw) => String(raw||'')
        .replace(/[\s\-]/g,'')
        .toUpperCase()
        .replace(/[^A-Z2-7]/g,'')
        .replace(/=+$/,'');

      const buildTotpUri = (rawSecretOrUri) => {
        const raw = String(rawSecretOrUri||'').trim();
        if (!raw) return '';
        if (raw.startsWith('otpauth://')) return raw;

        const issuer  = this.getAttribute('issuer')    || issuerAttr;
        const account = this.getAttribute('account')   || accountAttr;
        const digits  = this.getAttribute('digits')    || digitsAttr;
        const period  = this.getAttribute('period')    || periodAttr;
        const algo    = (this.getAttribute('algorithm')|| algorithmAttr).toUpperCase();

        const secret = normalizeBase32(raw);
        if (!secret) return '';

        const label = `${issuer}:${account}`;
        return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}`
             + `&issuer=${encodeURIComponent(issuer)}&digits=${encodeURIComponent(digits)}`
             + `&period=${encodeURIComponent(period)}&algorithm=${encodeURIComponent(algo)}`;
      };

      const onCreate   = ()=> renderQR(ta.value);
      const onCreate2F = ()=>{
        const uri = buildTotpUri(ta.value);
        if (!uri){
          msg.textContent = '请输入有效的 TOTP 密钥（Base32），或完整的 otpauth:// URI';
          res.innerHTML = ''; ta.focus(); return;
        }
        renderQR(uri, 'TOTP • otpauth URI');
      };

      btn.addEventListener('click', onCreate, {passive:true});
      btn2.addEventListener('click', onCreate2F, {passive:true});
      ta.addEventListener('keydown', e=>{
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onCreate(); }
        else if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); onCreate2F(); }
      });

      const preset = this.getAttribute('value');
      if (preset){ ta.value = preset; }
    }
  }

  if (!customElements.get('doremii-qr')) {
    customElements.define('doremii-qr', DoreQR);
  }
})();
