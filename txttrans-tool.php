<?php
// /wp-content/uploads/txttrans-tool.php
// JSON API: {action: "save"|"fetch", code: "xxx", text?: "..."}
//
// 隐私增强点：
// 1) 不再使用可猜测的文件名（不再是 code.txt），改为 HMAC(SHA-256) 的不可枚举文件名
// 2) 仅写入旧版 temp 目录（/wp-content/uploads/temp/），并尽量设置 0700/0600 权限
// 3) 保存内容默认进行 AES-256-GCM 加密（OpenSSL 可用时），即便有人拿到文件也难以读取
// 4) 接口不再返回文件名/目录，避免前端泄露存储位置
//
// 可选：你可以通过环境变量 TXTTRANS_SECRET 指定服务端密钥（建议为随机长字符串）。
// 若未提供，会在存储目录内自动生成 .secret.key（只生成一次，权限 0600）。

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

if (function_exists('mb_internal_encoding')) {
    mb_internal_encoding('UTF-8');
}

function u_strlen(string $s): int {
    if (function_exists('mb_strlen')) {
        return mb_strlen($s, 'UTF-8');
    }
    return strlen($s);
}


if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => '仅支持 POST。'], JSON_UNESCAPED_UNICODE);
    exit;
}

function json_fail(int $status, string $msg) {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function safe_mkdir(string $dir, int $mode = 0700): bool {
    if (is_dir($dir)) return true;
    $oldUmask = umask(0077);
    $ok = @mkdir($dir, $mode, true);
    umask($oldUmask);
    return $ok && is_dir($dir);
}

function best_effort_protect_dir(string $dir): void {
    // Apache: .htaccess 生效；Nginx/其他服务器需要你手动加 deny 规则
    @file_put_contents($dir . DIRECTORY_SEPARATOR . 'index.html', '', LOCK_EX);
    @file_put_contents($dir . DIRECTORY_SEPARATOR . '.htaccess', "Deny from all\n", LOCK_EX);
}

function load_or_create_secret(string $secretFile): string {
    // 返回 32 bytes
    if (is_file($secretFile)) {
        $k = @file_get_contents($secretFile);
        if (is_string($k) && strlen($k) >= 32) {
            return substr($k, 0, 32);
        }
    }

    // 创建新的密钥
    try {
        $k = random_bytes(32);
    } catch (Throwable $e) {
        // 兜底
        $k = openssl_random_pseudo_bytes(32);
        if ($k === false) {
            // 最后兜底：极少数环境
            $k = hash('sha256', uniqid('', true) . mt_rand(), true);
        }
    }

    $oldUmask = umask(0077);
    @file_put_contents($secretFile, $k, LOCK_EX);
    umask($oldUmask);
    @chmod($secretFile, 0600);

    return $k;
}

function encrypt_payload(string $plain, string $key32): array {
    // returns [ok(bool), payload(string), err(string)]
    if (function_exists('openssl_encrypt')) {
        $methods = openssl_get_cipher_methods(true);
        if (is_array($methods) && in_array('aes-256-gcm', $methods, true)) {
            try {
                $iv  = random_bytes(12);
            } catch (Throwable $e) {
                $iv = openssl_random_pseudo_bytes(12);
                if ($iv === false) $iv = str_repeat("\0", 12);
            }
            $tag = '';
            $cipher = openssl_encrypt($plain, 'aes-256-gcm', $key32, OPENSSL_RAW_DATA, $iv, $tag);
            if ($cipher === false || $tag === '' || strlen($tag) < 16) {
                return [false, '', '加密失败。'];
            }
            $bin = $iv . $tag . $cipher;
            return [true, 'v1:' . base64_encode($bin), ''];
        }
    }
    // OpenSSL 不可用时：退化为 base64（仍然使用不可枚举文件名 + 私有目录）
    return [true, 'v0:' . base64_encode($plain), ''];
}

function decrypt_payload(string $payload, string $key32): array {
    // returns [ok(bool), plain(string), err(string)]
    if (strncmp($payload, 'v1:', 3) === 0) {
        if (!function_exists('openssl_decrypt')) {
            return [false, '', '服务器缺少解密能力。'];
        }
        $bin = base64_decode(substr($payload, 3), true);
        if ($bin === false || strlen($bin) < (12 + 16)) {
            return [false, '', '数据损坏。'];
        }
        $iv     = substr($bin, 0, 12);
        $tag    = substr($bin, 12, 16);
        $cipher = substr($bin, 28);

        $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key32, OPENSSL_RAW_DATA, $iv, $tag);
        if ($plain === false) {
            return [false, '', '解密失败（取回密码可能错误或数据已损坏）。'];
        }
        return [true, $plain, ''];
    }

    if (strncmp($payload, 'v0:', 3) === 0) {
        $plain = base64_decode(substr($payload, 3), true);
        if ($plain === false) {
            return [false, '', '数据损坏。'];
        }
        return [true, $plain, ''];
    }

    // 兼容旧数据：当作明文
    return [true, $payload, ''];
}

