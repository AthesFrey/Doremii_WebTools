<?php
/**
 * DoreCounter - self-hosted tiny pageview counter
 * Place at webroot: /counter.php
 * Data dir: /wp-content/uploads/dorecounter/
 * Author: doremii.top helper
 */

declare(strict_types=1);

// ======= 可调参数 =======
const DATA_DIR_REL = '/wp-content/uploads/dorecounter';
const DATA_FILE    = 'counts.json';
const SEEN_FILE    = 'seen.json';   // 用于 unique=1 时的IP去重
const RETENTION_SECONDS = 172800;   // 2天，清理过期去重记录
const LABEL_DEFAULT = 'Visits';
// ========================

/** 小工具函数 **/
function resp_svg(string $svg): void {
    header('Content-Type: image/svg+xml; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    echo $svg;
    exit;
}
function resp_pixel(): void {
    // 1x1 透明GIF
    header('Content-Type: image/gif');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo base64_decode('R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==');
    exit;
}
function ensure_dir(string $abs): void {
    if (!is_dir($abs)) {
        @mkdir($abs, 0755, true);
    }
    // 禁止目录浏览
    $ht = $abs . DIRECTORY_SEPARATOR . '.htaccess';
    if (!file_exists($ht)) {
        @file_put_contents($ht, "Options -Indexes\n", LOCK_EX);
    }
}
function load_json(string $file): array {
    if (!is_file($file)) return [];
    $txt = @file_get_contents($file);
    if ($txt === false || $txt === '') return [];
    $arr = json_decode($txt, true);
    return is_array($arr) ? $arr : [];
}
function save_json_atomic(string $file, array $data): void {
    $tmp = $file . '.tmp';
    $json = json_encode($data, JSON_UNESCAPED_UNICODE);
    if ($json === false) return;
    $fp = @fopen($tmp, 'wb');
    if ($fp === false) return;
    @flock($fp, LOCK_EX);
    @fwrite($fp, $json);
    @fflush($fp);
    @flock($fp, LOCK_UN);
    @fclose($fp);
    @rename($tmp, $file);
}

/** 简单清洗 key：只保留 a-zA-Z0-9_- 和斜杠，最长64 */
function sanitize_key(string $k): string {
    $k = preg_replace('/[^a-zA-Z0-9_\\-\\/]/', '', $k);
    if ($k === null) $k = '';
    if (strlen($k) > 64) $k = substr($k, 0, 64);
    return $k !== '' ? $k : 'home';
}

/** 从 Referer 推断路径 */
function path_from_referer(): string {
    $ref = $_SERVER['HTTP_REFERER'] ?? '';
    if ($ref === '') return 'home';
    $p = parse_url($ref, PHP_URL_PATH);
    if (!is_string($p) || $p === '' ) return 'home';
    // 去掉末尾斜杠
    if ($p !== '/' && str_ends_with($p, '/')) $p = rtrim($p, '/');
    return $p;
}

/** 生成徽章SVG（可读性好，体积小） */
function svg_badge(string $label, string $value, string $fg = '#ffffff', string $bg = '#2563eb'): string {
    $pad = 6;
    $font = 12; // px
    $label_w = max(ceil(strlen($label) * 7), 40);
    $val_w   = max(ceil(strlen($value) * 7), 40);
    $w = $label_w + $val_w + $pad * 2;
    $h = 20;
    $label_x = $pad;
    $val_x   = $pad + $label_w;
    $y = 14;

    $svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="$w" height="$h" role="img" aria-label="$label: $value">
  <linearGradient id="g" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <rect rx="4" width="$w" height="$h" fill="#3f3f46"/>
  <rect rx="4" x="$label_w" width="$val_w" height="$h" fill="$bg"/>
  <rect rx="4" width="$w" height="$h" fill="url(#g)"/>
  <g fill="$fg" text-anchor="start" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="$font">
    <text x="$label_x" y="$y" fill="#fff" opacity=".95">$label</text>
    <text x="$val_x"   y="$y" fill="#fff" font-weight="600">$value</text>
  </g>
</svg>
SVG;
    return $svg;
}

/** 纯数字SVG（无底色，用于嵌入文字风格） */
function svg_digits(string $value): string {
    $font = 16;
    $w = max(ceil(strlen($value) * 10), 10);
    $h = 18;
    $y = 14;
    $v = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="$w" height="$h">
  <text x="0" y="$y" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="$font" fill="#111">$v</text>
</svg>
SVG;
}

// -------- 主逻辑 --------
$root = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/');
$datadir = $root . DATA_DIR_REL;
ensure_dir($datadir);

$dataFile = $datadir . DIRECTORY_SEPARATOR . DATA_FILE;
$seenFile = $datadir . DIRECTORY_SEPARATOR . SEEN_FILE;

// 参数
$key   = isset($_GET['key']) ? sanitize_key((string)$_GET['key']) : sanitize_key(path_from_referer());
$show  = $_GET['show']   ?? 'badge';   // badge | digits | pixel
$label = $_GET['label']  ?? LABEL_DEFAULT;
$bg    = $_GET['bg']     ?? '#2563eb';
$fg    = $_GET['fg']     ?? '#ffffff';
$unique = isset($_GET['unique']) && ($_GET['unique'] === '1' || strtolower((string)$_GET['unique']) === 'true');
$ip    = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$now   = time();

// 读取数据（加锁保证并发安全）
$counts = load_json($dataFile);
$seen   = $unique ? load_json($seenFile) : [];

$doCount = true;
if ($unique) {
    // key|ip 24小时去重
    $k = $key . '|' . $ip;
    $last = $seen[$k] ?? 0;
    if (is_numeric($last) && ($now - (int)$last) < 86400) {
        $doCount = false;
    } else {
        $seen[$k] = $now;
    }
    // 清理过期
    if (!empty($seen)) {
        $min = $now - RETENTION_SECONDS;
        foreach ($seen as $kk => $ts) {
            if (!is_numeric($ts) || (int)$ts < $min) {
                unset($seen[$kk]);
            }
        }
    }
}

if (!isset($counts[$key]) || !is_int($counts[$key])) {
    $counts[$key] = 0;
}
if ($doCount) {
    $counts[$key] += 1;
}

// 保存（原子写）
save_json_atomic($dataFile, $counts);
if ($unique) save_json_atomic($seenFile, $seen);

// 输出
$countStr = (string)$counts[$key];

switch ($show) {
    case 'pixel':
        resp_pixel(); // 1x1透明像素
        break;
    case 'digits':
        resp_svg(svg_digits($countStr));
        break;
    case 'badge':
    default:
        // 徽章
        $svg = svg_badge(is_string($label) ? $label : LABEL_DEFAULT, $countStr, (string)$fg, (string)$bg);
        resp_svg($svg);
}

