<?php
declare(strict_types=1);

// doremii-mw-proxy.php
// query: ?word=example
// response: { ok: true, type: "entries", entries: [...] }

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function out($x){ echo json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }

$word = isset($_GET['word']) ? trim((string)$_GET['word']) : '';
if ($word === '') out(['ok'=>false,'error'=>'missing word']);

$baseDir = __DIR__;
$keyFile = $baseDir . '/mw_api_key.txt';
if (!is_file($keyFile)) out(['ok'=>false,'error'=>'mw_api_key.txt not found']);
$key = trim((string)file_get_contents($keyFile));
if ($key === '') out(['ok'=>false,'error'=>'empty api key']);

$ref = 'collegiate'; // 你也可以改成 learners
$url = 'https://www.dictionaryapi.com/api/v3/references/'.$ref.'/json/'.rawurlencode($word).'?key='.rawurlencode($key);

// 简单文件缓存（7天，避免额度被刷）
$cacheDir = $baseDir . '/mw_cache';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
$cachePath = $cacheDir . '/' . md5($ref.'|'.strtolower($word)) . '.json';
$ttl = 7 * 86400;

if (is_file($cachePath) && (time() - filemtime($cachePath) < $ttl)) {
  $cached = json_decode((string)file_get_contents($cachePath), true);
  if (is_array($cached)) out($cached);
}

$ctx = stream_context_create([
  'http' => [
    'method' => 'GET',
    'timeout' => 8,
    'header' => "User-Agent: doremii-dict/1.0\r\n",
  ]
]);

$raw = @file_get_contents($url, false, $ctx);
if ($raw === false) out(['ok'=>false,'error'=>'fetch failed']);

$data = json_decode($raw, true);
if (!is_array($data)) out(['ok'=>false,'error'=>'bad json']);

$result = ['ok'=>true, 'type'=>'entries', 'entries'=>[]];

if (isset($data[0]) && is_string($data[0])) {
  $result = ['ok'=>true, 'type'=>'suggestions', 'suggestions'=>array_slice($data, 0, 12)];
} else {
  $entries = [];
  foreach (array_slice($data, 0, 3) as $ent) {
    if (!is_array($ent)) continue;
    $entries[] = [
      'headword' => $ent['hwi']['hw'] ?? ($ent['meta']['id'] ?? $word),
      'fl' => $ent['fl'] ?? '',
      'shortdef' => (isset($ent['shortdef']) && is_array($ent['shortdef'])) ? array_slice($ent['shortdef'], 0, 6) : []
    ];
  }
  $result['entries'] = $entries;
}

@file_put_contents($cachePath, json_encode($result, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES), LOCK_EX);
out($result);