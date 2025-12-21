// doremii-tools.js  (WEB COMPONENTS VERSION with themeable CSS variables)
// Updated 2025-09-02: add <doremii-uuid> (UUID generator with custom constraints)
// Updated 2025-12-03: (1) reduce input height; (2) add SC checkbox to password generator (toggle special chars)

class BaseTool extends HTMLElement {
  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    const accentAttr = this.getAttribute('accent') || '#FF8C00';
    const font       = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';

    // 用 *-base 作为默认值，外部可通过 --accent / --text 等覆盖
    this.root.innerHTML = `
      <style>
        :host{
          /* 默认色（可被外部覆盖：用 var(--xxx, var(--xxx-base)) 读取） */
          --accent-base:${accentAttr};
          --text-base:#111;
          --muted-base:#777;
          --card-bg-base:#fff;
          --card-border-base:#ddd;
          --result-bg-base: var(--accent, var(--accent-base));
          --result-fg-base:#fff;
          --result-border-base:#ccc;
          --hist-bg-base:#e6ffea;
          --hist-border-base:#eee;
          --shadow-base:0 1px 2px rgba(0,0,0,.04);

          display:block; width:100%; max-width: var(--tool-max-width, 425px); font-family:${font};
          color: var(--text, var(--text-base));
        }
        .card{
          margin:20px 0; padding:12px; border-radius:8px;
          background: var(--card-bg, var(--card-bg-base));
          border:1px solid var(--card-border, var(--card-border-base));
          box-shadow: var(--shadow, var(--shadow-base));
        }
        .row{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .row label{ color: var(--muted, var(--muted-base)); font-size: 12px; }

        /* ↓ 改动1：输入框高度调小一些（保守改动：只动 padding/min-height） */
        .row input[type="text"], .row input[type="number"]{
          padding: 5px 8px;
          border:1px solid var(--card-border, var(--card-border-base));
          border-radius:6px;
          min-height: 34px;
          box-sizing: border-box;
        }

        button{
          padding:10px 20px;font-size: 16px; border:none; cursor:pointer; border-radius:6px;
          background: var(--button-bg, var(--accent, var(--accent-base)));
          color: var(--button-fg, #fff);
        }
        .result{
          margin-top:10px; padding:8px; border-radius:6px;
          background: var(--result-bg, var(--result-bg-base));
          color: var(--result-fg, var(--result-fg-base));
          border:1px solid var(--result-border, var(--result-border-base));
          word-break: break-word;
        }
        .hist{
          margin-top:8px; padding:10px; border-radius:6px;
          background: var(--hist-bg, var(--hist-bg-base));
          border:1px solid var(--hist-border, var(--hist-border-base));
        }

        /* ✅新增：暗色主题下历史记录区改为深色底（仅影响 .hist 背景，不改其它结构/逻辑） */
        :host-context([data-theme="dark"]) .hist,
        :host-context(html[data-theme="dark"]) .hist,
        :host-context(body[data-theme="dark"]) .hist,
        :host-context(html.dark) .hist,
        :host-context(body.dark) .hist,
        :host-context(.dark) .hist{
          background: var(--hist-bg-dark, #0b1220);
        }

        .hist div{ margin:4px 0; }
        .msg{ font-size:12px; color: var(--muted, var(--muted-base)); }
        .msg.ok{ color: #0a7b1f; }  /* lucky! */
        .msg.no{ color: #a11212; }  /* ordinary! */
      </style>
      <div class="card">${this.tpl()}</div>
      <div class="result" aria-live="polite"></div>
      <div class="hist"></div>
    `;
    this.$ = (sel) => this.root.querySelector(sel);
    this.onReady = false;
  }
  tpl(){ return ''; }
  accent(v){ this.style.setProperty('--accent', v); }
}




