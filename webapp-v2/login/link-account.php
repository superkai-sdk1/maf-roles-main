<?php
// =====================================================
// Link additional auth methods to existing account
// POST: {token, method: 'telegram'|'gomafia', ...params}
//
// Link Telegram: requires completing the code flow first
//   {token, method: 'telegram', telegram_id, username, first_name, last_name, bot_secret}
//   (called by the bot, same as code-confirm but links to existing user)
//
// Link GoMafia: validates credentials and links
//   {token, method: 'gomafia', nickname, password}
//
// GET: ?token=xxx — returns linked methods info
// DELETE: ?token=xxx&method=gomafia — unlink a method
// =====================================================

require_once __DIR__ . '/auth-helpers.php';
setJsonHeaders();

// GET — linked methods info
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $token = isset($_GET['token']) ? trim($_GET['token']) : '';
    if (empty($token)) jsonError('Token is required');

    $session = validateSession($database, $token);
    if (!$session) jsonError('Invalid or expired session', 401);

    $userId = $session['user_id'];
    if (!$userId) jsonError('User not found', 400);

    $user = getUserById($database, $userId);
    if (!$user) jsonError('User not found', 404);

    $passkeys = getUserPasskeys($database, $userId);
    $passkeyList = [];
    foreach ($passkeys as $pk) {
        $passkeyList[] = [
            'id' => (int)$pk['id'],
            'device_name' => $pk['device_name'],
            'created_at' => $pk['created_at'],
            'last_used_at' => $pk['last_used_at'],
        ];
    }

    jsonResponse([
        'telegram' => [
            'linked' => !empty($user['telegram_id']),
            'telegram_id' => $user['telegram_id'],
            'username' => $user['telegram_username'],
            'first_name' => $user['telegram_first_name'],
        ],
        'gomafia' => [
            'linked' => !empty($user['gomafia_id']),
            'gomafia_id' => $user['gomafia_id'],
            'nickname' => $user['gomafia_nickname'],
        ],
        'passkeys' => $passkeyList,
    ]);
}

// DELETE — unlink a method
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $token = isset($_GET['token']) ? trim($_GET['token']) : '';
    if (empty($token)) jsonError('Token is required');

    $session = validateSession($database, $token);
    if (!$session) jsonError('Invalid or expired session', 401);

    $userId = $session['user_id'];
    if (!$userId) jsonError('User not found', 400);

    $method = isset($_GET['method']) ? $_GET['method'] : '';
    $user = getUserById($database, $userId);

    // Ensure at least one auth method remains
    $linkedCount = (!empty($user['telegram_id']) ? 1 : 0)
                 + (!empty($user['gomafia_id']) ? 1 : 0)
                 + ($database->count($TABLE_USER_PASSKEYS, ['user_id' => $userId]) > 0 ? 1 : 0);

    if ($linkedCount <= 1) {
        jsonError('Нельзя отвязать последний способ авторизации');
    }

    if ($method === 'gomafia') {
        $database->update($TABLE_USERS, [
            'gomafia_id' => null,
            'gomafia_nickname' => null,
        ], ['id' => $userId]);
        jsonResponse(['success' => true]);
    }

    if ($method === 'passkey') {
        $passkeyId = isset($_GET['passkey_id']) ? intval($_GET['passkey_id']) : 0;
        if ($passkeyId <= 0) jsonError('passkey_id is required');

        $pk = $database->get($TABLE_USER_PASSKEYS, 'user_id', ['id' => $passkeyId]);
        if ($pk != $userId) jsonError('Passkey not found', 404);

        $database->delete($TABLE_USER_PASSKEYS, ['id' => $passkeyId]);
        jsonResponse(['success' => true]);
    }

    jsonError('Invalid method. Use: gomafia, passkey');
}

// POST — link a method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) jsonError('Invalid JSON body');

$token = $input['token'] ?? '';
if (empty($token)) jsonError('Token is required');

$session = validateSession($database, $token);
if (!$session) jsonError('Invalid or expired session', 401);

$userId = $session['user_id'];
if (!$userId) jsonError('User not found', 400);

$method = $input['method'] ?? '';
$user = getUserById($database, $userId);

// --- Link Telegram (called by bot with bot_secret) ---
if ($method === 'telegram') {
    $botSecret = $input['bot_secret'] ?? '';
    $expectedSecret = hash('sha256', BOT_TOKEN);
    if (!hash_equals($expectedSecret, $botSecret)) {
        jsonError('Unauthorized', 403);
    }

    $telegramId = intval($input['telegram_id'] ?? 0);
    if ($telegramId <= 0) jsonError('Valid telegram_id is required');

    // Check if this telegram_id is already linked to another user
    $existing = $database->get($TABLE_USERS, 'id', ['telegram_id' => $telegramId]);
    if ($existing && $existing != $userId) {
        jsonError('Этот Telegram аккаунт уже привязан к другому пользователю');
    }

    $database->update($TABLE_USERS, [
        'telegram_id' => $telegramId,
        'telegram_username' => $input['username'] ?? null,
        'telegram_first_name' => $input['first_name'] ?? null,
        'telegram_last_name' => $input['last_name'] ?? null,
    ], ['id' => $userId]);

    // Update all active sessions for this user with telegram info
    $database->update($TABLE_AUTH_SESSIONS, [
        'telegram_id' => $telegramId,
        'telegram_username' => $input['username'] ?? null,
        'telegram_first_name' => $input['first_name'] ?? null,
        'telegram_last_name' => $input['last_name'] ?? null,
    ], [
        'user_id' => $userId,
        'expires_at[>]' => date('Y-m-d H:i:s'),
    ]);

    jsonResponse(['success' => true]);
}

// --- Link GoMafia ---
if ($method === 'gomafia') {
    $nickname = trim($input['nickname'] ?? '');
    $password = $input['password'] ?? '';

    if (empty($nickname) || empty($password)) {
        jsonError('Введите никнейм и пароль GoMafia');
    }

    require_once __DIR__ . '/../api/gomafia-functions.php';

    $cookieFile = tempnam(sys_get_temp_dir(), 'gm_link_');
    try {
        $result = doFullLogin($cookieFile, $nickname, $password);
        gmCleanup($cookieFile);
    } catch (\Throwable $e) {
        gmCleanup($cookieFile);
        jsonError('Ошибка проверки GoMafia: ' . $e->getMessage(), 500);
    }

    if (!$result['success']) {
        jsonError($result['error'] ?? 'Неверный никнейм или пароль GoMafia', 401);
    }

    $profile = $result['profile'] ?? ['nickname' => $nickname];
    $gomafiaId = $profile['id'] ?? null;

    if (!$gomafiaId) {
        $lookup = gmLookupPlayer($nickname);
        if ($lookup) $gomafiaId = $lookup['id'] ?? null;
    }
    if (!$gomafiaId) $gomafiaId = $nickname;
    $gomafiaId = (string)$gomafiaId;

    // Check if this gomafia_id is already linked to another user
    $existing = $database->get($TABLE_USERS, 'id', ['gomafia_id' => $gomafiaId]);
    if ($existing && $existing != $userId) {
        jsonError('Этот GoMafia аккаунт уже привязан к другому пользователю');
    }

    $database->update($TABLE_USERS, [
        'gomafia_id' => $gomafiaId,
        'gomafia_nickname' => $profile['nickname'] ?? $nickname,
    ], ['id' => $userId]);

    jsonResponse(['success' => true, 'gomafia_nickname' => $profile['nickname'] ?? $nickname]);
}

jsonError('Invalid method. Use: telegram, gomafia');
