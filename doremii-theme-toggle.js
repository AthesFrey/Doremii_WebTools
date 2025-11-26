(() => {
  const KEY = 'doremii_theme'; // 'light' | 'dark' | null(=auto)
  const root = document.documentElement;

  const prefersDark = () =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  function getSaved(){
    const v = localStorage.getItem(KEY);
    return (v === 'light' || v === 'dark') ? v : null;
  }

  function apply(mode){
    // mode: 'light' | 'dark' | null(auto)
    if (!mode) {
      root.dataset.theme = prefersDark() ? 'dark' : '';
      return;
    }
    root.dataset.theme = (mode === 'dark') ? 'dark' : '';
  }

  function setMode(mode){
    if (!mode) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
    apply(mode);
    updateBtn();
  }

  function currentEffective(){
    return root.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function updateBtn(){
    const btn = document.getElementById('doremiiThemeToggle');
    if (!btn) return;
    const eff = currentEffective();
    btn.querySelector('.icon').textContent = (eff === 'dark') ? '🌙' : '☀️';
    btn.querySelector('.label').textContent = (eff === 'dark') ? 'Dark' : 'Light';
  }

  function mountButton(){
    if (document.getElementById('doremiiThemeToggle')) return;

    const btn = document.createElement('div');
    btn.id = 'doremiiThemeToggle';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', 'Toggle theme');

    btn.innerHTML = `<span class="icon">☀️</span><span class="label">Light</span>`;
    btn.addEventListener('click', () => {
      const next = (currentEffective() === 'dark') ? 'light' : 'dark';
      setMode(next);
    });

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
  if (mq && mq.addEventListener) {
    mq.addEventListener('change', () => {
      if (!getSaved()) apply(null);
      updateBtn();
    });
  }

  // 可选：给你调试用
  window.DOREMII_THEME = { setMode, getSaved };
})();
