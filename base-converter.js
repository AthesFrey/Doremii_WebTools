// ---- DoreBaseConverter v20251120 ----
class DoreBaseConverter extends BaseTool {
  tpl() {
    return `
      <div class="row">
        <label>10进制</label>
        <textarea id="decimalInput" placeholder="请输入10进制"></textarea>
        <button id="convertDecimal" style="color: white;">Convert</button>
        <button id="copyDecimal" style="background-color: #FFDAB9; color: black;">copy</button>
      </div>
      <div class="row">
        <label>36进制</label>
        <textarea id="base36Input" placeholder="请输入36进制"></textarea>
        <button id="convertBase36" style="color: white;">Convert</button>
        <button id="copyBase36" style="background-color: #FFDAB9; color: black;">copy</button>
        <button id="ccaseBase36" style="background-color: #FFDAB9; color: black;">ccase</button>
      </div>
      <div class="row">
        <label>62进制</label>
        <textarea id="base62Input" placeholder="请输入62进制"></textarea>
        <button id="convertBase62" style="color: white;">Convert</button>
        <button id="copyBase62" style="background-color: #FFDAB9; color: black;">copy</button>
      </div>
    `;
  }

  connectedCallback() {
    if (this.onReady) return;
    this.onReady = true;

    const $ = sel => this.root.querySelector(sel);
    const decimalInput   = $('#decimalInput');
    const base36Input    = $('#base36Input');
    const base62Input    = $('#base62Input');
    const convertDecimal = $('#convertDecimal');
    const convertBase36  = $('#convertBase36');
    const convertBase62  = $('#convertBase62');
    const copyDecimal    = $('#copyDecimal');
    const copyBase36     = $('#copyBase36');
    const copyBase62     = $('#copyBase62');
    const ccaseBase36    = $('#ccaseBase36');

    // —— 修复：隐藏父类模板里未使用的 .result / .hist，避免底部两条色块 ——
    const hideIfEmpty = (el) => {
      if (!el) return;
      el.textContent = '';
      el.style.display = 'none';
      el.style.padding = '0';
      el.style.border  = 'none';
      el.style.margin  = '0';
    };
    hideIfEmpty(this.root.querySelector('.result'));
    hideIfEmpty(this.root.querySelector('.hist'));

    // 输入框样式：保持宽度与换行

	[decimalInput, base36Input, base62Input].forEach(t => {
	  t.style.width = '100%';
	  t.style.height = '4em';
	  t.style.fontSize = '20px';      // ← 字体稍微放大一点（含 placeholder）
	  t.style.wordWrap = 'break-word';
	  t.style.whiteSpace = 'normal';
	});
		
	const DIGITS    = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const DECIMAL_RE= /^(?:0|[1-9]\d*)$/;    // 非负整数字符串
    const B36_RE    = /^[0-9a-z]+$/;         // 规范化(小写)后校验
    const B62_RE    = /^[0-9A-Za-z]+$/;

    // 10进制字符串 -> 任意进制
    function decimalToBase(decStr, base) {
      if (!DECIMAL_RE.test(decStr)) throw new Error('十进制必须为非负整数（不含小数/科学计数）。');
      let n = BigInt(decStr);
      if (n === 0n) return '0';
      const B = BigInt(base);
      let out = '';
      while (n > 0n) {
        const r = n % B;                 // 余数 < base
        out = DIGITS[Number(r)] + out;
        n = n / B;
      }
      return out;
    }


    // 任意进制字符串 -> 10进制字符串
    function baseToDecimal(s, base) {
      const B = BigInt(base);
      let acc = 0n;
      for (let i = 0; i < s.length; i++) {
        const idx = DIGITS.indexOf(s[i]);
        if (idx < 0 || idx >= base) throw new Error(`字符 "${s[i]}" 超出${base}进制取值范围。`);
        acc = acc * B + BigInt(idx);
      }
      return acc.toString();
    }

    async function copyToClipboard(el, btn) {
      const text = el.value;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          el.focus(); el.select();
          document.execCommand('copy');
          el.setSelectionRange?.(el.value.length, el.value.length); // 取消选区
        }
        btn.textContent = 'Copied!';
      } catch {
        btn.textContent = 'Failed';
      } finally {
        setTimeout(() => (btn.textContent = 'copy'), 1000);
      }
    }

    // --- 事件绑定 ---
    convertDecimal.onclick = () => {
      const raw = decimalInput.value.trim();
      try {
        const b36 = decimalToBase(raw, 36);
        const b62 = decimalToBase(raw, 62);
        base36Input.value = b36;
        base62Input.value = b62;
      } catch (e) {
        alert(e.message || '十进制输入不合法。');
      }
    };

    // 36进制 -> 10进制 & 62进制
    convertBase36.onclick = () => {
      const raw = base36Input.value.trim();
      if (!raw) {
        alert('请输入仅含 0-9 与 a-z 的 36 进制数字。');
        return;
      }
      const s = raw.toLowerCase();   // 内部统一用小写做计算
      if (!B36_RE.test(s)) {
        alert('请输入仅含 0-9 与 a-z 的 36 进制数字。');
        return;
      }
      try {
        const dec = baseToDecimal(s, 36);
        decimalInput.value = dec;
        base62Input.value  = decimalToBase(dec, 62);
      } catch (e) {
        alert(e.message || '36 进制输入不合法。');
      }
    };

    convertBase62.onclick = () => {
      const s = base62Input.value.trim();
      if (!s || !B62_RE.test(s)) { alert('请输入仅含 0-9/a-z/A-Z 的 62 进制数字。'); return; }
      try {
        const dec = baseToDecimal(s, 62);
        decimalInput.value = dec;
        base36Input.value  = decimalToBase(dec, 36);
      } catch (e) {
        alert(e.message || '62 进制输入不合法。');
      }
    };

    copyDecimal.onclick = () => copyToClipboard(decimalInput, copyDecimal);
    copyBase36.onclick  = () => copyToClipboard(base36Input,  copyBase36);
    copyBase62.onclick  = () => copyToClipboard(base62Input,  copyBase62);

    // 36进制字母大小写切换
    if (ccaseBase36) {
      ccaseBase36.onclick = () => {
        const v = base36Input.value;
        if (!v) return;
        base36Input.value = v.replace(/[a-zA-Z]/g, ch =>
          ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase()
        );
        base36Input.focus();
      };
    }
  }
}

// 防二次注册（可重复加载，不报错）
if (!customElements.get('doremii-base-converter')) {
  customElements.define('doremii-base-converter', DoreBaseConverter);
}


