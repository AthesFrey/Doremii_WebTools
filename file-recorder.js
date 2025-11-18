// /wp-content/uploads/file-recorder.js
// DoreFileRecorder v20251116_file_upload_temp_limit_multi

class DoreFileRecorder extends BaseTool {
  tpl() {
    return `
      <div class="row" style="justify-content:flex-start; margin-bottom:4px;">
        <span style="font-size:14px;">请选择本地文件（Windows 本机文件）</span>
      </div>

      <div class="row" style="align-items:center; gap:8px; margin-bottom:4px;">
        <input type="file" id="fileInput" style="display:none;" />
        <button id="chooseBtn">选择文件</button>
        <span id="fileName" style="font-size:13px; flex:1; word-break:break-all;">
          未选择文件
        </span>
      </div>

      <div class="row" style="justify-content:space-between; margin-top:8px;">
        <button id="fetchBtn">fetch_file</button>
        <button id="saveBtn">save</button>
      </div>

      <div class="row" style="margin-top:8px;">
        <div id="downloadArea" style="font-size:13px; word-break:break-all;"></div>
      </div>
    `;
  }

  connectedCallback() {
    if (this.onReady) return;
    this.onReady = true;

    const $ = sel => this.root.querySelector(sel);
    const fileInput    = $('#fileInput');
    const chooseBtn    = $('#chooseBtn');
    const fileNameSpan = $('#fileName');
    const saveBtn      = $('#saveBtn');
    const fetchBtn     = $('#fetchBtn');
    const downloadArea = $('#downloadArea');

    const API_URL        = '/wp-content/uploads/file-recorderapi.php';
    const MAX_FILE_BYTES = 1170378588; // 与后端保持一致，约 1.09GB

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

    // 选择文件按钮：触发文件对话框
    chooseBtn.onclick = () => {
      fileInput.click();
    };

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        fileNameSpan.textContent = '未选择文件';
        return;
      }

      const size = file.size || 0;
      let sizeText = size + ' B';
      if (size > 1024 * 1024) {
        sizeText = (size / 1024 / 1024).toFixed(2) + ' MB';
      } else if (size > 1024) {
        sizeText = (size / 1024).toFixed(2) + ' KB';
      }

