<?php
// =====================================================
// API для синхронизации игровых сессий между устройствами
// Привязка к telegram_id через auth token
// GET:  ?token=xxx — получить сессии пользователя
// POST: {token, sessions, deleted} — сохранить сессии пользователя
// =====================================================

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../login/auth-helpers.php';

$TABLE_GAME_SESSIONS = 'game_sessions';
$TOMBSTONE_TTL_DAYS = 30;

$TABLE_PLAYER_SESSIONS = 'player_sessions';

// Автомиграция
try {
    $database->pdo->exec("
        CREATE TABLE IF NOT EXISTS `{$TABLE_GAME_SESSIONS}` (
            `telegram_id` bigint(20) NOT NULL,
            `sessions_json` mediumtext NOT NULL,
            `deleted_json` mediumtext DEFAULT NULL,
            `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`telegram_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $cols = $database->pdo->query("SHOW COLUMNS FROM `{$TABLE_GAME_SESSIONS}` LIKE 'deleted_json'")->fetchAll();
    if (empty($cols)) {
        $database->pdo->exec("ALTER TABLE `{$TABLE_GAME_SESSIONS}` ADD COLUMN `deleted_json` mediumtext DEFAULT NULL AFTER `sessions_json`");
    }
    $database->pdo->exec("
        CREATE TABLE IF NOT EXISTS `{$TABLE_PLAYER_SESSIONS}` (
            `player_login` varchar(100) NOT NULL,
            `session_id` varchar(100) NOT NULL,
            `judge_telegram_id` bigint(20) NOT NULL,
            `tournament_name` varchar(255) DEFAULT NULL,
            `game_mode` varchar(50) DEFAULT NULL,
            `winner_team` varchar(50) DEFAULT NULL,
            `game_finished` tinyint(1) DEFAULT 0,
            `player_role` varchar(50) DEFAULT NULL,
            `player_score` decimal(5,1) DEFAULT NULL,
            `player_action` varchar(50) DEFAULT NULL,
            `player_num` int DEFAULT NULL,
            `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`session_id`, `player_login`),
            INDEX `idx_player` (`player_login`),
            INDEX `idx_updated` (`player_login`, `updated_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
} catch (\Throwable $e) {
    error_log('Game sessions migration error: ' . $e->getMessage());
}

$ROLE_LABELS_SYNC = [
    'don' => 'Дон', 'black' => 'Мафия', 'sheriff' => 'Шериф', 'peace' => 'Мирный',
    'detective' => 'Детектив', 'doctor' => 'Доктор', 'kamikaze' => 'Камикадзе',
    'immortal' => 'Бессмертный', 'beauty' => 'Красотка', 'maniac' => 'Маньяк',
    'oyabun' => 'Оябун', 'yakuza' => 'Якудза', 'mafia' => 'Мафия',
];
$BLACK_ROLES_SYNC = ['don','black','oyabun','yakuza','maniac','ripper','swindler','thief','snitch','fangirl','lawyer','mafia'];

function computePlayerScore($roleKey, $roles, $playerScores, $winnerTeam) {
    global $BLACK_ROLES_SYNC;
    if (!$winnerTeam) return null;
    $s = 0;
    $role = isset($roles[$roleKey]) ? $roles[$roleKey] : '';
    $isBlack = in_array($role, $BLACK_ROLES_SYNC);
    if ($winnerTeam === 'civilians' && !$isBlack) $s += 1;
    if ($winnerTeam === 'mafia' && $isBlack) $s += 1;
    if (isset($playerScores[$roleKey]) && is_array($playerScores[$roleKey])) {
        $ps = $playerScores[$roleKey];
        $s += floatval($ps['bonus'] ?? 0);
        $s -= floatval($ps['penalty'] ?? 0);
    }
    return round($s * 100) / 100;
}

function indexPlayerSessions($database, $tableName, $sessions, $telegramId) {
    global $ROLE_LABELS_SYNC;
    if (empty($sessions)) return;
    $stmt = $database->pdo->prepare("
        INSERT INTO `{$tableName}` (`player_login`, `session_id`, `judge_telegram_id`, `tournament_name`, `game_mode`, `winner_team`, `game_finished`, `player_role`, `player_score`, `player_action`, `player_num`, `updated_at`)
        VALUES (:login, :sid, :jid, :tname, :gmode, :wteam, :gfin, :prole, :pscore, :paction, :pnum, :upd)
        ON DUPLICATE KEY UPDATE
            `judge_telegram_id` = VALUES(`judge_telegram_id`),
            `tournament_name` = VALUES(`tournament_name`),
            `game_mode` = VALUES(`game_mode`),
            `winner_team` = VALUES(`winner_team`),
            `game_finished` = VALUES(`game_finished`),
            `player_role` = VALUES(`player_role`),
            `player_score` = VALUES(`player_score`),
            `player_action` = VALUES(`player_action`),
            `player_num` = VALUES(`player_num`),
            `updated_at` = VALUES(`updated_at`)
    ");
    $now = date('Y-m-d H:i:s');
    foreach ($sessions as $s) {
        if (empty($s['sessionId'])) continue;
        $players = isset($s['players']) && is_array($s['players']) ? $s['players'] : [];
        $roles = isset($s['roles']) && is_array($s['roles']) ? $s['roles'] : [];
        $actions = isset($s['playersActions']) && is_array($s['playersActions']) ? $s['playersActions'] : [];
        $playerScores = isset($s['playerScores']) && is_array($s['playerScores']) ? $s['playerScores'] : [];
        $winnerTeam = isset($s['winnerTeam']) ? $s['winnerTeam'] : null;

        foreach ($players as $p) {
            $login = isset($p['login']) ? trim($p['login']) : '';
            if ($login === '') continue;
            $rk = isset($p['roleKey']) ? $p['roleKey'] : '';
            $role = isset($roles[$rk]) ? $roles[$rk] : '';
            $roleLabel = isset($ROLE_LABELS_SYNC[$role]) ? $ROLE_LABELS_SYNC[$role] : ($role ?: null);
            $score = computePlayerScore($rk, $roles, $playerScores, $winnerTeam);
            $action = isset($actions[$rk]) ? $actions[$rk] : null;
            try {
                $stmt->execute([
                    ':login' => $login,
                    ':sid' => $s['sessionId'],
                    ':jid' => $telegramId,
                    ':tname' => isset($s['tournamentName']) ? $s['tournamentName'] : null,
                    ':gmode' => isset($s['gameMode']) ? $s['gameMode'] : null,
                    ':wteam' => $winnerTeam,
                    ':gfin' => (!empty($s['gameFinished']) || !empty($winnerTeam)) ? 1 : 0,
                    ':prole' => $roleLabel,
                    ':pscore' => $score,
                    ':paction' => $action,
                    ':pnum' => isset($p['num']) ? (int)$p['num'] : null,
                    ':upd' => $now,
                ]);
            } catch (\Throwable $e) {
                error_log('Player session index error: ' . $e->getMessage());
            }
        }
    }
}

function filterExpiredTombstones($tombstones, $ttlDays) {
    $cutoff = (int)(microtime(true) * 1000) - ($ttlDays * 86400 * 1000);
    $result = [];
    $seen = [];
    foreach ($tombstones as $t) {
        if (!isset($t['id'])) continue;
        if (isset($t['ts']) && (int)$t['ts'] < $cutoff) continue;
        if (isset($seen[$t['id']])) continue;
        $seen[$t['id']] = true;
        $result[] = $t;
    }
    return $result;
}

function tombstoneIdSet($tombstones) {
    $set = [];
    foreach ($tombstones as $t) {
        if (isset($t['id'])) $set[$t['id']] = true;
    }
    return $set;
}

// === GET: получить сессии ===
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $token = isset($_GET['token']) ? trim($_GET['token']) : '';
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

    $telegramId = $session['telegram_id'];

    $row = $database->get($TABLE_GAME_SESSIONS, ['sessions_json', 'deleted_json', 'updated_at'], [
        'telegram_id' => $telegramId
    ]);

    $sessions = [];
    $deleted = [];

    if ($row) {
        if ($row['sessions_json']) {
            $decoded = json_decode($row['sessions_json'], true);
            if (is_array($decoded)) $sessions = $decoded;
        }
        if (isset($row['deleted_json']) && $row['deleted_json']) {
            $decoded = json_decode($row['deleted_json'], true);
            if (is_array($decoded)) $deleted = filterExpiredTombstones($decoded, $TOMBSTONE_TTL_DAYS);
        }
    }

    // Filter sessions by tombstones before returning
    if (!empty($deleted)) {
        $deletedSet = tombstoneIdSet($deleted);
        $sessions = array_values(array_filter($sessions, function($s) use ($deletedSet) {
            return !isset($deletedSet[$s['sessionId']]);
        }));
    }

    echo json_encode([
        'sessions' => $sessions,
        'deleted' => $deleted,
        'updated_at' => $row ? $row['updated_at'] : null
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// === POST: сохранить сессии (с мержем и томбстоунами) ===
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);

    if (!$input || !isset($input['token'])) {
        http_response_code(400);
        echo json_encode(['error' => 'token required'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $token = trim($input['token']);
    $clientSessions = isset($input['sessions']) ? $input['sessions'] : [];
    $clientDeleted = isset($input['deleted']) && is_array($input['deleted']) ? $input['deleted'] : [];

    if (!is_array($clientSessions)) {
        http_response_code(400);
        echo json_encode(['error' => 'sessions must be array'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $authSession = validateSession($database, $token);
    if (!$authSession) {
        http_response_code(401);
        echo json_encode(['error' => 'invalid token'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $telegramId = $authSession['telegram_id'];

    try {
        $database->pdo->beginTransaction();

        $stmt = $database->pdo->prepare("SELECT `sessions_json`, `deleted_json` FROM `{$TABLE_GAME_SESSIONS}` WHERE `telegram_id` = :tid FOR UPDATE");
        $stmt->execute([':tid' => $telegramId]);
        $existingRow = $stmt->fetch(\PDO::FETCH_ASSOC);

        $serverSessions = [];
        $serverDeleted = [];
        if ($existingRow) {
            if ($existingRow['sessions_json']) {
                $decoded = json_decode($existingRow['sessions_json'], true);
                if (is_array($decoded)) $serverSessions = $decoded;
            }
            if (isset($existingRow['deleted_json']) && $existingRow['deleted_json']) {
                $decoded = json_decode($existingRow['deleted_json'], true);
                if (is_array($decoded)) $serverDeleted = $decoded;
            }
        }

        // Merge tombstones: server + client, deduplicate, expire old
        $allDeleted = filterExpiredTombstones(array_merge($serverDeleted, $clientDeleted), $TOMBSTONE_TTL_DAYS);
        $deletedSet = tombstoneIdSet($allDeleted);

        // Build session map from server sessions, excluding tombstoned
        $map = [];
        foreach ($serverSessions as $s) {
            if (!isset($s['sessionId'])) continue;
            if (isset($deletedSet[$s['sessionId']])) continue;
            $map[$s['sessionId']] = $s;
        }

        // Merge client sessions (newer wins), excluding tombstoned
        foreach ($clientSessions as $s) {
            if (!isset($s['sessionId'])) continue;
            if (isset($deletedSet[$s['sessionId']])) continue;
            $sid = $s['sessionId'];
            if (isset($map[$sid])) {
                $serverTs = isset($map[$sid]['timestamp']) ? (int)$map[$sid]['timestamp'] : 0;
                $clientTs = isset($s['timestamp']) ? (int)$s['timestamp'] : 0;
                if ($clientTs >= $serverTs) {
                    $map[$sid] = $s;
                }
            } else {
                $map[$sid] = $s;
            }
        }

        $merged = array_values($map);
        usort($merged, function($a, $b) {
            return (isset($b['timestamp']) ? (int)$b['timestamp'] : 0) - (isset($a['timestamp']) ? (int)$a['timestamp'] : 0);
        });

        $maxSessions = 50;
        if (count($merged) > $maxSessions) {
            $merged = array_slice($merged, 0, $maxSessions);
        }

        $sessionsJson = json_encode($merged, JSON_UNESCAPED_UNICODE);
        $deletedJson = json_encode($allDeleted, JSON_UNESCAPED_UNICODE);
        $now = date('Y-m-d H:i:s');

        $stmt = $database->pdo->prepare("
            INSERT INTO `{$TABLE_GAME_SESSIONS}` (`telegram_id`, `sessions_json`, `deleted_json`, `updated_at`)
            VALUES (:tid, :sj, :dj, :now)
            ON DUPLICATE KEY UPDATE `sessions_json` = :sj2, `deleted_json` = :dj2, `updated_at` = :now2
        ");
        $stmt->execute([
            ':tid' => $telegramId,
            ':sj' => $sessionsJson,
            ':dj' => $deletedJson,
            ':now' => $now,
            ':sj2' => $sessionsJson,
            ':dj2' => $deletedJson,
            ':now2' => $now
        ]);

        $database->pdo->commit();

        try {
            indexPlayerSessions($database, $TABLE_PLAYER_SESSIONS, $merged, $telegramId);
        } catch (\Throwable $e) {
            error_log('Player sessions indexing error: ' . $e->getMessage());
        }

        echo json_encode([
            'result' => 'ok',
            'updated_at' => $now,
            'sessions' => $merged,
            'deleted' => $allDeleted
        ], JSON_UNESCAPED_UNICODE);
    } catch (\Throwable $e) {
        try { $database->pdo->rollBack(); } catch (\Throwable $_) {}
        error_log('Game sessions save error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
