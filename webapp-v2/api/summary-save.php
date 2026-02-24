<?php
/**
 * Сохранение итогов Фанки-вечера для публичного доступа.
 * POST ?za  body: JSON { tournamentName, data: [...players], createdAt }
 * Возвращает: { id: "abc123" }
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

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'POST only']);
    exit();
}

$input = file_get_contents('php://input');
$payload = json_decode($input, true);

if (!$payload || !isset($payload['data']) || !is_array($payload['data'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit();
}

// Генерируем короткий уникальный ID
$id = substr(md5(uniqid(mt_rand(), true)), 0, 10);

// Сохраняем в файл (без базы данных, просто JSON файлы)
$dir = __DIR__ . '/summaries';
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

$fileData = [
    'id' => $id,
    'tournamentName' => isset($payload['tournamentName']) ? $payload['tournamentName'] : 'Турнир',
    'data' => $payload['data'],
    'games' => isset($payload['games']) ? $payload['games'] : [],
    'createdAt' => isset($payload['createdAt']) ? $payload['createdAt'] : date('c'),
    'savedAt' => date('c')
];

$filePath = $dir . '/' . $id . '.json';
$written = file_put_contents($filePath, json_encode($fileData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

if ($written === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save']);
    exit();
}

echo json_encode(['id' => $id]);

