(() => {
  "use strict";

  const CFG = window.DOREMII_DICT || {};

  // ====== Online APIs ======
  const onlineCfg = CFG.online || {};
  const DICTDEV_ENABLED = onlineCfg.dictionaryApiDevEnabled !== false; // Free Dictionary API (dictionaryapi.dev)
  const MYMEMORY_ENABLED = onlineCfg.myMemoryEnabled !== false;         // MyMemory Translate (free)

  // Merriam-Webster（可选在线，旧的 api 翻译/释义）
  const mwCfg = CFG.mw || {};
  const MW_ENABLED = mwCfg.enabled !== false;
  const MW_PROXY = mwCfg.proxyUrl || "";
  const MW_DIRECT_KEY = mwCfg.directKey || "";

  const LS_PREFIX = "doremii_dict_v2:";
  const LS_MODE = LS_PREFIX + "mode";
  const LS_HISTORY = LS_PREFIX + "history";

  let mode = localStorage.getItem(LS_MODE) || (CFG.defaultMode || "en2zh");
  if (mode !== "en2zh" && mode !== "zh2en") mode = "en2zh";

  // 挂载面板
  let mountEl = null;


  // ====== utils ======
  function esc(s){
    return String(s || "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function normTerm(term, dir){
    let t = (term || "").trim();
    // 去标点
    t = t.replace(/^[\s"'“”‘’()（）【】\[\]{}<>《》.,!?;:，。！？；：]+/g, "");
    t = t.replace(/[\s"'“”‘’()（）【】\[\]{}<>《》.,!?;:，。！？；：]+$/g, "");
    if (t.length > 80) t = t.slice(0, 80);
    if (dir === "en2zh") t = t.toLowerCase();
    return t;
  }

  function isEnglishLike(w){
    return /^[A-Za-z][A-Za-z'\-]*$/.test(w);
  }

  function uniq(arr){
    const seen = new Set();
    const out = [];
    for (const x of arr || []) {
      const k = String(x || "").trim();
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
    return out;
  }

  function injectExtraStyles(){
    if (document.getElementById("doremiiDictExtraStyle")) return;
    const s = document.createElement("style");
    s.id = "doremiiDictExtraStyle";
    s.textContent = `
      .dd-pron{ margin-top:6px; font-size:12px; opacity:.9; }
      .dd-kv{ margin-top:8px; }
      .dd-kv .k{ font-size:12px; color: var(--dd-muted); }
      .dd-kv .v{ margin-top:4px; }
      .dd-audio{ display:inline-flex; align-items:center; gap:6px; margin-right:10px; }
      .doremii-dict-app.dd-compact .dd-body{ grid-template-columns: 1fr !important; }
      /* 输入框右侧清除按钮（X） */
      .dd-input-wrap{ position:relative; z-index:0; flex:1; min-width:0; align-self:stretch; display:flex; }
      .dd-input-wrap .dd-input{ position:relative; z-index:1; flex:1; width:100%; height:100%; padding-right:34px; box-sizing:border-box; }
      .dd-clear{
        position:absolute; right:8px; top:0; bottom:0; margin:auto 0; transform:none;
        z-index:9999; touch-action:manipulation; -webkit-tap-highlight-color: transparent; user-select:none; pointer-events:auto;
        width:24px; height:24px; border-radius:12px;
        border:1px solid var(--dd-border, rgba(0,0,0,.18));
        background: var(--dd-card, var(--dd-bg, #fff));
        color: var(--dd-muted, #666);
        cursor:pointer;
        display:none; align-items:center; justify-content:center;
        line-height:1; padding:0;
      }
      .dd-input-wrap.has-text .dd-clear{ display:flex; }
      @media (hover: hover) and (pointer: fine){
        .dd-clear:hover{ color: var(--dd-text, #111); }
      }

    `;
    document.head.appendChild(s);
  }

  // ====== 右侧弹卡片 ======
  function ensureCard(){
    let el = document.getElementById("doremiiDictCard");
    if (el) return el;

    el = document.createElement("div");
    el.id = "doremiiDictCard";
    el.innerHTML = `
      <div class="hd">
        <div>
          <div class="title" data-dd="word">—</div>
          <div class="sub"><span data-dd="hint"></span></div>
        </div>
        <button class="close" type="button" data-dd="close">×</button>
      </div>
      <div class="bd" data-dd="body">
        <div class="dd-muted">在面板输入并回车查询。</div>
      </div>
    `;
    document.body.appendChild(el);
    el.querySelector('[data-dd="close"]').addEventListener("click", () => el.classList.remove("dd-open"));
    return el;
  }

  function openCard(word){
    const el = ensureCard();
    el.querySelector('[data-dd="word"]').textContent = word || "—";
    const hint = (mode === "en2zh" ? "英→中" : "中→英") + "（在线）"
      + (DICTDEV_ENABLED ? " + IPA" : "")
      + (MYMEMORY_ENABLED ? " + 翻译" : "")
      + (MW_ENABLED ? " + MW" : "");
    el.querySelector('[data-dd="hint"]').textContent = hint;
    el.classList.add("dd-open");
  }

  function setCardHTML(html){
    const el = ensureCard();
    el.querySelector('[data-dd="body"]').innerHTML = html;
  }

  // ====== localStorage：历史 ======
  function loadHistory(){
    try{
      const x = JSON.parse(localStorage.getItem(LS_HISTORY) || "[]");
      return Array.isArray(x) ? x : [];
    }catch{ return []; }
  }
  function saveHistory(arr){
    localStorage.setItem(LS_HISTORY, JSON.stringify(arr.slice(0, 200)));
  }
  function pushHistory(term){
    const h = loadHistory();
    const t = term.trim();
    const idx = h.indexOf(t);
    if (idx >= 0) h.splice(idx,1);
    h.unshift(t);
    saveHistory(h);
  }

  // ====== API: Free Dictionary API（dictionaryapi.dev） ======
  async function dictDevLookup(term){
    if (!DICTDEV_ENABLED) return null;
    if (mode !== "en2zh") return null;
    if (!isEnglishLike(term)) return null;

    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return { ok:false, error:`HTTP ${r.status}` };

    const data = await r.json();
    if (!Array.isArray(data)) {
      // 可能是 { title: "No Definitions Found", ... }
      return { ok:false, error: (data && (data.message || data.title)) ? String(data.message || data.title) : "No result" };
    }

    const phoneticsText = [];
    const audios = [];
    const meanings = [];

    for (const ent of data) {
      if (ent && typeof ent.phonetic === "string") phoneticsText.push(ent.phonetic);
      if (Array.isArray(ent?.phonetics)) {
        for (const p of ent.phonetics) {
          if (p?.text) phoneticsText.push(String(p.text));
          if (p?.audio) audios.push(String(p.audio));
        }
      }
      if (Array.isArray(ent?.meanings)) {
        for (const m of ent.meanings) {
          const pos = m?.partOfSpeech ? String(m.partOfSpeech) : "";
          const defs = Array.isArray(m?.definitions) ? m.definitions : [];
          const ds = defs
            .map(d => (d && typeof d.definition === "string") ? d.definition.trim() : "")
            .filter(Boolean)
            .slice(0, 3);
          if (pos || ds.length) meanings.push({ pos, defs: ds });
        }
      }
    }

    return {
      ok: true,
      phonetics: uniq(phoneticsText).slice(0, 6),
      audios: uniq(audios).slice(0, 2),
      meanings: meanings.slice(0, 6)
    };
  }

  // ====== API: MyMemory Translate（免费） ======
  async function myMemoryTranslate(text, dir){
    if (!MYMEMORY_ENABLED) return null;
    const langpair = (dir === "en2zh") ? "en|zh-CN" : "zh-CN|en";
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return { ok:false, error:`HTTP ${r.status}` };

    const data = await r.json();
    const translatedText = data?.responseData?.translatedText ? String(data.responseData.translatedText) : "";
    const matchesRaw = Array.isArray(data?.matches) ? data.matches : [];
    const matches = matchesRaw
      .filter(m => m && typeof m.translation === "string")
      .sort((a,b) => (Number(b.match||0) - Number(a.match||0)))
      .slice(0, 8)
      .map(m => ({
        translation: String(m.translation || "").trim(),
        segment: String(m.segment || "").trim(),
        match: Number(m.match||0)
      }))
      .filter(m => m.translation);

    return { ok:true, translatedText, matches };
  }

  // ====== Merriam-Webster（可选在线） ======
  async function mwLookup(term){
    if (!MW_ENABLED) return null;
    if (mode !== "en2zh") return null;
    if (!isEnglishLike(term)) return null;

    // 1) 走 proxy（推荐）
    if (MW_PROXY) {
      const u = new URL(MW_PROXY, window.location.href);
      u.searchParams.set("word", term);
      const r = await fetch(u.toString(), { cache: "no-store" });
      if (!r.ok) return { ok:false, error: `proxy HTTP ${r.status}` };
      return await r.json();
    }

    // 2) 前端直连（不安全 + 可能 CORS）
    if (MW_DIRECT_KEY) {
      const url = `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(term)}?key=${encodeURIComponent(MW_DIRECT_KEY)}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return { ok:false, error: `MW HTTP ${r.status}` };
      const data = await r.json();
      if (Array.isArray(data) && typeof data[0] === "string") {
        return { ok:true, type:"suggestions", suggestions: data };
      }
      const entries = (Array.isArray(data) ? data : []).filter(x=>x && typeof x === "object" && x.meta);
      return {
        ok:true,
        type:"entries",
        entries: entries.slice(0, 3).map(e=>({
          headword: (e.hwi && e.hwi.hw) ? String(e.hwi.hw).replace(/\*/g,"") : term,
          fl: e.fl || "",
          shortdef: e.shortdef || []
        }))
      };
    }

    return null;
  }

  
  function buildIPAHtml(ipa){
    if (!ipa || !ipa.ok) {
      if (ipa && ipa.ok === false) {
        return `<div class="dd-muted">IPA：${esc(ipa.error || "请求失败")}</div>`;
      }
      return "";
    }

    const phonetics = (ipa.phonetics || []).map(x=>esc(x));
    const audios = (ipa.audios || []).map(x=>esc(x));

    let html = `<div class="dd-muted">英文音标（Free Dictionary API / dictionaryapi.dev）</div>`;
    if (phonetics.length) {
      html += `<div class="dd-pron">${phonetics.join(" / ")}</div>`;
    }
    if (audios.length) {
      html += `<div class="dd-kv"><div class="k">发音：</div><div class="v">${
        audios.map(a => `<span class="dd-audio"><audio controls preload="none" src="${a}"></audio></span>`).join("")
      }</div></div>`;
    }

    if (Array.isArray(ipa.meanings) && ipa.meanings.length) {
      html += `<div class="dd-kv"><div class="k">释义（英文，节选）：</div><div class="v">`;
      for (const m of ipa.meanings) {
        html += `<div style="margin-top:6px;">
          <span class="dd-tag">${esc(m.pos || "")}</span>
          ${Array.isArray(m.defs) && m.defs.length ? `<ul>${m.defs.map(d=>`<li>${esc(d)}</li>`).join("")}</ul>` : ""}
        </div>`;
      }
      html += `</div></div>`;
    }

    return html;
  }

  function buildTranslateHtml(tr){
    if (!tr) return "";
    if (!tr.ok) return `<div class="dd-muted">翻译：${esc(tr.error || "请求失败")}</div>`;

    let html = `<div class="dd-muted">在线翻译（MyMemory）</div>`;
    if (tr.translatedText) {
      html += `<div style="margin-top:6px;"><b>${esc(tr.translatedText)}</b></div>`;
    }
    const matches = (tr.matches || []).filter(m => m.translation && m.translation !== tr.translatedText);
    if (matches.length) {
      html += `<div class="dd-muted" style="margin-top:8px;">其他结果：</div>
        <ul>${matches.slice(0, 6).map(m => `<li>${esc(m.translation)}</li>`).join("")}</ul>`;
    }
    return html;
  }

  function buildMWHtml(mw, t){
    if (!mw) return "";
    if (!mw.ok) return `<div class="dd-muted">MW：${esc(mw.error||"请求失败")}</div>`;

    if (mw.type === "suggestions") {
      return `<div class="dd-muted">MW 拼写建议：</div>
        <div style="margin-top:6px;">${(mw.suggestions||[]).slice(0,10).map(s=>`<a href="#" data-dd-sug="${esc(s)}" style="margin-right:8px;">${esc(s)}</a>`).join("")}</div>`;
    }

    if (mw.type === "entries") {
      let html = `<div class="dd-muted">Merriam-Webster</div>`;
      for (const e of (mw.entries||[])) {
        html += `<div class="dd-card" style="margin-top:8px;">
          <div class="dd-row"><b>${esc(e.headword||t)}</b><span class="dd-muted">${esc(e.fl||"")}</span></div>
          ${Array.isArray(e.shortdef)&&e.shortdef.length ? `<ul>${e.shortdef.map(d=>`<li>${esc(d)}</li>`).join("")}</ul>` : `<div class="dd-muted">无 shortdef</div>`}
        </div>`;
      }
      return html;
    }

    return `<div class="dd-muted">MW：未知返回</div>`;
  }

  async function lookupAndShow(term){
    const raw = (term || "").trim();
    if (!raw) return;

    const t = normTerm(raw, mode);
    if (!t) return;

    openCard(raw);
    setCardHTML(`<div class="dd-muted">查询中…</div>`);

    try{
      pushHistory(raw);

      // 并发请求
      const [ipa, tr, mw] = await Promise.all([
        dictDevLookup(t),
        myMemoryTranslate(raw, mode),
        mwLookup(t),
      ]);

      let html = `
        <div class="dd-card">
          <div class="dd-row">
            <button class="dd-mini-btn" data-dd-open="1">📒 打开面板</button>
            <button class="dd-mini-btn" data-dd-toggle="1">切换 ${mode==="en2zh"?"中→英":"英→中"}</button>
          </div>
        </div>
      `;

      // 先展示 IPA（用户要求：在旧的 api 翻译前面加上）
      const ipaHtml = buildIPAHtml(ipa);
      if (ipaHtml) {
        html += `<div class="hr"></div><div class="dd-card">${ipaHtml}</div>`;
      }

      // 再展示翻译
      const trHtml = buildTranslateHtml(tr);
      if (trHtml) {
        html += `<div class="hr"></div><div class="dd-card">${trHtml}</div>`;
      }

      // 最后 MW
      const mwHtml = buildMWHtml(mw, t);
      if (mwHtml) {
        html += `<div class="hr"></div>${mwHtml.startsWith('<div class="dd-card"') ? mwHtml : `<div class="dd-card">${mwHtml}</div>`}`;
      }

      setCardHTML(html);

      // bind card actions
      const card = ensureCard();
      card.querySelectorAll("[data-dd-sug]").forEach(a=>{
        a.addEventListener("click",(e)=>{
          e.preventDefault();
          const w = a.getAttribute("data-dd-sug");
          if (w) lookupAndShow(w);
        });
      });

      const tog = card.querySelector("[data-dd-toggle]");
      if (tog) tog.addEventListener("click", ()=>{
        mode = (mode === "en2zh") ? "zh2en" : "en2zh";
        localStorage.setItem(LS_MODE, mode);
        renderTopbar();
        lookupAndShow(raw);
      });

      const open = card.querySelector("[data-dd-open]");
      if (open) open.addEventListener("click", ()=>{
        if (mountEl) mountEl.scrollIntoView({behavior:"smooth", block:"center"});
      });

      // 同步面板输入框
      const inp = mountEl?.querySelector("#ddQuery");
      if (inp) {
        inp.value = raw;
        updateClearBtn();
      }

      // 刷新历史（如果面板已打开）
      renderHistory();

    } catch(err){
      setCardHTML(`<div class="dd-muted">查询失败：${esc(err?.message || String(err))}</div>`);
    }
  }

  // ====== 面板 UI ======
  function renderTopbar(){
    if (!mountEl) return;
    const btn = mountEl.querySelector("#ddModeBtn");
    if (btn) btn.textContent = mode === "en2zh" ? "英→中" : "中→英";
  }


  function updateClearBtn(){
    if (!mountEl) return;
    const inp = mountEl.querySelector("#ddQuery");
    const wrap = mountEl.querySelector("#ddInputWrap");
    if (!inp || !wrap) return;
    if (inp.value && inp.value.length) wrap.classList.add("has-text");
    else wrap.classList.remove("has-text");
  }

  function renderHistory(){
    if (!mountEl) return;
    const listEl = mountEl.querySelector("#ddHistory");
    const h = loadHistory();
    if (!h.length) {
      listEl.innerHTML = `<div class="dd-muted">暂无历史。</div>`;
      return;
    }
    listEl.innerHTML = h.slice(0, 80).map(t=>`
      <div class="dd-item">
        <div class="dd-row">
          <b>${esc(t)}</b>
          <button class="dd-mini-btn" data-h-go="${esc(t)}">查</button>
        </div>
      </div>
    `).join("");
    listEl.querySelectorAll("[data-h-go]").forEach(b=>{
      b.addEventListener("click", ()=> lookupAndShow(b.getAttribute("data-h-go")));
    });

    const clearBtn = mountEl.querySelector("#ddHistoryClear");
    if (clearBtn) clearBtn.onclick = ()=>{
      saveHistory([]);
      renderHistory();
    };
  }

  function buildPanel(){
    if (!CFG.mount) return;
    mountEl = (typeof CFG.mount === "string") ? document.querySelector(CFG.mount) : CFG.mount;
    if (!mountEl) return;

    mountEl.classList.add("doremii-dict-app");

    // Windows 桌面端：把面板整体限制在 520px 内（手机端不受影响）
    try{
      const ua = navigator.userAgent || "";
      if (/Windows/i.test(ua)) {
        mountEl.classList.add("dd-win");
        mountEl.classList.add("dd-compact");
        mountEl.style.width = "100%";
        mountEl.style.maxWidth = "520px";
        mountEl.style.margin = "0 auto";
      }
      injectExtraStyles();
    }catch{}


    mountEl.innerHTML = `
      <div class="dd-topbar">
        <div class="dd-title">在线中英词典</div>
        <div class="dd-controls">
          <button class="dd-btn" id="ddModeBtn"></button>
        </div>
      </div>

      <div class="dd-search">
        <div class="dd-input-wrap" id="ddInputWrap">
          <input class="dd-input" id="ddQuery" placeholder="输入单词/中文，回车查询" />
          <button class="dd-clear" id="ddClear" type="button" aria-label="清除">×</button>
        </div>
        <button class="dd-btn" id="ddGo" type="button">查询</button>
      </div>

      <div class="dd-body">
        <div class="dd-pane">
          <div class="dd-card">
            <div class="dd-row">
              <b>历史</b>
              <button class="dd-btn" id="ddHistoryRefresh">刷新</button>
              <button class="dd-btn" id="ddHistoryClear">清空</button>
            </div>
            <div class="dd-list" id="ddHistory"></div>
          </div>
        </div>
      </div>
    `;

    renderTopbar();
    renderHistory();

    // 输入框右侧清除按钮（X）
    const inp = mountEl.querySelector("#ddQuery");
    const wrap = mountEl.querySelector("#ddInputWrap");
    const clearBtn = mountEl.querySelector("#ddClear");
    if (inp && wrap && clearBtn) {
      inp.addEventListener("input", updateClearBtn);
            const swallow = (e)=>{ try{ e.preventDefault(); e.stopPropagation(); }catch(_){ } };
      // 让点击清除按钮不触发输入框失焦/外层点击逻辑，避免“抖动/多点才生效”
      clearBtn.addEventListener("pointerdown", swallow);
      clearBtn.addEventListener("mousedown", swallow);

      clearBtn.addEventListener("click", (e)=>{
        swallow(e);
        inp.value = "";
        updateClearBtn();
        inp.focus();
      });
      updateClearBtn();
    }

    mountEl.querySelector("#ddModeBtn").addEventListener("click", ()=>{
      mode = (mode === "en2zh") ? "zh2en" : "en2zh";
      localStorage.setItem(LS_MODE, mode);
      renderTopbar();
    });

    mountEl.querySelector("#ddGo").addEventListener("click", ()=>{
      const q = mountEl.querySelector("#ddQuery").value.trim();
      if (q) lookupAndShow(q);
    });

    mountEl.querySelector("#ddQuery").addEventListener("keydown",(e)=>{
      if (e.key === "Enter"){
        const q = mountEl.querySelector("#ddQuery").value.trim();
        if (q) lookupAndShow(q);
      }
    });
    mountEl.querySelector("#ddHistoryRefresh").addEventListener("click", renderHistory);
  }

  // ====== init ======
  function init(){
    buildPanel();  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
