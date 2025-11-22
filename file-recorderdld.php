<?php
// /wp-content/uploads/file-recorderdld.php
mb_internal_encoding('UTF-8');

$BASE_DIR = rtrim(dirname(__DIR__, 3), DIRECTORY_SEPARATOR) . '/temp';
$MAX_CODE_LEN = 60;

function respond_error_text($msg, $status=400){
    http_response_code($status);
    echo htmlspecialchars($msg,ENT_QUOTES,'UTF-8');
    exit;
}

$code=$_GET['code']??'';
$code=trim($code);

if($code==='')respond_error_text('缺少 code');
if(mb_strlen($code,'UTF-8')>$MAX_CODE_LEN)respond_error_text('code 过长');
if(preg_match('/[\/\s]/u',$code))respond_error_text('不能包含斜线/空白');
if(!preg_match('/^[0-9A-Za-z._-]+$/u',$code))respond_error_text('非法 code 字符');

if(!is_dir($BASE_DIR))respond_error_text('目录不存在',404);

$dir=$BASE_DIR;

// 精确匹配
$path=$dir.'/'.$code;
if(!is_file($path)){
    $path=null;
    $files=@scandir($dir);
    if(is_array($files)){
        foreach($files as $f){
            if($f==='.'||$f==='..')continue;
            if(strpos($f,$code.'.')===0){
                $cand=$dir.'/'.$f;
                if(is_file($cand)){
                    $path=$cand;
                    break;
                }
            }
        }
    }
    if(!$path)respond_error_text('未找到对应文件',404);
}

$mime='application/octet-stream';
if(function_exists('finfo_open')){
    $f=finfo_open(FILEINFO_MIME_TYPE);
    if($f){$mime=finfo_file($f,$path);finfo_close($f);}
}

$filename=basename($path);

header('Content-Type: '.$mime);
header('Content-Length: '.filesize($path));
header('Content-Disposition: attachment; filename="'.rawurlencode($filename).'"');
header('X-Content-Type-Options: nosniff');

readfile($path);
exit;
