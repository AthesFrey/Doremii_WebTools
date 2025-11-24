// ip-map-locator.js
// 版本号：v20251123b

// 1. 使用 myip.ipip.net 获取访问者 IP 和文本位置（国内接口）
function fetchIpInfo() {
  return fetch('https://myip.ipip.net/json', { cache: 'no-store' })
    .then(function (res) { return res.json(); })
    .then(function (json) {
      if (json && json.ret === 'ok' && json.data) {
        // 典型结构：{ ip: "x.x.x.x", location: ["中国","北京市","海淀区", ...] }
        return json.data;
      }
      throw new Error('IP 接口返回异常');
    })
    .catch(function (err) {
      console.error('获取 IP 信息失败：', err);
      return null;
    });
}

// 2. 国内 IP：用高德 DistrictSearch 根据省/市/区名字绘制行政区轮廓，并自动缩放
function drawRegionByDistrict(map, ipData) {
  return new Promise(function (resolve) {
    if (!ipData || !Array.isArray(ipData.location)) {
      return resolve(false);
    }

    var locArr = ipData.location.slice();
    var country = (locArr[0] || '').toString();

    // 只对中国（含港澳台）尝试使用 DistrictSearch
    var isChina =
      country === '中国' ||
      country === '中国台湾' ||
      country === '中国香港' ||
      country === '中国澳门';

    if (!isChina) {
      // 海外 IP 直接返回 false，后面走全球经纬度方案
      return resolve(false);
    }

    // ipip: ["中国","省","市","区/运营商", "纬度","经度", ...]
    // 这里只取省/市/区三段文字
    var geoParts = locArr.slice(1, 4).filter(function (item) {
      return !!item;
    });

    if (!geoParts.length) {
      return resolve(false);
    }

    var level = geoParts.length >= 3 ? 'district' : 'city';
    var regionName = geoParts.join(''); // "北京市海淀区" / "广东省广州市"

    AMap.plugin('AMap.DistrictSearch', function () {
      var ds = new AMap.DistrictSearch({
        level: level,
        subdistrict: 0,
        extensions: 'all'
      });

      ds.search(regionName, function (status, result) {
        if (status !== 'complete' ||
            !result.districtList ||
            !result.districtList.length) {
          console.warn('DistrictSearch 未找到：', regionName, result);
          return resolve(false);
        }

        var d = result.districtList[0];
        var boundaries = d.boundaries;

        if (!boundaries || !boundaries.length) {
          console.warn('未返回边界数据：', d);
          return resolve(false);
        }

        var polygons = [];
        boundaries.forEach(function (b) {
          var polygon = new AMap.Polygon({
            path: b,
            strokeWeight: 1,
            strokeColor: '#409EFF',
            fillOpacity: 0.05,
            fillColor: '#409EFF'
          });
          polygons.push(polygon);
        });

        map.add(polygons);

        // 行政区中心点
        var center = d.center;
        var marker = new AMap.Marker({
          position: center,
          map: map
        });

        // 自动把「整个行政区 + 标记点」放进视图里
        map.setFitView([].concat(polygons, [marker]));

        resolve(true);
      });
    });
  });
}

// 3. 海外 IP / 兜底：用 ipapi.co 做全球经纬度定位
function drawByIpApi(map, ipData) {
  return new Promise(function (resolve) {
    var ip = ipData && ipData.ip;
    // 指定 IP，避免 Cloudflare / 代理影响
    var url = 'https://ipapi.co/json/';
    if (ip) {
      url = 'https://ipapi.co/' + encodeURIComponent(ip) + '/json/';
    }

    fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('ipapi HTTP 错误：' + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        if (!data) {
          return resolve(false);
        }

        var lat = data.latitude;
        var lng = data.longitude;

        if (typeof lat === 'string') {
          lat = parseFloat(lat);
        }
        if (typeof lng === 'string') {
          lng = parseFloat(lng);
        }

        if (!isFinite(lat) || !isFinite(lng)) {
          console.warn('ipapi 未返回有效经纬度：', data);
          return resolve(false);
        }

        var center = [lng, lat];

        var marker = new AMap.Marker({
          position: center,
          map: map
        });

        // 根据是否有 city / region 决定大致缩放
        var zoom;
        if (!data.city && !data.region) {
          zoom = 4;  // 只知道国家，给个大区域
        } else if (!data.city && data.region) {
          zoom = 7;  // 有州/省，没有城市
        } else {
          zoom = 11; // 有城市 → 城市级别
        }

        map.setZoomAndCenter(zoom, center);
        map.setFitView([marker]);

        resolve(true);
      })
      .catch(function (err) {
        console.error('ipapi 定位失败：', err);
        resolve(false);
      });
  });
}

// 4. 最后兜底：高德 CitySearch（只能保证在国内时大致有个结果）
function drawByCitySearch(map) {
  return new Promise(function (resolve) {
    AMap.plugin('AMap.CitySearch', function () {
      var citySearch = new AMap.CitySearch();
      citySearch.getLocalCity(function (status, result) {
        if (status === 'complete' &&
            result.info === 'OK' &&
            result.rectangle) {
          var rect = result.rectangle.split(';');
          if (rect.length === 2) {
            var sw = rect[0].split(',');
            var ne = rect[1].split(',');

            var swLngLat = [parseFloat(sw[0]), parseFloat(sw[1])];
            var neLngLat = [parseFloat(ne[0]), parseFloat(ne[1])];

            var bounds = new AMap.Bounds(swLngLat, neLngLat);
            map.setBounds(bounds);

            var center = bounds.getCenter();
            var marker = new AMap.Marker({
              position: center,
              map: map
            });

            map.setFitView([marker]);

            return resolve(true);
          }
        }

        console.warn('CitySearch IP 定位失败：', result);
        resolve(false);
      });
    });
  });
}

// 5. 初始化函数：创建地图、更新 IP 文本、按国内/海外分别处理
function initIpMap() {
  var ipSpan = document.getElementById('ip-value');
  var locSpan = document.getElementById('location-value');
  var mapContainer = document.getElementById('map');

  if (!mapContainer || typeof AMap === 'undefined') {
    console.error('地图容器或 AMap 未准备好');
    return;
  }

  // 先给一个中国为中心的全国视图，避免加载过程白屏
  var map = new AMap.Map('map', {
    viewMode: '2D',
    zoom: 4,
    center: [105, 35]
  });

  fetchIpInfo().then(function (ipData) {
    // 更新 IP 和位置文本
    if (ipData) {
      ipSpan.textContent = ipData.ip || '未知 IP';
      var locArr = Array.isArray(ipData.location) ? ipData.location : [];
      locSpan.textContent = locArr
        .filter(function (item) { return !!item; })
        .join(' ');
    } else {
      ipSpan.textContent = '获取失败';
      locSpan.textContent = 'IP 接口异常';
    }

    // 1）先尝试国内行政区方案（仅对中国 IP 生效）
    drawRegionByDistrict(map, ipData).then(function (okChina) {
      if (okChina) {
        return;
      }

      // 2）失败则尝试 ipapi 全球经纬度定位（海外 IP 走这条）
      drawByIpApi(map, ipData).then(function (okWorld) {
        if (!okWorld) {
          // 3）再不行，最后兜底 CitySearch
          drawByCitySearch(map);
        }
      });
    });
  });
}

// 6. DOM 就绪后初始化
(function () {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initIpMap();
  } else {
    document.addEventListener('DOMContentLoaded', initIpMap);
  }
})();