      fileNameSpan.textContent = `已选择：${file.name}（${sizeText}）`;
    });

    // 公用：输入取回密码
    function askFetchCode(promptText) {
      const msg = promptText || '请输入 fetch code（取回密码），最长 60 个字符：';
      const input = window.prompt(msg);
      if (input === null) return null; // 取消

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
      if (!/^[0-9A-Za-z._-]+$/.test(code)) {
        alert('取回密码只能包含字母、数字、点、下划线、中划线。');
        return null;
      }
      return code;
    }

    // 公用：JSON 请求（用于 check_fetch）
    async function callJsonApi(payload) {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (e) {}

      if (!res.ok || !data || data.ok === false) {
        const msg = data && data.error
          ? data.error
          : ('请求失败，HTTP ' + res.status);
        throw new Error(msg);
      }
      return data;
    }

    // save：上传本机文件到服务器 temp 目录
    saveBtn.onclick = async () => {
      downloadArea.innerHTML = '';

      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        alert('请先选择一个本地文件。');
        return;
      }

      const size = file.size || 0;

      // 前端大小限制
      if (size > MAX_FILE_BYTES) {
        let mb = size / (1024 * 1024);
        mb = mb.toFixed(2);
        alert(
          '文件过大（约 ' + mb + ' MB），超过最大允许的 1.09GB。\n' +
          '请压缩、分卷或换一个更小的文件再上传。'
        );
        return;
      }

      let sizeText = size + ' B';
      if (size > 1024 * 1024) {
        sizeText = (size / 1024 / 1024).toFixed(2) + ' MB';
      } else if (size > 1024) {
        sizeText = (size / 1024).toFixed(2) + ' KB';
      }

      const okConfirm = window.confirm(
        '将上传下列本机文件到服务器：\n\n' +
        file.name + '（' + sizeText + '）\n\n' +
        '上传后会保存到网站根目录下的 temp 目录中，\n' +
        '文件名 = fetch code + 原始后缀。\n\n是否继续？'
      );
      if (!okConfirm) return;

      const code = askFetchCode(
        '请输入 fetch code（取回密码）：\n' +
        '将作为服务器端文件名的一部分（例如 code.zip）。'
      );
      if (!code) return;

      const formData = new FormData();
      formData.append('action', 'save_file');
      formData.append('code', code);
      formData.append('file', file);

      saveBtn.disabled = true;
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          body: formData,
        });

        let data = null;
        try {
          data = await res.json();
        } catch (e) {}

        if (!res.ok || !data || data.ok === false) {
          const msg = data && data.error
            ? data.error
            : ('上传失败，HTTP ' + res.status);
          throw new Error(msg);
        }

        const destDir   = data.dest_dir      || '（网站根目录 temp）';
        const destPath  = data.dest_path     || '';
        const serverF   = data.filename      || (code + '（服务器文件名）');
        const dlUrl     = data.download_url  || '';

        alert(
          '上传成功！\n\n' +
          '服务器文件名：\n' + serverF + '\n\n' +
          '以后可以用 fetch code：' + code + ' 取回该文件。'
        );

        if (dlUrl) {
          downloadArea.innerHTML =
            '<a href="' + dlUrl +
            '" target="_blank" rel="noopener" ' +
            'style="text-decoration:underline; cursor:pointer;">' +
            '立即下载（服务器上的副本）：' + serverF +
            '</a>';
        } else {
          downloadArea.textContent =
            '文件已保存到服务器：' + (destPath || (destDir + '/' + serverF));
        }

      } catch (e) {
        alert(e.message || '上传失败，请稍后重试。');
      } finally {
        saveBtn.disabled = false;
      }
    };

    // fetch_file：根据 fetch code 生成一个或多个下载链接
    fetchBtn.onclick = async () => {
      downloadArea.innerHTML = '';

      const code = askFetchCode(
        '请输入 fetch code（取回密码）：\n' +
        '如果服务器 temp 目录中存在 code.xxx 这样的文件，就会生成下载链接。'
      );
      if (!code) return;

      fetchBtn.disabled = true;
      try {
        const data = await callJsonApi({
          action: 'check_fetch',
          code,
        });

        const files = data.files;
        // 多文件情况：逐个生成链接
        if (Array.isArray(files) && files.length > 0) {
          let html = '';
          files.forEach((f, idx) => {
            const url  = f.download_url;
            const name = f.filename || ('文件' + (idx + 1));
            if (!url) return;

            if (html) html += '<br/>';
            html +=
              '<a href="' + url +
              '" target="_blank" rel="noopener" ' +
              'style="text-decoration:underline; cursor:pointer;">' +
              '点击下载：' + name +
              '</a>';
          });

          downloadArea.innerHTML = html || '未找到可下载的文件。';
          return;
        }

        // 兼容老字段：单文件
        const url  = data.download_url;
        const name = data.filename || code;

        if (!url) {
          alert('后端未返回下载地址。');
          return;
        }

        downloadArea.innerHTML =
          '<a href="' + url +
          '" target="_blank" rel="noopener" ' +
          'style="text-decoration:underline; cursor:pointer;">' +
          '点击这里下载：' + name +
          '</a>';

      } catch (e) {
        alert(e.message || '检查失败，请确认网站根目录 temp 目录中是否有对应文件。');
      } finally {
        fetchBtn.disabled = false;
      }
    };
  }
}

// 防止重复注册
if (!customElements.get('doremii-file-recorder')) {
  customElements.define('doremii-file-recorder', DoreFileRecorder);
}

