<?php
/**
 * amap-security-config.php
 * 用途：从文件读取高德 JSAPI 安全密钥（securityJsCode），并以 JS 形式输出
 * 注意：按你的要求使用相对路径：dirname(__DIR__, 3)
 */

// 输出为 JS
header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$keyFile = dirname(__DIR__, 3) . '/mykeys/amapkey.txt';

$key = '';
if (is_readable($keyFile)) {
  $key = trim((string)file_get_contents($keyFile));
  // 去掉可能的空格/换行
  $key = preg_replace('/\s+/', '', $key);
}

// 兜底：没有 key 就输出空串（避免页面直接报错）
if (!$key) {
  echo "window._AMapSecurityConfig={securityJsCode:''};";
  exit;
}

// 基本安全转义（防止意外字符破坏 JS）
$keyJs = addslashes($key);

echo "window._AMapSecurityConfig={securityJsCode:'{$keyJs}'};";
