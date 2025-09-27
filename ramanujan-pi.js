// /wp-content/uploads/ramanujan-pi.js
(() => {
  'use strict';
  if (customElements.get('doremii-ramanujan')) return;

  class DoreRamanujan extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      const accent = this.getAttribute('accent') || '#0EA5A5';

      root.innerHTML = `
        <style>
          :host{
            --accent-base:${accent};
            --card-bg:    var(--card-bg, #f0fffa);
            --card-border:var(--card-border, #9ee6d7);
            --text:       var(--text, #0f172a);
            --muted:      var(--muted, #64748b);
            --button-bg:  var(--button-bg, var(--accent-base));
            --button-fg:  var(--button-fg, #fff);
            --result-bg:  var(--result-bg, #fff);
            --result-fg:  var(--result-fg, #111);
            --shadow:     var(--shadow, 0 1px 2px rgba(0,0,0,.05));

            --max-w:   450px;   /* 卡片最大宽度 */
            --dsize:   15px;    /* 小数位字号 */
            --rsize:   10px;    /* 标尺字号 */
            --line-gap:4px;

            /* 百分比列宽：表格自适应 450 宽，无横向滚动 */
            --intw:    2.2%;
            --dotw:    1.2%;
            --digitw:  calc((100% - var(--intw) - var(--dotw)) / 50);
            display:block; color:var(--text);
            font-family: system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
          }
          .frame{ width:min(var(--max-w),100%); margin:16px 0; }
          .card{
            width:100%;
            background:var(--card-bg); border:1px solid var(--card-border);
            border-radius:10px; padding:14px; box-shadow:var(--shadow);
          }
          .row{
            display:flex; align-items:center; justify-content:flex-start;
            gap:12px; flex-wrap:wrap;
          }
          .actions{
            margin-left:auto; display:flex; align-items:center; gap:10px; padding-right:2px;
          }
          .formula{
            background:#fff; border-radius:8px; padding:10px; border:1px dashed #dbeafe;
            color:#0f172a; overflow:auto;
          }
          math{ font-size:18px; }
          .kbox{
            font-size:14px; color:var(--muted); padding:6px 10px; border-radius:6px;
            background:#f6fff9; border:1px solid #c9f1de;
          }

          /* 按钮风格（与家族一致） */
          .btn{
            border:none; border-radius:10px; padding:10px 18px; cursor:pointer;
            font-size:16px; line-height:1; transition:transform .05s ease, background-color .15s;
          }
          .btn:active{ transform:translateY(1px); }
          .btn-primary{ background:var(--button-bg); color:var(--button-fg); }
          .btn-ghost{
            background:#fff; color:var(--accent-base);
            border:1px solid var(--accent-base);
          }
          .btn-ghost:hover{ background:#ecfffb; }

          .result{
            background:var(--result-bg); color:var(--result-fg);
            border:1px solid var(--card-border); border-radius:8px; padding:10px; margin-top:10px;
            overflow:auto; font-variant-numeric: tabular-nums slashed-zero;
          }
          .line{ margin: var(--line-gap) 0; }

          /* 表格刻度对齐（百分比列宽，自适应 450 宽） */
          table.pi{
            table-layout: fixed; border-collapse: separate; border-spacing: 0;
            width:100%; max-width:100%;
            font-size: var(--dsize);
            font-family:'JetBrains Mono','Cascadia Mono','Consolas','Menlo','DejaVu Sans Mono',monospace;
          }
          table.pi col.c-int   { width: var(--intw); }
          table.pi col.c-dot   { width: var(--dotw); }
          table.pi col.c-digit { width: var(--digitw); }

          table.pi td{ padding:0; margin:0; text-align:center; }
          table.pi .int, table.pi .dot{ font-weight:700; }
          tr.ruler td{ font-size:var(--rsize); color:var(--muted); line-height:1.0; }
          tr.digits td{ font-size:var(--dsize); line-height:1.1; }
          .note{ font-size:12px; color:var(--muted); margin-top:6px; }
        </style>

        <div class="frame">
          <div class="card">
            <div class="formula">
              <div style="margin-bottom:6px; color:#334155;">Ramanujan series (1914):</div>
              <math display="block">
                <mrow>
                  <mfrac><mn>1</mn><mi>π</mi></mfrac>
                  <mo>=</mo>
                  <mfrac>
                    <mrow><mn>2</mn><mo>⁢</mo><msqrt><mn>2</mn></msqrt></mrow>
                    <mn>9801</mn>
                  </mfrac>
                  <mo>·</mo>
                  <munderover><mo>∑</mo><mrow><mi>k</mi><mo>=</mo><mn>0</mn></mrow><mo>∞</mo></munderover>
                  <mfrac>
                    <mrow>
                      <mo>(</mo><mn>4</mn><mi>k</mi><mo>)</mo><mo>!</mo>
                      <mo>⁢</mo>
                      <mo>(</mo><mn>1103</mn><mo>+</mo><mn>26390</mn><mi>k</mi><mo>)</mo>
                    </mrow>
                    <mrow>
                      <msup><mrow><mo>(</mo><mi>k</mi><mo>!</mo><mo>)</mo></mrow><mn>4</mn></msup>
                      <mo>⁢</mo>
                      <msup><mn>396</mn><mrow><mn>4</mn><mi>k</mi></mrow></msup>
                    </mrow>
                  </mfrac>
                </mrow>
              </math>
            </div>

            <div class="row">
              <div class="kbox" aria-live="polite">当前 k = 1（已累加 0..1）</div>
              <div class="actions">
                <button id="go"   class="btn btn-primary">Pi progress</button>
                <button id="copy" class="btn btn-ghost" title="复制当前 π 值（最多 1000 位）">Copy</button>
              </div>
            </div>

            <div class="result" id="result">计算中…</div>
            <div class="note">每行 50 位小数；刻度（1、11、21…）与对应位绝对对齐。默认宽度 450，可在标签上用 style 覆盖。</div>
          </div>
        </div>
      `;

      const $ = (s)=>root.querySelector(s);

      /* ===== 计算内核（与你当前稳定版一致） ===== */
      this.DEC_DIGITS = 1000;
      this.GUARD      = 32;
      this.S          = this.DEC_DIGITS + this.GUARD;
      this.SC         = 10n ** BigInt(this.S);
      this.SC2        = this.SC * this.SC;

      const sqrt2_scaled = this.bigSqrt(2n * this.SC2);
      this.c_scaled      = (2n * sqrt2_scaled) / 9801n;

      this.M396_4     = 396n ** 4n;
      this.k          = -1;
      this.b_scaled   = this.SC;      // b0=1
      this.sum_scaled = 0n;

      // 最新 π 字符串缓存，供 Copy 使用
      this.pi_str = '';

      // 事件
      $('#go').addEventListener('click', () => {
        this.addNextTerm(); this.updateKBox(); this.repaintPi();
      });
      $('#copy').addEventListener('click', () => this.copyPi());

      // 启动
      this.addNextTerm(); this.addNextTerm();
      this.updateKBox();  this.repaintPi();
    }

    updateKBox(){
      this.shadowRoot.querySelector('.kbox').textContent =
        `当前 k = ${this.k}（已累加 0..${this.k}）`;
    }

    addNextTerm(){
      if (this.k < 0) { this.sum_scaled += this.b_scaled * 1103n; this.k = 0; return; }
      const k = this.k;
      const P = BigInt(4*k+1) * BigInt(4*k+2) * BigInt(4*k+3) * BigInt(4*k+4);
      const kp1 = BigInt(k+1);
      const kp1_4 = (kp1*kp1)*(kp1*kp1);
      const Q = kp1_4 * this.M396_4;
      this.b_scaled = (this.b_scaled * P) / Q;
      this.sum_scaled += this.b_scaled * (1103n + 26390n * BigInt(k+1));
      this.k = k + 1;
    }

    repaintPi(){
      const inv_pi_scaled = (this.c_scaled * this.sum_scaled) / this.SC; // ≈ (1/π)*10^S
      if (inv_pi_scaled === 0n) { this.shadowRoot.querySelector('#result').textContent = '数据不足'; return; }
      const pi_scaled = this.SC2 / inv_pi_scaled;                         // floor
      const intPart   = pi_scaled / this.SC;                              // 3
      const fracStr   = (pi_scaled % this.SC).toString().padStart(this.S,'0').slice(0,this.DEC_DIGITS);

      // 缓存纯字符串，给 Copy 按钮使用
      this.pi_str = `${intPart}.${fracStr}`;

      const LINE=50, STEP=10, total=Math.ceil(this.DEC_DIGITS/LINE);
      const blocks=[];
      for(let li=0; li<total; li++){
        const start = li*LINE;
        const seg   = fracStr.slice(start, start+LINE).padEnd(LINE,'0');

        const colgroup = `<colgroup>
          <col class="c-int"><col class="c-dot"><col class="c-digit" span="50">
        </colgroup>`;

        const ruler = [];
        ruler.push(`<td></td><td></td>`);
        for (let p=0; p<LINE; p+=STEP) {
          const mark = start + p + 1;
          ruler.push(`<td colspan="10" style="text-align:left;"><span>${mark}</span></td>`);
        }

        const digits=[];
        if (li===0) digits.push(`<td class="int">${intPart}</td><td class="dot">.</td>`);
        else        digits.push(`<td></td><td></td>`);
        for (let i=0;i<LINE;i++) digits.push(`<td>${seg[i]??'0'}</td>`);

        blocks.push(`
          <div class="line">
            <table class="pi">
              ${colgroup}
              <tbody>
                <tr class="ruler">${ruler.join('')}</tr>
                <tr class="digits">${digits.join('')}</tr>
              </tbody>
            </table>
          </div>
        `);
      }
      this.shadowRoot.querySelector('#result').innerHTML = blocks.join('');
    }

    async copyPi(){
      const btn = this.shadowRoot.querySelector('#copy');
      const text = this.pi_str || '3.14';
      try{
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // 兼容旧环境
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
          this.shadowRoot.appendChild(ta); ta.focus(); ta.select();
          document.execCommand('copy'); this.shadowRoot.removeChild(ta);
        }
        const old = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(()=>{ btn.textContent = old; }, 1200);
      }catch(e){
        const old = btn.textContent;
        btn.textContent = 'Copy failed';
        setTimeout(()=>{ btn.textContent = old; }, 1200);
      }
    }

    bigSqrt(n){
      if (n < 0n) throw new Error('negative');
      if (n < 2n) return n;
      let x0 = 1n << (BigInt(n.toString(2).length) >> 1n);
      let x1 = (x0 + n / x0) >> 1n;
      while (x1 < x0) { x0 = x1; x1 = (x0 + n / x0) >> 1n; }
      return x0;
    }
  }

  customElements.define('doremii-ramanujan', DoreRamanujan);
})();