/* ================= Password ================= */
class DorePassword extends BaseTool {
  tpl(){
    return `
    <div class="row">
      <label>Length</label>
      <input type="number" min="4" max="64" value="${this.getAttribute('length')||18}" style="width:5em">

      <!-- 改动2：SC 复选框（Length 右侧 / Generate 左侧），默认勾选=保持原行为：含特殊字符 -->
      <label style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap;margin:0 4px;font-size:12px;">
        <input type="checkbox" data-role="sc" checked>
        SC
      </label>

      <button>Generate</button>
    </div>`;
  }
  connectedCallback(){
    if(this.onReady) return; this.onReady = true;
    const input = this.root.querySelector('input[type="number"]');
    const sc    = this.root.querySelector('input[data-role="sc"]'); // 改动2：SC checkbox
    const btn   = this.root.querySelector('button');
    const res   = this.$('.result');
    const hist  = this.$('.hist');
    const KEY   = 'doreTools.passwordHistory';
    const MAX   = Number(this.getAttribute('history')||5);

    const CH = {
      l:'abcdefghijklmnopqrstuvwxyz',
      u:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      d:'012356789686868',
      s:'!$^&*()$$$'
    }, ALL = CH.l+CH.u+CH.d+CH.s;

    const ALL_NO_S = CH.l + CH.u + CH.d; // 改动2：不含特殊字符的池

    const rnd = (n)=>{ const b=new Uint32Array(1); crypto.getRandomValues(b); return b[0] % n; };
    const shuffle = (arr)=>{ for(let i=arr.length-1;i>0;i--){ const j=rnd(i+1); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; };

    // 新规则：首字符必须为随机大写字母，且固定在 index 0
    // 改动2：可选是否包含特殊字符（SC 勾选=包含；不勾选=不包含）
    const gen = (L, useSpecial)=>{
      L = Math.max(4, Math.min(64, Number(L)||12));
      const withS = (useSpecial !== false);

      const first = CH.u[rnd(CH.u.length)]; // 必为大写字母

      // 其余位：至少各 1 个小写 / 数字；若包含特殊则再至少 1 个特殊
      let poolPart = CH.l[rnd(CH.l.length)] + CH.d[rnd(CH.d.length)];
      if (withS) poolPart += CH.s[rnd(CH.s.length)];

      const pool = withS ? ALL : ALL_NO_S;

      while (1 + poolPart.length < L) poolPart += pool[rnd(pool.length)];

      // 只打乱后续部分，确保首字符位置不变
      const tail = shuffle(poolPart.split('')).join('');
      return first + tail;
    };

    const load=()=>{ try{ return JSON.parse(localStorage.getItem(KEY))||[] }catch{return[]} };
    const save=(a)=>localStorage.setItem(KEY, JSON.stringify(a.slice(0,MAX)));
    const push=(v)=>{ const a=[v,...load()].slice(0,MAX); save(a); return a; };
    const paint=()=>{ const a=load(); hist.innerHTML='';
      a.forEach((v,i)=>{
        const row=document.createElement('div');
        row.innerHTML=`<span>${i+1}. ${v}</span>`;
        const b=document.createElement('button'); b.textContent='Copy';
        b.style.marginLeft='8px';
        b.onclick=()=>navigator.clipboard.writeText(v).then(()=>{ b.textContent='Copied!'; setTimeout(()=>b.textContent='Copy',1000); });
        row.appendChild(b); hist.appendChild(row);
      });
    };

    btn.onclick=()=>{
      const pw = gen(input.value, sc ? sc.checked : true);
      res.textContent = pw;
      push(pw);
      paint();
    };
    paint();
  }
}
customElements.define('doremii-password', DorePassword);


/* ================= Name ================= */
class DoreName extends BaseTool {
  tpl(){ return `<div class="row"><button>Generate</button></div>`; }

