<?php
if (!isset($_GET['za']) || !isset($_GET['roomId'])) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo '{}';
    exit();
}
$roomId = preg_replace('/[^\w\-]/', '', $_GET['roomId']); // sanitize
$file = __DIR__ . "/avatars_{$roomId}.json";
header('Content-Type: application/json');
if (file_exists($file)) {
    $json = @file_get_contents($file);
    if ($json === false) {
        http_response_code(500);
        echo '{}';
    } else {
        echo $json;
    }
} else {
    echo '{}';
}
