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

$jsonInput = json_decode($initData, true);
if ($jsonInput && isset($jsonInput['initData'])) {
    $initData = $jsonInput['initData'];
}

if (empty($initData)) {
    jsonError('initData is required');
}

if (!validateTelegramInitData($initData, BOT_TOKEN)) {
    jsonError('Invalid initData signature', 403);
}

$tgUser = extractUserFromInitData($initData);
if (!$tgUser) {
    jsonError('Could not extract user data');
}

$user = findOrCreateUserByTelegram(
    $database,
    $tgUser['id'],
    $tgUser['username'] ?? null,
    $tgUser['first_name'] ?? null,
    $tgUser['last_name'] ?? null
);

$token = createSession($database, $user['id'], 'telegram');

if (random_int(1, 100) === 1) {
    cleanupExpired($database);
}

$userResponse = buildUserResponse($database, [
    'user_id' => $user['id'],
    'auth_method' => 'telegram',
    'telegram_id' => $tgUser['id'],
    'telegram_username' => $tgUser['username'] ?? null,
    'telegram_first_name' => $tgUser['first_name'] ?? null,
    'telegram_last_name' => $tgUser['last_name'] ?? null,
]);

jsonResponse([
    'token' => $token,
    'user' => $userResponse,
]);
