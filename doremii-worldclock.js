/* Doremii World Clock / 世界时间联动换算器
 * External JS version v2025-12-04a
 * - Soft per-timezone colors (no harsh red/purple/black)
 * - Conservative changes: add Dubai + Berlin
 * - Bugfix: do NOT auto-overwrite datetime-local input if user/restored value exists or input focused
 */
(() => {
  "use strict";

  const STYLE_ID = "doremii-worldclock-style";
  const WIDGET_CLASS = "doremii-worldclock";

  // Soft palette (avoid big red/purple/black)
  const ZONE_COLORS = {
    london: "#5C7FA3",  // steel blue
    berlin: "#6A8C7C",  // muted green-gray
    utc:    "#6B7280",  // muted gray
    beijing:"#B8942E",  // muted amber
    dubai:  "#9A8F6A",  // soft sand / taupe
    tokyo:  "#4C9A6A",  // muted green
    ny:     "#3F7FBF",  // muted blue
    chi:    "#3D8F8B",  // muted teal
    den:    "#7A8F3A",  // olive
    la:     "#3BA6B5",  // soft cyan-teal
    ak:     "#607AA8",  // blue gray
    hi:     "#B58A52"   // sand
  };

  const ZONES = [
    { key: "london", label: "London（伦敦）", tz: "Europe/London", brief: "冬季多为 GMT(UTC+0)，夏季为 BST(UTC+1)" },
    { key: "berlin", label: "Berlin（柏林）", tz: "Europe/Berlin", brief: "德国时间：冬令时 CET(UTC+1)，夏令时 CEST(UTC+2)" },
    { key: "utc",    label: "UTC（协调世界时）", tz: "Etc/UTC", brief: "全球时间基准；不实行夏令时" },
    { key: "beijing",label: "Beijing（北京时间）", tz: "Asia/Shanghai", brief: "CST(中国标准时间) = UTC+8；不实行夏令时" },
    { key: "dubai",  label: "Dubai（迪拜）", tz: "Asia/Dubai", brief: "海湾标准时间 GST = UTC+4；不实行夏令时" },
    { key: "tokyo",  label: "Tokyo（东京）", tz: "Asia/Tokyo", brief: "JST = UTC+9；不实行夏令时" },
    { key: "ny",     label: "US Eastern（纽约）", tz: "America/New_York", brief: "ET：冬令时 EST(UTC-5)，夏令时 EDT(UTC-4)" },
    { key: "chi",    label: "US Central（芝加哥）", tz: "America/Chicago", brief: "CT：CST(UTC-6)/CDT(UTC-5)" },
    { key: "den",    label: "US Mountain（丹佛）", tz: "America/Denver", brief: "MT：MST(UTC-7)/MDT(UTC-6)" },
    { key: "la",     label: "US Pacific（洛杉矶）", tz: "America/Los_Angeles", brief: "PT：PST(UTC-8)/PDT(UTC-7)" },
    { key: "ak",     label: "US Alaska（安克雷奇）", tz: "America/Anchorage", brief: "AKT：AKST(UTC-9)/AKDT(UTC-8)" },
    { key: "hi",     label: "US Hawaii（檀香山）", tz: "Pacific/Honolulu", brief: "HST = UTC-10；不实行夏令时" }
  ];

  function injectStyleOnce() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${WIDGET_CLASS}{
        --dw-bg:#ffffff;
        --dw-text:#111827;
        --dw-muted:#6b7280;
        --dw-border:rgba(15, 23, 42, .12);
        --dw-soft:rgba(2,6,23,.04);
        --dw-radius:18px;
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,"Apple Color Emoji","Segoe UI Emoji";
        color:var(--dw-text);
      }
      .${WIDGET_CLASS} *{box-sizing:border-box;}
      .dw-card{
        width:min(900px,100%);
        margin:16px auto;
        border:1px solid var(--dw-border);
        border-radius:var(--dw-radius);
        background:var(--dw-bg);
        box-shadow:0 14px 40px rgba(2,6,23,.08);
        overflow:hidden;
      }
      .dw-head{
        padding:14px 16px;
        background:linear-gradient(180deg,var(--dw-soft),transparent);
        border-bottom:1px solid var(--dw-border);
        display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap;
      }
      .dw-title{display:flex; gap:10px; align-items:baseline; flex-wrap:wrap;}
      .dw-title h3{margin:0;font-size:16px;letter-spacing:.2px;}
      .dw-badge{
        font-size:12px; padding:4px 10px; border-radius:999px;
        border:1px solid var(--dw-border); background:rgba(255,255,255,.7); color:var(--dw-muted);
      }
      .dw-mini{font-size:11px;color:var(--dw-muted); margin-left:6px;}
      .dw-actions{display:flex; gap:8px; align-items:center; flex-wrap:wrap;}
      .dw-btn{
        appearance:none; border:1px solid var(--dw-border); background:#fff;
        padding:8px 10px; border-radius:12px; cursor:pointer;
        font-size:13px; color:var(--dw-text);
        box-shadow:0 6px 16px rgba(2,6,23,.06);
      }
      .dw-btn:hover{transform:translateY(-1px);}
      .dw-btn:active{transform:translateY(0px);}
      .dw-btn.dw-primary{background:rgba(2,6,23,.03);}
      .dw-body{padding:12px 12px 6px;}
      .dw-grid{display:grid; grid-template-columns:1.3fr 1.1fr 1.2fr; gap:10px;}
      @media (max-width:760px){.dw-grid{grid-template-columns:1fr;}}
      .dw-row{
        border:1px solid var(--dw-border);
        border-radius:16px;
        padding:12px;
        background:#fff;
        position:relative;
        overflow:hidden;
      }
      .dw-row::before{
        content:"";
        position:absolute;
        left:0; top:0; bottom:0;
        width:6px;
        background:var(--z-strip, rgba(17,24,39,.2));
      }
      .dw-meta .dw-label{font-weight:650; font-size:14px; margin-bottom:4px;}
      .dw-meta .dw-sub{font-size:12px; color:var(--dw-muted); line-height:1.35;}
      .dw-kbd{
        border:1px solid var(--dw-border);
        background:rgba(255,255,255,.75);
        padding:1px 6px; border-radius:8px;
        font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
        font-size:11px;
      }
      .dw-time{display:flex; flex-direction:column; gap:6px; justify-content:center;}
      .dw-time .dw-clock{
        font-variant-numeric: tabular-nums;
        font-size:22px; font-weight:750; line-height:1.05;
        color:var(--z-clock, var(--dw-text));
        background:var(--z-hl, transparent);
        border-radius:12px;
        padding:6px 10px;
        width:fit-content;
      }
      .dw-time .dw-date{font-variant-numeric:tabular-nums; font-size:12px; color:var(--dw-muted);}
      .dw-input{display:flex; flex-direction:column; gap:8px; justify-content:center;}
      .dw-input label{font-size:12px; color:var(--dw-muted);}
      .dw-inputbox{display:flex; gap:8px; align-items:center;}
      .dw-input input[type="datetime-local"]{
        width:100%;
        border:1px solid var(--dw-border);
        padding:10px 10px;
        border-radius:12px;
        font-size:13px;
        background:#fff;
      }
      .dw-foot{
        padding:10px 14px 14px;
        color:var(--dw-muted);
        font-size:12px;
        line-height:1.5;
      }
      .dw-warn{
        margin-top:8px;
        margin-left:12px;
        margin-right:12px;
        padding:10px 12px;
        border-radius:12px;
        border:1px dashed rgba(15,23,42,.18);
        background:rgba(2,6,23,.03);
        color:var(--dw-text);
        display:none;
      }
      .dw-warn.show{display:block;}
    `;
    document.head.appendChild(style);
  }

  function pad2(n){ return String(n).padStart(2,"0"); }

  function parseDTLocalValue(v){
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v || "");
    if (!m) return null;
    return { y:+m[1], mo:+m[2], d:+m[3], h:+m[4], mi:+m[5], s: m[6] ? +m[6] : 0 };
  }

  function partsFromIntl(tz, utcMillis){
    const cache = partsFromIntl._cache ??= new Map();
    let f = cache.get(tz);
    if (!f){
      f = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year:"numeric", month:"2-digit", day:"2-digit",
        hour:"2-digit", minute:"2-digit", second:"2-digit",
        hourCycle:"h23"
      });
      cache.set(tz, f);
    }
    const parts = f.formatToParts(new Date(utcMillis));
    const out = {};
    for (const p of parts) out[p.type] = p.value;
    return { y:+out.year, mo:+out.month, d:+out.day, h:+out.hour, mi:+out.minute, s:+out.second };
  }

  function tzNameFromIntl(tz, utcMillis){
    const cache = tzNameFromIntl._cache ??= new Map();
    let f = cache.get(tz);
    if (!f){
      f = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour:"2-digit", minute:"2-digit",
        timeZoneName:"short",
        hourCycle:"h23"
      });
      cache.set(tz, f);
    }
    const parts = f.formatToParts(new Date(utcMillis));
    const tzp = parts.find(p => p.type === "timeZoneName");
    return tzp ? tzp.value : "";
  }

  function offsetMinutesAt(tz, utcMillis){
    const p = partsFromIntl(tz, utcMillis);
    const wallAsUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
    return Math.round((wallAsUTC - utcMillis) / 60000);
  }

  function formatOffset(mins){
    const sign = mins >= 0 ? "+" : "-";
    const a = Math.abs(mins);
    const hh = Math.floor(a / 60);
    const mm = a % 60;
    return `UTC${sign}${pad2(hh)}:${pad2(mm)}`;
  }

  function toDTLocalString(p){
    return `${p.y}-${pad2(p.mo)}-${pad2(p.d)}T${pad2(p.h)}:${pad2(p.mi)}`;
  }

  function sameToMinute(a,b){
    return a && b &&
      a.y===b.y && a.mo===b.mo && a.d===b.d &&
      a.h===b.h && a.mi===b.mi;
  }

  // Convert local time in a given TZ -> UTC millis, handling DST overlaps/gaps conservatively
  function utcMillisFromZonedInput(tz, dtLocalValue){
    const want = parseDTLocalValue(dtLocalValue);
    if (!want) return { ok:false, utc: NaN, adjusted:false, reason:"输入格式不对" };

    const wallAsUTC = Date.UTC(want.y, want.mo - 1, want.d, want.h, want.mi, want.s || 0);

    let utc = wallAsUTC;
    for (let i=0;i<4;i++){
      const off = offsetMinutesAt(tz, utc);
      utc = wallAsUTC - off * 60000;
    }

    const got = partsFromIntl(tz, utc);
    if (sameToMinute(got, want)) return { ok:true, utc, adjusted:false, reason:"" };

    // search around ±180 minutes for exact match
    let best = null;
    for (let d=0; d<=180; d++){
      for (const sgn of (d===0 ? [0] : [-1, +1])){
        const cand = utc + sgn*d*60000;
        const p = partsFromIntl(tz, cand);
        if (sameToMinute(p, want)) { best = cand; break; }
      }
      if (best !== null) break;
    }
    if (best !== null){
      return { ok:true, utc: best, adjusted:true, reason:"该时刻可能处于夏令时重叠/跳变，已自动选择最接近的有效时刻。" };
    }

    // No exact match: choose the next valid time (DST gap)
    const num = (x)=> (x.y*100000000 + x.mo*1000000 + x.d*10000 + x.h*100 + x.mi);
    const wantNum = num(want);
    for (let d=0; d<=360; d++){
      const cand = utc + d*60000;
      const p = partsFromIntl(tz, cand);
      if (num(p) >= wantNum){
        return { ok:true, utc: cand, adjusted:true, reason:"该时刻可能是夏令时“缺失时段”（不存在的本地时间），已自动跳到下一段有效时间。" };
      }
    }

    return { ok:true, utc, adjusted:true, reason:"已尽力换算（可能遇到夏令时特殊情况），请以显示结果为准。" };
  }

  function hexToRgb(hex){
    const h = (hex || "").trim();
    const m = /^#?([0-9a-f]{6})$/i.exec(h);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  }
  function rgba(hex, a){
    const c = hexToRgb(hex);
    if (!c) return `rgba(17,24,39,${a})`;
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  }

  class WorldClock {
    constructor(el){
      this.el = el;

      if (!(window.Intl && Intl.DateTimeFormat)){
        el.textContent = "你的浏览器不支持 Intl.DateTimeFormat，无法进行时区换算。建议升级浏览器。";
        return;
      }

      this.state = { live: true, baseUtc: Date.now() };
      this._timer = null;
      this._rows = new Map();

      this.render();
      this.setLive(true);
    }

    resetUserLocks(){
      // allow inputs to follow the display again
      for (const b of this._rows.values()){
        if (b && b.input){
          delete b.input.dataset.user;
        }
      }
    }

    render(){
      const card = document.createElement("div");
      card.className = "dw-card";

      const head = document.createElement("div");
      head.className = "dw-head";
      head.innerHTML = `
        <div class="dw-title">
          <h3>国际时间 / 世界时钟（联动换算）</h3>
          <span class="dw-badge" data-mode>模式：跟随现在</span>
          <span class="dw-mini">提示：改任意一行时间 → 点“以此为基准”</span>
        </div>
        <div class="dw-actions">
          <button class="dw-btn dw-primary" data-now>回到现在（Live）</button>
          <button class="dw-btn" data-copy>复制当前基准 UTC</button>
        </div>
      `;

      const body = document.createElement("div");
      body.className = "dw-body";
      const grid = document.createElement("div");
      grid.className = "dw-grid";

      for (const z of ZONES){
        const row = document.createElement("div");
        row.className = "dw-row";
        row.dataset.zone = z.key;

        const color = ZONE_COLORS[z.key] || "#6B7280";
        row.style.setProperty("--z-strip", rgba(color, 0.55));
        row.style.setProperty("--z-hl", rgba(color, 0.10));
        row.style.setProperty("--z-clock", rgba(color, 0.85));

        row.innerHTML = `
          <div class="dw-meta">
            <div class="dw-label">${z.label}</div>
            <div class="dw-sub">
              <div>IANA：<span class="dw-kbd">${z.tz}</span></div>
              <div>${z.brief}</div>
              <div>缩写：<span class="dw-kbd" data-abbr>--</span>　偏移：<span class="dw-kbd" data-off>--</span></div>
            </div>
          </div>

          <div class="dw-time">
            <div class="dw-clock" data-clock>--:--:--</div>
            <div class="dw-date" data-date>----</div>
          </div>

          <div class="dw-input">
            <label>调整此时区时间（datetime-local）</label>
            <div class="dw-inputbox">
              <input type="datetime-local" data-input />
              <button class="dw-btn" data-set>以此为基准</button>
            </div>
          </div>
        `;

        const bind = {
          zone: z,
          clock: row.querySelector("[data-clock]"),
          date: row.querySelector("[data-date]"),
          abbr: row.querySelector("[data-abbr]"),
          off:  row.querySelector("[data-off]"),
          input: row.querySelector("[data-input]"),
          setBtn: row.querySelector("[data-set]")
        };

        // mark as user-touched so refresh() won't overwrite the input
        const markUser = () => { bind.input.dataset.user = "1"; };
        bind.input.addEventListener("focus", markUser);
        bind.input.addEventListener("input", markUser);
        bind.input.addEventListener("change", markUser);

        bind.setBtn.addEventListener("click", () => this.applyFromRow(bind));
        bind.input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") this.applyFromRow(bind);
        });

        this._rows.set(z.key, bind);
        grid.appendChild(row);
      }

      body.appendChild(grid);

      const warn = document.createElement("div");
      warn.className = "dw-warn";
      warn.setAttribute("data-warn", "1");

      const foot = document.createElement("div");
      foot.className = "dw-foot";
      foot.innerHTML = `
        <div><b>缩写对照（易混点）</b>：UTC≈GMT（概念略不同，但日常可近似当同一基准）；</div>
        <div>PT=美国太平洋：冬 <span class="dw-kbd">PST</span>(UTC-8)，夏 <span class="dw-kbd">PDT</span>(UTC-7)；</div>
        <div>ET=美国东部：冬 <span class="dw-kbd">EST</span>(UTC-5)，夏 <span class="dw-kbd">EDT</span>(UTC-4)；</div>
        <div><span class="dw-kbd">CST</span> 很歧义：既可能指北京(CST=UTC+8)，也可能指美国中部冬令时(CST=UTC-6)。建议用 IANA 时区名避免误会。</div>
      `;

      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(warn);
      card.appendChild(foot);

      this.el.innerHTML = "";
      this.el.appendChild(card);

      this.modeBadge = this.el.querySelector("[data-mode]");
      this.warnBox = this.el.querySelector("[data-warn]");

      // IMPORTANT: reset locks when user explicitly returns to Live
      this.el.querySelector("[data-now]").addEventListener("click", () => {
        this.resetUserLocks();
        this.setLive(true);
      });

      this.el.querySelector("[data-copy]").addEventListener("click", () => this.copyBaseUtc());
    }

    flashWarn(msg){
      if (!msg){
        this.warnBox.classList.remove("show");
        this.warnBox.textContent = "";
        return;
      }
      this.warnBox.textContent = msg;
      this.warnBox.classList.add("show");
      clearTimeout(this._warnTimer);
      this._warnTimer = setTimeout(() => {
        this.warnBox.classList.remove("show");
      }, 5200);
    }

    setLive(on){
      this.state.live = !!on;
      if (this._timer) clearInterval(this._timer);

      if (this.state.live){
        this.modeBadge.textContent = "模式：跟随现在";
        this._timer = setInterval(() => {
          this.state.baseUtc = Date.now();
          this.refresh();
        }, 1000);
        this.state.baseUtc = Date.now();
        this.refresh();
      } else {
        this.modeBadge.textContent = "模式：自定义时间（暂停走秒）";
        this.refresh();
      }
    }

    applyFromRow(bind){
      const v = bind.input.value;
      if (!v){
        this.flashWarn("请输入时间后再点“以此为基准”。");
        return;
      }
      const res = utcMillisFromZonedInput(bind.zone.tz, v);
      if (!res.ok || !Number.isFinite(res.utc)){
        this.flashWarn("无法解析该时间输入，请检查格式。");
        return;
      }

      // When applying a base, we want everyone to follow that base again
      this.resetUserLocks();

      this.state.baseUtc = res.utc;
      this.setLive(false);
      if (res.adjusted) this.flashWarn(res.reason);
      else this.flashWarn("");
      this.refresh();
    }

    copyBaseUtc(){
      const iso = new Date(this.state.baseUtc).toISOString();
      const text = `UTC ISO: ${iso}`;
      const ok = (msg) => this.flashWarn(msg);

      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text)
          .then(() => ok(`已复制：${text}`))
          .catch(() => this.fallbackCopy(text));
      } else {
        this.fallbackCopy(text);
      }
    }

    fallbackCopy(text){
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
      this.flashWarn(`已复制：${text}`);
    }

    refresh(){
      const base = this.state.baseUtc;

      for (const bind of this._rows.values()){
        const tz = bind.zone.tz;
        const p  = partsFromIntl(tz, base);
        const ab = tzNameFromIntl(tz, base);
        const off = offsetMinutesAt(tz, base);

        bind.clock.textContent = `${pad2(p.h)}:${pad2(p.mi)}:${pad2(p.s)}`;
        bind.date.textContent  = `${p.y}-${pad2(p.mo)}-${pad2(p.d)}`;
        bind.abbr.textContent  = ab || "--";
        bind.off.textContent   = formatOffset(off);

        // ---- BUGFIX CORE ----
        // If input already has a value that differs from the auto value (e.g., browser restored),
        // treat it as user value and DO NOT overwrite.
        const dtLocal = toDTLocalString(p);
        const inp = bind.input;

        if (inp.value && inp.dataset.user !== "1" && inp.value !== dtLocal) {
          inp.dataset.user = "1";
        }

        // Only sync the input when it's not focused and not user-locked
        if (document.activeElement !== inp && inp.dataset.user !== "1") {
          if (inp.value !== dtLocal) inp.value = dtLocal;
        }
      }
    }
  }

  function initAll(){
    injectStyleOnce();
    document.querySelectorAll(`.${WIDGET_CLASS}`).forEach(el => {
      if (el.__doremiiWorldClockInited) return;
      el.__doremiiWorldClockInited = true;
      new WorldClock(el);
    });
  }

  window.DoremiiWorldClock = window.DoremiiWorldClock || { init: initAll };

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
