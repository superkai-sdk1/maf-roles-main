<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../login/auth-helpers.php';

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
$sessionId = isset($_GET['session_id']) ? trim($_GET['session_id']) : '';
$judgeId = isset($_GET['judge_id']) ? trim($_GET['judge_id']) : '';

if (empty($token) || empty($sessionId) || empty($judgeId)) {
    http_response_code(400);
    echo json_encode(['error' => 'token, session_id, and judge_id required']);
    exit;
}

$authSession = validateSession($database, $token);
if (!$authSession) {
    http_response_code(401);
    echo json_encode(['error' => 'invalid token']);
    exit;
}

$telegramId = $authSession['telegram_id'];

$profile = $database->get('user_profiles', ['gomafia_nickname'], ['telegram_id' => $telegramId]);
if (!$profile || empty($profile['gomafia_nickname'])) {
    http_response_code(403);
    echo json_encode(['error' => 'no_gomafia']);
    exit;
}

$nickname = $profile['gomafia_nickname'];

$access = $database->get('player_sessions', ['session_id'], [
    'session_id' => $sessionId,
    'player_login' => $nickname,
]);
if (!$access) {
    http_response_code(403);
    echo json_encode(['error' => 'access denied']);
    exit;
}

try {
    $row = $database->get('game_sessions', ['sessions_json'], ['telegram_id' => $judgeId]);
    if (!$row || empty($row['sessions_json'])) {
        http_response_code(404);
        echo json_encode(['error' => 'session not found']);
        exit;
    }

    $sessions = json_decode($row['sessions_json'], true);
    if (!is_array($sessions)) {
        http_response_code(404);
        echo json_encode(['error' => 'session not found']);
        exit;
    }

    $target = null;
    foreach ($sessions as $s) {
        if (isset($s['sessionId']) && $s['sessionId'] === $sessionId) {
            $target = $s;
            break;
        }
    }

    if (!$target) {
        http_response_code(404);
        echo json_encode(['error' => 'session not found']);
        exit;
    }

    $players = isset($target['players']) && is_array($target['players']) ? $target['players'] : [];
    $roles = isset($target['roles']) && is_array($target['roles']) ? $target['roles'] : [];
    $actions = isset($target['playersActions']) && is_array($target['playersActions']) ? $target['playersActions'] : [];
    $scores = isset($target['playerScores']) && is_array($target['playerScores']) ? $target['playerScores'] : [];
    $foulsData = isset($target['fouls']) && is_array($target['fouls']) ? $target['fouls'] : [];
    $techFoulsData = isset($target['techFouls']) && is_array($target['techFouls']) ? $target['techFouls'] : [];

    $resultPlayers = [];
    foreach ($players as $p) {
        $rk = isset($p['roleKey']) ? $p['roleKey'] : '';
        $resultPlayers[] = [
            'num' => isset($p['num']) ? (int)$p['num'] : null,
            'login' => isset($p['login']) ? $p['login'] : '',
            'role' => isset($roles[$rk]) ? $roles[$rk] : null,
            'action' => isset($actions[$rk]) ? $actions[$rk] : null,
            'score' => isset($scores[$rk]) ? (float)$scores[$rk] : null,
            'fouls' => isset($foulsData[$rk]) ? (int)$foulsData[$rk] : 0,
            'techFouls' => isset($techFoulsData[$rk]) ? (int)$techFoulsData[$rk] : 0,
        ];
    }

    echo json_encode([
        'sessionId' => $target['sessionId'],
        'tournamentName' => isset($target['tournamentName']) ? $target['tournamentName'] : null,
        'gameMode' => isset($target['gameMode']) ? $target['gameMode'] : null,
        'winnerTeam' => isset($target['winnerTeam']) ? $target['winnerTeam'] : null,
        'gameFinished' => !empty($target['gameFinished']) || !empty($target['winnerTeam']),
        'players' => $resultPlayers,
    ], JSON_UNESCAPED_UNICODE);

} catch (\Throwable $e) {
    error_log('Player session detail error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}
