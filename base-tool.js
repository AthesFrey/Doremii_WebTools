/* base-tool.js  v20251218B
 * 给所有 doremii-* 组件提供：
 * 1) shadow root + 统一渲染骨架
 * 2) 通用主题CSS（吃你在HTML里写的CSS变量）
 */
(function () {
  'use strict';

  class BaseTool extends HTMLElement {
    constructor() {
      super();
      this.root = this.attachShadow({ mode: 'open' });
      this.render();
      this.applyAccentAttr();
    }

    // 子类应覆盖：tpl() 返回内部HTML（不需要写<style>）
    tpl() { return ''; }

    baseCSS() {
      return `
<style>
  :host{
    display:block;
    color: var(--text, #1B5E20);
    font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;

    /* 默认主题（你在HTML里写的 --xxx 会覆盖这些默认值） */
    --accent: var(--accent, #4CAF50);
    --bg: var(--bg, #F6FFF8);
    --card-bg: var(--card-bg, #E8F5E9);
    --card-border: var(--card-border, #A5D6A7);
    --button-bg: var(--button-bg, var(--accent));
    --button-fg: var(--button-fg, #ffffff);
    --result-bg: var(--result-bg, #FFB74D);
    --result-fg: var(--result-fg, #3E2723);
    --hist-bg: var(--hist-bg, #F1F8E9);

    --radius: 16px;
    --shadow: 0 10px 26px rgba(0,0,0,.08);
  }

  *, *::before, *::after { box-sizing: border-box; }

  .tool-wrap{
    background: var(--bg);
    border-radius: calc(var(--radius) + 2px);
    padding: 10px;
  }

  .tool-card{
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 12px;
  }

  .row{
    display:flex;
    align-items:center;
    gap:10px;
    flex-wrap:wrap;
  }

  textarea, input, button{
    font-size: 16px; /* iOS 防止自动放大 */
  }

  textarea, input{
    width: 100%;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(0,0,0,.12);
    background: rgba(255,255,255,.85);
    color: var(--text, #1B5E20);
    outline: none;
  }

  textarea:focus, input:focus{
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(76,175,80,.18);
  }

  button{
    appearance:none;
    border: 1px solid rgba(0,0,0,.10);
    background: var(--button-bg);
    color: var(--button-fg);
    padding: 8px 12px;
    border-radius: 12px;
    font-weight: 700;
    cursor: pointer;
    user-select: none;
  }

  button:hover{ filter: brightness(0.98); }
  button:active{ transform: translateY(1px); }

  .result{
    margin-top: 10px;
    background: var(--result-bg);
    color: var(--result-fg);
    border-radius: 14px;
    padding: 10px 12px;
    border: 1px dashed rgba(0,0,0,.20);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .hist{
    margin-top: 10px;
    background: var(--hist-bg);
    border-radius: 14px;
    padding: 10px 12px;
    border: 1px solid rgba(0,0,0,.10);
  }
</style>`;
    }

    render() {
      const body = (typeof this.tpl === 'function') ? this.tpl() : '';
      this.root.innerHTML = `
        ${this.baseCSS()}
        <div class="tool-wrap">
          <div class="tool-card">
            ${body}
          </div>
          <div class="result"></div>
          <div class="hist"></div>
        </div>
      `;
    }

    applyAccentAttr() {
      const acc = this.getAttribute('accent');
      if (acc) {
        // 只设置 --accent，不强行覆盖你手写的 --button-bg
        this.style.setProperty('--accent', acc);
      }
    }

    static get observedAttributes() { return ['accent']; }
    attributeChangedCallback(name) {
      if (name === 'accent') this.applyAccentAttr();
    }
  }

  window.BaseTool = BaseTool;
})();
