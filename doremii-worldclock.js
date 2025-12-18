/* Doremii World Clock / 世界时间联动换算器
 * External JS version v2025-12-18a
 * - Soft per-timezone colors (no harsh red/purple/black)
 * - Conservative changes: add Dubai + Berlin
 * - Bugfix: do NOT auto-overwrite datetime-local input if user/restored value exists or input focused
 * - Android: replace datetime-local with date + time inputs to avoid tall input box
 */
(() => {
  "use strict";

  const STYLE_ID = "doremii-worldclock-style";
  const WIDGET_CLASS = "doremii-worldclock";

  const IS_ANDROID = /Android/i.test(navigator.userAgent);

  // Soft palette (avoid big red/purple/black)
  const ZONE_COLORS = {
    london: "#5C7FA3",  // steel blue
    berlin: "#6A8C7C",  // muted green-gray
    utc:    "#6B7280",  // muted gray
    beijing:"#B8942E",  // muted amber
    cairo:  "#A97952",  // warm sand / bronze
    moscow: "#7A6FA8",  // muted purple-gray
    dubai:  "#9A8F6A",  // soft sand / taupe
    tokyo:  "#4C9A6A",  // muted green
    sydney: "#3E9AA2",  // soft teal
    ny:     "#3F7FBF",  // muted blue
    chi:    "#3D8F8B",  // muted teal
    den:    "#7A8F3A",  // olive
    la:     "#3BA6B5",  // soft cyan-teal
    ak:     "#607AA8",  // blue gray
    hi:     "#B58A52"   // sand
  };

  const ZONES = [
    { key: "london", label: "London（伦敦）", tz: "Europe/London", lon: 0.1278, brief: "冬季多为 GMT(UTC+0)，夏季为 BST(UTC+1)" },
    { key: "berlin", label: "Berlin（柏林）", tz: "Europe/Berlin", lon: 13.4050, brief: "德国时间：冬令时 CET(UTC+1)，夏令时 CEST(UTC+2)" },
    { key: "cairo",  label: "Cairo（开罗）", tz: "Africa/Cairo", lon: 31.2357, brief: "埃及时间：通常为 EET(UTC+2)，实行夏令时年份可能为 UTC+3（以当地政策为准）" },
    { key: "moscow", label: "Moscow（莫斯科）", tz: "Europe/Moscow", lon: 37.6173, brief: "MSK = UTC+3；目前不实行夏令时" },
    { key: "utc",    label: "UTC（协调世界时）", tz: "Etc/UTC", lon: 0.0000, brief: "全球时间基准；不实行夏令时" },
    { key: "beijing",label: "Beijing（北京时间）", tz: "Asia/Shanghai", lon: 116.4074, brief: "CST(中国标准时间) = UTC+8；不实行夏令时" },
    { key: "dubai",  label: "Dubai（迪拜）", tz: "Asia/Dubai", lon: 55.2708, brief: "海湾标准时间 GST = UTC+4；不实行夏令时" },
    { key: "tokyo",  label: "Tokyo（东京）", tz: "Asia/Tokyo", lon: 139.6917, brief: "JST = UTC+9；不实行夏令时" },
    { key: "sydney", label: "Sydney（悉尼）", tz: "Australia/Sydney", lon: 151.2093, brief: "澳大利亚东部：AEST(UTC+10)，夏令时 AEDT(UTC+11)" },
    { key: "ny",     label: "US Eastern（纽约）", tz: "America/New_York", lon: -74.0060, brief: "ET：冬令时 EST(UTC-5)，夏令时 EDT(UTC-4)" },
    { key: "chi",    label: "US Central（芝加哥）", tz: "America/Chicago", lon: -87.6298, brief: "CT：CST(UTC-6)/CDT(UTC-5)" },
    { key: "den",    label: "US Mountain（丹佛）", tz: "America/Denver", lon: -104.9903, brief: "MT：MST(UTC-7)/MDT(UTC-6)" },
    { key: "la",     label: "US Pacific（洛杉矶）", tz: "America/Los_Angeles", lon: -118.2437, brief: "PT：PST(UTC-8)/PDT(UTC-7)" },
    { key: "ak",     label: "US Alaska（安克雷奇）", tz: "America/Anchorage", lon: -149.9003, brief: "AKT：AKST(UTC-9)/AKDT(UTC-8)" },
    { key: "hi",     label: "US Hawaii（檀香山）", tz: "Pacific/Honolulu", lon: -157.8583, brief: "HST = UTC-10；不实行夏令时" }
  ];

  function lon360(lon){
    return (lon < 0) ? (lon + 360) : lon;
  }
  const ZONES_SORTED = ZONES.slice().sort((a,b)=>lon360(a.lon)-lon360(b.lon));

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
        --dw-dt-w:280px; /* datetime 输入框统一宽度基准 */
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,"Apple Color Emoji","Segoe UI Emoji";
        color:var(--dw-text);
        padding:0 12px; /* 手机/窄屏别贴边 */
      }
      .${WIDGET_CLASS} *{box-sizing:border-box;}
      .dw-card{
        width:calc(100vw - 24px);   /* 让卡片脱离主题窄容器，按视口变宽 */
        max-width:1200px;           /* 超宽屏别无限拉伸（更均衡的上限） */
        margin:16px 0;
        position:relative;
        left:50%;
        transform:translateX(-50%);
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
      .dw-grid{display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px;}
      @media (max-width:1024px){.dw-grid{grid-template-columns:1fr 1fr;}}
      @media (max-width:760px){.dw-grid{grid-template-columns:1fr;}}
      @media (max-width:420px){.dw-inputbox{flex-direction:column; align-items:stretch;} .dw-inputbox .dw-btn{width:100%;}}
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
      .dw-inputbox{display:flex; gap:8px; align-items:center; flex-wrap:nowrap;}
      .dw-inputbox .dw-btn{
        display:inline-flex; align-items:center; justify-content:center;
        padding:8px 16px;
        height:40px;
        min-width:118px;
        white-space:nowrap;
        line-height:1;
      }

      .dw-input input[type="datetime-local"]{
        flex:1 1 var(--dw-dt-w);
        width:100%;
        max-width:var(--dw-dt-w);
        min-width:0;
        border:1px solid var(--dw-border);
        padding:8px 10px;
        border-radius:12px;
        font-size:13px;
        background:#fff;
        height:40px;
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
      /* =========================================================
         ✅ Theme bridge: support global :root[data-theme="dark"]
         说明：本工具原CSS里有多处固定 #fff 背景（行卡片/按钮/输入框等），
         所以在暗色下看起来“不变”。这里用“追加覆盖”的方式，不改现有架构。
         ========================================================= */

      /* Android 上我们用 date + time 代替 datetime-local（原来没样式会显得突兀） */
      .dw-input input[type="date"],
      .dw-input input[type="time"]{
        flex:1 1 calc((var(--dw-dt-w) - 8px)/2);
        width:100%;
        max-width:calc((var(--dw-dt-w) - 8px)/2);
        min-width:0;
        border:1px solid var(--dw-border);
        padding:8px 10px;
        border-radius:12px;
        font-size:13px;
        background:#fff;
        height:40px;
      }

      :root[data-theme="dark"] .${WIDGET_CLASS}{
        color-scheme: dark;
        /* 尽量跟随你全站主题变量（如果存在），否则走 fallback */
        --dw-bg: rgba(255,255,255,.06);
        --dw-text: var(--d-text, #e5e7eb);
        --dw-muted: var(--d-muted, rgba(229,231,235,.72));
        --dw-border: var(--d-border, rgba(255,255,255,.14));
        --dw-soft: rgba(255,255,255,.04);
      }

      :root[data-theme="dark"] .${WIDGET_CLASS} .dw-row{
        background: rgba(255,255,255,.04);
        border-color: var(--dw-border);
      }

      :root[data-theme="dark"] .${WIDGET_CLASS} .dw-badge{
        background: rgba(255,255,255,.06);
        border-color: var(--dw-border);
        color: var(--dw-muted);
      }

      :root[data-theme="dark"] .${WIDGET_CLASS} .dw-btn{
        background: rgba(255,255,255,.06);
        border-color: var(--dw-border);
        color: var(--dw-text);
        box-shadow: 0 10px 22px rgba(0,0,0,.28);
      }
      :root[data-theme="dark"] .${WIDGET_CLASS} .dw-btn.dw-primary{
        background: rgba(255,255,255,.10);
      }

      :root[data-theme="dark"] .${WIDGET_CLASS} .dw-kbd{
        background: rgba(255,255,255,.06);
        border-color: var(--dw-border);
        color: var(--dw-text);
      }

      :root[data-theme="dark"] .${WIDGET_CLASS} .dw-input input[type="datetime-local"],
      :root[data-theme="dark"] .${WIDGET_CLASS} .dw-input input[type="date"],
      :root[data-theme="dark"] .${WIDGET_CLASS} .dw-input input[type="time"]{
        background: rgba(255,255,255,.06);
        border-color: var(--dw-border);
        color: var(--dw-text);
      }

      :root[data-theme="dark"] .${WIDGET_CLASS} .dw-warn{
        border-color: rgba(255,255,255,.18);
        background: rgba(255,255,255,.06);
        color: var(--dw-text);
      }
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
        if (b && b._lockEl){
          delete b._lockEl.dataset.user;
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

      for (const z of ZONES_SORTED){
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
            <label>调整此时区时间</label>
            <div class="dw-inputbox">
              <span data-inputslot></span>
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
          inputSlot: row.querySelector("[data-inputslot]"),
          setBtn: row.querySelector("[data-set]")
        };

        // Build time input(s): non-Android uses datetime-local, Android uses date + time
        const slot = bind.inputSlot;
        // clear slot (safety)
        while (slot.firstChild) slot.removeChild(slot.firstChild);

        if (!IS_ANDROID){
          const inp = document.createElement("input");
          inp.type = "datetime-local";
          inp.setAttribute("data-input", "");
          bind.input = inp;
          bind._inputs = [inp];
          bind._lockEl = inp;
          bind.getValue = () => inp.value;
          bind.setAuto = (dtLocal) => { inp.value = dtLocal; };
          slot.appendChild(inp);
        } else {
          const di = document.createElement("input");
          di.type = "date";
          di.setAttribute("data-input-date", "");

          const ti = document.createElement("input");
          ti.type = "time";
          ti.step = 60; // 1-minute
          ti.setAttribute("data-input-time", "");

          bind.dateInput = di;
          bind.timeInput = ti;
          bind._inputs = [di, ti];
          bind._lockEl = di; // store user-lock flag here
          bind.getValue = () => {
            if (!di.value) return "";
            return di.value + "T" + (ti.value || "00:00");
          };
          bind.setAuto = (dtLocal) => {
            const i = (dtLocal || "").indexOf("T");
            const d = i >= 0 ? dtLocal.slice(0, i) : "";
            const t = i >= 0 ? dtLocal.slice(i + 1) : "";
            if (d) di.value = d;
            if (t) ti.value = t;
          };

          slot.appendChild(di);
          slot.appendChild(ti);
        }

        // mark as user-touched so refresh() won't overwrite the input(s)
        const markUser = () => { bind._lockEl.dataset.user = "1"; };
        for (const inp of bind._inputs){
          inp.addEventListener("focus", markUser);
          inp.addEventListener("input", markUser);
          inp.addEventListener("change", markUser);
          inp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") this.applyFromRow(bind);
          });
        }

        bind.setBtn.addEventListener("click", () => this.applyFromRow(bind));

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
      const v = bind.getValue ? bind.getValue() : (bind.input ? bind.input.value : "");
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
        const lockEl = bind._lockEl;
        const curVal = bind.getValue ? bind.getValue() : (bind.input ? bind.input.value : "");

        // Detect "restored" values: only lock if there is a non-empty current value and it differs
        if (curVal && lockEl && lockEl.dataset.user !== "1" && curVal !== dtLocal) {
          lockEl.dataset.user = "1";
        }

        const focused = bind._inputs && bind._inputs.includes(document.activeElement);

        // Only sync the input(s) when none is focused and not user-locked
        if (!focused && lockEl && lockEl.dataset.user !== "1") {
          if (curVal !== dtLocal && bind.setAuto) bind.setAuto(dtLocal);
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
