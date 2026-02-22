<?php
// =====================================================
// Admin Users - управление пользователями
// GET    ?token=xxx                     — список всех пользователей
// GET    ?token=xxx&id=TELEGRAM_ID      — детали пользователя
// DELETE ?token=xxx&id=TELEGRAM_ID      — удалить все сессии пользователя
// GET    ?token=xxx&search=query        — поиск пользователей
// =====================================================

require_once __DIR__ . '/admin-config.php';
require_once __DIR__ . '/../../login/auth-helpers.php';
setJsonHeaders();

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
if (empty($token)) jsonError('Token required', 401);

$session = validateSession($database, $token);
if (!$session || !in_array((int)$session['telegram_id'], ADMIN_TELEGRAM_IDS)) {
    jsonError('Access denied', 403);
}

$TABLE_AUTH_SESSIONS = 'auth_sessions';
$TABLE_GAME_SESSIONS = 'game_sessions';

// DELETE — удалить сессии пользователя
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $targetId = isset($_GET['id']) ? trim($_GET['id']) : '';
    if (empty($targetId)) jsonError('User ID required');

    try {
        $database->delete($TABLE_AUTH_SESSIONS, ['telegram_id' => $targetId]);
        jsonResponse(['ok' => true, 'message' => 'Sessions deleted']);
    } catch (\Throwable $e) {
        jsonError('Delete failed: ' . $e->getMessage(), 500);
    }
}

// GET с id — детали конкретного пользователя
if (isset($_GET['id'])) {
    $targetId = trim($_GET['id']);

    try {
        // Получаем все сессии авторизации
        $authSessions = $database->select($TABLE_AUTH_SESSIONS, [
            'id', 'token', 'telegram_id', 'telegram_username',
            'telegram_first_name', 'telegram_last_name',
            'created_at', 'expires_at', 'last_active'
        ], [
            'telegram_id' => $targetId,
            'ORDER' => ['last_active' => 'DESC']
        ]);

        // Получаем игровые сессии
        $gameSessions = $database->get($TABLE_GAME_SESSIONS, ['sessions_json', 'updated_at'], [
            'telegram_id' => $targetId
        ]);

        $games = [];
        if ($gameSessions && $gameSessions['sessions_json']) {
            $decoded = json_decode($gameSessions['sessions_json'], true);
            if (is_array($decoded)) $games = $decoded;
        }

        $user = null;
        if (!empty($authSessions)) {
            $latest = $authSessions[0];
            $user = [
                'telegram_id' => $latest['telegram_id'],
                'username' => $latest['telegram_username'],
                'first_name' => $latest['telegram_first_name'],
                'last_name' => $latest['telegram_last_name'],
                'first_seen' => $authSessions[count($authSessions) - 1]['created_at'],
                'last_active' => $latest['last_active'],
                'sessions_count' => count($authSessions),
                'games_count' => count($games),
            ];
        }

        jsonResponse([
            'user' => $user,
            'authSessions' => $authSessions,
            'games' => $games,
            'gamesUpdatedAt' => $gameSessions ? $gameSessions['updated_at'] : null,
        ]);

    } catch (\Throwable $e) {
        jsonError('Database error: ' . $e->getMessage(), 500);
    }
}

// GET — список пользователей
try {
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $limit = isset($_GET['limit']) ? min(100, max(10, (int)$_GET['limit'])) : 25;
    $offset = ($page - 1) * $limit;
    $sort = isset($_GET['sort']) ? $_GET['sort'] : 'last_active';
    $order = isset($_GET['order']) && strtolower($_GET['order']) === 'asc' ? 'ASC' : 'DESC';

    $allowedSorts = ['last_active', 'created_at', 'telegram_username', 'telegram_id', 'games_count'];
    if (!in_array($sort, $allowedSorts)) $sort = 'last_active';

    // Базовый запрос: уникальные пользователи с агрегацией
    $whereClause = '';
    $params = [];
    if ($search) {
        $whereClause = "WHERE (a.telegram_username LIKE :s1 OR a.telegram_first_name LIKE :s2 OR a.telegram_last_name LIKE :s3 OR CAST(a.telegram_id AS CHAR) LIKE :s4)";
        $params[':s1'] = "%{$search}%";
        $params[':s2'] = "%{$search}%";
        $params[':s3'] = "%{$search}%";
        $params[':s4'] = "%{$search}%";
    }

    // Подсчёт общего количества
    $countSql = "SELECT COUNT(DISTINCT a.telegram_id) FROM `{$TABLE_AUTH_SESSIONS}` a {$whereClause}";
    $countStmt = $database->pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalCount = (int)$countStmt->fetchColumn();

    // Основной запрос — получаем список уникальных пользователей
    $sortColumn = $sort === 'games_count' ? 'games_count' : "a.{$sort}";
    $sql = "SELECT
                a.telegram_id,
                MAX(a.telegram_username) as telegram_username,
                MAX(a.telegram_first_name) as telegram_first_name,
                MAX(a.telegram_last_name) as telegram_last_name,
                MIN(a.created_at) as first_seen,
                MAX(a.last_active) as last_active,
                COUNT(a.id) as sessions_count
            FROM `{$TABLE_AUTH_SESSIONS}` a
            {$whereClause}
            GROUP BY a.telegram_id
            ORDER BY {$sortColumn} {$order}
            LIMIT {$limit} OFFSET {$offset}";

    $stmt = $database->pdo->prepare($sql);
    $stmt->execute($params);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Добавляем данные об играх для каждого пользователя
    foreach ($users as &$user) {
        $gameRow = $database->get($TABLE_GAME_SESSIONS, ['sessions_json'], [
            'telegram_id' => $user['telegram_id']
        ]);
        $user['games_count'] = 0;
        if ($gameRow && $gameRow['sessions_json']) {
            $decoded = json_decode($gameRow['sessions_json'], true);
            if (is_array($decoded)) {
                $user['games_count'] = count($decoded);
            }
        }
    }
    unset($user);

    // Сортировка по games_count на PHP если запрошена
    if ($sort === 'games_count') {
        usort($users, function($a, $b) use ($order) {
            $diff = $a['games_count'] - $b['games_count'];
            return $order === 'ASC' ? $diff : -$diff;
        });
    }

    jsonResponse([
        'users' => $users,
        'total' => $totalCount,
        'page' => $page,
        'limit' => $limit,
        'totalPages' => ceil($totalCount / $limit),
    ]);

} catch (\Throwable $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}

