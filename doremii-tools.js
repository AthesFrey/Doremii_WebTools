// doremii-tools.js  (WEB COMPONENTS VERSION with themeable CSS variables)
// Updated 2025-08-21:
// 1) Password generator: FIRST char is ALWAYS a RANDOM UPPERCASE letter (no post-shuffle move).
// 2) Lucky number: adds "Input number" + "Check" UI. Check normalizes input by stripping
//    leading zeros before lookup (e.g., "0068" -> "68", "0368" -> "368"). Shows "lucky!"
//    if found in luckynums.txt; otherwise "ordinary!".
// 3) The "Input number" row is placed in a sink right AFTER the history list so it always
//    stays below history (even when history is initially empty).

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

          display:block; max-width:420px; font-family:${font};
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
        .row input[type="text"], .row input[type="number"]{
          padding: 6px 8px; border:1px solid var(--card-border, var(--card-border-base));
          border-radius:6px; min-height: 34px;
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
      <input type="number" min="4" max="64" value="${this.getAttribute('length')||16}" style="width:5em">
      <button>Generate</button>
    </div>`;
  }
  connectedCallback(){
    if(this.onReady) return; this.onReady = true;
    const input = this.root.querySelector('input[type="number"]');
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

    const rnd = (n)=>{ const b=new Uint32Array(1); crypto.getRandomValues(b); return b[0] % n; };
    const shuffle = (arr)=>{ for(let i=arr.length-1;i>0;i--){ const j=rnd(i+1); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; };

    // 新规则：首字符必须为随机大写字母，且固定在 index 0
    const gen = (L)=>{
      L = Math.max(4, Math.min(64, Number(L)||12));
      const first = CH.u[rnd(CH.u.length)]; // 必为大写字母
      // 其余位：至少各 1 个小写 / 数字 / 特殊
      let poolPart = CH.l[rnd(CH.l.length)] + CH.d[rnd(CH.d.length)] + CH.s[rnd(CH.s.length)];
      while (1 + poolPart.length < L) poolPart += ALL[rnd(ALL.length)];
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

    btn.onclick=()=>{ const pw=gen(input.value); res.textContent=pw; push(pw); paint(); };
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

    // 修改规则：根据列表顺序选择“前行”第一个词和“后行”最后一个词
    const gen = async()=>{
      const list = await load();
      let tries = 0;
      while (tries++ < 1000) {
        // 随机选择两行
        const [firstIndex, lastIndex] = pick2(list.length);

        // 确保 firstIndex 小于 lastIndex，保证第一行在前
        const [firstRow, lastRow] = firstIndex < lastIndex ? [list[firstIndex], list[lastIndex]] : [list[lastIndex], list[firstIndex]];

        // 按照行顺序，确定选择第一行第一个词和第二行最后一个词
        const first = (firstRow.split(/\s+/)[0]  || '').trim();   // 选第一行的第一个单词
        const last  = (lastRow.split(/\s+/).pop() || '').trim();   // 选最后一行的最后一个单词

        // 如果选出的名字长度大于2，则返回
        if (wordLenOk(first) && wordLenOk(last)) {
          return `${first} ${last}`;
        }
      }
      throw Error('多次尝试仍未找到符合长度的姓名，请检查名单内容');
    };

    // 历史区
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

    // Ensure the "Input number" row is ALWAYS below the history list by moving it
    // into a dedicated sink placed AFTER .hist
    const placeCheckRow = () => {
      try {
        // The second .row inside .card is the input/check row in the template
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
    // Move now (and again after paint to be safe)
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

    // 生成
    btn.onclick = async()=>{
      res.textContent='抽取中…';
      try{ const v=await gen(); res.textContent=v; push(v); paint(); }
      catch(e){ res.textContent=e.message; }
    };

    // 校验（Check）：把用户输入的4位数字去掉前导0后再检索
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
        // 去掉前导 0；"0000" 归一为 "0"
        const stripped = raw.replace(/^0+/, '');
        const normalized = stripped === '' ? '0' : stripped;
        // 同时也考虑原值和补零值（兼容包含前导零的字典条目）
        const padded = raw.padStart(padL,'0'); // 与 raw 等长，这里只是显式化
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

console.log('doremii-tools ready (themeable colors) [2025-08-21]');
