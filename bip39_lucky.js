(function () {
  'use strict';

  window.__BIP39_APP_LOADED = true;

  function $(id) { return document.getElementById(id); }
  function safeGet(id, missing) { var el = $(id); if (!el) missing.push(id); return el; }

  var ASSET_BASE = '/wp-content/uploads/crypto_files/';
  var ALPH = '0123456789abcdefghijklmnopqrstuvwxyz';

  function bootMain() {
    var missing = [];

    var elMnemonic = safeGet('mnemonic', missing);
    var elCnPreview = safeGet('cnPreview', missing);
    var elPass = safeGet('passphrase', missing);
    var elIndex = safeGet('addrIndex', missing);

    var elBtcNet = safeGet('btcNet', missing);
    var elBtcType = safeGet('btcType', missing);
    var elBtcPath = safeGet('btcPath', missing);
    var elEthPath = safeGet('ethPath', missing);
    var elSolPath = safeGet('solPath', missing);
    var elTrxPath = safeGet('trxPath', missing);

    var elStatus = safeGet('status', missing);
    var elOut = safeGet('out', missing);

    var btnLucky = safeGet('btnLucky', missing);
    var btnRand24 = safeGet('btnRand24', missing);
    var btnToggleSecrets = safeGet('btnToggleSecrets', missing);
    var btnClear = safeGet('btnClear', missing);

    var histList = safeGet('histList', missing);
    var elHitCount = safeGet('hitCount', missing);
    var elTryCount = safeGet('tryCount', missing);
    var elRate = safeGet('rate', missing);
    var elWorkers = safeGet('workers', missing);
    var btnClearHist = safeGet('btnClearHist', missing);
    var fltRun = safeGet('fltRun', missing);
    var fltSame = safeGet('fltSame', missing);

    
    var fltBTC = safeGet('fltBTC', missing);
    var fltETH = safeGet('fltETH', missing);
    var fltSOL = safeGet('fltSOL', missing);
    var fltTRX = safeGet('fltTRX', missing);
function setStatus(msg, ok) {
      elStatus.textContent = msg;
      elStatus.classList.remove('ok', 'bad');
      if (ok === true) elStatus.classList.add('ok');
      if (ok === false) elStatus.classList.add('bad');
    }

    if (missing.length) { setStatus('❌ HTML 缺少组件 id：\n' + missing.join(', '), false); return; }

    setStatus('✅ JS 已加载，正在检查依赖库…', true);

    function ensureLibs() {
      if (!window.ethers) return 'ethers 未加载（ethers.umd.min.js）';
      if (!window.bitcoin) return 'bitcoinjs bundle 未加载（bitcoinjs-lib.standalone.min.js）';
      if (!window.bitcoin.payments || !window.bitcoin.networks) return 'bitcoin 全局对象不完整（缺 payments/networks）';
      if (!window.bitcoin.ECPair) return 'bitcoin 全局对象缺 ECPair（你的 bundle 没导出 ECPair）';
      if (!window.solbundle || !window.solbundle.solanaWeb3 || !window.solbundle.ed25519HdKey) {
        return 'SOL bundle 未加载（solana-bundle.standalone.min.js）。需要提供全局 solbundle.solanaWeb3 / solbundle.ed25519HdKey';
      }
      return '';
    }

    var libErr = ensureLibs();
    if (libErr) { setStatus('❌ 依赖库未就绪：' + libErr, false); return; }


    // ---------- Mnemonic 中文对照（bip39_enwithcn.txt） ----------
    var cnMap = null;
    var cnReady = false;
    var cnLoading = false;
    var cnFailed = false;

    function getSelfDir() {
      var src = '';
      try {
        if (document.currentScript && document.currentScript.src) src = document.currentScript.src;
      } catch (e) {}
      if (!src) {
        var ss = document.getElementsByTagName('script');
        for (var i = ss.length - 1; i >= 0; i--) {
          var s = ss[i] && ss[i].src ? ss[i].src : '';
          if (s && s.indexOf('bip39_lucky.js') !== -1) { src = s; break; }
        }
      }
      try {
        if (!src) return new URL(ASSET_BASE, window.location.href).toString();
        var u = new URL(src, window.location.href);
        u.search = '';
        return u.toString().replace(/[^\/]+$/, '');
      } catch (e2) {
        return ASSET_BASE;
      }
    }

    function parseCnMap(txt) {
      var m = Object.create(null);
      var lines = String(txt || '').split(/\r?\n/);
      for (var i = 0; i < lines.length; i++) {
        var line = (lines[i] || '').trim();
        if (!line) continue;
        var sp = line.indexOf(' ');
        if (sp < 0) continue;
        var en = line.slice(0, sp).trim().toLowerCase();
        var cn = line.slice(sp + 1).trim();
        if (en) m[en] = cn;
      }
      return m;
    }

    function cnFromPhrase(phrase) {
      if (!cnReady || !cnMap) return '';
      phrase = normMnemonic(phrase);
      if (!phrase) return '';
      var ws = phrase.split(' ');
      var out = [];
      for (var i = 0; i < ws.length; i++) {
        var w = (ws[i] || '').toLowerCase();
        if (!w) continue;
        var cn = cnMap[w];
        if (!cn) cn = '未知';
        out.push(cn);
      }
      if (!out.length) return '';
      var s = '';
      for (var j = 0; j < out.length; j++) {
        s += out[j];
        if (j !== out.length - 1) {
          if (j % 6 === 5) s += '\n';
          else s += ' ';
        }
      }
      return s;
    }

    function updateCnPreview() {
      if (!elCnPreview) return;
      if (!cnReady) return;
      var phrase = normMnemonic(elMnemonic.value);
      if (!phrase) { elCnPreview.textContent = ''; return; }
      elCnPreview.textContent = cnFromPhrase(phrase);
    }

    function loadCnMap() {
      if (cnReady || cnLoading) return;
      cnLoading = true;

      var dir = getSelfDir();
      var url = dir + 'bip39_enwithcn.txt?v=' + Date.now();

      // 只有在加载确实慢时才显示提示，避免“卡在加载中”的错觉
      var slowTimer = setTimeout(function(){
        if (!cnReady && !cnFailed && elCnPreview) {
          elCnPreview.textContent = '中文对照加载中…';
          elCnPreview.classList.add('muted');
        }
      }, 450);

      fetch(url, { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function (txt) {
          cnMap = parseCnMap(txt);
          cnReady = true;
          cnLoading = false;
          clearTimeout(slowTimer);
          if (elCnPreview) { elCnPreview.classList.remove('muted'); }
          updateCnPreview();
          // 让历史记录也补上中文对照
          try { renderHistory(); } catch(e) {}
        })
        .catch(function (e) {
          cnFailed = true;
          cnLoading = false;
          clearTimeout(slowTimer);
          if (elCnPreview) {
            elCnPreview.textContent = '中文对照不可用';
            elCnPreview.classList.add('muted');
          }
          // 不影响主功能
        });
    }


    function normMnemonic(s) {
      s = String(s || '').trim();
      s = s.replace(/\u3000/g, ' ');
      s = s.replace(/\s+/g, ' ');
      return s.trim();
    }
    function replaceIndex(path, index) { path = String(path || '').trim(); return path.replace(/\{index\}/g, String(index)); }

    function clearOutput() { elOut.innerHTML = ''; }

    function addKV(title, value, canCopy) {
      var box = document.createElement('div'); box.className = 'kv';
      var k = document.createElement('div'); k.className = 'k'; k.textContent = title;
      var v = document.createElement('div'); v.className = 'v'; v.textContent = String(value || '');
      box.appendChild(k); box.appendChild(v);

      if (canCopy) {
        var mini = document.createElement('div'); mini.className = 'minirow';
        var b = document.createElement('button'); b.className = 'copy'; b.textContent = '复制';
        b.addEventListener('click', function () { navigator.clipboard.writeText(String(value || '')).catch(function () {}); });
        mini.appendChild(b); box.appendChild(mini);
      }
      elOut.appendChild(box);
    }

    function nowStr() {
      var d = new Date();
      function z(n){ return (n < 10 ? '0' : '') + n; }
      return d.getFullYear() + '-' + z(d.getMonth()+1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds());
    }

    function bytesToHex(u8) {
      var hex = '';
      for (var i = 0; i < u8.length; i++) {
        var h = u8[i].toString(16);
        if (h.length === 1) h = '0' + h;
        hex += h;
      }
      return hex;
    }

    function tail4(s) {
      s = String(s || '').toLowerCase();
      if (s.startsWith('0x')) s = s.slice(2);
      return s.slice(-4);
    }

    // ---------- BTC ----------
    var showSecrets = false;

    function applyDefaultBtcPath() {
      var net = elBtcNet.value;
      var type = elBtcType.value;
      var coin = (net === 'testnet') ? 1 : 0;
      var purpose = (type === 'p2pkh') ? 44 : (type === 'p2sh-p2wpkh' ? 49 : 84);
      elBtcPath.value = "m/" + purpose + "'/" + coin + "'/0'/0/{index}";
    }

    function btcNetworkObj(net) { return (net === 'testnet') ? window.bitcoin.networks.testnet : window.bitcoin.networks.bitcoin; }

    function btcAddressFromPriv(privKeyHex, type, net) {
      var pk = String(privKeyHex || '').replace(/^0x/i, '');
      if (!/^[0-9a-fA-F]{64}$/.test(pk)) throw new Error('BTC 私钥格式异常（应为 32 字节 hex）');
      if (typeof Buffer === 'undefined') throw new Error('Buffer 未定义：bundle 没注入 Buffer');

      var network = btcNetworkObj(net);
      var keyPair = window.bitcoin.ECPair.fromPrivateKey(Buffer.from(pk, 'hex'), { network: network });
      var pubkey = keyPair.publicKey;

      var payment;
      if (type === 'p2pkh') payment = window.bitcoin.payments.p2pkh({ pubkey: pubkey, network: network });
      else if (type === 'p2wpkh') payment = window.bitcoin.payments.p2wpkh({ pubkey: pubkey, network: network });
      else if (type === 'p2sh-p2wpkh') {
        var redeem = window.bitcoin.payments.p2wpkh({ pubkey: pubkey, network: network });
        payment = window.bitcoin.payments.p2sh({ redeem: redeem, network: network });
      } else throw new Error('未知 BTC 地址类型：' + type);

      if (!payment || !payment.address) throw new Error('BTC 地址生成失败（payment.address 为空）');

      return { address: payment.address, wif: keyPair.toWIF(), pubkeyHex: Buffer.from(pubkey).toString('hex') };
    }

    // ---------- ETH / TRX ----------
    function makeHdNodeAtPath(phrase, password, path) {
      return window.ethers.HDNodeWallet.fromPhrase(phrase, password || '', path);
    }

    function tronAddressFromPriv(privKeyHex) {
      var pk = String(privKeyHex || '');
      var sk = new window.ethers.SigningKey(pk);
      var pub = sk.publicKey;
      var pubBytes = window.ethers.getBytes(pub);
      var h = window.ethers.keccak256(pubBytes.slice(1));
      var hBytes = window.ethers.getBytes(h);
      var addr20 = hBytes.slice(12);

      if (typeof Buffer === 'undefined') throw new Error('Buffer 未定义：TRX 需要 Buffer');
      if (!window.bitcoin.address || typeof window.bitcoin.address.toBase58Check !== 'function') {
        throw new Error('bitcoin.address.toBase58Check 不可用：TRX base58check 需要该函数');
      }
      var tron = window.bitcoin.address.toBase58Check(Buffer.from(addr20), 0x41);
      return { address: tron, hex: '41' + Buffer.from(addr20).toString('hex') };
    }

    // ---------- SOL ----------
    function solFromMnemonic(phrase, pass, solPath) {
      // 使用 BIP39 seed（PBKDF2）→ SLIP-0010 ed25519 派生
      var m = window.ethers.Mnemonic.fromPhrase(phrase);
      var seed = m.computeSeed(pass || ''); // 可能是 Uint8Array 或 0x..hex
      var seedBytes = (typeof seed === 'string') ? window.ethers.getBytes(seed) : seed;
      var seedHex = bytesToHex(seedBytes); // ed25519-hd-key 需要 hex string（不带 0x）

      var path = String(solPath || '').trim();
      var derived = window.solbundle.ed25519HdKey.derivePath(path, seedHex);

      var dk = derived && derived.key;
      if (!dk) throw new Error('SOL 派生失败：derived.key 为空');
      if (typeof dk === 'string') dk = window.ethers.getBytes(dk);
      var kp = window.solbundle.solanaWeb3.Keypair.fromSeed(dk);
      var addr = kp.publicKey.toBase58();
      return { address: addr, pubBase58: addr, secretKey: kp.secretKey }; // secretKey is Uint8Array(64)
    }

    function generateAllOnce(phrase, pass, idx, opts) {
      var btcPath = replaceIndex(opts.btcPathTmpl, idx);
      var ethPath = replaceIndex(opts.ethPathTmpl, idx);
      var solPath = replaceIndex(opts.solPathTmpl, idx);
      var trxPath = replaceIndex(opts.trxPathTmpl, idx);

      var ethNode = makeHdNodeAtPath(phrase, pass, ethPath);
      var ethAddr = ethNode.address;

      var btcNode = makeHdNodeAtPath(phrase, pass, btcPath);
      var btcRes = btcAddressFromPriv(btcNode.privateKey, opts.btcType, opts.btcNet);

      var solRes = solFromMnemonic(phrase, pass, solPath);

      var trxNode = makeHdNodeAtPath(phrase, pass, trxPath);
      var trxRes = tronAddressFromPriv(trxNode.privateKey);

      return {
        paths: { btc: btcPath, eth: ethPath, sol: solPath, trx: trxPath },
        btc: { address: btcRes.address, pub: btcRes.pubkeyHex, wif: btcRes.wif },
        eth: { address: ethAddr, pub: ethNode.publicKey, priv: ethNode.privateKey },
        sol: { address: solRes.address, pub: solRes.pubBase58, secretHex: bytesToHex(solRes.secretKey) },
        trx: { address: trxRes.address, hex: trxRes.hex, priv: trxNode.privateKey }
      };
    }

    function randomMnemonic24() {
      try {
        var entropy = window.ethers.randomBytes(32);
        var m = window.ethers.Mnemonic.fromEntropy(entropy);
        elMnemonic.value = m.phrase;
        setStatus('✅ 已生成随机 24 词（测试用）', true);
      } catch (e) {
        setStatus('生成随机助记词失败：' + (e && e.message ? e.message : String(e)), false);
      }
    }

    function generateUI(opts) {
      opts = opts || {};
      clearOutput();

      var phrase = normMnemonic(elMnemonic.value);
      var pass = String(elPass.value || '');
      var words = phrase ? phrase.split(' ') : [];

      if (words.length < 12 || words.length > 24) { setStatus('❌ 助记词单词数异常：当前 ' + words.length + '（常见 12/15/18/21/24）', false); return; }

      var idx = parseInt(String(elIndex.value || '0'), 10);
      if (!isFinite(idx) || idx < 0 || idx > 2147483647) { setStatus('❌ 地址索引不合法：' + elIndex.value, false); return; }

      try { window.ethers.Mnemonic.fromPhrase(phrase); }
      catch (e) { setStatus('❌ 助记词校验失败：' + (e && e.message ? e.message : String(e)), false); return; }

      var opts = {
        btcNet: elBtcNet.value,
        btcType: elBtcType.value,
        btcPathTmpl: String(elBtcPath.value || ''),
        ethPathTmpl: String(elEthPath.value || ''),
        solPathTmpl: String(elSolPath.value || ''),
        trxPathTmpl: String(elTrxPath.value || '')
      };

      try {
        var res = generateAllOnce(phrase, pass, idx, opts);

        if (opts && opts.live) {
          setStatus('✅ 已实时生成（不入历史）', true);
        } else {
          setStatus(
            `✅ 生成成功
索引：${idx}
BTC 路径：${res.paths.btc}
ETH 路径：${res.paths.eth}
SOL 路径：${res.paths.sol}
TRX 路径：${res.paths.trx}`,
            true
          );
}

        addKV('BTC 地址', res.btc.address, true);
        addKV('ETH 地址', res.eth.address, true);
        addKV('SOL 地址', res.sol.address, true);
        addKV('TRX 地址', res.trx.address, true);

        addKV('BTC 公钥 (hex)', res.btc.pub, true);
        addKV('ETH 公钥 (compressed hex)', res.eth.pub, true);

        if (showSecrets) {
          addKV('⚠️ BTC 私钥 WIF（请勿泄露）', res.btc.wif, true);
          addKV('⚠️ ETH 私钥 hex（请勿泄露）', res.eth.priv, true);
          addKV('⚠️ SOL secretKey hex(64B)（请勿泄露）', res.sol.secretHex, true);
          addKV('⚠️ TRX 私钥 hex（请勿泄露）', res.trx.priv, true);
        } else {
          addKV('私钥', '已隐藏（点击“显示/隐藏私钥”查看）', false);
        }
      } catch (e) {
        setStatus('❌ 生成失败：' + (e && e.message ? e.message : String(e)), false);
      }
    }

    function buildMap() {
      var m = Object.create(null);
      for (var i = 0; i < ALPH.length; i++) m[ALPH[i]] = i;
      return m;
    }
    var MAP = buildMap();

    function matchTail4Kind(addr) {
      var t = tail4(addr);
      if (t.length !== 4) return null;

      var idx = [];
      for (var i = 0; i < 4; i++) {
        var ch = t[i];
        var v = MAP[ch];
        if (v === undefined) return null;
        idx.push(v);
      }

      if (t[0] === t[1] && t[1] === t[2] && t[2] === t[3]) {
        return { kind: '豹子4', tail: t };
      }

      var inc = (idx[1] === idx[0] + 1) && (idx[2] === idx[1] + 1) && (idx[3] === idx[2] + 1);
      var dec = (idx[1] === idx[0] - 1) && (idx[2] === idx[1] - 1) && (idx[3] === idx[2] - 1);

      if (inc || dec) return { kind: '顺子4', tail: t };
      return null;
    }

    // ---------- History + filter ----------
    var HIST_MAX = 150;
    var history = [];
    var triesTotal = 0;
    var hitsTotal = 0;

    var triesLast = 0;
    var tsLast = Date.now();
    var rateTimer = null;

    var luckyRunning = false;
    var luckyWorkers = [];

    function updateCountersUI() {
      elTryCount.textContent = 'tries: ' + triesTotal;
      elHitCount.textContent = 'hits: ' + hitsTotal;
      elWorkers.textContent = 'workers: ' + luckyWorkers.length;
    }

    function startRateTimer() {
      if (rateTimer) clearInterval(rateTimer);
      triesLast = triesTotal;
      tsLast = Date.now();
      rateTimer = setInterval(function () {
        var now = Date.now();
        var dt = (now - tsLast) / 1000;
        if (dt <= 0) return;
        var d = triesTotal - triesLast;
        var r = d / dt;
        elRate.textContent = 'rate: ' + (r >= 1000 ? r.toFixed(0) : r.toFixed(1)) + '/s';
        triesLast = triesTotal;
        tsLast = now;
      }, 800);
    }

    function stopRateTimer() {
      if (rateTimer) clearInterval(rateTimer);
      rateTimer = null;
      elRate.textContent = 'rate: 0/s';
    }

    function passesFilter(kind, chain) {
      // kind: '顺子4' or '豹子4'
      // chain: 'BTC'/'ETH'/'SOL'/'TRX'
      var showRun = !!fltRun.checked;
      var showSame = !!fltSame.checked;

      // —— 先按“顺子/豹子”过滤（保持你原来的逻辑）——
      var passKind = false;
      if (showRun && showSame) passKind = true;
      else if (!showRun && !showSame) passKind = true;
      else if (showRun && String(kind || '').indexOf('顺子') === 0) passKind = true;
      else if (showSame && String(kind || '').indexOf('豹子') === 0) passKind = true;

      if (!passKind) return false;

      // —— 再按“链”过滤（与运算：在通过顺子/豹子后，再决定是否显示该链）——
      var sBTC = !!fltBTC.checked;
      var sETH = !!fltETH.checked;
      var sSOL = !!fltSOL.checked;
      var sTRX = !!fltTRX.checked;

      // 四个都勾选：不过滤
      if (sBTC && sETH && sSOL && sTRX) return true;

      // 四个都不勾：按你“顺子/豹子”的风格，视为不过滤（避免一不小心全空）
      if (!sBTC && !sETH && !sSOL && !sTRX) return true;

      chain = String(chain || '').toUpperCase();
      if (chain === 'BTC') return sBTC;
      if (chain === 'ETH') return sETH;
      if (chain === 'SOL') return sSOL;
      if (chain === 'TRX') return sTRX;

      // 未知链：保守显示
      return true;
    }


    function renderHistory() {
      histList.innerHTML = '';
      for (var i = 0; i < history.length; i++) {
        var it = history[i];
        if (!passesFilter(it.kind, it.chain)) continue;

        var box = document.createElement('div');
        box.className = 'kv';

        var k = document.createElement('div');
        k.className = 'k';
        k.textContent =
          '#' + (history.length - i) + '  ' + it.when +
          '  [' + it.chain + '] ' + it.kind + '  tail4=' + it.tail4;

        var v = document.createElement('div');
        v.className = 'v';
        v.textContent =
          'mnemonic: ' + it.mnemonic + '\n' +
          'BTC: ' + it.btc + '\n' +
          'ETH: ' + it.eth + '\n' +
          'SOL: ' + it.sol + '\n' +
          'TRX: ' + it.trx;

        box.appendChild(k);
        box.appendChild(v);

        // 中文对照（仅中文，不重复英文）
        if (cnReady && cnMap) {
          var cn = cnFromPhrase(it.mnemonic);
          if (cn) {
            var ck = document.createElement('div');
            ck.className = 'k';
            ck.textContent = '中文对照';
            var cv = document.createElement('div');
            cv.className = 'v';
            cv.textContent = cn;
            box.appendChild(ck);
            box.appendChild(cv);
          }
        }

        var mini = document.createElement('div');
        mini.className = 'minirow';

        function mkCopy(text, label){
          var b = document.createElement('button');
          b.className = 'copy';
          b.textContent = label;
          b.addEventListener('click', function () {
            navigator.clipboard.writeText(String(text || '')).catch(function () {});
          });
          return b;
        }

        mini.appendChild(mkCopy(it.mnemonic, '复制助记词'));
        mini.appendChild(mkCopy(it.btc, '复制 BTC'));
        mini.appendChild(mkCopy(it.eth, '复制 ETH'));
        mini.appendChild(mkCopy(it.sol, '复制 SOL'));
        mini.appendChild(mkCopy(it.trx, '复制 TRX'));

        box.appendChild(mini);
        histList.appendChild(box);
      }
    }

    function pushHistory(item) {
      history.unshift(item);
      if (history.length > HIST_MAX) history.length = HIST_MAX;
      renderHistory();
    }

    function setLuckyButton(running) {
      if (running) { btnLucky.textContent = 'Calcu...'; btnLucky.classList.add('warn'); }
      else { btnLucky.textContent = 'LUCKY'; btnLucky.classList.remove('warn'); }
    }

    function disableWhenLucky(running) {
      btnRand24.disabled = running;
      btnClear.disabled = running;
      elMnemonic.disabled = running;
      elPass.disabled = running;
      elIndex.disabled = running;
      elBtcNet.disabled = running;
      elBtcType.disabled = running;
      elBtcPath.disabled = running;
      elEthPath.disabled = running;
      elSolPath.disabled = running;
      elTrxPath.disabled = running;
    }

    function absUrl(path) { return new URL(path, window.location.origin).toString(); }

    function buildWorkerScript(ethersUrl, bitcoinUrl, solUrl) {
      return `
        // polyfills for browser-worker environment
        self.global = self.global || self;
        self.process = self.process || { env: {}, browser: true, nextTick: function (fn) { Promise.resolve().then(fn); } };
        // Buffer 通常由 bitcoinjs bundle 注入；如果没有，SOL bundle 可能仍会失败

        self.importScripts(${JSON.stringify(ethersUrl)}, ${JSON.stringify(bitcoinUrl)}, ${JSON.stringify(solUrl)});

        var ALPH = ${JSON.stringify(ALPH)};
        function buildMap(alph){
          var m = Object.create(null);
          for (var i=0;i<alph.length;i++) m[alph[i]] = i;
          return m;
        }
        var MAP = buildMap(ALPH);

        function norm(s){ return String(s||'').toLowerCase(); }
        function tail4(s){
          s = norm(s);
          if(s.startsWith('0x')) s = s.slice(2);
          return s.slice(-4);
        }

        function matchTail4Kind(addr){
          var t = tail4(addr);
          if(t.length !== 4) return null;

          var idx = [];
          for(var i=0;i<4;i++){
            var v = MAP[t[i]];
            if(v===undefined) return null;
            idx.push(v);
          }

          if(t[0]===t[1] && t[1]===t[2] && t[2]===t[3]){
            return { kind:'豹子4', tail:t };
          }

          var inc = (idx[1]===idx[0]+1) && (idx[2]===idx[1]+1) && (idx[3]===idx[2]+1);
          var dec = (idx[1]===idx[0]-1) && (idx[2]===idx[1]-1) && (idx[3]===idx[2]-1);

          if(inc || dec) return { kind:'顺子4', tail:t };
          return null;
        }

        function bytesToHex(u8){
          var hex='';
          for(var i=0;i<u8.length;i++){
            var h=u8[i].toString(16);
            if(h.length===1) h='0'+h;
            hex+=h;
          }
          return hex;
        }

        function normPath(path, idx){
          return String(path||'').replace(/\\{index\\}/g, String(idx));
        }

        function btcNetObj(net){
          return (net==='testnet') ? self.bitcoin.networks.testnet : self.bitcoin.networks.bitcoin;
        }

        function btcAddrFromPriv(privKeyHex, type, net){
          var pk=String(privKeyHex||'').replace(/^0x/i,'');
          if(!/^[0-9a-fA-F]{64}$/.test(pk)) throw new Error('bad btc priv');
          var network=btcNetObj(net);
          var keyPair=self.bitcoin.ECPair.fromPrivateKey(Buffer.from(pk,'hex'), {network:network});
          var pubkey=keyPair.publicKey;

          var payment;
          if(type==='p2pkh'){
            payment=self.bitcoin.payments.p2pkh({pubkey:pubkey, network:network});
          }else if(type==='p2wpkh'){
            payment=self.bitcoin.payments.p2wpkh({pubkey:pubkey, network:network});
          }else if(type==='p2sh-p2wpkh'){
            var redeem=self.bitcoin.payments.p2wpkh({pubkey:pubkey, network:network});
            payment=self.bitcoin.payments.p2sh({redeem:redeem, network:network});
          }else{
            throw new Error('bad btc type');
          }
          if(!payment || !payment.address) throw new Error('no btc addr');
          return payment.address;
        }

        function tronAddrFromPriv(privKeyHex){
          var sk = new self.ethers.SigningKey(String(privKeyHex||''));
          var pub = sk.publicKey;
          var pubBytes = self.ethers.getBytes(pub);
          var h = self.ethers.keccak256(pubBytes.slice(1));
          var hBytes = self.ethers.getBytes(h);
          var addr20 = hBytes.slice(12);
          if(!self.bitcoin.address || typeof self.bitcoin.address.toBase58Check !== 'function') throw new Error('no toBase58Check');
          return self.bitcoin.address.toBase58Check(Buffer.from(addr20), 0x41);
        }

        function solAddrFromMnemonic(phrase, pass, solPath){
          var m = self.ethers.Mnemonic.fromPhrase(phrase);
          var seed = m.computeSeed(pass||''); // Uint8Array(64) 或 0x..hex
          var seedBytes = (typeof seed === 'string') ? self.ethers.getBytes(seed) : seed;
          var seedHex = bytesToHex(seedBytes);
          var derived = self.solbundle.ed25519HdKey.derivePath(solPath, seedHex);
          var kp = self.solbundle.solanaWeb3.Keypair.fromSeed(derived.key);
          return kp.publicKey.toBase58();
        }

        if(!self.solbundle || !self.solbundle.solanaWeb3 || !self.solbundle.ed25519HdKey){
          self.postMessage({ t:'err', m:'SOL bundle 未就绪：solbundle.solanaWeb3/ed25519HdKey 不存在（检查 solana-bundle 打包与加载）' });
        }
        var running=false;

        self.onmessage=function(ev){
          var msg=ev.data||{};
          if(msg.cmd==='stop'){ running=false; return; }

          if(msg.cmd==='start'){
            running=true;

            var pass=String(msg.pass||'');
            var idx=Number(msg.idx||0);

            var btcNet=msg.btcNet||'mainnet';
            var btcType=msg.btcType||'p2wpkh';

            var btcPath=normPath(msg.btcPathTmpl||"m/84'/0'/0'/0/{index}", idx);
            var ethPath=normPath(msg.ethPathTmpl||"m/44'/60'/0'/0/{index}", idx);
            var solPath=normPath(msg.solPathTmpl||"m/44'/501'/{index}'/0'", idx);
            var trxPath=normPath(msg.trxPathTmpl||"m/44'/195'/0'/0/{index}", idx);

            var BATCH=Number(msg.batch||320);
            if(!isFinite(BATCH)||BATCH<50) BATCH=320;

            function step(){
              if(!running) return;

              var localTries=0;

              try{
                for(var i=0;i<BATCH;i++){
                  var entropy=self.ethers.randomBytes(32);
                  var mm=self.ethers.Mnemonic.fromEntropy(entropy);
                  var phrase=mm.phrase;

                  var ethNode=self.ethers.HDNodeWallet.fromPhrase(phrase, pass, ethPath);
                  var ethAddr=ethNode.address;

                  var btcNode=self.ethers.HDNodeWallet.fromPhrase(phrase, pass, btcPath);
                  var btcAddr=btcAddrFromPriv(btcNode.privateKey, btcType, btcNet);

                  var solAddr=solAddrFromMnemonic(phrase, pass, solPath);

                  var trxNode=self.ethers.HDNodeWallet.fromPhrase(phrase, pass, trxPath);
                  var trxAddr=tronAddrFromPriv(trxNode.privateKey);

                  localTries++;

                  var m1=matchTail4Kind(btcAddr);
                  if(m1){
                    self.postMessage({ t:'hit', chain:'BTC', kind:m1.kind, tail4:m1.tail, mnemonic:phrase, btc:btcAddr, eth:ethAddr, sol:solAddr, trx:trxAddr });
                  }else{
                    var m2=matchTail4Kind(ethAddr);
                    if(m2){
                      self.postMessage({ t:'hit', chain:'ETH', kind:m2.kind, tail4:m2.tail, mnemonic:phrase, btc:btcAddr, eth:ethAddr, sol:solAddr, trx:trxAddr });
                    }else{
                      var m3=matchTail4Kind(solAddr);
                      if(m3){
                        self.postMessage({ t:'hit', chain:'SOL', kind:m3.kind, tail4:m3.tail, mnemonic:phrase, btc:btcAddr, eth:ethAddr, sol:solAddr, trx:trxAddr });
                      }else{
                        var m4=matchTail4Kind(trxAddr);
                        if(m4){
                          self.postMessage({ t:'hit', chain:'TRX', kind:m4.kind, tail4:m4.tail, mnemonic:phrase, btc:btcAddr, eth:ethAddr, sol:solAddr, trx:trxAddr });
                        }
                      }
                    }
                  }
                }
              }catch(e){
                self.postMessage({ t:'err', m: (e && e.message) ? e.message : String(e) });
              }

              if(localTries>0) self.postMessage({ t:'stat', n: localTries });

              setTimeout(step, 0);
            }

            step();
          }
        };
      `;
    }

    function startLucky() {
      var pass = String(elPass.value || '');

      var idx = parseInt(String(elIndex.value || '0'), 10);
      if (!isFinite(idx) || idx < 0 || idx > 2147483647) { setStatus('❌ 地址索引不合法：' + elIndex.value, false); return; }

      var cfg = {
        btcNet: elBtcNet.value,
        btcType: elBtcType.value,
        btcPathTmpl: String(elBtcPath.value || ''),
        ethPathTmpl: String(elEthPath.value || ''),
        solPathTmpl: String(elSolPath.value || ''),
        trxPathTmpl: String(elTrxPath.value || '')
      };

      var ethersUrl = absUrl(ASSET_BASE + 'ethers.umd.min.js?v=20251214_6');
      var bitcoinUrl = absUrl(ASSET_BASE + 'bitcoinjs-lib.standalone.min.js?v=20251214_6');
      var solUrl = absUrl(ASSET_BASE + 'solana-bundle.standalone.min.js?v=20251214_6');

      var cores = (navigator.hardwareConcurrency && navigator.hardwareConcurrency > 0) ? navigator.hardwareConcurrency : 4;
      var workerCount = Math.max(1, Math.min(cores, 16));

      luckyWorkers = [];
      startRateTimer();
      updateCountersUI();

      var code = buildWorkerScript(ethersUrl, bitcoinUrl, solUrl);
      var blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));

      for (var i = 0; i < workerCount; i++) {
        var w = new Worker(blobUrl);

        w.onmessage = function (ev) {
          var msg = ev.data || {};
          if (msg.t === 'stat') { triesTotal += (msg.n || 0); updateCountersUI(); return; }
          if (msg.t === 'hit') {
            hitsTotal += 1;
            updateCountersUI();
            pushHistory({
              when: nowStr(),
              chain: msg.chain,
              kind: msg.kind,
              tail4: msg.tail4,
              mnemonic: msg.mnemonic,
              btc: msg.btc,
              eth: msg.eth,
              sol: msg.sol,
              trx: msg.trx
            });
            return;
          }
          if (msg.t === 'err') { setStatus('⚠️ 某个 worker 出错：' + msg.m, false); return; }
        };

        w.onerror = function (e) { setStatus('⚠️ worker 崩溃：' + (e && e.message ? e.message : String(e)), false); };

        w.postMessage({
          cmd: 'start',
          pass: pass,
          idx: idx,
          btcNet: cfg.btcNet,
          btcType: cfg.btcType,
          btcPathTmpl: cfg.btcPathTmpl,
          ethPathTmpl: cfg.ethPathTmpl,
          solPathTmpl: cfg.solPathTmpl,
          trxPathTmpl: cfg.trxPathTmpl,
          batch: 320
        });

        luckyWorkers.push(w);
      }

      URL.revokeObjectURL(blobUrl);

      luckyRunning = true;
      setLuckyButton(true);
      disableWhenLucky(true);
      updateCountersUI();

      setStatus(
        '✅ LUCKY 已启动：BTC/ETH/SOL/TRX 任一链末4为顺子4/豹子4 才记录\n' +
        '顺子顺序：0-9 → a-z（忽略大小写，不回绕）\n' +
        'workers: ' + workerCount,
        true
      );
    }

    function stopLucky() {
      luckyRunning = false;
      setLuckyButton(false);

      for (var i = 0; i < luckyWorkers.length; i++) {
        try { luckyWorkers[i].postMessage({ cmd: 'stop' }); } catch(e){}
        try { luckyWorkers[i].terminate(); } catch(e){}
      }
      luckyWorkers = [];
      updateCountersUI();
      stopRateTimer();
      disableWhenLucky(false);

      setStatus('已停止 LUCKY。', true);
    }

    function toggleLucky() { if (!luckyRunning) startLucky(); else stopLucky(); }

    function clearHistory() {
      history = [];
      renderHistory();
      hitsTotal = 0;
      updateCountersUI();
    }

    btnLucky.addEventListener('click', toggleLucky);
    // —— 实时生成：编辑助记词时自动生成地址（不入历史）——
    var liveTimer = null;
    function scheduleLiveGenerate() {
      if (luckyRunning) return;
      if (liveTimer) clearTimeout(liveTimer);
      liveTimer = setTimeout(function () {
        liveTimer = null;

        var phrase = normMnemonic(elMnemonic.value);
        if (!phrase) { clearOutput(); setStatus(''); return; }

        var words = phrase.split(' ');
        var okCount = (words.length === 12 || words.length === 15 || words.length === 18 || words.length === 21 || words.length === 24);
        if (!okCount) { clearOutput(); return; }

        try { window.ethers.Mnemonic.fromPhrase(phrase); }
        catch (e) { clearOutput(); return; }

        generateUI({ live: true });
      }, 260);
    }

    function bindLive(el, ev) {
      if (!el) return;
      el.addEventListener(ev || 'input', function () {
        updateCnPreview();
        scheduleLiveGenerate();
      });
    }

    // mnemonic / passphrase / index / paths / network & type changes all trigger live update
    bindLive(elMnemonic, 'input');
    bindLive(elPass, 'input');
    bindLive(elIndex, 'input');
    bindLive(elBtcPath, 'input');
    bindLive(elEthPath, 'input');
    bindLive(elSolPath, 'input');
    bindLive(elTrxPath, 'input');
    bindLive(elBtcNet, 'change');
    bindLive(elBtcType, 'change');

    // 生成钱包：随机 24 词 + 立即生成地址
    btnRand24.addEventListener('click', function () {
      if (luckyRunning) return;
      randomMnemonic24();
      updateCnPreview();
      generateUI({ live: false });
    });

    btnToggleSecrets.addEventListener('click', function () {
      showSecrets = !showSecrets;
      setStatus(showSecrets ? '已开启：显示私钥（注意录屏/剪贴板）' : '已关闭：隐藏私钥', true);
      if (elOut.childNodes && elOut.childNodes.length) generateUI();
    });

    btnClear.addEventListener('click', function () {
      if (luckyRunning) return;
      elMnemonic.value = '';
      elPass.value = '';
      elIndex.value = '0';
      applyDefaultBtcPath();
      elEthPath.value = "m/44'/60'/0'/0/{index}";
      elSolPath.value = "m/44'/501'/{index}'/0'";
      elTrxPath.value = "m/44'/195'/0'/0/{index}";
      clearOutput();
      setStatus('已清空。', true);
    });

    btnClearHist.addEventListener('click', clearHistory);
    fltRun.addEventListener('change', renderHistory);
    fltSame.addEventListener('change', renderHistory);

    
    fltBTC.addEventListener('change', renderHistory);
    fltETH.addEventListener('change', renderHistory);
    fltSOL.addEventListener('change', renderHistory);
    fltTRX.addEventListener('change', renderHistory);
elBtcNet.addEventListener('change', applyDefaultBtcPath);
    elBtcType.addEventListener('change', applyDefaultBtcPath);

    applyDefaultBtcPath();
    loadCnMap();
    setLuckyButton(false);
    updateCountersUI();
    renderHistory();

    setStatus('✅ 依赖库已加载。已支持 BTC/ETH/SOL/TRX，并增加历史筛选（顺子/豹子 + 链）。', true);
  }

  try { bootMain(); }
  catch (e) {
    var s = document.getElementById('status');
    if (s) s.textContent = '❌ app.js 初始化异常：' + ((e && e.message) ? e.message : String(e));
    console.error(e);
  }
})();
