/* qr-creator-offline.js — 本地离线渲染 + 2FA（Nayuki ES6 外链）
 * 亮点：UI 先渲染；异步等待 qrcodegen 库；缺库时给出提示，不会整块消失
 * 主题：深蓝系；按钮不加粗；可多实例、可重复加载不冲突
 */
(function(){
  if (window.__QR_OFFLINE_DEFINED__) return;
  window.__QR_OFFLINE_DEFINED__ = true;

  // 等待 Nayuki 的 qrcodegen 出现（最多 waitMs 毫秒）
  function waitForNayuki(waitMs = 3000){
    return new Promise(resolve=>{
      if (window.qrcodegen && window.qrcodegen.QrCode) return resolve(true);
      let t = 0, step = 50;
      const timer = setInterval(()=>{
        if (window.qrcodegen && window.qrcodegen.QrCode) {
          clearInterval(timer); resolve(true);
        } else if ((t += step) >= waitMs) {
          clearInterval(timer); resolve(false);
        }
      }, step);
    });
  }

  // Nayuki -> Arase 风格轻适配（只暴露我们需要的 API）
  function attachShimIfNeeded(){
    if (typeof window.qrcode === 'function') return;
    if (!(window.qrcodegen && window.qrcodegen.QrCode)) return;
    const E = window.qrcodegen.QrCode.Ecc;
    const ECC_MAP = { L: E.LOW, M: E.MEDIUM, Q: E.QUARTILE, H: E.HIGH };

    window.qrcode = function(_typeNumberIgnored, eccChar){
      let _text = '';
      let _qr   = null;
      const _ecc = ECC_MAP[(eccChar||'M').toUpperCase()] || E.MEDIUM;

      return {
        addData(t){ _text += String(t); },
        make(){ _qr = window.qrcodegen.QrCode.encodeText(_text, _ecc); },
        // SVG 输出
        createSvgTag(cellSize=4, margin=2){
          const count = _qr.size;
          const dim   = (count + margin*2) * cellSize;
          let rects = '';
          for (let y=0; y<count; y++){
            for (let x=0; x<count; x++){
              if (_qr.getModule(x, y)) {
                rects += `<rect x="${(x+margin)*cellSize}" y="${(y+margin)*cellSize}" width="${cellSize}" height="${cellSize}"/>`;
              }
            }
          }
          return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="#fff"/>
  <g fill="#000">${rects}</g>
</svg>`;
        },
        // PNG DataURL 输出
        createDataURL(cellSize=4, margin=2){
          const count = _qr.size;
          const dim   = (count + margin*2) * cellSize;
          const cvs   = document.createElement('canvas');
          cvs.width = cvs.height = dim;
          const ctx = cvs.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0,0,dim,dim);
          ctx.fillStyle = '#000';
          for (let y=0; y<count; y++){
            for (let x=0; x<count; x++){
              if (_qr.getModule(x, y)) {
                ctx.fillRect((x+margin)*cellSize, (y+margin)*cellSize, cellSize, cellSize);
              }
            }
          }
          return cvs.toDataURL('image/png');
        }
      };
    };
  }

  class DoreQROffline extends HTMLElement {
    constructor(){
      super();
      this.root = this.attachShadow({mode:'open'});
      const accent = this.getAttribute('accent') || '#1e3a8a';
      const font   = 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial';
      this.root.innerHTML = `
        <style>
          :host{ --accent:${accent}; display:block; max-width:450px; font-family:${font}; }
          .card{
            margin:20px 0; padding:14px;
            color:var(--text, #0b1b34);
            background:var(--card-bg, #eff6ff);
            border:1px solid var(--card-border, #93c5fd);
            border-radius:12px;
          }
          .row{ display:flex; align-items:flex-start; gap:10px; flex-wrap:wrap; }
          label{ font-size:13px; color:var(--muted, #1e3a8a); line-height:28px; }
          textarea{
            flex:1 1 100%;
            min-height:84px; max-height:132px;
            padding:12px; border-radius:10px; outline:none;
            border:1px solid var(--card-border, #93c5fd);
            background:#fff; color:#0f172a; line-height:1.4; font-size:14px;
            resize:vertical;
          }
          textarea::placeholder{ color:#94a3b8; }
          .btns{ display:flex; gap:10px; flex-wrap:wrap; }
          button{
            padding:12px 18px; border:none; border-radius:12px; cursor:pointer;
            background:var(--button-bg, #1d4ed8);
            color:var(--button-fg, #ffffff);
            font-weight:var(--button-weight, 400); /* 不加粗 */
            font-size:16px;
          }
          button.secondary{ background:var(--button-bg-2, #0b1b34); color:#ffffff; }
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
        </div>`;
    }

    async connectedCallback(){
      if (this._inited) return; this._inited = true;

      const clamp = (v,min,max)=>Math.max(min, Math.min(max, v));
      const size  = clamp(Number(this.getAttribute('size')||420), 240, 1024);
      const eccIn = String(this.getAttribute('ecc')||'M').toUpperCase();  // L/M/Q/H
      const fmt   = (this.getAttribute('format')||'svg').toLowerCase();   // svg|png
      const qzone = clamp(Number(this.getAttribute('qzone')||2), 0, 50);

      const issuerAttr    = this.getAttribute('issuer')    || (location && location.host) || 'doremii.top';
      const accountAttr   = this.getAttribute('account')   || 'user';
      const digitsAttr    = String(this.getAttribute('digits') || '6');
      const periodAttr    = String(this.getAttribute('period') || '30');
      const algorithmAttr = (this.getAttribute('algorithm') || 'SHA1').toUpperCase();

      const $ = s => this.root.querySelector(s);
      const ta   = $('textarea');
      const btn  = $('.create');
      const btn2 = $('.create2fa');
      const msg  = $('.msg');
      const res  = $('.result');

      // 等库，装 shim（失败也保留 UI 并提示）
      const ok = await waitForNayuki();
      if (!ok){
        msg.textContent = '未检测到 qrcodegen 库：请确认已先加载 /wp-content/uploads/qrcodegen-v1.8.0-es6.js';
        return;
      }
      attachShimIfNeeded();

      const renderQR = (text, meta)=>{
        const t = (text||'').trim();
        if (!t){ res.innerHTML=''; msg.textContent='请输入要编码的文本'; ta.focus(); return; }

        const qr = window.qrcode(0, eccIn);
        qr.addData(t); qr.make();

        // 用一次 1px+0margin 的 SVG 推算模块数，再算 cellSize
        const tmp = qr.createSvgTag(1, 0);
        const m = tmp.match(/viewBox="0 0 (\d+) \1"/);
        const count = m ? Number(m[1]) : 21; // fallback 21

        const cell  = Math.max(1, Math.floor(size / (count + qzone*2)));

        res.innerHTML = '';
        if (fmt === 'png') {
          const url = qr.createDataURL(cell, qzone);
          const img = document.createElement('img');
          img.alt = 'QR'; img.width = cell*count + qzone*2*cell; img.height = img.width;
          img.src = url; res.appendChild(img);
        } else {
          const svg = qr.createSvgTag(cell, qzone).replace('<svg ','<svg role="img" aria-label="QR" ');
          res.insertAdjacentHTML('beforeend', svg);
        }
        msg.textContent = (meta || `${t.length} chars`) + ` • ECC ${eccIn} • ~${cell*count + qzone*2*cell}px • ${fmt.toUpperCase()}`;
      };

      const normalizeBase32 = (raw)=>String(raw||'').replace(/[\s\-]/g,'').toUpperCase().replace(/[^A-Z2-7]/g,'').replace(/=+$/,'');
      const buildTotpUri = (raw)=>{
        const s = String(raw||'').trim();
        if (!s) return '';
        if (s.startsWith('otpauth://')) return s;
        const issuer  = this.getAttribute('issuer')  || issuerAttr;
        const account = this.getAttribute('account') || accountAttr;
        const digits  = this.getAttribute('digits')  || digitsAttr;
        const period  = this.getAttribute('period')  || periodAttr;
        const algo    = (this.getAttribute('algorithm')|| algorithmAttr).toUpperCase();
        const secret  = normalizeBase32(s);
        if (!secret) return '';
        const label = `${issuer}:${account}`;
        return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=${encodeURIComponent(digits)}&period=${encodeURIComponent(period)}&algorithm=${encodeURIComponent(algo)}`;
      };

      const onCreate   = ()=> renderQR(ta.value);
      const onCreate2F = ()=>{
        const uri = buildTotpUri(ta.value);
        if (!uri){ msg.textContent = '请输入有效的 TOTP 密钥（Base32），或完整的 otpauth:// URI'; res.innerHTML=''; ta.focus(); return; }
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

   // 只注册 doremi-qr-offline
  if (!customElements.get('doremi-qr-offline')) {
    customElements.define('doremi-qr-offline', DoreQROffline);
  }

})();

