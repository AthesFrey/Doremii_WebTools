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

    const decimalInput = this.root.querySelector('#decimalInput');
    const base36Input = this.root.querySelector('#base36Input');
    const base62Input = this.root.querySelector('#base62Input');
    const convertDecimal = this.root.querySelector('#convertDecimal');
    const convertBase36 = this.root.querySelector('#convertBase36');
    const convertBase62 = this.root.querySelector('#convertBase62');
    const copyDecimal = this.root.querySelector('#copyDecimal');
    const copyBase36 = this.root.querySelector('#copyBase36');
    const copyBase62 = this.root.querySelector('#copyBase62');

    // 保持输入框的宽度和换行功能
    const inputs = [decimalInput, base36Input, base62Input];
    inputs.forEach(input => {
      input.style.width = '100%';
      input.style.height = '4em';
      input.style.wordWrap = 'break-word';
      input.style.whiteSpace = 'normal';
    });

    // 进制转换函数
    const decimalToBase = (decimalStr, base) => {
      const digits = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let result = '';
      let remainder;

      while (decimalStr !== '0') {
        remainder = BigInt(decimalStr) % BigInt(base);
        result = digits[Number(remainder)] + result;
        decimalStr = (BigInt(decimalStr) / BigInt(base)).toString();
      }

      return result || '0';
    };

    const baseToDecimal = (baseStr, base) => {
      const digits = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let result = 0n;

      for (let i = 0; i < baseStr.length; i++) {
        result = result * BigInt(base) + BigInt(digits.indexOf(baseStr[i]));
      }

      return result.toString();
    };

    // 单个转换按钮点击事件
    convertDecimal.onclick = () => {
      let decimal = decimalInput.value.trim();
      if (decimal === '' || isNaN(decimal)) {
        alert("请输入有效的10进制数字。");
        return;
      }
      base36Input.value = decimalToBase(decimal, 36);
      base62Input.value = decimalToBase(decimal, 62);
    };

    convertBase36.onclick = () => {
      let base36 = base36Input.value.trim();
      if (base36 === '' || !/^[0-9a-zA-Z]+$/.test(base36)) {
        alert("请输入有效的36进制数字。");
        return;
      }
      decimalInput.value = baseToDecimal(base36, 36);
      base62Input.value = decimalToBase(baseToDecimal(base36, 36), 62);
    };

    convertBase62.onclick = () => {
      let base62 = base62Input.value.trim();
      if (base62 === '' || !/^[0-9a-zA-Z]+$/.test(base62)) {
        alert("请输入有效的62进制数字。");
        return;
      }
      decimalInput.value = baseToDecimal(base62, 62);
      base36Input.value = decimalToBase(baseToDecimal(base62, 62), 36);
    };

    // 复制按钮点击事件
    const copyToClipboard = (input) => {
      input.select();
      document.execCommand('copy');
    };

    copyDecimal.onclick = () => {
      copyToClipboard(decimalInput);
      copyDecimal.textContent = 'Copied!';
      setTimeout(() => copyDecimal.textContent = 'copy', 1000);
    };

    copyBase36.onclick = () => {
      copyToClipboard(base36Input);
      copyBase36.textContent = 'Copied!';
      setTimeout(() => copyBase36.textContent = 'copy', 1000);
    };

    copyBase62.onclick = () => {
      copyToClipboard(base62Input);
      copyBase62.textContent = 'Copied!';
      setTimeout(() => copyBase62.textContent = 'copy', 1000);
    };
  }
}

customElements.define('doremii-base-converter', DoreBaseConverter);
