/*!
 * complex_calcu.js
 *  - 普通计算：结果固定显示到小数点后 10 位
 *  - 扩展：三角函数（math.js）、常见微分（math.js derivative）、常见积分（Algebrite 符号不定积分 + 数值定积分）
 *  - 样式隔离：优先使用 Shadow DOM，避免影响网页其他模块的主题/宽度
 *
 * 你在页面里引用：
 *   <script defer src="/wp-content/uploads/complex_calcu.js?v=20260125c"></script>
 */
(function () {
  'use strict';

  // 防止重复初始化
  if (window.__complex_calcu_inited__) return;
  window.__complex_calcu_inited__ = true;

  var CONFIG = {
    title: '复杂计算器',
    decimals: 10,

    // 权威/常用的开源数学库（CDN）：math.js（计算 + 三角 + 微分），Algebrite（符号积分）
    // 版本建议固定，避免未来升级带来不兼容
    mathjsUrl: 'https://cdn.jsdelivr.net/npm/mathjs@15.1.0/lib/browser/math.js',
    algebriteUrl: 'https://cdn.jsdelivr.net/npm/algebrite@1.4.0/dist/algebrite.bundle-for-browser.js',

    // 数值定积分精度控制（通常足够得到 10 位小数）
    numericIntegralEps: 1e-12,
    numericIntegralMaxDepth: 20
  };

  function domReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function replaceWord(input, fromWord, toWord) {
    if (!fromWord || fromWord === toWord) return input;
    var re = new RegExp('\\b' + escapeRegExp(fromWord) + '\\b', 'g');
    return String(input).replace(re, toWord);
  }

  function loadScriptOnce(url, globalName, timeoutMs) {
    timeoutMs = timeoutMs || 20000;

    return new Promise(function (resolve, reject) {
      // 已存在
      if (globalName && window[globalName]) return resolve(window[globalName]);

      // 是否已有相同 URL 的 script
      var existed = document.querySelector('script[data-ccalcu-src="' + url + '"]');
      if (existed) {
        // 等待已有脚本加载完成
        existed.addEventListener('load', function () { resolve(window[globalName]); }, { once: true });
        existed.addEventListener('error', function () { reject(new Error('加载失败：' + url)); }, { once: true });
        return;
      }

      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.defer = true;
      s.dataset.ccalcuSrc = url;

      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error('加载超时：' + url));
      }, timeoutMs);

      s.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(window[globalName]);
      };
      s.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error('加载失败：' + url));
      };

      document.head.appendChild(s);
    });
  }

  function ensureMath() {
    return loadScriptOnce(CONFIG.mathjsUrl, 'math');
  }

  function ensureAlgebrite() {
    return loadScriptOnce(CONFIG.algebriteUrl, 'Algebrite');
  }

  function createMountPoint() {
    // 1) 若页面里已经有容器：<div id="complex_calcu"></div> 或 class="complex_calcu"
    var existing =
      document.getElementById('complex_calcu') ||
      document.querySelector('.complex_calcu') ||
      document.querySelector('[data-complex-calcu]');

    // 确保容器具备唯一 id（用于无 Shadow DOM 时做 CSS 前缀隔离）
    function ensureId(el) {
      if (!el) return el;
      if (!el.getAttribute('data-complex-calcu')) el.setAttribute('data-complex-calcu', '1');
      if (!el.id) el.id = 'ccalcu_mount_' + Math.random().toString(36).slice(2, 10);
      return el;
    }

    if (existing) return ensureId(existing);

    // 2) 否则：插入到当前 script 标签后（若 script 在 <head>，则追加到 body）
    var mount = document.createElement('div');
    mount.setAttribute('data-complex-calcu', '1');
    ensureId(mount);

    var scriptEl = document.currentScript;
    if (scriptEl && scriptEl.parentElement && scriptEl.parentElement.tagName.toLowerCase() !== 'head') {
      scriptEl.insertAdjacentElement('afterend', mount);
      return mount;
    }

    // fallback：追加到 body
    (document.body || document.documentElement).appendChild(mount);
    return mount;
  }

  function buildUI(mount) {
    // 样式隔离：优先 shadow DOM
    var hasShadow = !!mount.attachShadow;
    var root = hasShadow ? mount.attachShadow({ mode: 'open' }) : mount;

    // 重要：如果没有 Shadow DOM，style 标签会变成“全局样式”，必须做选择器前缀隔离
    // createMountPoint() 已确保 mount 具备唯一 id
    var hostSel = hasShadow ? ':host' : ('#' + mount.id);
    var scopeSel = hasShadow ? '' : (hostSel + ' ');

    // ----- style -----
    var style = document.createElement('style');
    style.textContent = [
      hostSel + '{display:block;width:520px;max-width:100%;box-sizing:border-box;text-align:left;margin:12px auto;--ccalcu-bg: var(--d-card, transparent);--ccalcu-field-bg: var(--d-card, rgba(255,255,255,.85));--ccalcu-border: var(--d-border, rgba(0,0,0,.18));--ccalcu-text: var(--d-text, inherit);--ccalcu-muted: var(--d-muted, rgba(0,0,0,.7));--ccalcu-kbd-bg: var(--d-card, rgba(255,255,255,.75));color: var(--ccalcu-text);}',
      scopeSel + '.ccalcu{box-sizing:border-box;font-family:inherit;}',
      scopeSel + '.ccalcu *{box-sizing:border-box;}',
      scopeSel + '.wrap{width:100%;max-width:100%;border:1px solid var(--ccalcu-border);border-radius:12px;padding:12px;background:transparent;}',
      scopeSel + '.head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;}',
      scopeSel + '.title{font-weight:700;font-size:16px;line-height:1.2;}',
      scopeSel + '.status{font-size:12px;opacity:.75;white-space:nowrap;}',
      scopeSel + '.input{width:100%;min-height:180px;resize:vertical;padding:10px;border:1px solid var(--ccalcu-border);border-radius:10px;outline:none;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:14px;line-height:1.4;background:var(--ccalcu-field-bg);color:var(--ccalcu-text);} ',
      scopeSel + '.row{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}',
      scopeSel + '.input::placeholder{color:var(--ccalcu-muted);opacity:1;}',
      scopeSel + 'button{cursor:pointer;border:1px solid var(--ccalcu-border);background:var(--ccalcu-field-bg);color:var(--ccalcu-text);border-radius:10px;padding:7px 10px;font-size:13px;line-height:1;transition:transform .02s ease;}',
      scopeSel + 'button:active{transform:translateY(1px);} ',
      scopeSel + '.primary{font-weight:800;background:#0f766e;color:#ffffff;border-color:#0f766e;}',
      scopeSel + '.output{margin-top:10px;padding:10px;border-radius:10px;border:1px dashed var(--ccalcu-border);background:var(--ccalcu-bg);color:var(--ccalcu-text);font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word;}',
      scopeSel + '.hint{margin-top:8px;font-size:12px;opacity:.78;line-height:1.5;}',
      scopeSel + 'details{margin-top:8px;}',
      scopeSel + 'summary{cursor:pointer;font-size:12px;opacity:.8;}',
      scopeSel + '.help{margin-top:6px;font-size:12px;opacity:.85;line-height:1.6;}',
      scopeSel + '.kbd{display:inline-block;padding:0 6px;border:1px solid var(--ccalcu-border);border-radius:6px;font-family:inherit;font-size:12px;background:var(--ccalcu-kbd-bg);} ',
    ].join('\n');

    // ----- dom -----
    var outer = document.createElement('div');
    outer.className = 'ccalcu';
    outer.innerHTML = '' +
      '<div class="wrap">' +
      '  <div class="head">' +
      '    <div class="title"></div>' +
      '    <div class="status" aria-live="polite"></div>' +
      '  </div>' +
      '  <textarea class="input" spellcheck="false" placeholder="输入表达式，例如：\n  2+3*4\n  sin(pi/6)\n  diff(sin(x^2), x)\n  int(x^2, x)\n  defint(sin(x), x, 0, pi)\n\n提示：按 Ctrl+Enter 快速计算"></textarea>' +
      '  <div class="row">' +
      '    <button type="button" data-insert="sin(">sin</button>' +
      '    <button type="button" data-insert="cos(">cos</button>' +
      '    <button type="button" data-insert="tan(">tan</button>' +
      '    <button type="button" data-insert="sind(">sind</button>' +
      '    <button type="button" data-insert="cosd(">cosd</button>' +
      '    <button type="button" data-insert="tand(">tand</button>' +
      '    <button type="button" data-insert="asin(">asin</button>' +
      '    <button type="button" data-insert="acos(">acos</button>' +
      '    <button type="button" data-insert="atan(">atan</button>' +
      '    <button type="button" data-insert="sqrt(">√</button>' +
      '    <button type="button" data-insert="ln(">ln</button>' +
      '    <button type="button" data-insert="log10(">log10</button>' +
      '    <button type="button" data-insert="pi">π</button>' +
      '    <button type="button" data-insert="e">e</button>' +
      '    <button type="button" data-insert="^">^</button>' +
      '  </div>' +
      '  <div class="row">' +
      '    <button type="button" data-insert="diff(, x)">diff</button>' +
      '    <button type="button" data-insert="int(, x)">int</button>' +
      '    <button type="button" data-insert="defint(, x, 0, 1)">defint</button>' +
      '    <button type="button" class="primary" data-action="calc">计算</button>' +
      '    <button type="button" data-action="clear">清空</button>' +
      '  </div>' +
      '  <div class="output" role="status"></div>' +
      '  <div class="hint">说明：三角函数默认使用弧度制。结果（数值）固定显示到小数点后 10 位。</div>' +
      '  <details>' +
      '    <summary>命令说明（点击展开）</summary>' +
      '    <div class="help">' +
      '      <div><b>普通计算</b>：直接输入表达式，如 <span class="kbd">1/3</span>、<span class="kbd">sin(pi/6)</span></div>' +
      '      <div><b>微分</b>：<span class="kbd">diff(表达式, 变量)</span>，如 <span class="kbd">diff(sin(x^2), x)</span></div>' +
      '      <div><b>不定积分（符号）</b>：<span class="kbd">int(表达式, 变量)</span>，如 <span class="kbd">int(x^2, x)</span></div>' +
      '      <div><b>定积分（数值）</b>：<span class="kbd">defint(表达式, 变量, 下限, 上限)</span>，如 <span class="kbd">defint(sin(x), x, 0, pi)</span></div>' +
      '      <div style="margin-top:6px;opacity:.9;">提示：若符号积分不支持某些复杂表达式，可改用定积分（数值）计算。</div>' +
      '    </div>' +
      '  </details>' +
      '</div>';

    root.appendChild(style);
    root.appendChild(outer);

    var $title = root.querySelector('.title');
    var $status = root.querySelector('.status');
    var $input = root.querySelector('.input');
    var $output = root.querySelector('.output');

    $title.textContent = CONFIG.title;

    function setStatus(text) {
      $status.textContent = text || '';
    }

    function setOutput(text) {
      $output.textContent = text == null ? '' : String(text);
    }

    function insertTextAtCursor(text) {
      var el = $input;
      el.focus();
      var start = el.selectionStart || 0;
      var end = el.selectionEnd || 0;
      var val = el.value || '';
      el.value = val.slice(0, start) + text + val.slice(end);
      var newPos = start + text.length;
      el.setSelectionRange(newPos, newPos);
    }

    function parseFunctionCall(input) {
      // 仅解析最外层：name(...)
      input = String(input || '').trim();
      var m = /^([a-zA-Z_]\w*)\s*\(([\s\S]*)\)$/.exec(input);
      if (!m) return null;

      var name = m[1];
      var inside = m[2];

      // 分割顶层逗号参数
      var args = [];
      var cur = '';
      var depth = 0;
      var inStr = false;
      var strCh = '';
      for (var i = 0; i < inside.length; i++) {
        var ch = inside[i];

        if (inStr) {
          cur += ch;
          if (ch === strCh && inside[i - 1] !== '\\') {
            inStr = false;
            strCh = '';
          }
          continue;
        }

        if (ch === '"' || ch === "'") {
          inStr = true;
          strCh = ch;
          cur += ch;
          continue;
        }

        if (ch === '(' || ch === '[' || ch === '{') depth++;
        if (ch === ')' || ch === ']' || ch === '}') depth--;

        if (ch === ',' && depth === 0) {
          args.push(cur.trim());
          cur = '';
          continue;
        }
        cur += ch;
      }
      if (cur.trim()) args.push(cur.trim());

      return { name: name, args: args };
    }

    function formatFixed10Number(n) {
      // 只对有限数进行 toFixed
      if (typeof n !== 'number') n = Number(n);
      if (!isFinite(n)) return String(n);
      return n.toFixed(CONFIG.decimals);
    }

    function formatMathValue(math, value) {
      // 只对“数值输出”做 10 位小数格式
      // 若是符号表达式（字符串）则原样输出
      if (value == null) return '';

      // math.js 类型判断
      try {
        if (math && typeof math.typeOf === 'function') {
          var t = math.typeOf(value);

          if (t === 'number') return formatFixed10Number(value);

          if (t === 'BigNumber' && value && typeof value.toFixed === 'function') {
            return value.toFixed(CONFIG.decimals);
          }

          if (t === 'Fraction') {
            return formatFixed10Number(value.valueOf());
          }

          if (t === 'Complex') {
            var re = value.re || 0;
            var im = value.im || 0;
            var reStr = formatFixed10Number(re);
            var imAbsStr = formatFixed10Number(Math.abs(im));
            if (Math.abs(im) < 1e-15) return reStr;
            if (Math.abs(re) < 1e-15) return (im < 0 ? '-' : '') + imAbsStr + 'i';
            return reStr + (im < 0 ? ' - ' : ' + ') + imAbsStr + 'i';
          }

          // 其它类型：尽量用 math.format 输出（不强制 10 位）
          if (typeof math.format === 'function') {
            return math.format(value, { precision: 14 });
          }
        }
      } catch (e) { /* ignore */ }

      // 兜底
      if (typeof value === 'number') return formatFixed10Number(value);
      return String(value);
    }

    // --- 数值定积分：自适应 Simpson ---
    function simpson(fa, fm, fb, a, b) {
      return (b - a) / 6 * (fa + 4 * fm + fb);
    }

    function adaptiveSimpson(f, a, b, eps, maxDepth) {
      var c = (a + b) / 2;
      var fa = f(a);
      var fb = f(b);
      var fm = f(c);
      var whole = simpson(fa, fm, fb, a, b);

      function recurse(a1, b1, fa1, fb1, fm1, S, eps1, depth) {
        var c1 = (a1 + b1) / 2;
        var d = (a1 + c1) / 2;
        var e = (c1 + b1) / 2;

        var fd = f(d);
        var fe = f(e);

        var left = simpson(fa1, fd, fm1, a1, c1);
        var right = simpson(fm1, fe, fb1, c1, b1);

        var S2 = left + right;

        if (depth <= 0 || Math.abs(S2 - S) <= 15 * eps1) {
          return S2 + (S2 - S) / 15;
        }
        return recurse(a1, c1, fa1, fm1, fd, left, eps1 / 2, depth - 1) +
               recurse(c1, b1, fm1, fb1, fe, right, eps1 / 2, depth - 1);
      }

      return recurse(a, b, fa, fb, fm, whole, eps, maxDepth);
    }

    function compute() {
      var inputText = String($input.value || '').trim();
      if (!inputText) {
        setOutput('');
        return;
      }

      setStatus('加载中…');

      ensureMath().then(function (math) {
        setStatus('就绪');

        // 常用别名：ln / log10
        if (!math.__ccalcu_patched__) {
          math.__ccalcu_patched__ = true;
          if (typeof math.import === 'function') {
            // ln(x) -> log(x)
            if (typeof math.ln !== 'function' && typeof math.log === 'function') {
              math.import({ ln: math.log }, { override: false });
            }
            // log10(x) -> log(x,10)
            if (typeof math.log10 !== 'function') {
              math.import({
                log10: function (x) { return math.log(x, 10); }
              }, { override: false });
            }
            // degree trig: sind/cosd/tand (degrees)
            if (typeof math.sind !== 'function' || typeof math.cosd !== 'function' || typeof math.tand !== 'function') {
              var __ccalcu_deg2rad = math.divide(math.pi, 180);
              var __ccalcu_degFns = {};
              if (typeof math.sind !== 'function') __ccalcu_degFns.sind = function (x) { return math.sin(math.multiply(x, __ccalcu_deg2rad)); };
              if (typeof math.cosd !== 'function') __ccalcu_degFns.cosd = function (x) { return math.cos(math.multiply(x, __ccalcu_deg2rad)); };
              if (typeof math.tand !== 'function') __ccalcu_degFns.tand = function (x) { return math.tan(math.multiply(x, __ccalcu_deg2rad)); };
              math.import(__ccalcu_degFns, { override: false });
            }
          }
        }

        var call = parseFunctionCall(inputText);

        // diff(...)
        if (call && call.name.toLowerCase() === 'diff') {
          var expr = call.args[0] || '';
          var v = call.args[1] || 'x';
          if (!expr) throw new Error('diff() 需要表达式参数');

          var node = math.derivative(expr, v); // 文档：math.derivative(expr, variable)
          setOutput(String(node)); // toString
          return;
        }

        // int(...)
        if (call && (call.name.toLowerCase() === 'int' || call.name.toLowerCase() === 'integral')) {
          var iexpr = call.args[0] || '';
          var ivar = call.args[1] || 'x';
          if (!iexpr) throw new Error('int() 需要表达式参数');

          // 延迟加载 Algebrite（较大）
          setStatus('加载积分库…');
          ensureAlgebrite().then(function (Algebrite) {
            setStatus('就绪');
            // 为了兼容性：Algebrite 示例中 integral(x^2) 默认变量是 x
            // 若用户变量不是 x，则做一次变量替换：var -> x，再积分后再替换回来
            var tmpVar = 'x';
            var expr2 = String(iexpr);
            if (ivar !== tmpVar) expr2 = replaceWord(expr2, ivar, tmpVar);

            var out;
            try {
              if (Algebrite.eval) {
                out = Algebrite.eval('integral(' + expr2 + ')').toString();
              } else if (Algebrite.run) {
                out = Algebrite.run('integral(' + expr2 + ')');
              } else {
                throw new Error('Algebrite 接口不可用');
              }
            } catch (e) {
              throw new Error('符号积分失败：' + (e && e.message ? e.message : e));
            }

            if (ivar !== tmpVar) out = replaceWord(out, tmpVar, ivar);
            setOutput(out);
          }).catch(function (err) {
            setStatus('错误');
            setOutput('积分库加载/计算失败：' + (err && err.message ? err.message : err));
          });

          return;
        }

        // defint(expr, var, a, b) -> 数值定积分
        if (call && call.name.toLowerCase() === 'defint') {
          var dexpr = call.args[0] || '';
          var dvar = call.args[1] || 'x';
          var da = call.args[2];
          var db = call.args[3];
          if (!dexpr) throw new Error('defint() 需要表达式参数');
          if (da == null || db == null) throw new Error('defint() 需要下限和上限');

          // 允许 a/b 写 pi 等常量
          var aVal = math.evaluate(String(da));
          var bVal = math.evaluate(String(db));

          var aNum = Number(aVal);
          var bNum = Number(bVal);

          if (!isFinite(aNum) || !isFinite(bNum)) {
            throw new Error('定积分上下限必须是有限数值');
          }

          // 解析一次表达式，循环时只 evaluate
          var node2 = math.parse(String(dexpr));
          var code2 = node2.compile();

          var scope = {};
          function f(x) {
            scope[dvar] = x;
            var y = code2.evaluate(scope);

            // 处理复数：只接受虚部接近 0 的情况
            var type = math.typeOf(y);
            if (type === 'Complex') {
              if (Math.abs(y.im) > 1e-12) return NaN;
              return Number(y.re);
            }

            return Number(y);
          }

          // 处理反向积分
          var sign = 1;
          var A = aNum, B = bNum;
          if (B < A) { sign = -1; A = bNum; B = aNum; }

          var res = adaptiveSimpson(f, A, B, CONFIG.numericIntegralEps, CONFIG.numericIntegralMaxDepth);
          res = sign * res;

          if (!isFinite(res)) throw new Error('定积分数值结果无效（可能存在奇点/发散）');
          setOutput(formatFixed10Number(res));
          return;
        }

        // 普通计算
        var val = math.evaluate(inputText);
        setOutput(formatMathValue(math, val));
      }).catch(function (err) {
        setStatus('错误');
        setOutput((err && err.message) ? err.message : String(err));
      });
    }

    // button events
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'BUTTON') return;

      var insert = t.getAttribute('data-insert');
      var action = t.getAttribute('data-action');

      if (insert) {
        // 特殊：diff/int/defint 模板，放到光标位置并把光标移到逗号前
        insertTextAtCursor(insert);

        // 若模板里有 ",", 尝试把光标移到第一个逗号前（方便输入表达式）
        var idx = ($input.value || '').lastIndexOf(insert);
        if (idx >= 0) {
          var commaPos = ($input.value || '').indexOf(',', idx);
          if (commaPos > idx) {
            $input.setSelectionRange(idx + calloutPrefixLen(insert), idx + calloutPrefixLen(insert));
          }
        }
        return;
      }

      if (action === 'calc') {
        compute();
        return;
      }
      if (action === 'clear') {
        $input.value = '';
        setOutput('');
        setStatus('');
        $input.focus();
        return;
      }
    });

    // 计算模板把光标放到 “(” 后面
    function calloutPrefixLen(template) {
      // diff(, x) -> 5
      var p = template.indexOf('(');
      return p >= 0 ? (p + 1) : template.length;
    }

    // Ctrl+Enter 计算
    $input.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        compute();
      }
    });

    // 初次加载 math.js（让用户点按钮时更快）
    setStatus('加载中…');
    ensureMath().then(function () {
      setStatus('就绪');
    }).catch(function () {
      setStatus('库加载失败');
    });
  }

  domReady(function () {
    var mount = createMountPoint();
    buildUI(mount);
  });
})();
