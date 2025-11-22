<?php
// /wp-content/uploads/file-recorderapi.php

// ==== CORS 处理（允许从主站跨域调用 cloudpan 接口）====
$allowed_origins = [
    'https://doremii.top',
    'https://www.doremii.top',
    'https://cloudpan.doremii.top',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $allowed_origins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

// 处理预检请求（主要是 JSON 接口会触发 OPTIONS）
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    if ($origin && in_array($origin, $allowed_origins, true)) {
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Max-Age: 86400');
    }
    exit;
}
// ==== CORS 结束 ====

// 原有内容
header('Content-Type: application/json; charset=utf-8');
mb_internal_encoding('UTF-8');


$BASE_DIR        = rtrim(dirname(__DIR__, 3), DIRECTORY_SEPARATOR) . '/temp';
$MAX_CODE_LEN    = 60;
$MAX_FILE_BYTES  = 1170378588;

// ---- utility ----
function respond_error($msg, $status = 400) {
    http_response_code($status);
    echo json_encode(['ok'=>false,'error'=>$msg],JSON_UNESCAPED_UNICODE);
    exit;
}
function validate_code($raw, $maxLen) {
    $code = trim((string)$raw);
    if ($code==='') respond_error('取回密码不能为空');
    if (mb_strlen($code,'UTF-8')>$maxLen) respond_error('取回密码不能超过60字');
    if (preg_match('/[\/\s]/u',$code)) respond_error('取回密码不能包含斜线或空白字符');
    if (!preg_match('/^[0-9A-Za-z._-]+$/u',$code)) respond_error('取回密码只能包含字母数字._-');
    return $code;
}
function find_files_by_code_all($dir, $code) {
    $dir=rtrim($dir,'/');
    if(!is_dir($dir))return[];
    $files=@scandir($dir);
    if(!is_array($files))return[];
    $ret=[];
    foreach($files as $f){
        if($f==='.'||$f==='..')continue;
        if($f===$code||strpos($f,$code.'.')===0){
            $p=$dir.'/'.$f;
            if(is_file($p)&&is_readable($p))$ret[]=$p;
        }
    }
    return $ret;
}

// detect
$method      = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

// ------------------- UPLOAD -------------------
if ($method==='POST' && stripos($contentType,'multipart/form-data')!==false){
    $action=$_POST['action']??'';
    if($action!=='save_file')respond_error('未知 action');

    global $MAX_CODE_LEN,$BASE_DIR,$MAX_FILE_BYTES;
    $code=validate_code($_POST['code']??'', $MAX_CODE_LEN);

    if(!isset($_FILES['file'])) respond_error('没有收到上传文件');
    $err=$_FILES['file']['error']??UPLOAD_ERR_NO_FILE;
    if($err!==UPLOAD_ERR_OK){
        respond_error('上传失败，错误码：'.$err);
    }

    $tmp=$_FILES['file']['tmp_name'];
    $name=$_FILES['file']['name'];
    $size=(int)($_FILES['file']['size']??0);

    if(!is_uploaded_file($tmp)) respond_error('无效上传');
    if($size>$MAX_FILE_BYTES){
        $mb=round($size/1024/1024,2);
        respond_error('文件过大（'.$mb.'MB），超过1GB限制');
    }

    if(!is_dir($BASE_DIR)){
        if(!mkdir($BASE_DIR,0770,true)) respond_error('无法创建目录');
    }
    if(!is_writable($BASE_DIR)) respond_error('目录不可写');

    $ext=pathinfo($name,PATHINFO_EXTENSION);
    $ext= $ext==='' ? '' : ('.'.$ext);
    $filename=$code.$ext;
    $dest=$BASE_DIR.'/'.$filename;

    if(!@move_uploaded_file($tmp,$dest)) respond_error('保存失败');

    echo json_encode([
        'ok'=>true,
        'code'=>$code,
        'filename'=>$filename,
        'download_url'=>'/wp-content/uploads/file-recorderdld.php?code='.rawurlencode($code)
    ],JSON_UNESCAPED_UNICODE);
    exit;
}

// ------------------- FETCH -------------------
$raw=file_get_contents('php://input');
$data=json_decode($raw,true);
if(!is_array($data)) respond_error('JSON 无效');

$action=$data['action']??'';
if($action==='check_fetch'){
    global $MAX_CODE_LEN,$BASE_DIR;
    $code=validate_code($data['code']??'', $MAX_CODE_LEN);

    if(!is_dir($BASE_DIR)) respond_error('目录不存在',500);

    $paths=find_files_by_code_all($BASE_DIR,$code);
    if(empty($paths)) respond_error('未找到文件',404);

    $files=[];
    foreach($paths as $p){
        $fname=basename($p);
        $files[]=[
            'filename'=>$fname,
            'abs_path'=>$p,
            'download_url'=>'/wp-content/uploads/file-recorderdld.php?code='.rawurlencode($code)
        ];
    }

    $first=$files[0];

    echo json_encode([
        'ok'=>true,
        'code'=>$code,
        'files'=>$files,
        'filename'=>$first['filename'],
        'download_url'=>$first['download_url']
    ],JSON_UNESCAPED_UNICODE);
    exit;
}

respond_error('未知 action');
