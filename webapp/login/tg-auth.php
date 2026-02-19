<?php
// =====================================================
// Telegram Mini App Auto-Auth
// POST: initData (raw Telegram WebApp initData string)
// Returns: {token, user} on success
// =====================================================

require_once __DIR__ . '/auth-helpers.php';
setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

$initData = isset($_POST['initData']) ? $_POST['initData'] : file_get_contents('php://input');

// Если пришёл JSON
$jsonInput = json_decode($initData, true);
if ($jsonInput && isset($jsonInput['initData'])) {
    $initData = $jsonInput['initData'];
}

if (empty($initData)) {
    jsonError('initData is required');
}

// Валидация HMAC
if (!validateTelegramInitData($initData, BOT_TOKEN)) {
    jsonError('Invalid initData signature', 403);
}

// Извлекаем данные пользователя
$user = extractUserFromInitData($initData);
if (!$user) {
    jsonError('Could not extract user data');
}

// Создаём сессию
$token = createSession(
    $database,
    $user['id'],
    isset($user['username']) ? $user['username'] : null,
    isset($user['first_name']) ? $user['first_name'] : null,
    isset($user['last_name']) ? $user['last_name'] : null
);

// Периодическая очистка старых записей (1% шанс)
if (random_int(1, 100) === 1) {
    cleanupExpired($database);
}

jsonResponse([
    'token' => $token,
    'user' => [
        'id' => $user['id'],
        'username' => isset($user['username']) ? $user['username'] : null,
        'first_name' => isset($user['first_name']) ? $user['first_name'] : null,
        'last_name' => isset($user['last_name']) ? $user['last_name'] : null,
    ]
]);

