<?php
// =====================================================
// Active sessions management
// GET:    ?token=xxx              — list active sessions for current user
// DELETE: ?token=xxx&session_id=N — terminate specific session
// =====================================================

require_once __DIR__ . '/auth-helpers.php';
setJsonHeaders();

$token = '';
if ($_SERVER['REQUEST_METHOD'] === 'GET' || $_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $token = isset($_GET['token']) ? trim($_GET['token']) : '';
}
if (empty($token) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $token = isset($input['token']) ? trim($input['token']) : '';
}

if (empty($token)) {
    jsonError('Token is required');
}

$currentSession = validateSession($database, $token);
if (!$currentSession) {
    jsonError('Invalid or expired session', 401);
}

$telegramId = $currentSession['telegram_id'];

// DELETE — terminate a session
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $sessionId = isset($_GET['session_id']) ? intval($_GET['session_id']) : 0;
    if ($sessionId <= 0) {
        jsonError('session_id is required');
    }

    // Only allow deleting own sessions (and not the current one)
    $target = $database->get($TABLE_AUTH_SESSIONS, ['id', 'telegram_id'], [
        'id' => $sessionId,
        'expires_at[>]' => date('Y-m-d H:i:s')
    ]);

    if (!$target || $target['telegram_id'] != $telegramId) {
        jsonError('Session not found', 404);
    }

    if ($target['id'] == $currentSession['id']) {
        jsonError('Нельзя завершить текущую сессию');
    }

    $database->delete($TABLE_AUTH_SESSIONS, ['id' => $sessionId]);

    jsonResponse(['success' => true]);
}

// GET — list all active sessions
$sessions = $database->select($TABLE_AUTH_SESSIONS, [
    'id', 'device_name', 'ip_address', 'created_at', 'last_active'
], [
    'telegram_id' => $telegramId,
    'expires_at[>]' => date('Y-m-d H:i:s'),
    'ORDER' => ['last_active' => 'DESC']
]);

$result = [];
foreach ($sessions as $s) {
    $result[] = [
        'id' => (int)$s['id'],
        'device_name' => $s['device_name'] ?: 'Неизвестное устройство',
        'ip_address' => $s['ip_address'],
        'created_at' => $s['created_at'],
        'last_active' => $s['last_active'],
        'is_current' => ((int)$s['id'] === (int)$currentSession['id']),
    ];
}

jsonResponse(['sessions' => $result]);
