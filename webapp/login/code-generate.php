<?php
// =====================================================
// Generate 4-digit auth code for browser login
// POST request, returns: {code, expires_in, bot_username, bot_link}
// =====================================================

require_once __DIR__ . '/auth-helpers.php';
setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

try {
    // Генерируем уникальный код
    $code = generateUniqueCode($database);
    $expiresAt = date('Y-m-d H:i:s', time() + CODE_TTL_SECONDS);

    // Сохраняем код в БД
    $database->insert($TABLE_AUTH_CODES, [
        'code' => $code,
        'created_at' => date('Y-m-d H:i:s'),
        'expires_at' => $expiresAt
    ]);


    // Периодическая очистка
    if (random_int(1, 100) <= 5) {
        cleanupExpired($database);
    }

    jsonResponse([
        'code' => $code,
        'expires_in' => CODE_TTL_SECONDS,
        'bot_username' => BOT_USERNAME,
        'bot_link' => 'https://t.me/' . BOT_USERNAME . '?start=' . $code
    ]);
} catch (\Throwable $e) {
    jsonError('Server error: ' . $e->getMessage(), 500);
}