// 读取 JSON 请求
$raw = file_get_contents('php://input');
if (!is_string($raw) || $raw === '') {
    json_fail(400, '请求体不能为空。');
}
$data = json_decode($raw, true);
if (!is_array($data)) {
    json_fail(400, '请求格式必须为 JSON。');
}

$action = isset($data['action']) ? (string)$data['action'] : '';
$code   = isset($data['code'])   ? (string)$data['code'] : '';
$code   = trim($code);

$MAX_CODE_LEN = 60;
$MAX_CHARS    = 1000000;

// ===== 校验取回密码 =====
if ($code === '') {
    json_fail(400, '取回密码不能为空。');
}
if (u_strlen($code) > $MAX_CODE_LEN) {
    json_fail(400, '取回密码不能超过 60 个字符。');
}
if (preg_match('/[\/\s]/u', $code)) {
    json_fail(400, '取回密码不能包含斜线 "/" 或任何空白字符。');
}
if (!preg_match('/^[0-9A-Za-z._-]+$/u', $code)) {
    json_fail(400, '取回密码只能包含大小写字母、数字、点、下划线、中划线。');
}

// ===== 存储目录选择 =====
// 按你的要求：仅使用旧版的 temp 文件夹存储（/wp-content/uploads/temp/）
// 注意：仍然使用不可枚举文件名 + 可选加密，且接口不返回文件名/目录，减少被跟踪/枚举风险
$BASE_DIR = __DIR__ . DIRECTORY_SEPARATOR . 'temp';
if (!safe_mkdir($BASE_DIR, 0700)) {
    json_fail(500, '无法创建 temp 存储目录，请检查权限。');
}
best_effort_protect_dir($BASE_DIR);

// ===== 获取服务端密钥 =====
$envSecret = getenv('TXTTRANS_SECRET');
if (is_string($envSecret) && $envSecret !== '') {
    // 把任意长度的字符串折叠成 32 bytes key
    $serverSecret = hash('sha256', $envSecret, true);
} else {
    $secretFile   = $BASE_DIR . DIRECTORY_SEPARATOR . '.secret.key';
    $serverSecret = load_or_create_secret($secretFile);
}

// ===== 计算不可枚举文件名（不返回给前端）=====
$fileKey = hash_hmac('sha256', $code, $serverSecret); // hex string
$subDir  = $BASE_DIR . DIRECTORY_SEPARATOR . substr($fileKey, 0, 2);
if (!safe_mkdir($subDir, 0700)) {
    json_fail(500, '无法创建存储子目录，请检查权限。');
}
$path = $subDir . DIRECTORY_SEPARATOR . $fileKey . '.dat';

// 每个 code 派生一把加密 key（32 bytes）
$encKey = hash_hmac('sha256', $code, $serverSecret, true);

// ===== 保存 =====
if ($action === 'save') {
    $text = isset($data['text']) ? (string)$data['text'] : '';

    if (u_strlen($text) > $MAX_CHARS) {
        json_fail(400, '内容超过 1,000,000 字符，保存失败。');
    }

    $enc = encrypt_payload($text, $encKey);
    if (!$enc[0]) {
        json_fail(500, $enc[2] ?: '保存失败。');
    }

    $oldUmask = umask(0077);
    $ok = (@file_put_contents($path, $enc[1], LOCK_EX) !== false);
    umask($oldUmask);
    @chmod($path, 0600);

    if (!$ok) {
        json_fail(500, '写入失败，请检查权限。');
    }

    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

// ===== 取回 =====
if ($action === 'fetch') {
    if (!is_file($path)) {
        // 兼容旧版本：尝试从公开 temp/code.txt 迁移到私有存储
        $legacyDir  = $BASE_DIR;
        $legacyPath = $legacyDir . DIRECTORY_SEPARATOR . $code . '.txt';
        if (is_file($legacyPath)) {
            $legacyText = @file_get_contents($legacyPath);
            if (is_string($legacyText)) {
                // 尝试迁移（成功则顺便删除旧文件，降低被枚举/追踪的风险）
                $enc = encrypt_payload($legacyText, $encKey);
                if ($enc[0]) {
                    $oldUmask = umask(0077);
                    $ok = (@file_put_contents($path, $enc[1], LOCK_EX) !== false);
                    umask($oldUmask);
                    @chmod($path, 0600);
                    if ($ok) {
                        @unlink($legacyPath);
                    }
                }
                echo json_encode(['ok' => true, 'text' => $legacyText], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }

        // 不暴露真实文件名/目录
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => '未找到对应数据（取回密码错误或尚未保存）。'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $payload = @file_get_contents($path);

    if (!is_string($payload)) {
        json_fail(500, '读取失败。');
    }

    $dec = decrypt_payload($payload, $encKey);
    if (!$dec[0]) {
        json_fail(400, $dec[2] ?: '解密失败。');
    }

    echo json_encode(['ok' => true, 'text' => $dec[1]], JSON_UNESCAPED_UNICODE);
    exit;
}

// ===== 未知 action =====
json_fail(400, '未知 action 参数。');
