(() => {
  'use strict';

  // 全量命名色：key 为 6 位 HEX（大写），value 为 [英文名, 中文名]
  // （说明：有别名的颜色用一个条目表示，如 00FFFF 显示 “Cyan / 青色（Aqua）”）
  const NAMED_COLORS = {
    "F0F8FF": ["AliceBlue", "爱丽丝蓝"],
    "FAEBD7": ["AntiqueWhite", "古董白"],
    "00FFFF": ["Cyan", "青色（Aqua）"],
    "7FFFD4": ["Aquamarine", "海蓝宝石色/碧绿色"],
    "F0FFFF": ["Azure", "天蓝雾"],
    "F5F5DC": ["Beige", "米白/米色"],
    "FFE4C4": ["Bisque", "陶坯色"],
    "000000": ["Black", "黑色"],
    "FFEBCD": ["BlanchedAlmond", "漂白杏仁色"],
    "0000FF": ["Blue", "蓝色"],
    "8A2BE2": ["BlueViolet", "蓝紫色"],
    "A52A2A": ["Brown", "棕色"],
    "DEB887": ["BurlyWood", "原木色"],
    "5F9EA0": ["CadetBlue", "军服蓝"],
    "7FFF00": ["Chartreuse", "查特酒绿/黄绿色"],
    "D2691E": ["Chocolate", "巧克力色"],
    "FF7F50": ["Coral", "珊瑚色"],
    "6495ED": ["CornflowerBlue", "矢车菊蓝"],
    "FFF8DC": ["Cornsilk", "玉米丝色"],
    "DC143C": ["Crimson", "猩红"],
    "00008B": ["DarkBlue", "深蓝"],
    "008B8B": ["DarkCyan", "深青"],
    "B8860B": ["DarkGoldenrod", "深金菊"],
    "A9A9A9": ["DarkGray", "深灰"],
    "006400": ["DarkGreen", "深绿"],
    "BDB76B": ["DarkKhaki", "深卡其"],
    "8B008B": ["DarkMagenta", "深洋红"],
    "556B2F": ["DarkOliveGreen", "暗橄榄绿"],
    "FF8C00": ["DarkOrange", "深橙"],
    "9932CC": ["DarkOrchid", "深兰花紫"],
    "8B0000": ["DarkRed", "深红"],
    "E9967A": ["DarkSalmon", "深鲑红"],
    "8FBC8F": ["DarkSeaGreen", "深海绿"],
    "483D8B": ["DarkSlateBlue", "深石板蓝"],
    "2F4F4F": ["DarkSlateGray", "深石板灰"],
    "00CED1": ["DarkTurquoise", "深绿松石"],
    "9400D3": ["DarkViolet", "深紫罗兰"],
    "FF1493": ["DeepPink", "艳粉红/深粉红"],
    "00BFFF": ["DeepSkyBlue", "深天蓝"],
    "696969": ["DimGray", "暗灰"],
    "1E90FF": ["DodgerBlue", "道奇蓝"],
    "B22222": ["FireBrick", "火砖红"],
    "FFFAF0": ["FloralWhite", "花白"],
    "228B22": ["ForestGreen", "森林绿"],
    "FF00FF": ["Magenta", "洋红（Fuchsia/品红）"],
    "DCDCDC": ["Gainsboro", "庚斯博罗灰"],
    "F8F8FF": ["GhostWhite", "幽灵白"],
    "FFD700": ["Gold", "金色"],
    "DAA520": ["Goldenrod", "金菊色"],
    "808080": ["Gray", "灰色"],
    "008000": ["Green", "绿色"],
    "ADFF2F": ["GreenYellow", "黄绿色"],
    "F0FFF0": ["Honeydew", "哈密瓜色"],
    "FF69B4": ["HotPink", "艳粉"],
    "CD5C5C": ["IndianRed", "印度红"],
    "4B0082": ["Indigo", "靛青"],
    "FFFFF0": ["Ivory", "象牙白"],
    "F0E68C": ["Khaki", "卡其色"],
    "E6E6FA": ["Lavender", "薰衣草紫"],
    "FFF0F5": ["LavenderBlush", "薰衣草紫红"],
    "7CFC00": ["LawnGreen", "草坪绿"],
    "FFFACD": ["LemonChiffon", "柠檬绸"],
    "ADD8E6": ["LightBlue", "淡蓝"],
    "F08080": ["LightCoral", "淡珊瑚色"],
    "E0FFFF": ["LightCyan", "灰青色/淡青"],
    "FAFAD2": ["LightGoldenrodYellow", "浅金菊黄"],
    "D3D3D3": ["LightGray", "浅灰"],
    "90EE90": ["LightGreen", "淡绿"],
    "FFB6C1": ["LightPink", "浅粉"],
    "FFA07A": ["LightSalmon", "浅鲑红"],
    "20B2AA": ["LightSeaGreen", "浅海绿"],
    "87CEFA": ["LightSkyBlue", "浅天蓝"],
    "778899": ["LightSlateGray", "浅石板灰"],
    "B0C4DE": ["LightSteelBlue", "浅钢蓝"],
    "FFFFE0": ["LightYellow", "浅黄"],
    "00FF00": ["Lime", "亮绿（Lime）"],
    "32CD32": ["LimeGreen", "青柠绿"],
    "FAF0E6": ["Linen", "亚麻白"],
    "800000": ["Maroon", "栗色"],
    "66CDAA": ["MediumAquamarine", "中海蓝宝石色/中碧绿"],
    "0000CD": ["MediumBlue", "中蓝"],
    "BA55D3": ["MediumOrchid", "中兰花紫"],
    "9370DB": ["MediumPurple", "中紫"],
    "3CB371": ["MediumSeaGreen", "中海绿"],
    "7B68EE": ["MediumSlateBlue", "中石板蓝"],
    "00FA9A": ["MediumSpringGreen", "中春绿"],
    "48D1CC": ["MediumTurquoise", "中绿松石"],
    "C71585": ["MediumVioletRed", "中紫罗兰红"],
    "191970": ["MidnightBlue", "午夜蓝"],
    "F5FFFA": ["MintCream", "薄荷奶油色"],
    "FFE4E1": ["MistyRose", "雾玫瑰色"],
    "FFE4B5": ["Moccasin", "鹿皮色"],
    "FFDEAD": ["NavajoWhite", "纳瓦霍白"],
    "000080": ["Navy", "海军蓝"],
    "FDF5E6": ["OldLace", "旧蕾丝白"],
    "808000": ["Olive", "橄榄色"],
    "6B8E23": ["OliveDrab", "橄榄绿"],
    "FFA500": ["Orange", "橙色"],
    "FF4500": ["OrangeRed", "橙红"],
    "DA70D6": ["Orchid", "兰花紫"],
    "EEE8AA": ["PaleGoldenrod", "苍金菊"],
    "98FB98": ["PaleGreen", "苍绿"],
    "AFEEEE": ["PaleTurquoise", "苍绿松石"],
    "DB7093": ["PaleVioletRed", "苍紫罗兰红"],
    "FFEFD5": ["PapayaWhip", "木瓜奶油"],
    "FFDAB9": ["PeachPuff", "桃色"],
    "CD853F": ["Peru", "赭褐/秘鲁色"],
    "FFC0CB": ["Pink", "粉色"],
    "DDA0DD": ["Plum", "梅紫/李子紫"],
    "B0E0E6": ["PowderBlue", "粉蓝"],
    "800080": ["Purple", "紫色"],
    "663399": ["RebeccaPurple", "Rebecca 紫"],
    "FF0000": ["Red", "红色"],
    "BC8F8F": ["RosyBrown", "玫瑰棕"],
    "4169E1": ["RoyalBlue", "皇家蓝/宝蓝"],
    "8B4513": ["SaddleBrown", "鞍褐色"],
    "FA8072": ["Salmon", "鲑红"],
    "F4A460": ["SandyBrown", "沙褐色"],
    "2E8B57": ["SeaGreen", "海绿"],
    "FFF5EE": ["Seashell", "贝壳白"],
    "A0522D": ["Sienna", "赭色/棕褐"],
    "C0C0C0": ["Silver", "银色"],
    "87CEEB": ["SkyBlue", "天蓝"],
    "6A5ACD": ["SlateBlue", "石板蓝"],
    "708090": ["SlateGray", "石板灰"],
    "FFFAFA": ["Snow", "雪白"],
    "00FF7F": ["SpringGreen", "春绿"],
    "4682B4": ["SteelBlue", "钢蓝"],
    "D2B48C": ["Tan", "棕褐/茶色"],
    "008080": ["Teal", "水鸭色/蓝绿色"],
    "D8BFD8": ["Thistle", "蓟紫"],
    "FF6347": ["Tomato", "番茄红"],
    "40E0D0": ["Turquoise", "绿松石"],
    "EE82EE": ["Violet", "紫罗兰"],
    "F5DEB3": ["Wheat", "小麦色"],
    "FFFFFF": ["White", "纯白"],
    "F5F5F5": ["WhiteSmoke", "烟熏白"],
    "FFFF00": ["Yellow", "黄色"],
    "9ACD32": ["YellowGreen", "黄绿"]
  };
  
  

  // 只注册一次
  if (!customElements.get('color-validator')) {
    class ColorValidator extends HTMLElement {
      constructor() {
        super();
        const root = this.attachShadow({ mode: 'open' });

        // 玫瑰金主题（可通过属性 accent 覆盖）
        const accent = this.getAttribute('accent') || '#B76E79';
        const font = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';

        root.innerHTML = `
          <style>
            :host{
              --accent:${accent};
              --text:#2a1f22;
              --muted:#8C5964;
              --card-bg:#FFF5F7;
              --card-border:#F7CCD5;
              --button-bg: var(--accent);
              --button-fg: #ffffff;
              --grid-border:#e5e7eb;

              display:block; max-width:450px; color:var(--text);
              font-family:${font};
            }
            .card{
              margin:16px 0; padding:12px; border-radius:12px;
              background:var(--card-bg);
              border:1px solid var(--card-border);
              box-shadow:0 1px 2px rgba(0,0,0,.06);
            }
            .row{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
            .row label{ color:var(--muted); font-size:12px; }
            input[type="text"]{
              padding:6px 8px; border:1px solid var(--card-border);
              border-radius:8px; min-height:36px; width:12em;
              font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
              background:#fff;
            }
            button{
              padding:10px 16px; border:none; border-radius:8px; cursor:pointer;
              background:linear-gradient(180deg, var(--button-bg), #9E5D66);
              color:var(--button-fg); font-weight:600;
            }
            .out{
              min-width:12em; display:flex; align-items:center; gap:8px; flex-wrap:wrap;
              font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
            }
            .rgb{ padding:2px 6px; background:#fff; border:1px solid var(--card-border); border-radius:6px; }
            .name{ color:#7A3E49; font-weight:600; }
            .err{ color:#b91c1c; font-size:12px; margin-left:4px; }

            .grids{ display:flex; gap:12px; margin-top:12px; flex-wrap:wrap; }
            .grid, .grid-codes{
              display:grid; grid-template-columns: repeat(3, 64px); grid-template-rows: repeat(3, 64px);
              gap:6px;
            }
            .cell{
              width:64px; height:64px; border:1px solid var(--grid-border);
              border-radius:8px;
            }
            .cell.center{ outline:2px solid var(--accent); outline-offset:-2px; }
            .code{
              width:64px; height:64px; border:1px dashed var(--grid-border);
              border-radius:8px; display:flex; align-items:center; justify-content:center;
              background:#fff;
              font-size:12px; text-align:center; padding:2px;
              font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
              user-select: text;
            }
            .result{ margin-top:10px; color:var(--muted); font-size:12px; }
          </style>

          <div class="card">
            <div class="row">
              <label>Hex</label>
              <input type="text" placeholder="#1E90FF 或 1E90FF" />
              <button>Colour check</button>
              <span class="out">
                <span class="rgb">R G B</span>
                <span>→</span>
                <span class="name">—</span>
              </span>
              <span class="err" aria-live="polite"></span>
            </div>

            <div class="grids">
              <div class="grid" aria-label="颜色九宫格"></div>
              <div class="grid-codes" aria-label="十六进制九宫格"></div>
            </div>

            <div class="result">提示：支持 3/6 位十六进制；相近色按通道 ±32 生成（至少相差 20 以上）。</div>
          </div>
        `;

        // ---------- 脚本逻辑 ----------
        const $ = (sel)=> root.querySelector(sel);
        const input = $('input[type="text"]');
        const btn   = root.querySelector('button');
        const rgbEl = root.querySelector('.rgb');
        const nameEl= root.querySelector('.name');
        const errEl = root.querySelector('.err');
        const grid  = root.querySelector('.grid');
        const gridC = root.querySelector('.grid-codes');

        const makeCells = (wrap, cls) => {
          wrap.innerHTML = '';
          for (let i=0;i<9;i++){
            const d = document.createElement('div');
            d.className = cls + (i===4?' center':'');
            wrap.appendChild(d);
          }
        };
        makeCells(grid, 'cell');
        makeCells(gridC, 'code');

        const clamp = (v)=> Math.max(0, Math.min(255, v|0));
        const toHex2 = (n)=> n.toString(16).toUpperCase().padStart(2,'0');
        const rgbToHex = ([r,g,b]) => `${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
        const hexToRgb = (hex) => {
          let s = (hex||'').trim();
          if (s.startsWith('#')) s = s.slice(1);
          if (s.length === 3) s = s.split('').map(c=>c+c).join('');
          if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
          return [
            parseInt(s.slice(0,2),16),
            parseInt(s.slice(2,4),16),
            parseInt(s.slice(4,6),16),
          ];
        };
        const nameOf = (hex6) => {
          const key = hex6.toUpperCase();
          if (NAMED_COLORS[key]) {
            const [en, zh] = NAMED_COLORS[key];
            return `${en} / ${zh}`;
          }
          return '—';
        };

        // 九宫格相近色（有方向的不同维度变化；Δ 默认 32）
        const neighborMatrix = ([r,g,b], Δ=32) => {
          const P = (dr,dg,db)=> [clamp(r+dr), clamp(g+dg), clamp(b+db)];
          return [
            P(-Δ,+Δ,  0),  P(+Δ,+Δ,+Δ),  P(+Δ,-Δ,  0),
            P(-Δ,  0,  0), P(  0,  0,  0), P(+Δ,  0,  0),
            P(  0,+Δ,-Δ),  P(-Δ,-Δ,-Δ),  P(  0,-Δ,+Δ),
          ];
        };

        const paint = (hexIn) => {
          errEl.textContent = '';
          const rgb = hexToRgb(hexIn);
          if (!rgb){
            errEl.textContent = '请输入合法的十六进制颜色（如 #1E90FF 或 1E90FF）';
            return;
          }
          const [r,g,b] = rgb;
          const hex6 = rgbToHex(rgb);
          rgbEl.textContent = `${r} ${g} ${b}`;
          nameEl.textContent = nameOf(hex6);

          const mats = neighborMatrix([r,g,b], 32);
          const cells = grid.querySelectorAll('.cell');
          const codes = gridC.querySelectorAll('.code');

          mats.forEach((rgb,i)=>{
            const h = '#' + rgbToHex(rgb);
            const c = cells[i];
            c.style.background = h;
            c.title = h;
            const code = codes[i];
            code.textContent = h;
          });
        };

        // 事件
        btn.addEventListener('click', ()=> paint(input.value));
        input.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') paint(input.value); });

        // 默认演示色：1E90FF
        paint('#1E90FF');
      }
    }

    customElements.define('color-validator', ColorValidator);
  }
})();

