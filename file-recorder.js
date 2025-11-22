// /wp-content/uploads/file-recorder.js
// DoreFileRecorder v20251122_1GB_api_fix

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
        <div id="uploadProgressContainer"
             style="display:none; width:100%; max-width:100%; background:#eee; border-radius:4px; overflow:hidden;">
          <div id="uploadProgressBar"
               style="height:8px; width:0%; background:var(--button-bg,#7E57C2); transition:width 0.2s linear;"></div>
        </div>
      </div>
      <div class="row" style="margin-top:4px;">
        <span id="uploadProgressText"
              style="display:none; font-size:12px; color:#555;">上传进度：0%</span>
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

    const uploadProgressContainer = $('#uploadProgressContainer');
    const uploadProgressBar       = $('#uploadProgressBar');
    const uploadProgressText      = $('#uploadProgressText');

    // ⭐ 加入动态版本号，防缓存
	const API_URL = 'https://cloudpan.doremii.top/wp-content/uploads/file-recorderapi.php?_v=' + Date.now();
    const MAX_FILE_BYTES = 1170378588;

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

    chooseBtn.onclick = () => fileInput.click();

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        fileNameSpan.textContent = '未选择文件';
        return;
      }

      const size = file.size || 0;
      let sizeText = size + ' B';
      if (size > 1024 * 1024) sizeText = (size / 1024 / 1024).toFixed(2) + ' MB';
      else if (size > 1024) sizeText = (size / 1024).toFixed(2) + ' KB';

      fileNameSpan.textContent = `已选择：${file.name}（${sizeText}）`;
    });

    function askFetchCode(promptText) {
      const msg = promptText || '请输入 fetch code（取回密码）：';
      const input = window.prompt(msg);
      if (input === null) return null;

      const code = input.trim();
      if (!code) return alert('取回密码不能为空。'), null;
      if (code.length > 60) return alert('取回密码不能超过 60 字。'), null;
      if (/[\/\s]/.test(code)) return alert('不能包含斜线或空白字符'), null;
      if (!/^[0-9A-Za-z._-]+$/.test(code)) return alert('只能包含字母数字._-'), null;

      return code;
    }

    async function callJsonApi(payload) {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data = null;
      try { data = await res.json(); } catch (e) {}

      if (!res.ok || !data || data.ok === false) {
        throw new Error(data?.error || ('HTTP ' + res.status));
      }
      return data;
    }

    function uploadWithProgress(formData, onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', API_URL, true);

        xhr.timeout = 10 * 60 * 1000;

        xhr.upload.onprogress = function (e) {
          if (!e.lengthComputable) return;
          const percent = Math.round((e.loaded * 100) / e.total);
          if (typeof onProgress === 'function') onProgress(percent, e.loaded, e.total);
        };

        xhr.onreadystatechange = function () {
          if (xhr.readyState !== 4) return;

          let data = null;
          try { data = JSON.parse(xhr.responseText || '{}'); } catch(err){}

          const okStatus = xhr.status >= 200 && xhr.status < 300;

          if (okStatus && data && data.ok !== false) resolve(data);
          else reject(new Error(data?.error || ('HTTP ' + xhr.status)));
        };

        xhr.onerror = () => reject(new Error('网络错误'));
        xhr.ontimeout = () => reject(new Error('上传超时'));

        xhr.send(formData);
      });
    }

    function resetProgress() {
      uploadProgressBar.style.width = '0%';
      uploadProgressText.textContent = '上传进度：0%';
    }
    function showProgressUI(show) {
      const d = show ? 'block' : 'none';
      uploadProgressContainer.style.display = d;
      uploadProgressText.style.display = d;
    }

    // ---------------- SAVE ----------------
    saveBtn.onclick = async () => {
      downloadArea.innerHTML = '';

      const file = fileInput.files && fileInput.files[0];
      if (!file) return alert('请先选择文件。');

      if (file.size > MAX_FILE_BYTES) {
        return alert('文件超过 1GB 限制，无法上传。');
      }

      const code = askFetchCode('请输入 fetch code（取回密码）');
      if (!code) return;

      const formData = new FormData();
      formData.append('action', 'save_file');
      formData.append('code', code);
      formData.append('file', file);

      saveBtn.disabled = true;
      const origin = saveBtn.textContent;

      resetProgress();
      showProgressUI(true);

      try {
        saveBtn.textContent = '上传中...';

        const data = await uploadWithProgress(formData, (percent) => {
          uploadProgressBar.style.width = percent + '%';
          uploadProgressText.textContent = '上传进度：' + percent + '%';
        });

        alert('上传成功！\n服务器文件名：' + data.filename);

        if (data.download_url) {
          downloadArea.innerHTML =
            '<a href="' + data.download_url +
            '" target="_blank" rel="noopener">立即下载：' + data.filename + '</a>';
        }

        uploadProgressBar.style.width = '100%';
        uploadProgressText.textContent = '上传完成：100%';

      } catch (e) {
        alert(e.message || '上传失败');
        showProgressUI(false);
        resetProgress();
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = origin;
      }
    };

    // ---------------- FETCH ----------------
    fetchBtn.onclick = async () => {
      downloadArea.innerHTML = '';

      const code = askFetchCode('请输入 fetch code：');
      if (!code) return;

      fetchBtn.disabled = true;

      try {
        const data = await callJsonApi({
          action: 'check_fetch',
          code,
        });

        const files = data.files;
        if (Array.isArray(files) && files.length > 0) {
          let html = '';

          files.forEach((f, idx) => {
            const url = 'https://cloudpan.doremii.top/wp-content/uploads/file-recorderdld.php?code=' + encodeURIComponent(code);
            if (idx > 0) html += '<br/>';
            html += '<a href="' + url + '" target="_blank" rel="noopener">下载：' + f.filename + '</a>';
          });

          downloadArea.innerHTML = html;
          return;
        }

        const url = data.download_url;
        downloadArea.innerHTML =
          '<a href="' + url + '" target="_blank">点击下载：' + (data.filename || code) + '</a>';


      } catch (e) {
        alert(e.message || '未找到文件');
      } finally {
        fetchBtn.disabled = false;
      }
    };
  }
}

if (!customElements.get('doremii-file-recorder')) {
  customElements.define('doremii-file-recorder', DoreFileRecorder);
}
