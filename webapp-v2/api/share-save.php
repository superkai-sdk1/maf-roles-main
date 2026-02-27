<?php
/**
 * Save session data for public sharing.
 * POST ?za  body: JSON with full session + games history
 * Returns: { id: "abc123def4" }
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

if (!$payload || !isset($payload['currentGame'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit();
}

$id = substr(md5(uniqid(mt_rand(), true)), 0, 12);

$dir = __DIR__ . '/shares';
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

$fileData = [
    'id' => $id,
    'tournamentName' => $payload['tournamentName'] ?? '',
    'gameMode' => $payload['gameMode'] ?? 'manual',
    'currentGame' => $payload['currentGame'],
    'gamesHistory' => $payload['gamesHistory'] ?? [],
    'createdAt' => date('c'),
];

$filePath = $dir . '/' . $id . '.json';
$written = file_put_contents($filePath, json_encode($fileData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

if ($written === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save']);
    exit();
}

echo json_encode(['id' => $id]);
