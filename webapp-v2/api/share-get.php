<?php
/**
 * Get shared session data by ID (public, no auth required).
 * GET ?za&id=abc123def4
 */

if (!isset($_REQUEST['za'])) {
    exit();
}

register_shutdown_function(function() {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(['fatal_error' => $err['message'], 'file' => basename($err['file']), 'line' => $err['line']]);
    }
});

ini_set('display_errors', 0);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$id = isset($_REQUEST['id']) ? preg_replace('/[^a-f0-9]/', '', $_REQUEST['id']) : '';

if (strlen($id) < 5 || strlen($id) > 32) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid ID']);
    exit();
}

$filePath = __DIR__ . '/shares/' . $id . '.json';

if (!file_exists($filePath)) {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
    exit();
}

$content = file_get_contents($filePath);
if ($content === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Read error']);
    exit();
}

echo $content;
