// ip-map-locator.js
// 版本号：v20251125V6
// 方案：逆地理为空时，用坐标源(ipwho/ipapi)的 region/city/isp 兜底显示；国家用中文(按国家码映射)

function safeJoin(arr) {
  return (arr || []).filter(function (x) { return !!x; }).join(' ');
}

function firstToken(s) {
  s = String(s || '').trim();
  if (!s) return '';
  return s.split(/\s+/)[0] || '';
}

function parseNum(x) {
  if (typeof x === 'string') x = parseFloat(x);
  return (isFinite(x) ? x : null);
}

function toLngLatArray(lng, lat) {
  lng = parseNum(lng);
  lat = parseNum(lat);
  if (lng == null || lat == null) return null;
  return [lng, lat];
}

function setMarkerView(map, lnglat, zoom) {
  if (!lnglat) return false;
  map.clearMap();
  var marker = new AMap.Marker({ position: lnglat, map: map });
  if (zoom) map.setZoomAndCenter(zoom, lnglat);
  map.setFitView([marker]);
  return true;
}

function isChinaCountryName(country) {
  return country === '中国' || country === '中国台湾' || country === '中国香港' || country === '中国澳门';
}

function isChinaIp(ipData) {
  if (!ipData || !Array.isArray(ipData.location)) return false;
  var country = (ipData.location[0] || '').toString();
  return isChinaCountryName(country);
}

function expectedCountryCodeFromCn(countryCn) {
  var m = {
    '中国': 'CN', '中国香港': 'HK', '中国澳门': 'MO', '中国台湾': 'TW',
    '日本': 'JP', '美国': 'US', '英国': 'GB', '德国': 'DE', '法国': 'FR',
    '加拿大': 'CA', '澳大利亚': 'AU', '俄罗斯': 'RU', '韩国': 'KR', '新加坡': 'SG',
    '荷兰': 'NL', '意大利': 'IT', '西班牙': 'ES', '瑞士': 'CH', '瑞典': 'SE',
    '挪威': 'NO', '芬兰': 'FI', '印度': 'IN', '越南': 'VN', '泰国': 'TH',
    '马来西亚': 'MY', '印度尼西亚': 'ID', '菲律宾': 'PH', '巴西': 'BR', '墨西哥': 'MX'
  };
  return m[countryCn] || '';
}

function countryCnFromCC(cc) {
  cc = String(cc || '').toUpperCase();
  var m = {
    'CN':'中国','HK':'中国香港','MO':'中国澳门','TW':'中国台湾',
    'JP':'日本','US':'美国','GB':'英国','DE':'德国','FR':'法国',
    'CA':'加拿大','AU':'澳大利亚','RU':'俄罗斯','KR':'韩国','SG':'新加坡',
    'NL':'荷兰','IT':'意大利','ES':'西班牙','CH':'瑞士','SE':'瑞典',
    'NO':'挪威','FI':'芬兰','IN':'印度','VN':'越南','TH':'泰国',
    'MY':'马来西亚','ID':'印度尼西亚','PH':'菲律宾','BR':'巴西','MX':'墨西哥'
  };
  return m[cc] || '';
}

// ===== IPIP（仅当前访客）=====
function fetchIpInfo() {
  return fetch('https://myip.ipip.net/json', { cache: 'no-store' })
    .then(function (res) { return res.json(); })
    .then(function (json) {
      if (json && json.ret === 'ok' && json.data) return json.data;
      throw new Error('IPIP 返回异常');
    })
    .catch(function (err) {
      console.error('获取 IPIP 失败：', err);
      return null;
    });
}

// ===== 坐标源 A：ipapi.co =====
function fetchGeoByIpapi(ip) {
  var url = ip ? ('https://ipapi.co/' + encodeURIComponent(ip) + '/json/') : 'https://ipapi.co/json/';
  return fetch(url, { cache: 'no-store' })
    .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
    .then(function (d) {
      if (!d || d.error) return null;
      var ll = toLngLatArray(d.longitude, d.latitude);
      if (!ll) return null;
      return {
        provider: 'ipapi',
        lnglat: ll,
        cc: (d.country_code || '').toUpperCase(),
        country: d.country_name || '',
        region: d.region || '',
        city: d.city || '',
        org: d.org || ''
      };
    })
    .catch(function () { return null; });
}

// ===== 坐标源 B：ipwho.is =====
function fetchGeoByIpwho(ip) {
  var url = ip ? ('https://ipwho.is/' + encodeURIComponent(ip)) : 'https://ipwho.is/';
  return fetch(url, { cache: 'no-store' })
    .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
    .then(function (d) {
      if (!d || d.success === false) return null;
      var ll = toLngLatArray(d.longitude, d.latitude);
      if (!ll) return null;
      var isp = (d.connection && (d.connection.isp || d.connection.org)) ? (d.connection.isp || d.connection.org) : '';
      return {
        provider: 'ipwho',
        lnglat: ll,
        cc: (d.country_code || '').toUpperCase(),
        country: d.country || '',
        region: d.region || '',
        city: d.city || '',
        org: isp || ''
      };
    })
    .catch(function () { return null; });
}

