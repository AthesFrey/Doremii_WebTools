(function () {
  'use strict';

  // 兜底：如果页面未提前对齐主题，这里再对齐一次（不影响已存在的 data-theme）
  (function syncThemeOnce(){
    try{
      if(!document.documentElement.dataset.theme){
        const t = localStorage.getItem('doremiiTheme');
        if(t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
      }
    }catch(e){}
  })();

  function init() {
    const canvas = document.getElementById('ce2-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const diameterInput = document.getElementById('ce2-diameter');
    const distanceInput = document.getElementById('ce2-distance');
    const offsetInput   = document.getElementById('ce2-offset');
    const colorSelect   = document.getElementById('ce2-colorPair');
    const swapCheckbox  = document.getElementById('ce2-swap');
    const resetBtn      = document.getElementById('ce2-reset');

    const readmeBtn     = document.getElementById('ce2-readme');
    const readmeOverlay = document.getElementById('ce2-readme-overlay');
    const readmeClose   = document.getElementById('ce2-readme-close');

    const colorPairs = [
      { left: '#ff9900', right: '#0000ff' }, // Orange / blue
      { left: '#ff0000', right: '#00ffff' }, // Red / cyan
      { left: '#ffd800', right: '#8000ff' }, // Yellow / purple
      { left: '#00aa00', right: '#ff66aa' }, // Green / pink
      { left: '#0000ff', right: '#ff0000' }  // Blue / red
    ];

    const defaults = {
      diameter: 200,
      distance: 260,
      offset:   0,
      colorIdx: 0,
      swapped:  false
    };

    function currentColors() {
      const idx = parseInt(colorSelect.value, 10) || 0;
      const pair = colorPairs[idx] || colorPairs[0];
      if (swapCheckbox.checked) {
        return { left: pair.right, right: pair.left };
      }
      return { left: pair.left, right: pair.right };
    }

    function drawCircleWithVerticalGap(cx, cy, radius, fillColor) {
      const gap = radius * 0.33;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = fillColor;
      ctx.fillRect(cx - radius - 2, cy - radius - 2, radius * 2 + 4, radius * 2 + 4);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - gap / 2, cy - radius - 4, gap, radius * 2 + 8);

      ctx.restore();
    }

    function drawCircleWithHorizontalGap(cx, cy, radius, fillColor) {
      const gap = radius * 0.33;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = fillColor;
      ctx.fillRect(cx - radius - 2, cy - radius - 2, radius * 2 + 4, radius * 2 + 4);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - radius - 4, cy - gap / 2, radius * 2 + 8, gap);

      ctx.restore();
    }

    function draw() {
      const diameter = parseInt(diameterInput.value, 10);
      const distance = parseInt(distanceInput.value, 10);
      const offset   = parseInt(offsetInput.value, 10);

      const radius = diameter / 2;

      const colors = currentColors();
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      const maxDistance = canvas.width - 2 * radius - 60;
      const d = Math.min(Math.max(distance, 100), maxDistance);

      const leftX  = cx - d / 2;
      const rightX = cx + d / 2;
      const leftY  = cy - offset / 2;
      const rightY = cy + offset / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 画布背景跟随主题：从 CSS 变量读取底色
      const bg = getComputedStyle(document.documentElement)
        .getPropertyValue('--ce2-canvas-bg')
        .trim() || '#ffffff';

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawCircleWithVerticalGap(leftX,  leftY,  radius, colors.left);
      drawCircleWithHorizontalGap(rightX, rightY, radius, colors.right);
    }

    function attachEvents() {
      const inputs = [
        diameterInput,
        distanceInput,
        offsetInput,
        colorSelect,
        swapCheckbox
      ];

      inputs.forEach(el => {
        el.addEventListener('input', draw);
        el.addEventListener('change', draw);
      });

      resetBtn.addEventListener('click', function () {
        diameterInput.value = defaults.diameter;
        distanceInput.value = defaults.distance;
        offsetInput.value   = defaults.offset;
        colorSelect.value   = String(defaults.colorIdx);
        swapCheckbox.checked = defaults.swapped;
        draw();
      });

      // Readme 相关事件
      function openReadme() {
        readmeOverlay.classList.add('active');
      }

      function closeReadme() {
        readmeOverlay.classList.remove('active');
      }

      readmeBtn.addEventListener('click', openReadme);
      readmeClose.addEventListener('click', closeReadme);

      // 点击遮罩空白处关闭
      readmeOverlay.addEventListener('click', function (e) {
        if (e.target === readmeOverlay) {
          closeReadme();
        }
      });

      // ESC 键关闭
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          closeReadme();
        }
      });

      // 主题切换时立刻重画画布
      new MutationObserver(() => draw()).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
      });
    }

    // 初始化默认值
    diameterInput.value = defaults.diameter;
    distanceInput.value = defaults.distance;
    offsetInput.value   = defaults.offset;
    colorSelect.value   = String(defaults.colorIdx);
    swapCheckbox.checked = defaults.swapped;

    attachEvents();
    draw();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