  connectedCallback(){
    if(this.onReady) return; this.onReady = true;

    const btn  = this.root.querySelector('button');
    const res  = this.$('.result');
    const hist = this.$('.hist');

    const src  = this.getAttribute('src') || '/wp-content/uploads/forbes.txt';
    const vtag = this.getAttribute('v')   || '';
    const KEY  = 'doreTools.nameHistory';
    const MAX  = Number(this.getAttribute('history')||5);

    let cache;

    // 读取名单（无缓存；允许 ?v= 强制刷新）
    const load = async()=>{
      if (cache) return cache;
      const url = vtag ? `${src}?v=${encodeURIComponent(vtag)}` : src;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw Error(`无法加载名单 (${r.status})`);
      const arr = (await r.text()).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      if (arr.length < 2) throw Error('名单过短（至少需要两行）');
      cache = arr;
      return arr;
    };

    // 取两条不同的随机索引
    const pick2 = (n)=>{
      const i = (Math.random()*n)|0;
      let j = (Math.random()*n)|0;
      if (n>1) while (j === i) j = (Math.random()*n)|0;
      return [i, j];
    };

    const wordLenOk = w => w && w.length > 2;

    // 规则：根据列表顺序选择“前行”第一个词和“后行”最后一个词
    const gen = async()=>{
      const list = await load();
      let tries = 0;
      while (tries++ < 1000) {
        const [firstIndex, lastIndex] = pick2(list.length);
        const [firstRow, lastRow] = firstIndex < lastIndex ? [list[firstIndex], list[lastIndex]] : [list[lastIndex], list[firstIndex]];
        const first = (firstRow.split(/\s+/)[0]  || '').trim();
        const last  = (lastRow.split(/\s+/).pop() || '').trim();
        if (wordLenOk(first) && wordLenOk(last)) return `${first} ${last}`;
      }
      throw Error('多次尝试仍未找到符合长度的姓名，请检查名单内容');
    };

    const loadH = ()=>{ try{ return JSON.parse(localStorage.getItem(KEY))||[] }catch{return[]} };
    const save  = (x)=> localStorage.setItem(KEY, JSON.stringify(x.slice(0,MAX)));
    const push  = (v)=>{ const x=[v, ...loadH()].slice(0,MAX); save(x); return x; };
    const paint = ()=>{
      const a = loadH(); hist.innerHTML = '';
      a.forEach((v,i)=>{
        const row = document.createElement('div');
        row.innerHTML = `<span>${i+1}. ${v}</span>`;
        const b = document.createElement('button');
        b.textContent = 'Copy';
        b.style.marginLeft = '8px';
        b.onclick = ()=>navigator.clipboard.writeText(v).then(()=>{
          b.textContent='Copied!'; setTimeout(()=>b.textContent='Copy', 1000);
        });
        row.appendChild(b);
        hist.appendChild(row);
      });
    };

    btn.onclick = async ()=>{
      res.textContent = '生成中…';
      try {
        const v = await gen();
        res.textContent = v;
        push(v);
        paint();
      } catch (e) {
        res.textContent = e.message;
      }
    };

    paint();
  }
}
customElements.define('doremii-name', DoreName);


/* ================= Lucky Number ================= */
class DoreLucky extends BaseTool {
  tpl(){
    const L = Number(this.getAttribute('length')||4);
    return `
      <div class="row">
        <button>Generate</button>
      </div>
      <div class="row">
        <label>Input number:</label>
        <input type="text" inputmode="numeric" pattern="\\d{${L}}" maxlength="${L}" placeholder="${L} digits" style="width:${L+1}em">
        <button data-role="check">Check</button>
        <span class="msg" aria-live="polite"></span>
      </div>`;
  }
  connectedCallback(){
    if(this.onReady) return; this.onReady = true;
    const btn  = this.root.querySelector('button');                 // Generate
    const res  = this.$('.result');
    const hist = this.$('.hist');

    const checkBtn = this.root.querySelector('button[data-role="check"]');
    const manualIn = this.root.querySelector('input[type="text"]');
    const msg      = this.root.querySelector('.msg');

    // 确保输入/校验行始终在历史列表下面
    const placeCheckRow = () => {
      try {
        const rowsInCard = this.root.querySelectorAll('.card .row');
        const checkRow   = rowsInCard[1];
        const histEl     = this.$('.hist');
        if (!checkRow || !histEl) return;
        let sink = this.root.querySelector('#after-hist-sink');
        if (!sink) {
          sink = document.createElement('div');
          sink.id = 'after-hist-sink';
          sink.style.marginTop = '8px';
          histEl.insertAdjacentElement('afterend', sink);
        }
        if (checkRow.parentNode !== sink) {
          sink.appendChild(checkRow);
        }
      } catch (e) { /* noop */ }
    };
    placeCheckRow();

    const src  = this.getAttribute('src') || '/wp-content/uploads/luckynums.txt';
    const vtag = this.getAttribute('v') || '';
    const padL = Math.max(2, Math.min(8, Number(this.getAttribute('length')||4)));
    const KEY  = 'doreTools.luckyNumberHistory';
    const MAX  = Number(this.getAttribute('history')||5);
    let cache;

    const load=async()=>{
      if(cache) return cache;
      const url = vtag ? `${src}?v=${encodeURIComponent(vtag)}` : src;
      const r = await fetch(url,{cache:'no-store'}); if(!r.ok) throw Error(`无法加载文件 (${r.status})`);
      const arr=(await r.text()).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      if(!arr.length) throw Error('luckynums.txt 文件为空'); cache=arr; return arr;
    };

    const gen = async()=>{ const a=await load(); const i=(Math.random()*a.length)|0; return String(a[i]).padStart(padL,'0'); };

    const loadH=()=>{ try{ return JSON.parse(localStorage.getItem(KEY))||[] }catch{return[]} };
    const save =(x)=>localStorage.setItem(KEY, JSON.stringify(x.slice(0,MAX)));
    const push =(v)=>{ const vv=String(v).padStart(padL,'0'); const x=[vv,...loadH().filter(t=>t!==vv)].slice(0,MAX); save(x); return x; };
    const paint=()=>{
      const a=loadH(); hist.innerHTML='';
      a.forEach((v,i)=>{
        const row=document.createElement('div');
        row.innerHTML=`<span>${i+1}. ${v}</span>`;
        const b=document.createElement('button'); b.textContent='Copy';
        b.style.marginLeft='8px';
        b.onclick=()=>navigator.clipboard.writeText(v).then(()=>{ b.textContent='Copied!'; setTimeout(()=>b.textContent='Copy',1000); });
        row.appendChild(b); hist.appendChild(row);
      });
      placeCheckRow();
    };

    btn.onclick = async()=>{
      res.textContent='抽取中…';
      try{ const v=await gen(); res.textContent=v; push(v); paint(); }
      catch(e){ res.textContent=e.message; }
    };

    const showMsg = (text, ok)=>{
      msg.textContent = text;
      msg.classList.remove('ok','no');
      if      (ok === true)  msg.classList.add('ok');
      else if (ok === false) msg.classList.add('no');
    };
    checkBtn.onclick = async ()=>{
      const raw = (manualIn.value||'').trim();
      const re  = new RegExp(`^\\d{${padL}}$`);
      if(!re.test(raw)){
        showMsg(`请输入${padL}位数字`, false);
        manualIn.focus();
        return;
      }
      try{
        const arr = await load();
        const stripped = raw.replace(/^0+/, '');
        const normalized = stripped === '' ? '0' : stripped;
        const padded = raw.padStart(padL,'0');
        const candidates = [raw, normalized, padded];
        const found = candidates.some(v => arr.includes(v));
        showMsg(found ? 'lucky!' : 'ordinary!', found);
      }catch(e){
        showMsg(e.message, false);
      }
    };

    paint();
  }
}
customElements.define('doremii-lucky', DoreLucky);


/* ================= UUID ================= */
class DoreUUID extends BaseTool {
  tpl(){ return `<div class="row"><button>Generate</button></div>`; }

