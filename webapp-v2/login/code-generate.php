<?php
// =====================================================
// Generate 4-digit auth code
// POST request
// Optional: {link_token: "xxx"} — for Telegram linking (not new auth)
// Returns: {code, expires_in, bot_username, bot_link}
// =====================================================

require_once __DIR__ . '/auth-helpers.php';
setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

$userId = null;

$input = json_decode(file_get_contents('php://input'), true);
if ($input && !empty($input['link_token'])) {
    $session = validateSession($database, $input['link_token']);
    if (!$session || empty($session['user_id'])) {
        jsonError('Invalid link token', 401);
    }
    $userId = $session['user_id'];
}

try {
    $code = generateUniqueCode($database);
    $expiresAt = date('Y-m-d H:i:s', time() + CODE_TTL_SECONDS);

    $insertData = [
        'code' => $code,
        'created_at' => date('Y-m-d H:i:s'),
        'expires_at' => $expiresAt
    ];

    if ($userId) {
        $insertData['user_id'] = $userId;
    }

    $database->insert($TABLE_AUTH_CODES, $insertData);

    if (random_int(1, 100) <= 5) {
        cleanupExpired($database);
    }

    jsonResponse([
        'code' => $code,
        'expires_in' => CODE_TTL_SECONDS,
        'bot_username' => BOT_USERNAME,
        'bot_link' => 'https://t.me/' . BOT_USERNAME . '?start=' . $code,
        'link_mode' => $userId ? true : false,
    ]);
} catch (\Throwable $e) {
    jsonError('Server error: ' . $e->getMessage(), 500);
}
