<?php
// =====================================================
// Admin Game Sessions - управление игровыми сессиями
// GET    ?token=xxx                       — все пользователи с играми
// GET    ?token=xxx&userId=TG_ID          — игры конкретного пользователя
// POST   ?token=xxx  body: {userId, sessionId, data}  — обновить игровую сессию
// DELETE ?token=xxx&userId=TG_ID&sessionId=xxx — удалить конкретную игру
// DELETE ?token=xxx&userId=TG_ID          — удалить все игры пользователя
// =====================================================

require_once __DIR__ . '/admin-config.php';
require_once __DIR__ . '/../../login/auth-helpers.php';
setJsonHeaders();

// Читаем тело запроса один раз
$rawBody = file_get_contents('php://input');
$parsedBody = json_decode($rawBody, true);

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
if (empty($token) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($parsedBody && isset($parsedBody['token'])) $token = trim($parsedBody['token']);
}
if (empty($token) && $_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $token = isset($_GET['token']) ? trim($_GET['token']) : '';
}
if (empty($token)) jsonError('Token required', 401);

$session = validateSession($database, $token);
if (!$session || !in_array((int)$session['telegram_id'], ADMIN_TELEGRAM_IDS)) {
    jsonError('Access denied', 403);
}

$TABLE_GAME_SESSIONS = 'game_sessions';

// Авто-миграция
try {
    $database->pdo->exec("
        CREATE TABLE IF NOT EXISTS `{$TABLE_GAME_SESSIONS}` (
            `telegram_id` bigint(20) NOT NULL,
            `sessions_json` mediumtext NOT NULL,
            `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`telegram_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
} catch (\Throwable $e) {}

// ===== DELETE =====
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $userId = isset($_GET['userId']) ? trim($_GET['userId']) : '';
    $sessionId = isset($_GET['sessionId']) ? trim($_GET['sessionId']) : '';

    if (empty($userId)) jsonError('userId required');

    if (!empty($sessionId)) {
        // Удалить конкретную игру
        $row = $database->get($TABLE_GAME_SESSIONS, ['sessions_json'], ['telegram_id' => $userId]);
        if (!$row) jsonError('User has no games', 404);

        $sessions = json_decode($row['sessions_json'], true);
        if (!is_array($sessions)) $sessions = [];

        $sessions = array_values(array_filter($sessions, function($s) use ($sessionId) {
            return !(isset($s['sessionId']) && $s['sessionId'] === $sessionId);
        }));

        $database->update($TABLE_GAME_SESSIONS, [
            'sessions_json' => json_encode($sessions, JSON_UNESCAPED_UNICODE),
            'updated_at' => date('Y-m-d H:i:s')
        ], ['telegram_id' => $userId]);

        jsonResponse(['ok' => true, 'remaining' => count($sessions)]);
    } else {
        // Удалить все игры пользователя
        $database->delete($TABLE_GAME_SESSIONS, ['telegram_id' => $userId]);
        jsonResponse(['ok' => true, 'message' => 'All games deleted']);
    }
}

// ===== POST — обновить игровую сессию =====
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = $parsedBody;
    if (!$input) jsonError('Invalid JSON body');

    $userId = isset($input['userId']) ? trim($input['userId']) : '';
    $sessionId = isset($input['sessionId']) ? trim($input['sessionId']) : '';
    $data = isset($input['data']) ? $input['data'] : null;

    if (empty($userId) || empty($sessionId) || !is_array($data)) {
        jsonError('userId, sessionId, and data are required');
    }

    $row = $database->get($TABLE_GAME_SESSIONS, ['sessions_json'], ['telegram_id' => $userId]);
    if (!$row) jsonError('User has no games', 404);

    $sessions = json_decode($row['sessions_json'], true);
    if (!is_array($sessions)) $sessions = [];

    $found = false;
    foreach ($sessions as &$s) {
        if (isset($s['sessionId']) && $s['sessionId'] === $sessionId) {
            // Мержим данные
            foreach ($data as $k => $v) {
                $s[$k] = $v;
            }
            $s['adminModified'] = true;
            $s['adminModifiedAt'] = date('c');
            $found = true;
            break;
        }
    }
    unset($s);

    if (!$found) jsonError('Session not found', 404);

    $database->update($TABLE_GAME_SESSIONS, [
        'sessions_json' => json_encode($sessions, JSON_UNESCAPED_UNICODE),
        'updated_at' => date('Y-m-d H:i:s')
    ], ['telegram_id' => $userId]);

    jsonResponse(['ok' => true]);
}

// ===== GET =====
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Игры конкретного пользователя
    if (isset($_GET['userId'])) {
        $userId = trim($_GET['userId']);
        $row = $database->get($TABLE_GAME_SESSIONS, ['sessions_json', 'updated_at'], [
            'telegram_id' => $userId
        ]);

        $games = [];
        if ($row && $row['sessions_json']) {
            $decoded = json_decode($row['sessions_json'], true);
            if (is_array($decoded)) $games = $decoded;
        }

        jsonResponse([
            'userId' => $userId,
            'games' => $games,
            'updatedAt' => $row ? $row['updated_at'] : null,
            'total' => count($games)
        ]);
    }

    // Список всех пользователей с играми
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $limit = isset($_GET['limit']) ? min(100, max(10, (int)$_GET['limit'])) : 25;
    $offset = ($page - 1) * $limit;

    $totalCount = (int)$database->pdo->query("SELECT COUNT(*) FROM `{$TABLE_GAME_SESSIONS}`")->fetchColumn();

    $stmt = $database->pdo->prepare(
        "SELECT gs.telegram_id, gs.sessions_json, gs.updated_at,
                a.telegram_username, a.telegram_first_name, a.telegram_last_name
         FROM `{$TABLE_GAME_SESSIONS}` gs
         LEFT JOIN (
            SELECT telegram_id, telegram_username, telegram_first_name, telegram_last_name
            FROM `auth_sessions`
            WHERE id IN (SELECT MAX(id) FROM `auth_sessions` GROUP BY telegram_id)
         ) a ON gs.telegram_id = a.telegram_id
         ORDER BY gs.updated_at DESC
         LIMIT :lim OFFSET :off"
    );
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $result = [];
    foreach ($rows as $row) {
        $games = [];
        if ($row['sessions_json']) {
            $decoded = json_decode($row['sessions_json'], true);
            if (is_array($decoded)) $games = $decoded;
        }
        $result[] = [
            'telegram_id' => $row['telegram_id'],
            'username' => $row['telegram_username'],
            'first_name' => $row['telegram_first_name'],
            'last_name' => $row['telegram_last_name'],
            'games_count' => count($games),
            'updated_at' => $row['updated_at'],
        ];
    }

    jsonResponse([
        'items' => $result,
        'total' => $totalCount,
        'page' => $page,
        'limit' => $limit,
        'totalPages' => ceil($totalCount / $limit),
    ]);
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);

