// /wp-content/uploads/text-recorder.js
// DoreTextRecorder v20251116_lines_scrollfix + copy button

class DoreTextRecorder extends BaseTool {
  tpl() {
    return `
      <div class="row" style="justify-content:flex-end; margin-bottom:8px;">
        <button id="copyBtn">copy</button>
        <button id="fetchBtn">fetch_txt</button>
      </div>

      <div class="row">
        <textarea id="textArea" placeholder="在这里输入 / 粘贴内容……"></textarea>
      </div>

      <div class="row" style="justify-content:flex-end; margin-top:8px;">
        <button id="saveBtn">save</button>
      </div>
    `;
  }

  connectedCallback() {
    if (this.onReady) return;
    this.onReady = true;

    const $ = sel => this.root.querySelector(sel);
    const textArea = $('#textArea');
    const saveBtn  = $('#saveBtn');
    const fetchBtn = $('#fetchBtn');
    const copyBtn  = $('#copyBtn'); // 新增 copy 按钮引用

    // 后端 API 地址
    const API_URL = '/wp-content/uploads/text-recorder-tool.php';

    // 隐藏 BaseTool 默认的 result / hist 区域
    const hideIfExists = (el) => {
      if (!el) return;
      el.textContent     = '';
      el.style.display   = 'none';
      el.style.padding   = '0';
      el.style.border    = 'none';
      el.style.margin    = '0';
      el.style.minHeight = '0';
    };
    hideIfExists(this.root.querySelector('.result'));
    hideIfExists(this.root.querySelector('.hist'));

    // 文本框相关设置
    const MAX_HEIGHT = 10000;    // 最高高度 px
    const MAX_LINES  = 10000;    // 最大行数

    let baseHeight = null;       // 默认正方形高度
    let lastValue  = textArea.value || ''; // 上一次合法内容
    let lineLimitAlertShown = false;       // 是否已经提示过“行数太多”

    const getLineCount = (str) =>
      str.length === 0 ? 1 : str.split(/\r\n|\r|\n/).length;

    // 文本框基础样式
    textArea.style.width      = '100%';
    textArea.style.boxSizing  = 'border-box';
    textArea.style.wordWrap   = 'break-word';
    textArea.style.whiteSpace = 'pre-wrap';
    textArea.style.overflowY  = 'hidden';
    textArea.style.resize     = 'none';

    // 默认正方形：高度 = 宽度
    const setInitialSquare = () => {
      const rect = textArea.getBoundingClientRect();
      let w = rect.width || textArea.clientWidth || 425;
      if (!w || w <= 0) w = 425;
      baseHeight = w;
      textArea.style.height = w + 'px';
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(setInitialSquare);
    } else {
      setTimeout(setInitialSquare, 0);
    }

    // 自动高度调整（不小于 baseHeight，不大于 MAX_HEIGHT）
    function autoResize() {
      if (!baseHeight) {
        const rect = textArea.getBoundingClientRect();
        let w = rect.width || textArea.clientWidth || 425;
        if (!w || w <= 0) w = 425;
        baseHeight = w;
      }

      // 让浏览器根据内容重新计算 scrollHeight
      textArea.style.height = 'auto';
      let h = textArea.scrollHeight;

      if (h > MAX_HEIGHT) h = MAX_HEIGHT;
      if (h < baseHeight) h = baseHeight;

      textArea.style.height = h + 'px';

      // 内容高度大于可见高度才允许内部滚动
      const canScroll = textArea.scrollHeight > textArea.clientHeight + 1;
      textArea.style.overflowY = canScroll ? 'auto' : 'hidden';
    }

    // 输入事件：限制行数 + 自动高度 + 保持页面滚动条不动
    textArea.addEventListener('input', () => {
      // 记录当前页面滚动位置
      const prevX = window.scrollX || window.pageXOffset || 0;
      const prevY = window.scrollY || window.pageYOffset || 0;

      const value     = textArea.value;
      const lineCount = getLineCount(value);

      if (lineCount > MAX_LINES) {
        // 超出行数上限：恢复到上一次合法内容
        textArea.value = lastValue;

        if (!lineLimitAlertShown) {
          alert('内容行数已达到 10,000 行，无法继续输入。');
          lineLimitAlertShown = true;
        }
        // 不更新 lastValue，保持为最后一次合法内容
      } else {
        lastValue = value;
        lineLimitAlertShown = false;
      }

      autoResize();

      // 在下一帧把页面滚动位置恢复成原来的值，避免右侧滚动条突然跳动
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          window.scrollTo(prevX, prevY);
        });
      } else {
        // 兜底方案
        window.scrollTo(prevX, prevY);
      }
    });

    // 弹窗输入取回密码（fetch code）
    function askFetchCode(promptText) {
      const msg = promptText || '请输入 fetch code（取回密码），最长 60 个字符：';
      const input = window.prompt(msg);
      if (input === null) return null;   // 用户点击取消

      const code = input.trim();
      if (!code) {
        alert('取回密码不能为空。');
        return null;
      }
      if (code.length > 60) {
        alert('取回密码不能超过 60 个字符。');
        return null;
      }
      if (/[\/\s]/.test(code)) {
        alert('取回密码不能包含斜线 "/" 或空格/换行。');
        return null;
      }
      // 和后端保持一致：仅允许大小写字母、数字、点、下划线、中划线
      if (!/^[0-9A-Za-z._-]+$/.test(code)) {
        alert('取回密码只能包含字母、数字、点、下划线、中划线。');
        return null;
      }
      return code;
    }

    // 通用请求函数
    async function callApi(payload) {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        // 非 JSON（比如 PHP 报错直接输出 HTML）
      }

      if (!res.ok || !data || data.ok === false) {
        const msg = data && data.error
          ? data.error
          : ('请求失败，HTTP ' + res.status);
        throw new Error(msg);
      }
      return data;
    }

    // save 按钮
    saveBtn.onclick = async () => {
      const code = askFetchCode('请输入 fetch code，用于保存本次文本（可覆盖）：');
      if (!code) return;

      const text  = textArea.value || '';
      const lines = getLineCount(text);

      if (lines === 1 && text === '') {
        const ok = window.confirm('当前文本为空，仍然保存空文件吗？');
        if (!ok) return;
      }
      if (lines > MAX_LINES) {
        alert('内容行数超过 10,000 行，请删减后再保存。');
        return;
      }

      saveBtn.disabled = true;
      try {
        const data = await callApi({
          action: 'save',
          code,
          text,
        });
        const fname = data.filename || (code + '.txt');
        alert(
          '保存成功！\n' +
          '文件名：' + fname + '\n' +
          '目录：网站后台目录 doremii.top / temp/'
        );

      } catch (e) {
        alert(e.message || '保存失败，请稍后重试。');
      } finally {
        saveBtn.disabled = false;
      }
    };

    // fetch_txt 按钮
    fetchBtn.onclick = async () => {
      const code = askFetchCode('请输入 fetch code（取回密码），用于取回之前保存的文本：');
      if (!code) return;

      fetchBtn.disabled = true;
      try {
        const data = await callApi({
          action: 'fetch',
          code,
        });

        let text = data.text || '';
        const linesArr = text.split(/\r\n|\r|\n/);
        if (linesArr.length > MAX_LINES) {
          alert('服务器返回的文本超过 10,000 行，仅加载前 10,000 行。');
          text = linesArr.slice(0, MAX_LINES).join('\n');
        }

        textArea.value = text;
        lastValue      = text;
        lineLimitAlertShown = false;

        // 取回时也会触发 autoResize；为了保险，也记录和恢复滚动
        const prevX = window.scrollX || window.pageXOffset || 0;
        const prevY = window.scrollY || window.pageYOffset || 0;

        autoResize();

        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => {
            window.scrollTo(prevX, prevY);
          });
        } else {
          window.scrollTo(prevX, prevY);
        }

      } catch (e) {
        alert(e.message || '取回失败，请检查取回密码是否正确。');
      } finally {
        fetchBtn.disabled = false;
      }
    };

    // copy 按钮：复制文本框内容
    if (copyBtn) {
      copyBtn.onclick = async () => {
        const text = textArea.value || '';

        if (!text) {
          const ok = window.confirm('当前文本为空，仍然复制空内容吗？');
          if (!ok) return;
        }

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
          } else {
            // 兼容旧浏览器：用 execCommand('copy')
            const selection = window.getSelection && window.getSelection();
            const prevRanges = [];

            if (selection && selection.rangeCount > 0) {
              for (let i = 0; i < selection.rangeCount; i++) {
                prevRanges.push(selection.getRangeAt(i));
              }
            }

            textArea.focus();
            textArea.select();
            document.execCommand('copy');

            // 恢复之前的选区
            if (selection) {
              selection.removeAllRanges();
              prevRanges.forEach(r => selection.addRange(r));
            }
          }

          alert('已复制到剪贴板。');
        } catch (e) {
          alert('复制失败，请手动使用 Ctrl+C / ⌘+C。');
        }
      };
    }
  }
}

// 防止重复注册
if (!customElements.get('doremii-text-recorder')) {
  customElements.define('doremii-text-recorder', DoreTextRecorder);
}
