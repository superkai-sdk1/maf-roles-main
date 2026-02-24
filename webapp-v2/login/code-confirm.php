<?php
// =====================================================
// Confirm auth code (called by the Telegram bot)
// POST: {code, telegram_id, username, first_name, last_name, bot_secret}
// Returns: {success: true, token} or {error: ...}
// =====================================================

require_once __DIR__ . '/auth-helpers.php';
setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    jsonError('Invalid JSON body');
}

$code = isset($input['code']) ? trim($input['code']) : '';
$telegramId = isset($input['telegram_id']) ? intval($input['telegram_id']) : 0;
$username = isset($input['username']) ? $input['username'] : null;
$firstName = isset($input['first_name']) ? $input['first_name'] : null;
$lastName = isset($input['last_name']) ? $input['last_name'] : null;
$botSecret = isset($input['bot_secret']) ? $input['bot_secret'] : '';

// Проверяем секрет бота (используем хеш от BOT_TOKEN)
$expectedSecret = hash('sha256', BOT_TOKEN);
if (!hash_equals($expectedSecret, $botSecret)) {
    jsonError('Unauthorized', 403);
}

if (empty($code) || strlen($code) !== 4) {
    jsonError('Valid 4-digit code is required');
}

if ($telegramId <= 0) {
    jsonError('Valid telegram_id is required');
}

// Ищем неподтверждённый активный код
$codeRow = $database->get($TABLE_AUTH_CODES, ['id', 'code', 'expires_at'], [
    'code' => $code,
    'confirmed_at' => null,
    'expires_at[>]' => date('Y-m-d H:i:s'),
    'ORDER' => ['id' => 'DESC']
]);

if (!$codeRow) {
    jsonError('Code not found or expired', 404);
}

// Создаём сессию
$token = createSession($database, $telegramId, $username, $firstName, $lastName);

// Обновляем код: помечаем подтверждённым
$database->update($TABLE_AUTH_CODES, [
    'telegram_id' => $telegramId,
    'token' => $token,
    'confirmed_at' => date('Y-m-d H:i:s')
], [
    'id' => $codeRow['id']
]);

jsonResponse([
    'success' => true,
    'token' => $token
]);

