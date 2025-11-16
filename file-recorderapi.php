<?php
// /wp-content/uploads/file-recorderapi.php
// 用法：
//
// 1) 上传文件（save）：multipart/form-data
//    action = save_file
//    code   = 取回密码
//    file   = 上传文件
//
// 2) 检查 fetch_code（fetch）：JSON POST
//    { "action": "check_fetch", "code": "xxx" }

header('Content-Type: application/json; charset=utf-8');
mb_internal_encoding('UTF-8');

// 保存 / 读取的统一目录：当前目录向上 3 级，再加 /temp
// 例如： /opt/1panel/www/sites/xxx.com/temp
$BASE_DIR        = rtrim(dirname(__DIR__, 3), DIRECTORY_SEPARATOR) . '/temp';
$MAX_CODE_LEN    = 60;
// 最大上传体积：约 1.09 GiB
$MAX_FILE_BYTES  = 1170378588; // ≈ 1.09 * 1024^3

// ----------------- 公用函数 -----------------

function respond_error($msg, $status = 400) {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// 校验 fetch code
function validate_code($raw, $maxLen) {
    $code = trim((string)$raw);
    if ($code === '') {
        respond_error('取回密码不能为空。', 400);
    }
    if (mb_strlen($code, 'UTF-8') > $maxLen) {
        respond_error('取回密码不能超过 60 个字符。', 400);
    }
    if (preg_match('/[\/\s]/u', $code)) {
        respond_error('取回密码不能包含斜线 "/" 或任何空白字符。', 400);
    }
    if (!preg_match('/^[0-9A-Za-z._-]+$/u', $code)) {
        respond_error('取回密码只能包含字母、数字、点、下划线、中划线。', 400);
    }
    return $code;
}

// 按 code 在目录中查找“所有匹配文件”：
// 1) 精确同名（code 或 code.zip 等）
// 2) 前缀为 "code." 的全部文件（code.zip、code.pdf 都算）
function find_files_by_code_all($dir, $code) {
    $dir = rtrim($dir, DIRECTORY_SEPARATOR);
    if (!is_dir($dir)) {
        return [];
    }

    $files = @scandir($dir);
    if (!is_array($files)) {
        return [];
    }

    $matches = [];

    foreach ($files as $f) {
        if ($f === '.' || $f === '..') continue;

        // 精确名字，或者 code. 开头
        if ($f === $code || strpos($f, $code . '.') === 0) {
            $p = $dir . DIRECTORY_SEPARATOR . $f;
            if (is_file($p) && is_readable($p)) {
                $matches[] = $p;
            }
        }
    }

    return $matches;
}

// ----------------- 主逻辑分支 -----------------

$method      = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

// ============= 分支 1：上传文件（multipart/form-data） =============
if ($method === 'POST' && stripos($contentType, 'multipart/form-data') !== false) {
    $action = isset($_POST['action']) ? (string)$_POST['action'] : '';
    if ($action !== 'save_file') {
        respond_error('未知 action 参数（multipart 模式下仅支持 save_file）。', 400);
    }

    global $MAX_CODE_LEN, $BASE_DIR, $MAX_FILE_BYTES;
    $code = validate_code($_POST['code'] ?? '', $MAX_CODE_LEN);

    if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
        respond_error('没有收到上传文件。', 400);
    }

    $fileErr = $_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE;
    if ($fileErr !== UPLOAD_ERR_OK) {
        respond_error('文件上传失败，错误码：' . $fileErr, 400);
    }

    $tmpName  = $_FILES['file']['tmp_name'];
    $origName = $_FILES['file']['name'];
    $size     = isset($_FILES['file']['size']) ? (int)$_FILES['file']['size'] : 0;

    if (!is_uploaded_file($tmpName)) {
        respond_error('无效的上传文件。', 400);
    }

    // 大小限制（后端强制）
    if ($size > $MAX_FILE_BYTES) {
        $mb = $size / (1024 * 1024);
        $mb = round($mb, 2);
        respond_error(
            '文件过大（约 ' . $mb . ' MB），超过最大允许的 1.09GB，请压缩或分卷后再上传。',
            400
        );
    }

    // 确保 temp 目录存在且可写
    if (!is_dir($BASE_DIR)) {
        if (!mkdir($BASE_DIR, 0770, true) && !is_dir($BASE_DIR)) {
            respond_error('无法创建目录 ' . $BASE_DIR . '，请检查权限。', 500);
        }
    }
    if (!is_writable($BASE_DIR)) {
        respond_error('目录 ' . $BASE_DIR . ' 不可写，请检查 PHP 运行用户对该目录的写权限。', 500);
    }

    // 取原始文件后缀
    $ext = pathinfo($origName, PATHINFO_EXTENSION);
    $extPart = $ext !== '' ? ('.' . $ext) : '';

    // 保存为：code + 原后缀，例如 mycode.zip
    $filename = $code . $extPart;
    $destPath = rtrim($BASE_DIR, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $filename;

    if (!@move_uploaded_file($tmpName, $destPath)) {
        respond_error('保存上传文件失败，请检查目录权限。', 500);
    }

    $downloadUrl = '/wp-content/uploads/file-recorderdld.php?code=' . rawurlencode($code);

    echo json_encode([
        'ok'           => true,
        'code'         => $code,
        'filename'     => $filename,
        'dest_dir'     => $BASE_DIR,
        'dest_path'    => $destPath,
        'download_url' => $downloadUrl,
        'message'      => '文件已保存到网站根目录 temp 文件夹中。',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ============= 分支 2：JSON 请求（主要是 check_fetch） =============

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    respond_error('请求格式必须为 JSON。', 400);
}

$action = isset($data['action']) ? (string)$data['action'] : '';

if ($action === 'check_fetch') {
    global $MAX_CODE_LEN, $BASE_DIR;

    $code = validate_code($data['code'] ?? '', $MAX_CODE_LEN);

    if (!is_dir($BASE_DIR)) {
        respond_error('目录 ' . $BASE_DIR . ' 不存在，请先通过“临时网盘”上传文件。', 500);
    }

    $paths = find_files_by_code_all($BASE_DIR, $code);
    if (empty($paths)) {
        respond_error('未在 ' . $BASE_DIR . ' 中找到以 "' . $code . '" 命名的文件。', 404);
    }

    $files = [];
    foreach ($paths as $p) {
        $fname = basename($p);
        $files[] = [
            'filename'     => $fname,
            'abs_path'     => $p,
            'download_url' => '/wp-content/uploads/file-recorderdld.php?code=' . rawurlencode($fname),
        ];
    }

    // 兼容单文件的字段：取第一个
    $first = $files[0];

    echo json_encode([
        'ok'           => true,
        'code'         => $code,
        'files'        => $files,
        'filename'     => $first['filename'],
        'abs_path'     => $first['abs_path'],
        'download_url' => $first['download_url'],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 其他未知 action
respond_error('未知 action 参数。', 400);
