/* bip39-mnemonic-number.js (audited)
 * Mnemonics ⇄ Numbers (BIP39)
 * - Reads: /wp-content/uploads/crypto_files/bip39_enwithcn.txt (2048 lines)
 * - Fallback: /index/wp-content/uploads/crypto_files/bip39_enwithcn.txt
 * - Scope: only binds within .doremii-b39num[data-tool="b39num"]
 *
 * Security/hardening:
 * - No innerHTML (status uses textContent) => avoids XSS
 * - Input size limits to avoid page freeze (DoS by huge paste)
 * - Robust number parsing for mixed spaced/unspaced input
 */
(function(){
  "use strict";

  // Let the HTML loader confirm the script actually ran.
  // NOTE: keep this near the top so a valid script stops fallback loading;
  // syntax errors (e.g. HTML masquerading as JS) will prevent this from being set.
  window.DOREMII_B39NUM_LOADED = true;

  var ROOT_SEL = '.doremii-b39num[data-tool="b39num"]';
  var DEFAULT_TXT_CANDIDATES = [
    "/wp-content/uploads/crypto_files/bip39_enwithcn.txt",
    "/index/wp-content/uploads/crypto_files/bip39_enwithcn.txt"
  ];

  // Hard limits to prevent UI freeze from extremely large input
  var MAX_INPUT_CHARS = 200000;  // 200 KB-ish text paste
  var MAX_TOKENS = 4096;         // plenty for normal use; prevents pathological splits

  var state = {
    word2idx: null,     // Map(word -> 1..2048)
    idx2word: null,     // Array[1..2048] -> word
    loading: null       // Promise<boolean> to de-duplicate loads
  };

  function $(root, sel){ return root.querySelector(sel); }

  // Status is ONLY used for conversion result / error.
  function setStatus(root, msg, cls){
    var st = $(root, '[data-field="status"]');
    if(!st) return;
    st.className = "status" + (cls ? (" " + cls) : "");
    st.textContent = msg || "";
  }

  function pad4(nStr){
    var s = String(nStr);
    return s.length >= 4 ? s : ("0000" + s).slice(-4);
  }

  function normalizeWord(w){
    return (w || "").trim().toLowerCase();
  }

  function looksLikeHTML(text){
    var t = (text || "").trim().slice(0, 200).toLowerCase();
    return t.startsWith("<!doctype") || t.startsWith("<html") || t.includes("<head") || t.includes("<body");
  }

  function parseWordlist(text){
    if(!text || looksLikeHTML(text)) throw new Error("wordlist returned HTML");
    var lines = text.replace(/\r\n?/g, "\n").split("\n").filter(function(x){ return x.trim() !== ""; });
    if(lines.length < 2048) throw new Error("wordlist lines < 2048");

    var word2idx = new Map();
    var idx2word = new Array(2049); // 1..2048

    for(var i=0;i<2048;i++){
      var line = lines[i].trim();
      var parts = line.split(/\s+/);
      var w = normalizeWord(parts[0] || "");
      if(!w) throw new Error("missing word at line " + (i+1));
      if(!word2idx.has(w)) word2idx.set(w, i+1);
      idx2word[i+1] = w;
    }
    return { word2idx: word2idx, idx2word: idx2word };
  }

  async function fetchText(url){
    var res = await fetch(url, { cache: "no-store" });
    var txt = await res.text();
    return { ok: res.ok, status: res.status, text: txt };
  }

  async function loadWordlist(root){
    var custom = (root.getAttribute("data-wordlist-url") || "").trim();
    var urls = [];
    if(custom) urls.push(custom);
    urls = urls.concat(DEFAULT_TXT_CANDIDATES);

    for(var i=0;i<urls.length;i++){
      try{
        var r = await fetchText(urls[i]);
        var parsed = parseWordlist(r.text);
        state.word2idx = parsed.word2idx;
        state.idx2word = parsed.idx2word;
        return true;
      }catch(e){
        // try next candidate
      }
    }
    state.word2idx = null;
    state.idx2word = null;
    return false;
  }

  function ensureWordlist(root){
    if(state.word2idx && state.idx2word) return Promise.resolve(true);
    if(state.loading) return state.loading;
    state.loading = loadWordlist(root).finally(function(){ state.loading = null; });
    return state.loading;
  }

  function splitMnemonic(input){
    var s = (input || "").trim();
    if(!s) return [];
    if(s.length > MAX_INPUT_CHARS) throw new Error("输入过长");
    var arr = s.split(/\s+/).map(normalizeWord).filter(Boolean);
    if(arr.length > MAX_TOKENS) throw new Error("词数过多");
    return arr;
  }

  function parseNumbers(input){
    var raw = (input || "").trim();
    if(!raw) return [];

    if(raw.length > MAX_INPUT_CHARS) throw new Error("输入过长");
    if(/[^0-9\s]/.test(raw)) throw new Error("只能输入数字和空格/换行");

    var hasSpace = /\s/.test(raw);
    var tokens;

    if(!hasSpace){
      var digits = raw;
      if(digits.length % 4 !== 0) throw new Error("无空格模式：长度必须是 4 的倍数");
      if(digits.length / 4 > MAX_TOKENS) throw new Error("数字组数过多");
      tokens = [];
      for(var i=0;i<digits.length;i+=4) tokens.push(digits.slice(i,i+4));
    }else{
      var parts = raw.split(/\s+/).filter(Boolean);
      if(parts.length > MAX_TOKENS) throw new Error("数字段过多");
      tokens = [];
      for(var p=0;p<parts.length;p++){
        var t = parts[p];
        if(t.length <= 4){
          tokens.push(pad4(t));
        }else{
          if(t.length % 4 !== 0) throw new Error("存在非法数字段：" + t);
          if(t.length / 4 + tokens.length > MAX_TOKENS) throw new Error("数字组数过多");
          for(var j=0;j<t.length;j+=4) tokens.push(t.slice(j,j+4));
        }
      }
    }

    var out = [];
    for(var k=0;k<tokens.length;k++){
      var chunk = tokens[k];
      if(!/^\d{4}$/.test(chunk)) throw new Error("存在非法数字段：" + chunk);
      var n = parseInt(chunk, 10);
      if(!(n >= 1 && n <= 2048)) throw new Error("超出范围（0001~2048）： " + chunk);
      out.push(chunk);
    }
    return out;
  }

  async function handleMn2Num(root){
    if(!state.word2idx || !state.idx2word){
      var ok = await ensureWordlist(root);
      if(!ok){ setStatus(root, "词表未就绪，无法转换。", "err"); return; }
    }
    var mnTa = $(root, '[data-field="mn"]');
    var numTa = $(root, '[data-field="num"]');

    var words;
    try{
      words = splitMnemonic(mnTa.value);
    }catch(e){
      numTa.value = "";
      setStatus(root, e.message || "解析失败。", "err");
      return;
    }

    if(words.length === 0){
      numTa.value = "";
      setStatus(root, "请输入助记词。", "err");
      return;
    }

    var missing = [];
    var nums = [];
    for(var i=0;i<words.length;i++){
      var w = words[i];
      var idx = state.word2idx.get(w);
      if(!idx) missing.push(w);
      else nums.push(pad4(idx));
    }

    if(missing.length){
      numTa.value = "";
      setStatus(root, "未识别：" + missing.slice(0,30).join(" ") + (missing.length>30 ? " ..." : ""), "err");
      return;
    }

    numTa.value = nums.join(" ");
    setStatus(root, "完成：共 " + nums.length + " 组。", "ok");
  }

  async function handleNum2Mn(root){
    if(!state.word2idx || !state.idx2word){
      var ok = await ensureWordlist(root);
      if(!ok){ setStatus(root, "词表未就绪，无法转换。", "err"); return; }
    }
    var mnTa = $(root, '[data-field="mn"]');
    var numTa = $(root, '[data-field="num"]');

    var chunks;
    try{
      chunks = parseNumbers(numTa.value);
    }catch(e){
      mnTa.value = "";
      setStatus(root, e.message || "数字解析失败。", "err");
      return;
    }

    if(chunks.length === 0){
      mnTa.value = "";
      setStatus(root, "请输入数字。", "err");
      return;
    }

    var words = [];
    for(var i=0;i<chunks.length;i++){
      var n = parseInt(chunks[i], 10);
      var w = state.idx2word[n];
      if(!w){
        mnTa.value = "";
        setStatus(root, "无法找到：" + chunks[i], "err");
        return;
      }
      words.push(w);
    }

    mnTa.value = words.join(" ");
    setStatus(root, "完成：共 " + words.length + " 词。", "ok");
  }

  async function copyToClipboard(text){
    // Prefer modern clipboard API; fallback to execCommand for older browsers.
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        await navigator.clipboard.writeText(text);
        return true;
      }
    }catch(e){}
    try{
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    }catch(e2){}
    return false;
  }

  async function copyField(root, field){
    var ta = $(root, '[data-field="' + field + '"]');
    var val = ta ? (ta.value || "") : "";
    if(!val){
      setStatus(root, "无内容可复制。", "err");
      return;
    }
    var ok = await copyToClipboard(val);
    setStatus(root, ok ? "已复制。" : "复制失败。", ok ? "ok" : "err");
  }

  function clearField(root, field){
    var ta = $(root, '[data-field="' + field + '"]');
    if(ta) ta.value = "";
    setStatus(root, "", "");
  }

  function bind(root){
    root.addEventListener("click", function(ev){
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-action]") : null;
      if(!btn || !root.contains(btn)) return;
      var act = btn.getAttribute("data-action");
      if(act === "mn2num") handleMn2Num(root);
      else if(act === "num2mn") handleNum2Mn(root);
      else if(act === "clear-mn") clearField(root, "mn");
      else if(act === "clear-num") clearField(root, "num");
      else if(act === "copy-mn") copyField(root, "mn");
      else if(act === "copy-num") copyField(root, "num");
    });

    // Ctrl/Cmd + Enter to convert
    root.addEventListener("keydown", function(ev){
      if(!(ev.ctrlKey || ev.metaKey)) return;
      if(ev.key !== "Enter") return;
      var ta = ev.target;
      if(!ta || !ta.getAttribute) return;
      var field = ta.getAttribute("data-field");
      if(field === "mn"){ ev.preventDefault(); handleMn2Num(root); }
      if(field === "num"){ ev.preventDefault(); handleNum2Mn(root); }
    });
  }

  function init(){
    var root = document.querySelector(ROOT_SEL);
    if(!root) return;
    bind(root);
    // silently pre-load
    ensureWordlist(root);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, { once: true });
  }else{
    init();
  }
})();
