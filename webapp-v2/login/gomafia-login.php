<?php
// =====================================================
// GoMafia Profile Authentication
// POST: {nickname, password}
// Returns: {token, user} on success
// =====================================================

require_once __DIR__ . '/auth-helpers.php';
require_once __DIR__ . '/../api/gomafia-functions.php';
setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    jsonError('Invalid JSON body');
}

$nickname = isset($input['nickname']) ? trim($input['nickname']) : '';
$password = isset($input['password']) ? $input['password'] : '';

if (empty($nickname) || empty($password)) {
    jsonError('Введите никнейм и пароль');
}

$cookieFile = tempnam(sys_get_temp_dir(), 'gm_auth_');

try {
    $result = doFullLogin($cookieFile, $nickname, $password);

    if (!$result['success']) {
        gmCleanup($cookieFile);
        jsonError($result['error'] ?? 'Неверный никнейм или пароль', 401);
    }

    $profile = $result['profile'] ?? ['nickname' => $nickname, 'avatar' => null];
    $gomafiaId = $profile['id'] ?? null;

    // If the login didn't return an id, try a lookup
    if (!$gomafiaId) {
        $lookup = gmLookupPlayer($nickname);
        if ($lookup) {
            $gomafiaId = $lookup['id'] ?? null;
            if (!$profile['avatar'] && $lookup['avatar']) $profile['avatar'] = $lookup['avatar'];
            if (!isset($profile['title']) && isset($lookup['title'])) $profile['title'] = $lookup['title'];
        }
    }

    // Use nickname as fallback id if no numeric id returned
    if (!$gomafiaId) {
        $gomafiaId = $nickname;
    }

    $user = findOrCreateUserByGomafia($database, $gomafiaId, $profile['nickname'] ?? $nickname);

    $token = createSession($database, $user['id'], 'gomafia');

    if (random_int(1, 100) === 1) {
        cleanupExpired($database);
    }

    $userResponse = buildUserResponse($database, [
        'user_id' => $user['id'],
        'auth_method' => 'gomafia',
        'telegram_id' => $user['telegram_id'] ?? null,
        'telegram_username' => $user['telegram_username'] ?? null,
        'telegram_first_name' => $user['telegram_first_name'] ?? null,
        'telegram_last_name' => $user['telegram_last_name'] ?? null,
    ]);
    $userResponse['gomafia_profile'] = $profile;

    gmCleanup($cookieFile);
    jsonResponse([
        'token' => $token,
        'user' => $userResponse,
    ]);
} catch (\Throwable $e) {
    gmCleanup($cookieFile);
    jsonError('Ошибка сервера: ' . $e->getMessage(), 500);
}
