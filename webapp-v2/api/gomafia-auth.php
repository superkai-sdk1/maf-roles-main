<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if (!isset($_REQUEST['za'])) {
    exit();
}

require_once __DIR__ . '/gomafia-functions.php';

$action = isset($_REQUEST['action']) ? $_REQUEST['action'] : '';

if ($action === 'login') {
    $nickname = isset($_POST['nickname']) ? trim($_POST['nickname']) : '';
    $password = isset($_POST['password']) ? $_POST['password'] : '';

    if (!$nickname || !$password) {
        echo json_encode(['success' => false, 'error' => 'Введите никнейм и пароль']);
        exit();
    }

    $cookieFile = tempnam(sys_get_temp_dir(), 'gm_');

    try {
        $result = doFullLogin($cookieFile, $nickname, $password);

        if ($result['success']) {
            echo json_encode([
                'success' => true,
                'profile' => $result['profile'] ?? ['nickname' => $nickname, 'avatar' => null]
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'error' => $result['error'] ?? 'Неверный никнейм или пароль'
            ]);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Ошибка: ' . $e->getMessage()]);
    }

    gmCleanup($cookieFile);
    exit();
}

if ($action === 'lookup') {
    $nickname = isset($_REQUEST['nickname']) ? trim($_REQUEST['nickname']) : '';
    if (!$nickname) {
        echo json_encode(['success' => false, 'error' => 'Введите никнейм']);
        exit();
    }

    $profile = gmLookupPlayer($nickname);
    echo json_encode($profile
        ? ['success' => true, 'profile' => $profile]
        : ['success' => false, 'error' => 'Игрок не найден']);
    exit();
}

echo json_encode(['success' => false, 'error' => 'Unknown action']);
exit();
