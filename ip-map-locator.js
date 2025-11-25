// ip-map-locator.js
// 版本号：v20251123g
// 目标：只采信“中文地址库”（ipip + 高德）
// 改动点（保守）：
// 1) 位置栏不再显示 ipapi 的英文地址，避免与中文冲突
// 2) 海外优先用 ipip 给的中文地名 → 高德 Geocoder.getLocation() 求坐标，地图与中文一致
// 3) 只有当中文地名无法解析坐标时，才兜底用 ipapi 坐标 + 高德反查得到中文

function hasChinese(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ''));
}

function safeJoin(arr) {
  return (arr || []).filter(function (x) { return !!x; }).join(' ');
}

function isChinaCountryName(country) {
  return country === '中国' || country === '中国台湾' || country === '中国香港' || country === '中国澳门';
}

function isChinaIp(ipData) {
  if (!ipData || !Array.isArray(ipData.location)) return false;
  var country = (ipData.location[0] || '').toString();
  return isChinaCountryName(country);
}

// 把 ipip 返回的 location 里“运营商/骨干网/域名”等噪声尽量去掉，保留地名用于地理编码
function shortPlaceFromCnDesc(cnDesc) {
  var s = String(cnDesc || '').trim();
  if (!s) return '';
  var parts = s.split(/\s+/).filter(Boolean);

  // 只保留前 3~4 段最像“国家/省/市/区”的信息
  // 示例：日本 东京都 东京 cogentco.com  -> 日本 东京都 东京
  // 示例：中国 山东 青岛 CHINA UNICOM -> 中国 山东 青岛
  var out = [];
  for (var i = 0; i < parts.length && out.length < 4; i++) {
    var p = parts[i];
    // 过滤明显噪声
    if (/[A-Za-z]/.test(p) || /\./.test(p)) continue;
    if (/(联通|移动|电信|铁通|网通|教育网|广电|骨干网|Backbone|UNICOM|TELECOM|MOBILE|BGP|IDC)/i.test(p)) continue;
    out.push(p);
  }
  // 如果过滤过头导致太短，就退一步取前三段
  if (out.length < 2) out = parts.slice(0, 3);
  return out.join(' ');
}

// 1) ipip：当前访问者 IP + 中文位置
function fetchIpInfo() {
  return fetch('https://myip.ipip.net/json', { cache: 'no-store' })
    .then(function (res) { return res.json(); })
    .then(function (json) {
      if (json && json.ret === 'ok' && json.data) return json.data;
      throw new Error('IP 接口返回异常');
    })
    .catch(function (err) {
      console.error('获取 IP 信息失败：', err);
      return null;
    });
}

// 2) ipapi：仅用于兜底取坐标（不再用于展示地址）
function fetchIpApi(ip) {
  var url = ip
    ? ('https://ipapi.co/' + encodeURIComponent(ip) + '/json/')
    : 'https://ipapi.co/json/';

  return fetch(url, { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('ipapi HTTP 错误：' + res.status);
      return res.json();
    })
    .then(function (data) {
      if (!data || data.error) return null;
      return data;
    })
    .catch(function (err) {
      console.error('ipapi 获取失败：', err);
      return null;
    });
}

// 3) 高德：地理编码（中文地名->坐标）
function geocodeAMap(address) {
  return new Promise(function (resolve) {
    address = String(address || '').trim();
    if (!address) return resolve(null);

    AMap.plugin('AMap.Geocoder', function () {
      var geocoder = new AMap.Geocoder({ extensions: 'base' });
      geocoder.getLocation(address, function (status, result) {
        if (status !== 'complete' || !result || !result.geocodes || !result.geocodes.length) {
          return resolve(null);
        }
        var loc = result.geocodes[0].location;
        if (!loc) return resolve(null);
        resolve([loc.lng, loc.lat]);
      });
    });
  });
}

