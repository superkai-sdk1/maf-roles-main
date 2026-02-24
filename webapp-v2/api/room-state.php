<?php
    header("Access-Control-Allow-Origin: *");

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$roomId = $_REQUEST['roomId'] ?? $_POST['roomId'] ?? null;
if (!$roomId) {
    http_response_code(400);
    echo json_encode(['error' => 'roomId required']);
    exit();
}
$file = __DIR__ . "/room_{$roomId}.json";

// Получить состояние комнаты
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($file)) {
        header('Content-Type: application/json');
        echo file_get_contents($file);
    } else {
        echo json_encode(["peoples" => [], "panelState" => []]);
    }
    exit();
}

// Сохранить состояние комнаты (инкрементально)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) $data = [];
    $state = [];
    if (file_exists($file)) {
        $state = json_decode(file_get_contents($file), true) ?: [];
    }
    // Инкрементально обновляем только переданные поля
    foreach ($data as $k => $v) {
        $state[$k] = $v;
    }
    file_put_contents($file, json_encode($state, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
    echo json_encode(['result' => 'ok']);
    exit();
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
