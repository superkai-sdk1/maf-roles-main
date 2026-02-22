<?php
// =====================================================
// Admin Stats - статистика для дашборда
// GET ?token=xxx
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

try {
    // Общее количество пользователей (уникальных telegram_id в auth_sessions)
    $totalUsers = $database->pdo->query(
        "SELECT COUNT(DISTINCT telegram_id) FROM `{$TABLE_AUTH_SESSIONS}`"
    )->fetchColumn();

    // Активные пользователи за последние 24 часа
    $activeToday = $database->pdo->query(
        "SELECT COUNT(DISTINCT telegram_id) FROM `{$TABLE_AUTH_SESSIONS}` WHERE last_active >= DATE_SUB(NOW(), INTERVAL 24 HOUR)"
    )->fetchColumn();

    // Активные за последние 7 дней
    $activeWeek = $database->pdo->query(
        "SELECT COUNT(DISTINCT telegram_id) FROM `{$TABLE_AUTH_SESSIONS}` WHERE last_active >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
    )->fetchColumn();

    // Активные за последние 30 дней
    $activeMonth = $database->pdo->query(
        "SELECT COUNT(DISTINCT telegram_id) FROM `{$TABLE_AUTH_SESSIONS}` WHERE last_active >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    )->fetchColumn();

    // Всего игровых сессий (записей в game_sessions)
    $totalGameUsers = $database->pdo->query(
        "SELECT COUNT(*) FROM `{$TABLE_GAME_SESSIONS}`"
    )->fetchColumn();

    // Подсчёт общего количества игр
    $totalGames = 0;
    $stmt = $database->pdo->query("SELECT sessions_json FROM `{$TABLE_GAME_SESSIONS}`");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $sessions = json_decode($row['sessions_json'], true);
        if (is_array($sessions)) {
            $totalGames += count($sessions);
        }
    }

    // Количество сохранённых итогов (файлы в summaries/)
    $summariesDir = __DIR__ . '/../../api/summaries';
    $totalSummaries = 0;
    if (is_dir($summariesDir)) {
        $totalSummaries = count(glob($summariesDir . '/*.json'));
    }

    // Количество игроков в таблице players
    $totalPlayers = $database->pdo->query(
        "SELECT COUNT(*) FROM `players`"
    )->fetchColumn();

    // Регистрации по дням (последние 30 дней)
    $registrationsByDay = [];
    $stmt = $database->pdo->query(
        "SELECT t.first_day, COUNT(*) as cnt FROM (
            SELECT telegram_id, DATE(MIN(created_at)) as first_day
            FROM `{$TABLE_AUTH_SESSIONS}`
            GROUP BY telegram_id
        ) t
        WHERE t.first_day >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY t.first_day
        ORDER BY t.first_day"
    );
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $registrationsByDay[] = [
            'date' => $row['first_day'],
            'count' => (int)$row['cnt']
        ];
    }

    // Активность по дням (последние 30 дней)
    $activityByDay = [];
    $stmt = $database->pdo->query(
        "SELECT DATE(last_active) as act_date, COUNT(DISTINCT telegram_id) as cnt
         FROM `{$TABLE_AUTH_SESSIONS}`
         WHERE last_active >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY DATE(last_active)
         ORDER BY act_date"
    );
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $activityByDay[] = [
            'date' => $row['act_date'],
            'count' => (int)$row['cnt']
        ];
    }

    // ===== Последние зарегистрированные пользователи (5) =====
    $recentUsers = [];
    $stmt = $database->pdo->query(
        "SELECT telegram_id, telegram_username, telegram_first_name, telegram_last_name,
                MIN(created_at) as first_seen, MAX(last_active) as last_active
         FROM `{$TABLE_AUTH_SESSIONS}`
         GROUP BY telegram_id
         ORDER BY first_seen DESC
         LIMIT 5"
    );
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $recentUsers[] = $row;
    }

    // ===== Последние активные пользователи (5) =====
    $lastActiveUsers = [];
    $stmt = $database->pdo->query(
        "SELECT telegram_id, telegram_username, telegram_first_name, telegram_last_name,
                MAX(last_active) as last_active
         FROM `{$TABLE_AUTH_SESSIONS}`
         GROUP BY telegram_id
         ORDER BY last_active DESC
         LIMIT 5"
    );
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $lastActiveUsers[] = $row;
    }

    // ===== Топ пользователей по количеству игр (5) =====
    $topGameUsers = [];
    $stmt = $database->pdo->query(
        "SELECT gs.telegram_id, gs.sessions_json,
                a.telegram_username, a.telegram_first_name, a.telegram_last_name
         FROM `{$TABLE_GAME_SESSIONS}` gs
         LEFT JOIN (
            SELECT telegram_id, telegram_username, telegram_first_name, telegram_last_name
            FROM `{$TABLE_AUTH_SESSIONS}`
            WHERE id IN (SELECT MAX(id) FROM `{$TABLE_AUTH_SESSIONS}` GROUP BY telegram_id)
         ) a ON gs.telegram_id = a.telegram_id"
    );
    $allGameUsers = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $sessions = json_decode($row['sessions_json'], true);
        $cnt = is_array($sessions) ? count($sessions) : 0;
        $allGameUsers[] = [
            'telegram_id' => $row['telegram_id'],
            'username' => $row['telegram_username'],
            'first_name' => $row['telegram_first_name'],
            'last_name' => $row['telegram_last_name'],
            'games_count' => $cnt,
        ];
    }
    usort($allGameUsers, function($a, $b) { return $b['games_count'] - $a['games_count']; });
    $topGameUsers = array_slice($allGameUsers, 0, 5);

    // ===== Распределение по режимам игр =====
    $modeBreakdown = ['gomafia' => 0, 'funky' => 0, 'manual' => 0, 'tournament' => 0, 'city' => 0];
    $winBreakdown = ['city' => 0, 'mafia' => 0, 'draw' => 0, 'in_progress' => 0];
    $recentGames = [];
    $stmt2 = $database->pdo->query("SELECT gs.telegram_id, gs.sessions_json, gs.updated_at,
            a.telegram_username, a.telegram_first_name
         FROM `{$TABLE_GAME_SESSIONS}` gs
         LEFT JOIN (
            SELECT telegram_id, telegram_username, telegram_first_name
            FROM `{$TABLE_AUTH_SESSIONS}`
            WHERE id IN (SELECT MAX(id) FROM `{$TABLE_AUTH_SESSIONS}` GROUP BY telegram_id)
         ) a ON gs.telegram_id = a.telegram_id");
    while ($row = $stmt2->fetch(PDO::FETCH_ASSOC)) {
        $sessions = json_decode($row['sessions_json'], true);
        if (!is_array($sessions)) continue;
        foreach ($sessions as $s) {
            // Режимы
            if (!empty($s['cityMode'])) $modeBreakdown['city']++;
            elseif (!empty($s['funkyMode'])) $modeBreakdown['funky']++;
            elseif (!empty($s['manualMode'])) $modeBreakdown['manual']++;
            elseif (!empty($s['tournamentId'])) $modeBreakdown['tournament']++;
            else $modeBreakdown['gomafia']++;
            // Победители
            if (!empty($s['winnerTeam'])) {
                $w = strtolower($s['winnerTeam']);
                if ($w === 'civilians' || $w === 'city' || $w === 'мирные') $winBreakdown['city']++;
                elseif ($w === 'mafia' || $w === 'мафия') $winBreakdown['mafia']++;
                else $winBreakdown['draw']++;
            } else {
                $winBreakdown['in_progress']++;
            }
        }
        // Последние игры (берём последнюю сессию каждого пользователя)
        $lastSession = end($sessions);
        if ($lastSession) {
            $recentGames[] = [
                'telegram_id' => $row['telegram_id'],
                'username' => $row['telegram_username'],
                'first_name' => $row['telegram_first_name'],
                'updated_at' => $row['updated_at'],
                'winnerTeam' => isset($lastSession['winnerTeam']) ? $lastSession['winnerTeam'] : null,
                'funkyMode' => !empty($lastSession['funkyMode']),
                'cityMode' => !empty($lastSession['cityMode']),
                'manualMode' => !empty($lastSession['manualMode']),
                'tournamentId' => isset($lastSession['tournamentId']) ? $lastSession['tournamentId'] : null,
                'gameNumber' => isset($lastSession['gameNumber']) ? $lastSession['gameNumber'] : null,
                'playersCount' => isset($lastSession['peoples']) && is_array($lastSession['peoples']) ? count($lastSession['peoples']) : 0,
            ];
        }
    }
    // Сортируем последние игры по дате
    usort($recentGames, function($a, $b) { return strcmp($b['updated_at'], $a['updated_at']); });
    $recentGames = array_slice($recentGames, 0, 8);

    // ===== Активные комнаты (room_*.json файлы) =====
    $activeRooms = [];
    $roomFiles = glob(__DIR__ . '/../../api/room_*.json');
    foreach ($roomFiles as $rf) {
        $roomData = json_decode(file_get_contents($rf), true);
        if (!$roomData) continue;
        $roomId = str_replace(['room_', '.json'], '', basename($rf));
        $playersCount = 0;
        if (isset($roomData['peoples']) && is_array($roomData['peoples'])) {
            $playersCount = count(array_filter($roomData['peoples'], function($p) {
                return !empty($p['login']);
            }));
        }
        $activeRooms[] = [
            'roomId' => $roomId,
            'playersCount' => $playersCount,
            'hasState' => !empty($roomData['panelState']),
        ];
    }

    // ===== Retention: вернулись ли пользователи =====
    // Пользователи, которые были активны более 1 дня (вернулись)
    $retentionCount = (int)$database->pdo->query(
        "SELECT COUNT(*) FROM (
            SELECT telegram_id
            FROM `{$TABLE_AUTH_SESSIONS}`
            GROUP BY telegram_id
            HAVING DATEDIFF(MAX(last_active), MIN(created_at)) >= 1
        ) t"
    )->fetchColumn();
    $retentionRate = $totalUsers > 0 ? round(($retentionCount / $totalUsers) * 100, 1) : 0;

    // ===== Средние игры на пользователя =====
    $avgGamesPerUser = $totalGameUsers > 0 ? round($totalGames / $totalGameUsers, 1) : 0;

    jsonResponse([
        'totalUsers' => (int)$totalUsers,
        'activeToday' => (int)$activeToday,
        'activeWeek' => (int)$activeWeek,
        'activeMonth' => (int)$activeMonth,
        'totalGameUsers' => (int)$totalGameUsers,
        'totalGames' => (int)$totalGames,
        'totalSummaries' => (int)$totalSummaries,
        'totalPlayers' => (int)$totalPlayers,
        'registrationsByDay' => $registrationsByDay,
        'activityByDay' => $activityByDay,
        'recentUsers' => $recentUsers,
        'lastActiveUsers' => $lastActiveUsers,
        'topGameUsers' => $topGameUsers,
        'modeBreakdown' => $modeBreakdown,
        'winBreakdown' => $winBreakdown,
        'recentGames' => $recentGames,
        'activeRooms' => $activeRooms,
        'retentionRate' => $retentionRate,
        'retentionCount' => $retentionCount,
        'avgGamesPerUser' => $avgGamesPerUser,
    ]);

} catch (\Throwable $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}

