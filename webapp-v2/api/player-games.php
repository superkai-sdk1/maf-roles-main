<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../login/auth-helpers.php';

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
if (empty($token)) {
    http_response_code(400);
    echo json_encode(['error' => 'token required']);
    exit;
}

$session = validateSession($database, $token);
if (!$session) {
    http_response_code(401);
    echo json_encode(['error' => 'invalid token']);
    exit;
}

$telegramId = $session['telegram_id'];

$profile = $database->get('user_profiles', ['gomafia_nickname'], ['telegram_id' => $telegramId]);
if (!$profile || empty($profile['gomafia_nickname'])) {
    echo json_encode(['error' => 'no_gomafia', 'games' => []]);
    exit;
}

$nickname = $profile['gomafia_nickname'];

try {
    $stmt = $database->pdo->prepare("
        SELECT `session_id`, `judge_telegram_id`, `tournament_name`, `game_mode`,
               `winner_team`, `game_finished`, `player_role`, `player_score`,
               `player_action`, `player_num`, `updated_at`
        FROM `player_sessions`
        WHERE `player_login` = :login
        ORDER BY `updated_at` DESC
        LIMIT 100
    ");
    $stmt->execute([':login' => $nickname]);
    $games = $stmt->fetchAll(\PDO::FETCH_ASSOC);

    foreach ($games as &$g) {
        $g['game_finished'] = (bool)$g['game_finished'];
        $g['player_score'] = $g['player_score'] !== null ? (float)$g['player_score'] : null;
        $g['player_num'] = $g['player_num'] !== null ? (int)$g['player_num'] : null;
        $g['judge_telegram_id'] = (string)$g['judge_telegram_id'];
    }
    unset($g);

    echo json_encode(['nickname' => $nickname, 'games' => $games], JSON_UNESCAPED_UNICODE);
} catch (\Throwable $e) {
    error_log('Player games error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}
