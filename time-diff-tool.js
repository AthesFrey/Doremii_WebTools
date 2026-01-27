(function(){
  const $ = (id) => document.getElementById(id);

  const startEl = $("start");
  const endEl = $("end");
  const startNowBtn = $("startNow");
  const endNowBtn = $("endNow");
  const startFollow = $("startFollow");
  const endFollow = $("endFollow");
  const swapBtn = $("swap");
  const copyBtn = $("copy");

  const mainLine = $("mainLine");
  const subLine = $("subLine");
  const detailLine = $("detailLine");

  // Guard: if the tool is embedded on a page where elements are missing, do nothing.
  if(!startEl || !endEl || !startNowBtn || !endNowBtn || !swapBtn || !copyBtn || !mainLine || !subLine || !detailLine){
    return;
  }

  // Minor normalization: keep datetime-local at minute granularity and consistent sizing across platforms.
  try{
    startEl.step = 60;
    endEl.step = 60;

    // Fallback inline styles (wins over aggressive theme CSS if any sneaks in)
    [startEl, endEl].forEach((el)=>{ 
      el.style.fontSize = "16px";
      el.style.height = "44px";
      el.style.minHeight = "44px";
      el.style.lineHeight = "1.2";
    });
    [startNowBtn, endNowBtn, swapBtn, copyBtn].forEach((el)=>{
      el.style.height = "44px";
      el.style.minHeight = "44px";
      el.style.fontSize = "15px";
    });
  }catch(e){}

  let timer = null;

  function pad(n){ return String(n).padStart(2, "0"); }

  // 生成 datetime-local 的格式：YYYY-MM-DDTHH:mm
  function toLocalInputValue(d){
    const y = d.getFullYear();
    const m = pad(d.getMonth()+1);
    const da = pad(d.getDate());
    const h = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${y}-${m}-${da}T${h}:${mi}`;
  }

  // 更稳：手动解析为“本地时间”（避免少数环境 Date("YYYY-MM-DDTHH:mm") 的解析差异）
  function parseLocalInputValue(v){
    if(!v) return null;
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if(!m) return null;
    const year = +m[1], mon = +m[2], day = +m[3], hh = +m[4], mm = +m[5], ss = m[6] ? +m[6] : 0;
    const dt = new Date(year, mon - 1, day, hh, mm, ss, 0);
    if(Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  function setStartNow(){ startEl.value = toLocalInputValue(new Date()); }
  function setEndNow(){ endEl.value = toLocalInputValue(new Date()); }

  function updateFollowStates(){
    startEl.disabled = startFollow.checked;
    startNowBtn.disabled = startFollow.checked;

    endEl.disabled = endFollow.checked;
    endNowBtn.disabled = endFollow.checked;
  }

  function ensureTimer(){
    const need = startFollow.checked || endFollow.checked;
    if(need && !timer){
      timer = setInterval(()=>{
        const now = new Date();
        let changed = false;
        if(startFollow.checked){
          const v = toLocalInputValue(now);
          if(startEl.value !== v){ startEl.value = v; changed = true; }
        }
        if(endFollow.checked){
          const v = toLocalInputValue(now);
          if(endEl.value !== v){ endEl.value = v; changed = true; }
        }
        if(changed) calc();
      }, 1000);
    }else if(!need && timer){
      clearInterval(timer);
      timer = null;
    }
  }

  function humanDiff(ms){
    const sign = ms >= 0 ? 1 : -1;
    const abs = Math.abs(ms);

    const dayMs = 24 * 60 * 60 * 1000;
    const hourMs = 60 * 60 * 1000;

    const days = Math.floor(abs / dayMs);
    const hours = Math.floor((abs % dayMs) / hourMs);
    const totalHours = abs / hourMs;

    return { sign, days, hours, totalHours };
  }

  function setMainLine(status, days, hours, pillText, pillClass){
    // 清空并用 textContent 组装，避免 innerHTML
    mainLine.textContent = "";
    const s1 = document.createElement("span");
    s1.textContent = `${status}：`;
    mainLine.appendChild(s1);

    const dSpan = document.createElement("span");
    dSpan.className = "mono";
    dSpan.textContent = String(days);
    mainLine.appendChild(dSpan);

    mainLine.appendChild(document.createTextNode(" 天 "));

    const hSpan = document.createElement("span");
    hSpan.className = "mono";
    hSpan.textContent = String(hours);
    mainLine.appendChild(hSpan);

    mainLine.appendChild(document.createTextNode(" 小时"));

    const pill = document.createElement("span");
    pill.className = `pill ${pillClass}`;
    pill.textContent = pillText;
    mainLine.appendChild(pill);
  }

  function calc(){
    const s = parseLocalInputValue(startEl.value);
    const e = parseLocalInputValue(endEl.value);

    if(!s || !e){
      mainLine.textContent = "请先选择两个时刻";
      subLine.textContent = "";
      detailLine.textContent = "";
      return;
    }

    const diff = e.getTime() - s.getTime();
    const { sign, days, hours, totalHours } = humanDiff(diff);

    const status = sign >= 0 ? "剩余" : "已过";
    const pillClass = sign >= 0 ? "good" : "warn";
    const pillText = (diff === 0) ? "同一时刻" : (sign >= 0 ? "倒计时" : "已超时");

    setMainLine(status, days, hours, pillText, pillClass);

    subLine.textContent = `起点：${s.toLocaleString()} ｜ 终点：${e.toLocaleString()}`;
    detailLine.textContent = `总小时（绝对值）：${totalHours.toFixed(2)} h  ｜  原始差值：${diff} ms`;
  }

  // 事件
  startEl.addEventListener("input", calc);
  endEl.addEventListener("input", calc);

  startNowBtn.addEventListener("click", ()=>{ setStartNow(); calc(); });
  endNowBtn.addEventListener("click", ()=>{ setEndNow(); calc(); });

  startFollow.addEventListener("change", ()=>{
    updateFollowStates();
    ensureTimer();
    if(startFollow.checked) setStartNow();
    calc();
  });
  endFollow.addEventListener("change", ()=>{
    updateFollowStates();
    ensureTimer();
    if(endFollow.checked) setEndNow();
    calc();
  });

  swapBtn.addEventListener("click", ()=>{
    const sv = startEl.value;
    startEl.value = endEl.value;
    endEl.value = sv;
    calc();
  });

  copyBtn.addEventListener("click", async ()=>{
    const text = [
      mainLine.textContent || "",
      subLine.textContent || "",
      detailLine.textContent || ""
    ].filter(Boolean).join("\n");

    try{
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "已复制";
      setTimeout(()=>copyBtn.textContent="复制结果", 800);
    }catch(e){
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try{ document.execCommand("copy"); }catch(_){}
      document.body.removeChild(ta);
      copyBtn.textContent = "已复制";
      setTimeout(()=>copyBtn.textContent="复制结果", 800);
    }
  });

  // 默认初始化：两端都给当前时刻
  setStartNow();
  setEndNow();
  updateFollowStates();
  ensureTimer();
  calc();
})();