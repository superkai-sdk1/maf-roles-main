<?php
/**
 * Поиск игроков в таблице players по подстроке login.
 * GET/POST ?za&q=подстрока
 */

if (!isset($_REQUEST['za'])) {
    exit();
}

// Перехват fatal errors
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

$query = isset($_REQUEST['q']) ? trim($_REQUEST['q']) : '';

if (strlen($query) < 1) {
    echo json_encode([]);
    exit();
}

require 'db.php';

try {
    $pdo = $database->pdo;
    $stmt = $pdo->prepare("SELECT login, data FROM players WHERE login LIKE ? LIMIT 15");
    $stmt->execute(array('%' . $query . '%'));
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $results = array();
    foreach ($rows as $row) {
        $data = json_decode($row['data'], true);
        if ($data) {
            $results[] = array(
                'login' => isset($data['login']) ? $data['login'] : $row['login'],
                'avatar_link' => isset($data['avatar_link']) ? $data['avatar_link'] : null,
                'id' => isset($data['id']) ? $data['id'] : null,
                'title' => isset($data['title']) ? $data['title'] : null
            );
        } else {
            $results[] = array(
                'login' => $row['login'],
                'avatar_link' => null,
                'id' => null,
                'title' => null
            );
        }
    }

    echo json_encode($results, JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode(array('error' => $e->getMessage(), 'line' => $e->getLine()));
}
