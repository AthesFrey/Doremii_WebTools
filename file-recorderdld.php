<?php
// /wp-content/uploads/file-recorderdld.php
// 用法： /wp-content/uploads/file-recorderdld.php?code=xxx
// code 可以是：
//   1) 完整文件名（例如 abc123.zip）
//   2) 取回密码（例如 abc123，对应 abc123.zip / abc123.pdf 等）

mb_internal_encoding('UTF-8');

$BASE_DIR     = rtrim(dirname(__DIR__, 3), DIRECTORY_SEPARATOR) . '/temp';
$MAX_CODE_LEN = 60;

function respond_error_text($msg, $status = 400) {
    http_response_code($status);
    echo htmlspecialchars($msg, ENT_QUOTES, 'UTF-8');
    exit;
}

$code = isset($_GET['code']) ? (string)$_GET['code'] : '';
$code = trim($code);

if ($code === '') {
    respond_error_text('缺少 code 参数。', 400);
}
if (mb_strlen($code, 'UTF-8') > $MAX_CODE_LEN) {
    respond_error_text('code 过长。', 400);
}
if (preg_match('/[\/\s]/u', $code)) {
    respond_error_text('code 中不能包含斜线或空白字符。', 400);
}
if (!preg_match('/^[0-9A-Za-z._-]+$/u', $code)) {
    respond_error_text('code 只能包含字母、数字、点、下划线、中划线。', 400);
}

if (!is_dir($BASE_DIR)) {
    respond_error_text('目录 ' . $BASE_DIR . ' 不存在。', 404);
}

$dir = rtrim($BASE_DIR, DIRECTORY_SEPARATOR);

// 先尝试精确文件名
$path = $dir . DIRECTORY_SEPARATOR . $code;
if (!is_file($path) || !is_readable($path)) {
    // 再找前缀 code.*
    $path = null;
    $files = @scandir($dir);
    if (is_array($files)) {
        foreach ($files as $f) {
            if ($f === '.' || $f === '..') continue;
            if (strpos($f, $code . '.') === 0) {
                $cand = $dir . DIRECTORY_SEPARATOR . $f;
                if (is_file($cand) && is_readable($cand)) {
                    $path = $cand;
                    break;
                }
            }
        }
    }

    if ($path === null) {
        respond_error_text('未找到对应文件。', 404);
    }
}

// 猜 MIME
$finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : false;
if ($finfo) {
    $mime = finfo_file($finfo, $path);
    finfo_close($finfo);
} else {
    $mime = 'application/octet-stream';
}

$filename = basename($path);

// 输出头部，触发下载
header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($path));
header('Content-Disposition: attachment; filename="' . rawurlencode($filename) . '"');
header('X-Content-Type-Options: nosniff');




readfile($path);
exit;
