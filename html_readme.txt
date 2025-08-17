<!-- 载入脚本（记得每次改 JS 就改 ?v= 强刷缓存） -->
<script defer src="/wp-content/uploads/doremii-tools.js?v=lovegod_202508"></script>

<!-- 密码生成器 -->
<h2 style="font-size: 22px; color: #FF8C00;">密码生成器</h2>
<doremii-password
  accent="#FF8C00"
  length="16"
  history="5"
  style="
    --card-bg: #FFF8DC; /* cornsilk 米黄色背景 */
    --card-border: #BC8F8F; /* rosybrown 玫瑰棕色边框 */
    --text: #0f172a; /* very dark blue-gray 深蓝灰色文字 */
    --muted: #64748b; /* slategray 石板灰蓝色文字 */
    --button-bg: #FFA500; /* orange 橙色按钮背景 */
    --button-fg: #000000; /* black 黑色文字 */
    --result-bg: #FFA500; /* orange 橙色背景 */
    --result-fg: #000000; /* black 黑色文字 */
    --hist-bg: #FFF8DC; /* cornsilk 米黄色背景 */
  ">
</doremii-password>

<!-- 姓名生成器 -->
<h2 style="font-size: 22px; color: #D50068;">姓名生成器</h2>
<doremii-name
  accent="#D50068"
  src="/wp-content/uploads/forbes.txt"
  v="20250816"
  history="5"
  style=" 
    --card-bg: #fff7ff; /* lavenderblush 淡紫红背景 */
    --card-border: #f0d5ff; /* thistle 蓟紫色边框 */
    --text: #3b0764; /* indigo 靛紫色文字 */
    --muted: #7e22ce; /* mediumorchid 中兰紫色文字 */
    --button-bg: #D50068; /* deep pink 深粉红按钮背景 */
    --button-fg: #ffffff; /* white 白色文字 */
    --result-bg: #D50068; /* deep pink 深粉红背景 */
    --result-fg: #ffffff; /* white 白色文字 */
    --hist-bg: #FFF0F5; /* lavenderblush 淡紫红背景 */
  ">
</doremii-name>

<!-- 幸运数字生成器 -->
<h2 style="font-size: 22px; color: #1E90FF;">幸运数字生成器</h2>
<doremii-lucky
  accent="#1E90FF"
  src="/wp-content/uploads/luckynums.txt"
  v="20250816"
  length="4"
  history="5"
  style=" 
    --card-bg: #ADD8E6; /* lightblue 淡蓝色背景 */
    --card-border: #1E90FF; /* dodgerblue 道奇蓝边框 */
    --text: #000000; /* black 黑色文字 */
    --muted: #4682B4; /* steelblue 钢蓝色文字 */
    --button-bg: #1E90FF; /* dodgerblue 道奇蓝按钮背景 */
    --button-fg: #ffffff; /* white 白色文字 */
    --result-bg: #1E90FF; /* dodgerblue 道奇蓝背景 */
    --result-fg: #ffffff; /* white 白色文字 */
    --hist-bg: #B0E0E6; /* powderblue 粉蓝色背景 */
  ">
</doremii-lucky>