function getBestGeo(ip, expectedCC) {
  return Promise.allSettled([fetchGeoByIpapi(ip), fetchGeoByIpwho(ip)]).then(function (res) {
    var list = res
      .map(function (r) { return (r.status === 'fulfilled' ? r.value : null); })
      .filter(Boolean);

    if (!list.length) return null;
    if (expectedCC) {
      var hit = list.find(function (x) { return x.cc === expectedCC; });
      if (hit) return hit;
    }
    return list[0];
  });
}

// ===== 高德：逆地理（手动 track 补地址）=====
function reverseGeocodeAMap(lng, lat) {
  return new Promise(function (resolve) {
    AMap.plugin('AMap.Geocoder', function () {
      var geocoder = new AMap.Geocoder({ radius: 1000, extensions: 'base' });
      geocoder.getAddress([lng, lat], function (status, result) {
        if (status !== 'complete' || !result || !result.regeocode) return resolve('');
        resolve((result.regeocode.formattedAddress || '').trim());
      });
    });
  });
}

// ===== 中国：行政区边界缩放 =====
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

        var marker = new AMap.Marker({ position: d.center, map: map });
        map.setFitView([].concat(polygons, [marker]));
        resolve(true);
      });
    });
  });
}

function drawChinaByIpipDistrict(map, ipData) {
  return new Promise(function (resolve) {
    if (!isChinaIp(ipData)) return resolve(false);

    var loc = ipData.location || [];
    var province = (loc[1] || '').toString();
    var city = (loc[2] || '').toString();
    var third = (loc[3] || '').toString();

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

// ===== 自动模式（当前访客）：显示 ipip 中文；海外用坐标缩放 =====
function locateAutoVisitor(map, ipSpan, locSpan) {
  return fetchIpInfo().then(function (ipData) {
    var ip = ipData && ipData.ip ? ipData.ip : '';
    var cnDesc = ipData && Array.isArray(ipData.location) ? safeJoin(ipData.location) : '';

    if (ipSpan) ipSpan.textContent = ip || '获取失败';
    if (locSpan) locSpan.textContent = cnDesc || '未知位置';

    return drawChinaByIpipDistrict(map, ipData).then(function (okChina) {
      if (okChina) return true;

      var cc = expectedCountryCodeFromCn(firstToken(cnDesc));
      return getBestGeo(ip, cc).then(function (best) {
        if (!best) return false;
        setMarkerView(map, best.lnglat, 11);
        return true;
      });
    });
  });
}

// ===== 手动 track：地图用坐标；文字优先逆地理，否则用坐标源信息兜底 =====
function formatFallbackFromGeo(best) {
  if (!best) return '';
  var parts = [];

  var cnCountry = countryCnFromCC(best.cc);
  if (cnCountry) parts.push(cnCountry);
  else if (best.country) parts.push(best.country);

  if (best.region) parts.push(best.region);
  if (best.city) parts.push(best.city);
  if (best.org) parts.push(best.org);

  return parts.filter(Boolean).join(' ');
}

function locateManual(map, ip, ipSpan, locSpan) {
  if (ipSpan) ipSpan.textContent = ip;
  if (locSpan) locSpan.textContent = '查询中...';

  return getBestGeo(ip, '').then(function (best) {
    if (!best) {
      if (locSpan) locSpan.textContent = '定位失败';
      return false;
    }

    setMarkerView(map, best.lnglat, 11);

    // 先尝试高德逆地理（可能海外返回空）
    return reverseGeocodeAMap(best.lnglat[0], best.lnglat[1]).then(function (addr) {
      if (addr) {
        if (locSpan) locSpan.textContent = addr;
        return true;
      }

      // 逆地理为空：用坐标源信息兜底（这就是你这次要的修复点）
      var fb = formatFallbackFromGeo(best);
      if (locSpan) locSpan.textContent = fb || '定位成功（无详细地址）';
      return true;
    });
  });
}

// ===== 初始化 =====
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

  locateAutoVisitor(map, ipSpan, locSpan);

  function trigger() {
    var value = (manualInput && manualInput.value ? manualInput.value : '').trim();
    if (!value) return;
    locateManual(map, value, ipSpan, locSpan);
  }

  if (manualBtn) manualBtn.addEventListener('click', trigger);
  if (manualInput) {
    manualInput.addEventListener('keydown', function (e) {
      var key = e.key || e.keyCode;
      if (key === 'Enter' || key === 13) {
        e.preventDefault();
        trigger();
      }
    });
  }
}

(function () {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initIpMap();
  } else {
    document.addEventListener('DOMContentLoaded', initIpMap);
  }
})();
