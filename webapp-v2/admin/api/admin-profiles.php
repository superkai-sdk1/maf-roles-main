<?php
// =====================================================
// Admin Profiles — CRUD for user_profiles table
// GET    ?token=xxx                     — list all profiles
// GET    ?token=xxx&id=TELEGRAM_ID      — single profile + linked user data
// POST   {token, id, data:{...}}        — update profile fields
// DELETE ?token=xxx&id=TELEGRAM_ID      — delete profile
// =====================================================

require_once __DIR__ . '/admin-config.php';
require_once __DIR__ . '/../../login/auth-helpers.php';
setJsonHeaders();

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
if (empty($token)) {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input && isset($input['token'])) $token = trim($input['token']);
}
if (empty($token)) jsonError('Token required', 401);

$session = validateSession($database, $token);
if (!$session || !in_array((int)$session['telegram_id'], ADMIN_TELEGRAM_IDS)) {
    jsonError('Access denied', 403);
}

$TABLE_PROFILES = 'user_profiles';
$TABLE_USERS = 'users';
$TABLE_AUTH_SESSIONS = 'auth_sessions';

// DELETE
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $targetId = isset($_GET['id']) ? trim($_GET['id']) : '';
    if (empty($targetId)) jsonError('Profile ID required');

    try {
        $database->delete($TABLE_PROFILES, ['telegram_id' => $targetId]);
        jsonResponse(['ok' => true, 'message' => 'Profile deleted']);
    } catch (\Throwable $e) {
        jsonError('Delete failed: ' . $e->getMessage(), 500);
    }
}

// POST — update profile
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) jsonError('Invalid JSON');

    $targetId = isset($input['id']) ? trim($input['id']) : '';
    $data = isset($input['data']) ? $input['data'] : [];
    if (empty($targetId)) jsonError('Profile ID required');
    if (empty($data)) jsonError('No data to update');

    $allowedFields = [
        'display_name', 'avatar_url', 'gomafia_nickname',
        'gomafia_avatar', 'gomafia_id', 'gomafia_title',
        'gomafia_connected_at'
    ];

    $updateData = [];
    foreach ($data as $key => $value) {
        if (in_array($key, $allowedFields)) {
            $updateData[$key] = $value;
        }
    }

    if (empty($updateData)) jsonError('No valid fields to update');

    try {
        $existing = $database->get($TABLE_PROFILES, ['telegram_id'], ['telegram_id' => $targetId]);
        if ($existing) {
            $database->update($TABLE_PROFILES, $updateData, ['telegram_id' => $targetId]);
        } else {
            $updateData['telegram_id'] = $targetId;
            $database->insert($TABLE_PROFILES, $updateData);
        }
        jsonResponse(['ok' => true, 'message' => 'Profile updated']);
    } catch (\Throwable $e) {
        jsonError('Update failed: ' . $e->getMessage(), 500);
    }
}

// GET single profile
if (isset($_GET['id'])) {
    $targetId = trim($_GET['id']);
    try {
        $profile = $database->get($TABLE_PROFILES, '*', ['telegram_id' => $targetId]);

        $authData = $database->get($TABLE_AUTH_SESSIONS, [
            'telegram_username', 'telegram_first_name', 'telegram_last_name'
        ], [
            'telegram_id' => $targetId,
            'ORDER' => ['last_active' => 'DESC']
        ]);

        $userData = $database->get($TABLE_USERS, '*', ['telegram_id' => $targetId]);

        jsonResponse([
            'profile' => $profile,
            'auth' => $authData,
            'user' => $userData,
        ]);
    } catch (\Throwable $e) {
        jsonError('Database error: ' . $e->getMessage(), 500);
    }
}

// GET list
try {
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $limit = isset($_GET['limit']) ? min(100, max(10, (int)$_GET['limit'])) : 25;
    $offset = ($page - 1) * $limit;

    if ($search) {
        $where = [
            'OR' => [
                'display_name[~]' => "%{$search}%",
                'gomafia_nickname[~]' => "%{$search}%",
                'CAST(telegram_id AS CHAR)[~]' => "%{$search}%",
            ],
            'ORDER' => ['updated_at' => 'DESC'],
            'LIMIT' => [$offset, $limit],
        ];
        $countWhere = [
            'OR' => [
                'display_name[~]' => "%{$search}%",
                'gomafia_nickname[~]' => "%{$search}%",
            ],
        ];
    } else {
        $where = [
            'ORDER' => ['updated_at' => 'DESC'],
            'LIMIT' => [$offset, $limit],
        ];
        $countWhere = [];
    }

    $profiles = $database->select($TABLE_PROFILES, '*', $where);
    $total = $database->count($TABLE_PROFILES, $countWhere ?: null);

    foreach ($profiles as &$p) {
        $auth = $database->get($TABLE_AUTH_SESSIONS, [
            'telegram_username', 'telegram_first_name', 'telegram_last_name'
        ], [
            'telegram_id' => $p['telegram_id'],
            'ORDER' => ['last_active' => 'DESC']
        ]);
        $p['telegram_username'] = $auth ? $auth['telegram_username'] : null;
        $p['telegram_first_name'] = $auth ? $auth['telegram_first_name'] : null;
        $p['telegram_last_name'] = $auth ? $auth['telegram_last_name'] : null;
    }
    unset($p);

    jsonResponse([
        'profiles' => $profiles,
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'totalPages' => ceil($total / $limit),
    ]);

} catch (\Throwable $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}
