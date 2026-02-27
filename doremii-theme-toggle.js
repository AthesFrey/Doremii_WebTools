// doremii-theme-toggle.js (patched)
// 目标：在 iOS/内置浏览器（localStorage 可能被禁用或抛异常）也能稳定切换；并修复 icon/label 空指针。

(() => {
  'use strict';

  const KEY = 'doremii_theme'; // 'light' | 'dark' | null(=auto)
  const root = document.documentElement;

  const prefersDark = () => {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (_) {
      return false;
    }
  };

  // ---------- storage: localStorage -> cookie fallback ----------
  function cookieGet(name) {
    const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function cookieSet(name, value, maxAgeSeconds) {
    const maxAge = typeof maxAgeSeconds === 'number' ? `; Max-Age=${maxAgeSeconds}` : '';
    document.cookie = `${name}=${encodeURIComponent(value)}${maxAge}; Path=/; SameSite=Lax`;
  }
  function cookieDel(name) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  }

  function lsGet(k) {
    try { return window.localStorage.getItem(k); } catch (_) { return null; }
  }
  function lsSet(k, v) {
    try { window.localStorage.setItem(k, v); return true; } catch (_) { return false; }
  }
  function lsRemove(k) {
    try { window.localStorage.removeItem(k); return true; } catch (_) { return false; }
  }

  function readSavedRaw() {
    // 优先 localStorage；失败时退到 cookie
    const v = lsGet(KEY);
    if (v != null) return v;
    return cookieGet(KEY);
  }
  function writeSavedRaw(v) {
    // 先写 localStorage；失败时写 cookie（1 年）
    if (!lsSet(KEY, v)) cookieSet(KEY, v, 60 * 60 * 24 * 365);
  }
  function removeSavedRaw() {
    const ok = lsRemove(KEY);
    cookieDel(KEY);
    return ok;
  }

  function getSaved() {
    const v = readSavedRaw();
    return (v === 'light' || v === 'dark') ? v : null;
  }

  // ---------- apply ----------
  function apply(mode) {
    // mode: 'light' | 'dark' | null(auto)
    const t = mode ? mode : (prefersDark() ? 'dark' : 'light');
    root.dataset.theme = t;
    if (document.body) document.body.dataset.theme = t; // 兼容只看 body 的模块
  }

  function currentEffective() {
    return root.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  // ---------- UI ----------
  function updateBtn() {
    const btn = document.getElementById('doremiiThemeToggle');
    if (!btn) return;
    const eff = currentEffective();
    const icon = btn.querySelector('.icon');
    const label = btn.querySelector('.label');
    if (icon) icon.textContent = (eff === 'dark') ? '🌙' : '☀️';
    if (label) label.textContent = (eff === 'dark') ? 'Dark' : 'Light';
    btn.setAttribute('data-theme', eff);
  }

  function setMode(mode) {
    if (!mode) removeSavedRaw();
    else writeSavedRaw(mode);
    apply(mode);
    updateBtn();
  }

  function mountButton() {
    if (!document.body) return;
    if (document.getElementById('doremiiThemeToggle')) {
      updateBtn();
      return;
    }
    const btn = document.createElement('button');
    btn.id = 'doremiiThemeToggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle theme');
    btn.innerHTML = `<span class="icon" aria-hidden="true">☀️</span><span class="label">Light</span>`;
    btn.addEventListener('click', () => {
      const next = (currentEffective() === 'dark') ? 'light' : 'dark';
      setMode(next);
    }, { passive: true });
    document.body.appendChild(btn);
    updateBtn();
  }

  // 1) 初次应用：优先使用用户记忆，否则跟随系统
  apply(getSaved());

  // 2) DOM ready 后挂按钮
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountButton, { once: true });
  } else {
    mountButton();
  }

  // 3) 系统主题变化：只有“未保存选择(=auto)”才跟随
  const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (mq) {
    const onChange = () => {
      if (!getSaved()) apply(null);
      updateBtn();
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange); // iOS Safari 老版本回退
  }

  // 调试接口
  window.DOREMII_THEME = { setMode, getSaved };
})();

