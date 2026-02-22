<?php
// =====================================================
// Admin Auth - проверка прав администратора
// GET ?token=xxx — проверить, является ли пользователь админом
// =====================================================

require_once __DIR__ . '/admin-config.php';
require_once __DIR__ . '/../../login/auth-helpers.php';
setJsonHeaders();

$token = isset($_GET['token']) ? trim($_GET['token']) : '';

if (empty($token)) {
    jsonError('Token required', 401);
}

$session = validateSession($database, $token);
if (!$session) {
    jsonError('Invalid or expired token', 401);
}

$telegramId = (int)$session['telegram_id'];
$isAdmin = in_array($telegramId, ADMIN_TELEGRAM_IDS);

if (!$isAdmin) {
    jsonResponse([
        'admin' => false,
        'message' => 'У вас нет прав администратора. Ваш Telegram ID: ' . $telegramId
    ], 403);
}

jsonResponse([
    'admin' => true,
    'user' => [
        'id' => $session['telegram_id'],
        'username' => $session['telegram_username'],
        'first_name' => $session['telegram_first_name'],
        'last_name' => $session['telegram_last_name'],
    ]
]);

