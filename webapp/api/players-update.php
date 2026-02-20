<?php
/**
 * Обновление данных игроков в таблице players.
 *
 * POST ?za
 *   player[] = JSON-строка с данными игрока (login, avatar_link, id, title)
 *
 * Логика: если игрок с таким login уже существует — обновляем data,
 *         если нет — вставляем новую запись.
 */

if (!isset($_REQUEST['za'])) {
    exit();
}

require 'db.php';

ini_set('error_reporting', E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

header('Content-Type: application/json; charset=utf-8');

if (!isset($_REQUEST['player']) || !is_array($_REQUEST['player'])) {
    echo json_encode(['error' => 'no player data']);
    exit();
}

$updated = 0;
$inserted = 0;
$errors = [];

foreach ($_REQUEST['player'] as $key => $playerData) {
    $decoded = json_decode($playerData);
    if (!$decoded || !isset($decoded->login)) {
        $errors[] = "Invalid JSON at index $key";
        continue;
    }

    $playerLogin = $decoded->login;
    $setArray = array("data" => $playerData, "login" => $playerLogin);

    // Проверяем, существует ли игрок
    $existing = $database->select($TABLE_PLAYERS, "id", ["login" => $playerLogin]);

    if (!empty($existing)) {
        // Обновляем
        $database->update($TABLE_PLAYERS, ["data" => $playerData], ["login" => $playerLogin]);
        $updated++;
    } else {
        // Вставляем
        $database->insert($TABLE_PLAYERS, $setArray);
        $inserted++;
    }
}

echo json_encode([
    'ok' => true,
    'updated' => $updated,
    'inserted' => $inserted,
    'errors' => $errors
], JSON_UNESCAPED_UNICODE);