// 4) 高德：反向地理编码（坐标->中文地址）
function reverseGeocodeAMap(lng, lat) {
  return new Promise(function (resolve) {
    AMap.plugin('AMap.Geocoder', function () {
      var geocoder = new AMap.Geocoder({ radius: 1000, extensions: 'base' });
      geocoder.getAddress([lng, lat], function (status, result) {
        if (status !== 'complete' || !result || !result.regeocode) return resolve(null);
        var comp = result.regeocode.addressComponent || {};
        resolve({
          formattedAddress: result.regeocode.formattedAddress || '',
          country: comp.country || '',
          province: comp.province || '',
          city: (Array.isArray(comp.city) ? comp.city.join('') : (comp.city || '')),
          district: comp.district || ''
        });
      });
    });
  });
}

// 5) 高德：按行政区边界缩放（中国用）
function fitByDistrictSearch(map, opts) {
  return new Promise(function (resolve) {
    if (!opts || !opts.regionName) return resolve(false);

    AMap.plugin('AMap.DistrictSearch', function () {
      var ds = new AMap.DistrictSearch({
        level: opts.level || 'city',
        subdistrict: 0,
        extensions: 'all'
      });

      ds.search(opts.regionName, function (status, result) {
        if (status !== 'complete' || !result || !result.districtList || !result.districtList.length) {
          return resolve(false);
        }

        var d = result.districtList[0];
        var boundaries = d.boundaries;
        if (!boundaries || !boundaries.length) return resolve(false);

        map.clearMap();

        var polygons = boundaries.map(function (b) {
          return new AMap.Polygon({
            path: b,
            strokeWeight: 1,
            strokeColor: '#409EFF',
            fillOpacity: 0.05,
            fillColor: '#409EFF'
          });
        });

        map.add(polygons);

        var center = d.center;
        var marker = new AMap.Marker({ position: center, map: map });
        map.setFitView([].concat(polygons, [marker]));

        resolve(true);
      });
    });
  });
}

// 6) 中国：优先按 ipip 行政区缩放，避免“假精确点”
function drawChinaByIpipDistrict(map, ipData) {
  return new Promise(function (resolve) {
    if (!isChinaIp(ipData)) return resolve(false);

    var loc = ipData.location || [];
    var province = (loc[1] || '').toString();
    var city = (loc[2] || '').toString();
    var third = (loc[3] || '').toString();

    // third 可能是区县，也可能是运营商，这里谨慎判断
    var bad = /(联通|移动|电信|铁通|网通|教育网|广电|backbone|unicom|telecom|mobile|china|cn|bgp|idc)/i;
    var district = (third && /[区县旗州市]/.test(third) && !bad.test(third)) ? third : '';

    var level, regionName;
    if (district) {
      level = 'district';
      regionName = (province || '') + (city || '') + district;
    } else if (city) {
      level = 'city';
      regionName = (city === province || !province) ? city : (province + city);
    } else if (province) {
      level = 'province';
      regionName = province;
    } else {
      return resolve(false);
    }

    fitByDistrictSearch(map, { level: level, regionName: regionName }).then(resolve);
  });
}

// 7) 设置地图点位（海外/兜底）
function setMarkerView(map, lnglat, zoom) {
  map.clearMap();
  var marker = new AMap.Marker({ position: lnglat, map: map });
  if (zoom) map.setZoomAndCenter(zoom, lnglat);
  map.setFitView([marker]);
}