  connectedCallback(){
    if(this.onReady) return; this.onReady = true;
    const btn  = this.root.querySelector('button');
    const res  = this.$('.result');
    const hist = this.$('.hist');

    const KEY  = 'doreTools.uuidHistory';
    const MAX  = Number(this.getAttribute('history')||5);

    // 允许的十六进制字符（去掉 '4'）
    const HEX_OTHERS = ['0','1','2','3','5','7','9','a','b','c','d','e','f']; // 不含 4/6/8
    // 强化 6 与 8 的权重（至少 10 倍）
    const WEIGHTED = [
      ...HEX_OTHERS,                     // 权重 1
      ...Array(5).fill('6'),            // 权重 5
      ...Array(5).fill('8')             // 权重 5
    ];
    const rnd = (n)=>{ const b=new Uint32Array(1); crypto.getRandomValues(b); return b[0] % n; };
    const pickWeighted = ()=> WEIGHTED[rnd(WEIGHTED.length)];

    // 生成一个候选 UUID（version=1，variant 固定为 8；全程不使用 '4'）
    const candidate = ()=>{
      const h = [];
      for (let i=0;i<32;i++){
        if (i === 12) { h.push('1'); continue; }  // version 1
        if (i === 16) { h.push('8'); continue; }  // variant '10xx' -> 8
        h.push(pickWeighted());
      }
      const s = `${h.slice(0,8).join('')}-${h.slice(8,12).join('')}-${h.slice(12,16).join('')}-${h.slice(16,20).join('')}-${h.slice(20).join('')}`;
      return s;
    };

    // 约束：不得包含 '4'；不得包含这些数字串（去掉连字符后判断）
    const BANS = ["13","55","57","59","110","111","112","119","122","321","507","508","512","513","712"];
    const ok = (u)=>{
      if (u.includes('4')) return false;
      const plain = u.replace(/-/g,'');
      return !BANS.some(p => plain.includes(p));
    };

    const gen = ()=>{
      let tries = 0;
      while (++tries <= 5000) {
        const u = candidate();
        if (ok(u)) return u;
      }
      throw Error('生成受限 UUID 失败，请稍后重试或放宽限制');
    };

    const load=()=>{ try{ return JSON.parse(localStorage.getItem(KEY))||[] }catch{return[]} };
    const save=(a)=>localStorage.setItem(KEY, JSON.stringify(a.slice(0,MAX)));
    const push=(v)=>{ const a=[v,...load()].slice(0,MAX); save(a); return a; };
    const paint=()=>{ const a=load(); hist.innerHTML='';
      a.forEach((v,i)=>{
        const row=document.createElement('div');
        row.innerHTML=`<span>${i+1}. ${v}</span>`;
        const b=document.createElement('button'); b.textContent='Copy';
        b.style.marginLeft='8px';
        b.onclick=()=>navigator.clipboard.writeText(v).then(()=>{ b.textContent='Copied!'; setTimeout(()=>b.textContent='Copy',1000); });
        row.appendChild(b); hist.appendChild(row);
      });
    };

    btn.onclick=()=>{ try{ const id=gen(); res.textContent=id; push(id); paint(); } catch(e){ res.textContent=e.message; } };
    paint();
  }
}
customElements.define('doremii-uuid', DoreUUID);

console.log('doremii-tools ready (themeable colors) [2025-12-03]');
