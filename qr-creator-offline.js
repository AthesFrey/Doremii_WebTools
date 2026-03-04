/* qr-creator-offline.js — 本地离线渲染 + 2FA（Nayuki ES6 外链）
 * 20251109 仅在“2FA QR”处弹出备注对话框（留空=TEST）
 * 本版：生成 TOTP 时不再写入 issuer 参数；label 仅为备注名
 */
(function(){
  if (window.__QR_OFFLINE_DEFINED__) return;
  window.__QR_OFFLINE_DEFINED__ = true;

  function waitForNayuki(waitMs = 3000){
    return new Promise(resolve=>{
      if (window.qrcodegen && window.qrcodegen.QrCode) return resolve(true);
      let t = 0, step = 50;
      const timer = setInterval(()=>{
        if (window.qrcodegen && window.qrcodegen.QrCode) { clearInterval(timer); resolve(true); }
        else if ((t += step) >= waitMs) { clearInterval(timer); resolve(false); }
      }, step);
    });
  }

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
          :host{
            --accent:${accent};
            /* Themeable tokens (light defaults) */
            --card-bg:#eff6ff;
            --card-border:#93c5fd;
            --text:#0b1b34;
            --muted:#1e3a8a;

            --input-bg:#ffffff;
            --input-fg:#0f172a;
            --placeholder:#94a3b8;

            --button-bg:#1d4ed8;
            --button-bg-2:#0b1b34;
            --button-fg:#ffffff;
            --button-weight:400;

            --result-bg:#ffffff;
            --result-fg:#000000;

            display:block;
            max-width:520px;
            font-family:${font};
          }

          :host([data-theme="dark"]){
            --card-bg:#0b1220;
            --card-border:#334155;
            --text:#e2e8f0;
            --muted:#94a3b8;

            --input-bg:#0f172a;
            --input-fg:#e2e8f0;
            --placeholder:#64748b;

            --button-bg:#2563eb;
            --button-bg-2:#111827;
            --button-fg:#ffffff;

            --result-bg:#0b1220;
            --result-fg:#e2e8f0;
          }

          .card{ margin:20px 0; padding:14px; color:var(--text); background:var(--card-bg); border:1px solid var(--card-border); border-radius:12px; }
          .row{ display:flex; align-items:flex-start; gap:10px; flex-wrap:wrap; }
          label{ font-size:13px; color:var(--muted); line-height:28px; }
          textarea{
            flex:1 1 100%;
            min-height:84px;
            max-height:132px;
            padding:12px;
            border-radius:10px;
            outline:none;
            border:1px solid var(--card-border);
            background:var(--input-bg);
            color:var(--input-fg);
            line-height:1.4;
            font-size:14px;
            resize:vertical;
          }
          textarea::placeholder{ color:var(--placeholder); }
          .btns{ display:flex; gap:10px; flex-wrap:wrap; }
          button{
            padding:12px 18px;
            border:none;
            border-radius:12px;
            cursor:pointer;
            background:var(--button-bg);
            color:var(--button-fg);
            font-weight:var(--button-weight);
            font-size:16px;
          }
          button.secondary{ background:var(--button-bg-2); color:var(--button-fg); }
          /* 新增的大小写切换按钮颜色 */
          button.ccase{ background:#f97316; color:#ffffff; }
          button:active{ transform:translateY(1px); }
          .msg{ margin-top:8px; font-size:13px; color:var(--muted); word-break:break-all; }
          .result{ margin-top:12px; padding:10px; border-radius:10px; display:inline-block; text-align:center; background:var(--result-bg); color:var(--result-fg); border:1px dashed var(--card-border); max-width:100%; }
          .result img,.result svg{ display:block; max-width:100%; height:auto; margin:0 auto; }
        </style>
        
        <div class="card">
          <div class="row">
            <label>Text</label>
            <textarea placeholder="输入文本/网址；或输入 TOTP 密钥（Base32）。也可粘贴 otpauth://..."></textarea>
            <div class="btns">
              <button class="create">Create QR</button>
              <button class="create2fa secondary" title="将输入当作TOTP密钥，拼成 otpauth://totp/... 生成二维码">2FA QR</button>
              <button class="ccase" title="在大写/小写之间切换">ccase</button>
            </div>
          </div>
          <div class="msg"></div>
          <div class="result" aria-live="polite"></div>
        </div>`;
    }

    async connectedCallback(){
      if (this._inited) return; this._inited = true;

      // Sync theme from page (Doremii toggler updates html/body[data-theme])
      const readTheme = ()=>{
        const html = document.documentElement;
        const body = document.body;
        return (
          (html && html.getAttribute('data-theme')) ||
          (body && body.getAttribute('data-theme')) ||
          (html && html.dataset && html.dataset.theme) ||
          (body && body.dataset && body.dataset.theme) ||
          ''
        );
      };
      const syncTheme = ()=>{
        const t = String(readTheme() || '').toLowerCase();
        const theme = (t === 'dark') ? 'dark' : 'light';
        if (this.getAttribute('data-theme') !== theme) this.setAttribute('data-theme', theme);
      };
      syncTheme();
      this._themeMO = new MutationObserver(syncTheme);
      try {
        if (document.documentElement) {
          this._themeMO.observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
        }
        if (document.body) {
          this._themeMO.observe(document.body, {attributes:true, attributeFilter:['data-theme']});
        } else {
          // body may not exist yet; attach later
          this._themeMO_bodyTimer = setInterval(()=>{
            if (document.body) {
              try { this._themeMO.observe(document.body, {attributes:true, attributeFilter:['data-theme']}); } catch(_e){}
              clearInterval(this._themeMO_bodyTimer); this._themeMO_bodyTimer = null;
            }
          }, 50);
        }
      } catch(_e) {}

      const clamp = (v,min,max)=>Math.max(min, Math.min(max, v));
      const size  = clamp(Number(this.getAttribute('size')||520), 240, 1024);
      const eccIn = String(this.getAttribute('ecc')||'M').toUpperCase();
      const fmt   = (this.getAttribute('format')||'svg').toLowerCase();
      const qzone = clamp(Number(this.getAttribute('qzone')||2), 0, 50);

      /* 原属性保持可读（不再用于 TOTP 生成展示名） */
      const digitsAttr    = String(this.getAttribute('digits') || '6');
      const periodAttr    = String(this.getAttribute('period') || '30');
      const algorithmAttr = (this.getAttribute('algorithm') || 'SHA1').toUpperCase();

      const $ = s => this.root.querySelector(s);
      const ta     = $('textarea');
      const btn    = $('.create');
      const btn2   = $('.create2fa');
      const btn3   = $('.ccase');
      const msg    = $('.msg');
      const res    = $('.result');

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

        const tmp = qr.createSvgTag(1, 0);
        const m = tmp.match(/viewBox="0 0 (\d+) \1"/);
        const count = m ? Number(m[1]) : 21;
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
      // —— 关键改动：label=备注名；URI 不再包含 issuer=
      const buildTotpUri = (raw, accountOverride)=>{
        const s = String(raw||'').trim();
        if (!s) return '';
        if (s.startsWith('otpauth://')) return s; // 粘贴完整 URI 时仍原样使用
        const account = (accountOverride && accountOverride.trim()) || 'TEST';
        const digits  = digitsAttr;
        const period  = periodAttr;
        const algo    = algorithmAttr;
        const secret  = normalizeBase32(s);
        if (!secret) return '';
        const label = account; // 仅备注名
        // 不包含 issuer 参数
        return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&digits=${encodeURIComponent(digits)}&period=${encodeURIComponent(period)}&algorithm=${encodeURIComponent(algo)}`;
      };

      const onCreate   = ()=> renderQR(ta.value);
      const onCreate2F = ()=>{
        const nick = window.prompt('请输入 2FA 备注（可留空=TEST）', '');
        const uri = buildTotpUri(ta.value, nick);
        if (!uri){ msg.textContent = '请输入有效的 TOTP 密钥（Base32），或完整的 otpauth:// URI'; res.innerHTML=''; ta.focus(); return; }
        renderQR(uri, 'TOTP • otpauth URI');
      };

      // 新增：大小写切换
      let _isUpper = false;
      const onToggleCase = ()=>{
        const v = ta.value;
        if (!v) return;
        if (!_isUpper) {
          ta.value = v.toUpperCase();
        } else {
          ta.value = v.toLowerCase();
        }
        _isUpper = !_isUpper;
      };

      btn.addEventListener('click', onCreate, {passive:true});
      btn2.addEventListener('click', onCreate2F, {passive:true});
      btn3.addEventListener('click', onToggleCase, {passive:true});

      ta.addEventListener('keydown', e=>{
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onCreate(); }
        else if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); onCreate2F(); }
      });

      const preset = this.getAttribute('value');
      if (preset){ ta.value = preset; }
    }

    disconnectedCallback(){
      try { if (this._themeMO) { this._themeMO.disconnect(); this._themeMO = null; } } catch(_e) {}
      try { if (this._themeMO_bodyTimer) { clearInterval(this._themeMO_bodyTimer); this._themeMO_bodyTimer = null; } } catch(_e) {}
    }
  }

  // 只注册 doremi-qr-offline
  if (!customElements.get('doremi-qr-offline')) {
    customElements.define('doremi-qr-offline', DoreQROffline);
  }
})();
