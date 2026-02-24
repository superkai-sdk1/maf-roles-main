<?php
// =====================================================
// Check if auth code was confirmed by the bot
// GET: ?code=1234
// Returns: {confirmed: false} or {confirmed: true, token, user}
// =====================================================

require_once __DIR__ . '/auth-helpers.php';
setJsonHeaders();

$code = isset($_GET['code']) ? trim($_GET['code']) : '';

if (empty($code) || strlen($code) !== 4) {
    jsonError('Valid 4-digit code is required');
}

// Ищем код в БД
$codeRow = $database->get($TABLE_AUTH_CODES, [
    'id', 'code', 'telegram_id', 'token', 'confirmed_at', 'expires_at'
], [
    'code' => $code,
    'expires_at[>]' => date('Y-m-d H:i:s'),
    'ORDER' => ['id' => 'DESC']
]);

if (!$codeRow) {
    jsonResponse([
        'confirmed' => false,
        'expired' => true,
        'message' => 'Код не найден или истёк'
    ]);
}

if (empty($codeRow['confirmed_at']) || empty($codeRow['token'])) {
    jsonResponse([
        'confirmed' => false,
        'expired' => false
    ]);
}

// Код подтверждён — возвращаем данные сессии
$session = validateSession($database, $codeRow['token']);

if (!$session) {
    jsonResponse([
        'confirmed' => false,
        'message' => 'Ошибка сессии'
    ]);
}

// Обновляем сессию данными устройства браузера (сессия была создана ботом)
$browserUA = $_SERVER['HTTP_USER_AGENT'] ?? null;
$browserIP = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
if ($browserIP && strpos($browserIP, ',') !== false) {
    $browserIP = trim(explode(',', $browserIP)[0]);
}
$database->update($TABLE_AUTH_SESSIONS, [
    'user_agent' => $browserUA,
    'ip_address' => $browserIP,
    'device_name' => parseDeviceName($browserUA),
], [
    'id' => $session['id']
]);

jsonResponse([
    'confirmed' => true,
    'token' => $codeRow['token'],
    'user' => [
        'id' => $session['telegram_id'],
        'username' => $session['telegram_username'],
        'first_name' => $session['telegram_first_name'],
        'last_name' => $session['telegram_last_name'],
    ]
]);

