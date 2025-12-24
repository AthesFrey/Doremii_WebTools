<?php
// /wp-content/uploads/file-recorderdld.php
mb_internal_encoding('UTF-8');

$BASE_DIR = rtrim(dirname(__DIR__, 3), DIRECTORY_SEPARATOR) . '/temp';
$MAX_CODE_LEN = 60;

function respond_error_text($msg, $status=400){
    http_response_code($status);
    echo htmlspecialchars($msg, ENT_QUOTES, 'UTF-8');
    exit;
}

function respond_choose_page($code, $files, $status=409){
    http_response_code($status);
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
    echo "<!doctype html><meta charset=\"utf-8\"><title>选择要下载的文件</title>";
    echo "<div style=\"font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,'Microsoft YaHei',sans-serif; padding:16px; max-width:720px; margin:0 auto;\">";
    echo "<h2 style=\"margin:0 0 8px;\">检测到多个文件</h2>";
    echo "<div style=\"color:#555; font-size:14px; margin-bottom:12px;\">code：<b>" . htmlspecialchars($code, ENT_QUOTES, 'UTF-8') . "</b> 对应多个文件，请选择一个下载：</div>";
    echo "<ul style=\"line-height:1.8;\">";
    foreach($files as $f){
        $u = '?code=' . rawurlencode($code) . '&filename=' . rawurlencode($f);
        echo "<li><a href=\"" . htmlspecialchars($u, ENT_QUOTES, 'UTF-8') . "\">" . htmlspecialchars($f, ENT_QUOTES, 'UTF-8') . "</a></li>";
    }
    echo "</ul>";
    echo "<div style=\"margin-top:12px; color:#777; font-size:13px;\">提示：你也可以直接用带后缀的 code，例如 <code>?code=888.txt</code>，或使用 <code>&amp;filename=888.txt</code> 精确下载。</div>";
    echo "</div>";
    exit;
}

// ---------------- 参数读取与校验 ----------------
$code = $_GET['code'] ?? '';
$code = trim($code);

if($code==='') respond_error_text('缺少 code');
if(mb_strlen($code,'UTF-8') > $MAX_CODE_LEN) respond_error_text('code 过长');
if(preg_match('/[\/\s]/u', $code)) respond_error_text('不能包含斜线/空白');
if(!preg_match('/^[0-9A-Za-z._-]+$/u', $code)) respond_error_text('非法 code 字符');

if(!is_dir($BASE_DIR)) respond_error_text('目录不存在', 404);

$dir = $BASE_DIR;

// 可选：filename 精确指定（用于区分 888.txt / 888.dat）
$reqFilename = $_GET['filename'] ?? '';
$reqFilename = trim($reqFilename);
if($reqFilename !== ''){
    // 保守校验：禁止路径穿越
    if(mb_strlen($reqFilename,'UTF-8') > 255) respond_error_text('filename 过长');
    if(preg_match('/[\/\\\\\0]/u', $reqFilename)) respond_error_text('非法 filename');
    if(!preg_match('/^[0-9A-Za-z._-]+$/u', $reqFilename)) respond_error_text('非法 filename 字符');

    // 必须与 code 强关联：允许 filename == code 或者 filename 以 "code." 开头
    if(!($reqFilename === $code || strpos($reqFilename, $code . '.') === 0)){
        respond_error_text('filename 与 code 不匹配', 400);
    }

    $cand = $dir . '/' . $reqFilename;
    if(!is_file($cand)) respond_error_text('未找到对应文件', 404);
    $path = $cand;
} else {
    // ---------------- 文件定位逻辑 ----------------
    // 1) 先尝试精确匹配：/temp/<code>
    $path = $dir . '/' . $code;

    if(!is_file($path)){
        $path = null;
        $matches = [];

        $files = @scandir($dir);
        if(is_array($files)){
            foreach($files as $f){
                if($f==='.' || $f==='..') continue;

                // 匹配：以 "code." 开头，例如 888.txt、888.dat
                if(strpos($f, $code . '.') === 0){
                    $cand = $dir . '/' . $f;
                    if(is_file($cand)){
                        $matches[] = $f;
                    }
                }
            }
        }

        if(count($matches) === 0){
            respond_error_text('未找到对应文件', 404);
        }

        if(count($matches) === 1){
            $path = $dir . '/' . $matches[0];
        } else {
            // 多个匹配：不再随便选第一个，返回选择页（兼容旧 JS 不改 href 的情况）
            respond_choose_page($code, $matches, 409);
        }
    }
}

// ---------------- 下载输出 ----------------
$mime = 'application/octet-stream';
if(function_exists('finfo_open')){
    $f = finfo_open(FILEINFO_MIME_TYPE);
    if($f){
        $mime = finfo_file($f, $path);
        finfo_close($f);
    }
}

$filename = basename($path);

// Content-Disposition：提供 ASCII fallback + RFC5987 UTF-8
$filenameAscii = preg_replace('/[^A-Za-z0-9._-]/', '_', $filename);
$filenameStar  = rawurlencode($filename);

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($path));
header('Content-Disposition: attachment; filename="' . $filenameAscii . '"; filename*=UTF-8\'\'' . $filenameStar);
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

readfile($path);
exit;
