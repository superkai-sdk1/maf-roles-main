<?php
    header("Access-Control-Allow-Origin: *");

if (!isset($_REQUEST['za']) || !isset($_REQUEST['url'])) {
	exit();
}

$url = $_REQUEST['url'];

ini_set('error_reporting', E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

if(isset($_REQUEST['body'])) {
	$body = $_REQUEST['body'];
	$r = getByPOST($url, $body);
	echo $r; // именно echo, если результат — JSON!
} else {
	echo getByGET($url);
}

function getByGET($urlFrom) {
	return file_get_contents($urlFrom);
}

function getByPOST($urlFrom, $body) {
	$crl = curl_init($urlFrom);
	$headr = array();
	$headr[] = 'Content-type: application/x-www-form-urlencoded';
	curl_setopt($crl, CURLOPT_POSTFIELDS, $body);
	curl_setopt($crl, CURLOPT_POST, true);
	curl_setopt($crl, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($crl, CURLOPT_HTTPHEADER, $headr);
	$response = curl_exec($crl);
	curl_close($crl);
	return $response;
}