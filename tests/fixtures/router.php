<?php
// PHP built-in server router; use only with 127.0.0.1 fixture processes.
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
$target=realpath($_SERVER['DOCUMENT_ROOT'].$path);
if($target && str_starts_with($target,realpath($_SERVER['DOCUMENT_ROOT']).DIRECTORY_SEPARATOR) && is_file($target)) return false;
require $_SERVER['DOCUMENT_ROOT'].'/index.php';