// 8) 核心：定位并显示（只展示中文）
function locateOnlyChinese(map, ip, ipSpan, locSpan, cnDescFromIpip) {
  // 先准备中文展示文本（只取中文来源）
  var cnDesc = String(cnDescFromIpip || '').trim();

  // 展示 IP（始终）
  if (ipSpan) ipSpan.textContent = ip || (ipSpan.textContent || '未知 IP');

  // ① 如果 cnDesc 有中文（ipip 给得靠谱），优先让地图“跟中文走”
  if (cnDesc && hasChinese(cnDesc)) {
    if (locSpan) locSpan.textContent = cnDesc;

    // 中国：优先行政区边界
    if (cnDesc.indexOf('中国') === 0) {
      // 这里地图由 drawChinaByIpipDistrict 处理；locateOnlyChinese 只做备用兜底
      return Promise.resolve(true);
    }

    // 海外：用高德把中文地名编码成坐标（不要用 ipapi 的英文/坐标去“打架”）
    var place = shortPlaceFromCnDesc(cnDesc);
    return geocodeAMap(place).then(function (lnglat) {
      if (lnglat) {
        setMarkerView(map, lnglat, 11);
        return true;
      }
      // 中文地名编码失败：才兜底用 ipapi 坐标 + 高德反查中文
      return fetchIpApi(ip).then(function (data) {
        if (!data) return false;
        var lat = data.latitude, lng = data.longitude;
        if (typeof lat === 'string') lat = parseFloat(lat);
        if (typeof lng === 'string') lng = parseFloat(lng);
        if (!isFinite(lat) || !isFinite(lng)) return false;

        setMarkerView(map, [lng, lat], 11);
        return reverseGeocodeAMap(lng, lat).then(function (rg) {
          if (rg && rg.formattedAddress && hasChinese(rg.formattedAddress)) {
            if (locSpan) locSpan.textContent = rg.formattedAddress;
          }
          return true;
        });
      });
    });
  }

  // ② 没有中文：本次只能兜底（ipapi 拿坐标，但地址用高德反查中文）
  return fetchIpApi(ip).then(function (data2) {
    if (!data2) return false;

    var lat2 = data2.latitude, lng2 = data2.longitude;
    if (typeof lat2 === 'string') lat2 = parseFloat(lat2);
    if (typeof lng2 === 'string') lng2 = parseFloat(lng2);
    if (!isFinite(lat2) || !isFinite(lng2)) return false;

    setMarkerView(map, [lng2, lat2], 11);
    return reverseGeocodeAMap(lng2, lat2).then(function (rg2) {
      if (rg2 && rg2.formattedAddress && hasChinese(rg2.formattedAddress)) {
        if (locSpan) locSpan.textContent = rg2.formattedAddress;
      } else {
        if (locSpan) locSpan.textContent = '未知位置';
      }
      return true;
    });
  });
}

// 9) 初始化
function initIpMap() {
  var ipSpan = document.getElementById('ip-value');
  var locSpan = document.getElementById('location-value');
  var mapContainer = document.getElementById('map');
  var manualInput = document.getElementById('manual-ip-input');
  var manualBtn = document.getElementById('manual-ip-btn');

  if (!mapContainer || typeof AMap === 'undefined') {
    console.error('地图容器或 AMap 未准备好');
    return;
  }

  var map = new AMap.Map('map', { viewMode: '2D', zoom: 4, center: [105, 35] });

  // 自动模式：用 ipip 的中文为主
  fetchIpInfo().then(function (ipData) {
    var ip = ipData && ipData.ip ? ipData.ip : '';
    var cnDesc = ipData && Array.isArray(ipData.location) ? safeJoin(ipData.location) : '';

    if (ipSpan) ipSpan.textContent = ip || '获取失败';
    if (locSpan) locSpan.textContent = cnDesc || '未知位置';

    // 中国优先行政区边界
    drawChinaByIpipDistrict(map, ipData).then(function (okChina) {
      if (okChina) return;

      // 非中国：只采信中文（ipip 若含中文就用它；否则用高德反查）
      locateOnlyChinese(map, ip, ipSpan, locSpan, cnDesc);
    });
  });

  // 手动 track：无法用 ipip 查询任意 IP，所以只能“地址用高德中文反查”，但仍不展示英文
  function triggerManualSearch() {
    var value = (manualInput && manualInput.value ? manualInput.value : '').trim();
    if (!value) return;

    if (ipSpan) ipSpan.textContent = value;
    if (locSpan) locSpan.textContent = '查询中...';

    // 手动：没有 ipip 中文，走兜底路径（ipapi 坐标 + 高德反查中文）
    locateOnlyChinese(map, value, ipSpan, locSpan, '');
  }

  if (manualBtn) manualBtn.addEventListener('click', triggerManualSearch);
  if (manualInput) {
    manualInput.addEventListener('keydown', function (e) {
      var key = e.key || e.keyCode;
      if (key === 'Enter' || key === 13) {
        e.preventDefault();
        triggerManualSearch();
      }
    });
  }
}

// DOM ready
(function () {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initIpMap();
  } else {
    document.addEventListener('DOMContentLoaded', initIpMap);
  }
})();
