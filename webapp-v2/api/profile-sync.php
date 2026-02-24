<?php
// =====================================================
// API для синхронизации профиля пользователя между устройствами
// Привязка к telegram_id через auth token
// GET:    ?token=xxx — получить профиль
// POST:   {token, profile: {...}} — сохранить/обновить профиль
// DELETE: ?token=xxx&field=gomafia — очистить GoMafia-интеграцию
// =====================================================

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../login/auth-helpers.php';

$TABLE_USER_PROFILES = 'user_profiles';

try {
    $database->pdo->exec("
        CREATE TABLE IF NOT EXISTS `{$TABLE_USER_PROFILES}` (
            `telegram_id` bigint(20) NOT NULL,
            `display_name` varchar(255) DEFAULT NULL,
            `avatar_url` text DEFAULT NULL,
            `gomafia_nickname` varchar(255) DEFAULT NULL,
            `gomafia_avatar` text DEFAULT NULL,
            `gomafia_id` varchar(100) DEFAULT NULL,
            `gomafia_title` varchar(255) DEFAULT NULL,
            `gomafia_connected_at` datetime DEFAULT NULL,
            `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`telegram_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
} catch (\Throwable $e) {
    error_log('User profiles migration error: ' . $e->getMessage());
}

// === Helper: authenticate by token ===
function authenticateRequest($database, $method) {
    if ($method === 'GET' || $method === 'DELETE') {
        $token = isset($_GET['token']) ? trim($_GET['token']) : '';
    } else {
        $rawInput = file_get_contents('php://input');
        $input = json_decode($rawInput, true);
        $token = isset($input['token']) ? trim($input['token']) : '';
    }

    if (empty($token)) {
        http_response_code(400);
        echo json_encode(['error' => 'token required'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $session = validateSession($database, $token);
    if (!$session) {
        http_response_code(401);
        echo json_encode(['error' => 'invalid token'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    return [
        'telegram_id' => $session['telegram_id'],
        'input' => isset($input) ? $input : null
    ];
}

// === GET: получить профиль ===
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $auth = authenticateRequest($database, 'GET');
    $telegramId = $auth['telegram_id'];

    $row = $database->get($TABLE_USER_PROFILES, [
        'display_name', 'avatar_url',
        'gomafia_nickname', 'gomafia_avatar', 'gomafia_id', 'gomafia_title', 'gomafia_connected_at',
        'updated_at'
    ], [
        'telegram_id' => $telegramId
    ]);

    $profile = [
        'display_name' => null,
        'avatar_url' => null,
        'gomafia' => null,
        'updated_at' => null
    ];

    if ($row) {
        $profile['display_name'] = $row['display_name'];
        $profile['avatar_url'] = $row['avatar_url'];
        $profile['updated_at'] = $row['updated_at'];

        if ($row['gomafia_nickname']) {
            $profile['gomafia'] = [
                'nickname' => $row['gomafia_nickname'],
                'avatar' => $row['gomafia_avatar'],
                'id' => $row['gomafia_id'],
                'title' => $row['gomafia_title'],
                'connectedAt' => $row['gomafia_connected_at']
            ];
        }
    }

    echo json_encode($profile, JSON_UNESCAPED_UNICODE);
    exit;
}

// === POST: сохранить/обновить профиль ===
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $auth = authenticateRequest($database, 'POST');
    $telegramId = $auth['telegram_id'];
    $input = $auth['input'];

    $profileData = isset($input['profile']) ? $input['profile'] : [];
    if (!is_array($profileData)) {
        http_response_code(400);
        echo json_encode(['error' => 'profile must be object'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $updateFields = [];

    if (array_key_exists('display_name', $profileData)) {
        $updateFields['display_name'] = $profileData['display_name'];
    }
    if (array_key_exists('avatar_url', $profileData)) {
        $updateFields['avatar_url'] = $profileData['avatar_url'];
    }

    if (array_key_exists('gomafia', $profileData)) {
        $gm = $profileData['gomafia'];
        if ($gm && is_array($gm)) {
            $updateFields['gomafia_nickname'] = isset($gm['nickname']) ? $gm['nickname'] : null;
            $updateFields['gomafia_avatar'] = isset($gm['avatar']) ? $gm['avatar'] : null;
            $updateFields['gomafia_id'] = isset($gm['id']) ? (string)$gm['id'] : null;
            $updateFields['gomafia_title'] = isset($gm['title']) ? $gm['title'] : null;
            $updateFields['gomafia_connected_at'] = isset($gm['connectedAt'])
                ? date('Y-m-d H:i:s', (int)($gm['connectedAt'] / 1000))
                : date('Y-m-d H:i:s');
        } else {
            $updateFields['gomafia_nickname'] = null;
            $updateFields['gomafia_avatar'] = null;
            $updateFields['gomafia_id'] = null;
            $updateFields['gomafia_title'] = null;
            $updateFields['gomafia_connected_at'] = null;
        }
    }

    if (empty($updateFields)) {
        http_response_code(400);
        echo json_encode(['error' => 'no profile fields to update'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    try {
        $existing = $database->get($TABLE_USER_PROFILES, 'telegram_id', [
            'telegram_id' => $telegramId
        ]);

        if ($existing) {
            $database->update($TABLE_USER_PROFILES, $updateFields, [
                'telegram_id' => $telegramId
            ]);
        } else {
            $updateFields['telegram_id'] = $telegramId;
            $database->insert($TABLE_USER_PROFILES, $updateFields);
        }

        echo json_encode(['result' => 'ok'], JSON_UNESCAPED_UNICODE);
    } catch (\Throwable $e) {
        error_log('Profile save error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// === DELETE: очистить GoMafia-интеграцию ===
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $auth = authenticateRequest($database, 'DELETE');
    $telegramId = $auth['telegram_id'];

    $field = isset($_GET['field']) ? $_GET['field'] : '';

    if ($field === 'gomafia') {
        try {
            $database->update($TABLE_USER_PROFILES, [
                'gomafia_nickname' => null,
                'gomafia_avatar' => null,
                'gomafia_id' => null,
                'gomafia_title' => null,
                'gomafia_connected_at' => null
            ], [
                'telegram_id' => $telegramId
            ]);

            echo json_encode(['result' => 'ok'], JSON_UNESCAPED_UNICODE);
        } catch (\Throwable $e) {
            error_log('Profile delete error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'field parameter required (e.g. field=gomafia)'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
