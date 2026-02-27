/* doremii-theme-toggle.js (v2) — mobile-safe theme toggle
 * - 不新增 css/php 文件
 * - 只负责设置 html/body 的 data-theme（light/dark）并提供按钮切换
 * - 存储优先 localStorage，失败则回退 cookie（兼容部分移动端/内嵌 WebView）
 * - iOS Safari bfcache（返回页面）会重新应用主题
 * - 按住按钮约 0.5s：恢复“跟随系统”
 */

(() => {
  const KEY_V2 = 'doremii_theme_mode_v2'; // 'light' | 'dark' | ''(system)
  const KEY_OLD = 'doremii_theme';
  const COOKIE_KEY = 'doremii_theme';
  const root = document.documentElement;

  // ---------------- storage (localStorage -> cookie -> memory) ----------------
  const mem = { mode: '' };

  function storageOK() {
    try {
      const k = '__doremii__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }
  const canLS = storageOK();

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + escapeRe(name) + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function setCookie(name, value, maxAgeSec = 31536000) {
    const v = encodeURIComponent(value);
    document.cookie = `${name}=${v}; Max-Age=${maxAgeSec}; Path=/; SameSite=Lax`;
  }
  function delCookie(name) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  }

  function normalize(v) {
    return v === 'light' || v === 'dark' ? v : '';
  }

  function readSaved() {
    let v = '';

    // v2
    if (canLS) {
      try {
        v = window.localStorage.getItem(KEY_V2) || '';
      } catch {
        v = '';
      }
    }
    v = normalize(v);

    // migrate old -> v2 (一次性)
    if (!v && canLS) {
      try {
        const old = normalize(window.localStorage.getItem(KEY_OLD) || '');
        if (old) {
          window.localStorage.setItem(KEY_V2, old);
          window.localStorage.removeItem(KEY_OLD);
          v = old;
        }
      } catch {
        // ignore
      }
    }

    // cookie fallback
    if (!v) v = normalize(getCookie(COOKIE_KEY));

    // memory fallback
    if (!v && mem.mode) v = mem.mode;

    return v; // '' = system
  }

  function writeSaved(v) {
    v = normalize(v); // '' = system
    mem.mode = v;

    if (canLS) {
      try {
        if (v) window.localStorage.setItem(KEY_V2, v);
        else window.localStorage.removeItem(KEY_V2);
      } catch {
        // ignore
      }
    }

    if (v) setCookie(COOKIE_KEY, v);
    else delCookie(COOKIE_KEY);
  }

  // ---------------- theme apply ----------------
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const prefersDark = () => (mq ? mq.matches : false);

  function effective(mode) {
    return mode ? mode : prefersDark() ? 'dark' : 'light';
  }

  function setDOMTheme(theme) {
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
    // 让表单控件/滚动条跟随
    root.style.colorScheme = theme;

    if (document.body) {
      document.body.dataset.theme = theme;
      document.body.classList.toggle('dark', theme === 'dark');
      document.body.style.colorScheme = theme;
    }
  }

  function apply(mode) {
    setDOMTheme(effective(mode));
  }

  // ---------------- UI ----------------
  function ensureButton() {
    let btn = document.getElementById('doremiiThemeToggle');
    if (btn) return btn;

    btn = document.createElement('button');
    btn.id = 'doremiiThemeToggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle theme');
    btn.innerHTML = `<span class="icon" aria-hidden="true"></span><span class="label"></span>`;

    // 不依赖额外 CSS 也能用（如果已有 doremii-theme-toggle.css，会覆盖成更好看的样式）
    btn.style.position = 'fixed';
    // Fallback positioning for older mobile / embedded WebViews.
    btn.style.right = '16px';
    btn.style.top = '16px';
    btn.style.zIndex = '2147483647';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '6px';
    btn.style.padding = '8px 10px';
    btn.style.borderRadius = '10px';
    btn.style.border = '1px solid rgba(0,0,0,.18)';
    btn.style.background = 'rgba(255,255,255,.75)';
    btn.style.backdropFilter = 'blur(10px)';
    btn.style.font = '13px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,"Microsoft YaHei",sans-serif';
    btn.style.cursor = 'pointer';
    btn.style.userSelect = 'none';
    btn.style.touchAction = 'manipulation';
    btn.style.webkitTapHighlightColor = 'transparent';

    document.body.appendChild(btn);
    return btn;
  }

  function updateButton(mode = readSaved()) {
    const btn = document.getElementById('doremiiThemeToggle');
    if (!btn) return;

    const theme = effective(mode);
    const icon = btn.querySelector('.icon');
    const label = btn.querySelector('.label');

    if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    if (label) {
      // mode=='' 时显示 Auto，方便你确认“跟随系统”生效
      label.textContent = mode ? (theme === 'dark' ? 'Dark' : 'Light') : (theme === 'dark' ? 'Auto·Dark' : 'Auto·Light');
    }

    btn.setAttribute('data-mode', mode || 'system');
    btn.setAttribute('data-theme', theme);

    // 若页面没加载你的 CSS，这里简单适配暗色
    if (!document.querySelector('link[href*="doremii-theme-toggle"],style#doremii-theme-toggle-style')) {
      btn.style.borderColor = theme === 'dark' ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)';
      btn.style.background = theme === 'dark' ? 'rgba(17,26,46,.75)' : 'rgba(255,255,255,.75)';
      btn.style.color = theme === 'dark' ? '#e5e7eb' : '#111827';
    }
  }

  function setMode(mode) {
    mode = normalize(mode); // '' = system
    writeSaved(mode);
    apply(mode);
    updateButton(mode);
  }

  function toggleLightDark() {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    setMode(next);
  }

  function bindButton(btn) {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';

    // 长按 (~0.5s) => 跟随系统（相当于“重置”）
    let timer = null;
    let longFired = false;

    const clear = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const start = () => {
      longFired = false;
      clear();
      timer = setTimeout(() => {
        longFired = true;
        setMode('');
      }, 520);
    };

    const end = (ev) => {
      clear();
      if (longFired) return;
      toggleLightDark();
      if (ev && ev.preventDefault) ev.preventDefault();
    };

    // iOS：Pointer Events 稳定；否则回退 touch/click
    if (window.PointerEvent) {
      btn.addEventListener('pointerdown', start, { passive: true });
      btn.addEventListener('pointerup', end);
      btn.addEventListener('pointercancel', clear);
    } else {
      btn.addEventListener('touchstart', start, { passive: true });
      btn.addEventListener('touchend', end);
      btn.addEventListener('touchcancel', clear);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleLightDark();
      });
    }

    // 避免长按弹出系统菜单打断
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function mount() {
    if (!document.body) return;
    const btn = ensureButton();
    bindButton(btn);
    updateButton();
  }

  // ---------------- lifecycle ----------------
  const initMode = readSaved();
  apply(initMode); // 尽早应用，减少闪烁

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }

  // 系统主题变化：仅当“未保存选择(=system)”时跟随
  if (mq) {
    const onChange = () => {
      if (!readSaved()) {
        apply('');
        updateButton('');
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange); // 兼容旧 iOS
  }

  // iOS Safari bfcache：返回页面时重新应用（解决“偶现失效/状态不同步”）
  window.addEventListener('pageshow', () => {
    const m = readSaved();
    apply(m);
    updateButton(m);
  });

  // Debug
  window.DOREMII_THEME = { setMode, getMode: readSaved };
})();

