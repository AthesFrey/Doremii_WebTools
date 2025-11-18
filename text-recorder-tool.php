<?php
// /wp-content/uploads/text-recorder-php.php
// JSON API：{action: "save"|"fetch", code: "xxx", text?: "..."}

header('Content-Type: application/json; charset=utf-8');
mb_internal_encoding('UTF-8');

// 读取 JSON 请求
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => '请求格式必须为 JSON。'], JSON_UNESCAPED_UNICODE);
    exit;
}

$action = isset($data['action']) ? (string)$data['action'] : '';
$code   = isset($data['code'])   ? (string)$data['code'] : '';
$code   = trim($code);

$MAX_CODE_LEN = 60;
$MAX_CHARS    = 1000000;

// 目录：放在当前 uploads 目录向上 3 级目录 /home/web/html/doremii.top/temp
// __DIR__ = /home/web/html/doremii.top/wordpress/wp-content/uploads
$BASE_DIR = dirname(__DIR__, 3) . '/temp';

// ===== 校验取回密码 =====
if ($code === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => '取回密码不能为空。'], JSON_UNESCAPED_UNICODE);
    exit;
}
if (mb_strlen($code, 'UTF-8') > $MAX_CODE_LEN) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => '取回密码不能超过 60 个字符。'], JSON_UNESCAPED_UNICODE);
    exit;
}
if (preg_match('/[\/\s]/u', $code)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => '取回密码不能包含斜线 "/" 或任何空白字符。'], JSON_UNESCAPED_UNICODE);
    exit;
}
if (!preg_match('/^[0-9A-Za-z._-]+$/u', $code)) {
    http_response_code(400);
    echo json_encode([
        'ok'    => false,
        'error' => '取回密码只能包含大小写字母、数字、点、下划线、中划线。',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ===== 目录检查 + 必要时自动 mkdir =====
if (!is_dir($BASE_DIR)) {
    // 尝试创建目录（递归创建）
    if (!mkdir($BASE_DIR, 0770, true) && !is_dir($BASE_DIR)) {
        http_response_code(500);
        echo json_encode([
            'ok'    => false,
            'error' => '无法创建文件目录，请检查权限。',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// 再检查一次是否可写
if (!is_writable($BASE_DIR)) {
    http_response_code(500);
    echo json_encode([
        'ok'    => false,
        'error' => '目录不可写，请检查 PHP 运行用户对该目录的写权限。',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 文件名 = 取回密码 + ".txt"
$filename = $code . '.txt';
$path     = $BASE_DIR . DIRECTORY_SEPARATOR . $filename;

// ===== 保存 =====
if ($action === 'save') {
    $text = isset($data['text']) ? (string)$data['text'] : '';

    if (mb_strlen($text, 'UTF-8') > $MAX_CHARS) {
        http_response_code(400);
        echo json_encode([
            'ok'    => false,
            'error' => '内容超过 1,000,000 字符，保存失败。',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (file_put_contents($path, $text) === false) {
        http_response_code(500);
        echo json_encode([
            'ok'    => false,
            'error' => '写入文件失败，请检查文件目录的权限。',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['ok' => true, 'filename' => $filename], JSON_UNESCAPED_UNICODE);
    exit;
}

// ===== 取回 =====
if ($action === 'fetch') {
    if (!is_file($path)) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => '未找到对应的 txt 文件。'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $text = file_get_contents($path);
    if ($text === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => '读取文件失败。'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['ok' => true, 'text' => $text], JSON_UNESCAPED_UNICODE);
    exit;
}

// ===== 未知 action =====
http_response_code(400);
echo json_encode(['ok' => false, 'error' => '未知 action 参数。'], JSON_UNESCAPED_UNICODE);
exit;

