<?php
// =====================================================
// API для синхронизации игровых сессий между устройствами
// Привязка к telegram_id через auth token
// GET:  ?token=xxx — получить сессии пользователя
// POST: {token, sessions} — сохранить сессии пользователя
// =====================================================

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Подключаем auth-helpers (содержит подключение к БД и validateSession)
require_once __DIR__ . '/../login/auth-helpers.php';

$TABLE_GAME_SESSIONS = 'game_sessions';

// Автомиграция — создаём таблицу если не существует
try {
    $database->pdo->exec("
        CREATE TABLE IF NOT EXISTS `{$TABLE_GAME_SESSIONS}` (
            `telegram_id` bigint(20) NOT NULL,
            `sessions_json` mediumtext NOT NULL,
            `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`telegram_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
} catch (\Throwable $e) {
    error_log('Game sessions migration error: ' . $e->getMessage());
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

    $row = $database->get($TABLE_GAME_SESSIONS, ['sessions_json', 'updated_at'], [
        'telegram_id' => $telegramId
    ]);

    if ($row && $row['sessions_json']) {
        $sessions = json_decode($row['sessions_json'], true);
        if (!is_array($sessions)) $sessions = [];
        echo json_encode([
            'sessions' => $sessions,
            'updated_at' => $row['updated_at']
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode([
            'sessions' => [],
            'updated_at' => null
        ], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// === POST: сохранить сессии (с мержем) ===
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

    // Транзакция с блокировкой строки для предотвращения гонки при одновременном пуше с двух устройств
    try {
        $database->pdo->beginTransaction();

        // Читаем текущие сессии с сервера с блокировкой строки (FOR UPDATE)
        $stmt = $database->pdo->prepare("SELECT `sessions_json` FROM `{$TABLE_GAME_SESSIONS}` WHERE `telegram_id` = :tid FOR UPDATE");
        $stmt->execute([':tid' => $telegramId]);
        $existingRow = $stmt->fetch(\PDO::FETCH_ASSOC);

        $serverSessions = [];
        if ($existingRow && $existingRow['sessions_json']) {
            $decoded = json_decode($existingRow['sessions_json'], true);
            if (is_array($decoded)) {
                $serverSessions = $decoded;
            }
        }

        // Мерж: по sessionId оставляем сессию с более новым timestamp
        $map = [];
        foreach ($serverSessions as $s) {
            if (isset($s['sessionId'])) {
                $map[$s['sessionId']] = $s;
            }
        }
        foreach ($clientSessions as $s) {
            if (!isset($s['sessionId'])) continue;
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

        // Собираем результат и сортируем по timestamp (новые первые)
        $merged = array_values($map);
        usort($merged, function($a, $b) {
            return (isset($b['timestamp']) ? (int)$b['timestamp'] : 0) - (isset($a['timestamp']) ? (int)$a['timestamp'] : 0);
        });

        // Ограничиваем количество сессий
        $maxSessions = 50;
        if (count($merged) > $maxSessions) {
            $merged = array_slice($merged, 0, $maxSessions);
        }

        $sessionsJson = json_encode($merged, JSON_UNESCAPED_UNICODE);
        $now = date('Y-m-d H:i:s');

        // Upsert
        $stmt = $database->pdo->prepare("
            INSERT INTO `{$TABLE_GAME_SESSIONS}` (`telegram_id`, `sessions_json`, `updated_at`)
            VALUES (:tid, :sj, :now)
            ON DUPLICATE KEY UPDATE `sessions_json` = :sj2, `updated_at` = :now2
        ");
        $stmt->execute([
            ':tid' => $telegramId,
            ':sj' => $sessionsJson,
            ':now' => $now,
            ':sj2' => $sessionsJson,
            ':now2' => $now
        ]);

        $database->pdo->commit();

        echo json_encode([
            'result' => 'ok',
            'updated_at' => $now,
            'sessions' => $merged
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

