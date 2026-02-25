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

$ROLE_LABELS = [
    'don' => 'Дон', 'black' => 'Мафия', 'sheriff' => 'Шериф', 'peace' => 'Мирный',
    'detective' => 'Детектив', 'jailer' => 'Тюремщик', 'prostitute' => 'Проститутка',
    'bodyguard' => 'Телохранитель', 'sleepwalker' => 'Лунатик', 'journalist' => 'Журналист',
    'doctor' => 'Доктор', 'priest' => 'Священник', 'judge' => 'Судья',
    'kamikaze' => 'Камикадзе', 'immortal' => 'Бессмертный', 'beauty' => 'Красотка',
    'oyabun' => 'Оябун', 'yakuza' => 'Якудза', 'maniac' => 'Маньяк',
    'ripper' => 'Потрошитель', 'swindler' => 'Аферист', 'thief' => 'Вор',
    'snitch' => 'Стукач', 'fangirl' => 'Поклонница', 'lawyer' => 'Адвокат',
    'mafia' => 'Мафия',
];

$BLACK_ROLES = ['don','black','oyabun','yakuza','maniac','ripper','swindler','thief','snitch','fangirl','lawyer','mafia'];

function calculateScore($roleKey, $roles, $playerScores, $winnerTeam) {
    global $BLACK_ROLES;
    if (!$winnerTeam) return 0;
    $s = 0;
    $role = isset($roles[$roleKey]) ? $roles[$roleKey] : '';
    $isBlack = in_array($role, $BLACK_ROLES);
    if ($winnerTeam === 'civilians' && !$isBlack) $s += 1;
    if ($winnerTeam === 'mafia' && $isBlack) $s += 1;
    if (isset($playerScores[$roleKey]) && is_array($playerScores[$roleKey])) {
        $ps = $playerScores[$roleKey];
        $s += floatval($ps['bonus'] ?? 0);
        $s -= floatval($ps['penalty'] ?? 0);
    }
    return round($s * 100) / 100;
}

function extractGameData($game, $roleLabels, $blackRoles) {
    $players = isset($game['players']) && is_array($game['players']) ? $game['players'] : [];
    $roles = isset($game['roles']) && is_array($game['roles']) ? $game['roles'] : [];
    $actions = isset($game['playersActions']) && is_array($game['playersActions']) ? $game['playersActions'] : [];
    $scores = isset($game['playerScores']) && is_array($game['playerScores']) ? $game['playerScores'] : [];
    $foulsData = isset($game['fouls']) && is_array($game['fouls']) ? $game['fouls'] : [];
    $techFoulsData = isset($game['techFouls']) && is_array($game['techFouls']) ? $game['techFouls'] : [];
    $winnerTeam = isset($game['winnerTeam']) ? $game['winnerTeam'] : null;

    $resultPlayers = [];
    foreach ($players as $p) {
        $rk = isset($p['roleKey']) ? $p['roleKey'] : '';
        $role = isset($roles[$rk]) ? $roles[$rk] : '';
        $resultPlayers[] = [
            'num' => isset($p['num']) ? (int)$p['num'] : null,
            'login' => isset($p['login']) ? $p['login'] : '',
            'roleKey' => $role,
            'role' => isset($roleLabels[$role]) ? $roleLabels[$role] : ($role ?: null),
            'isBlack' => in_array($role, $blackRoles),
            'action' => isset($actions[$rk]) ? $actions[$rk] : null,
            'score' => calculateScore($rk, $roles, $scores, $winnerTeam),
            'fouls' => isset($foulsData[$rk]) ? (int)$foulsData[$rk] : 0,
            'techFouls' => isset($techFoulsData[$rk]) ? (int)$techFoulsData[$rk] : 0,
            'scoreDetails' => isset($scores[$rk]) && is_array($scores[$rk]) ? $scores[$rk] : null,
        ];
    }

    return [
        'winnerTeam' => $winnerTeam,
        'gameFinished' => !empty($game['gameFinished']) || !empty($winnerTeam),
        'players' => $resultPlayers,
        'votingHistory' => isset($game['votingHistory']) ? $game['votingHistory'] : [],
        'nightCheckHistory' => isset($game['nightCheckHistory']) ? $game['nightCheckHistory'] : [],
        'killedOnNight' => isset($game['killedOnNight']) ? $game['killedOnNight'] : [],
        'nightMisses' => isset($game['nightMisses']) ? $game['nightMisses'] : [],
        'doctorHealHistory' => isset($game['doctorHealHistory']) ? $game['doctorHealHistory'] : [],
        'bestMove' => isset($game['bestMove']) ? $game['bestMove'] : [],
        'bestMoveAccepted' => !empty($game['bestMoveAccepted']),
        'firstKilledPlayer' => isset($game['firstKilledPlayer']) ? $game['firstKilledPlayer'] : null,
        'dayNumber' => isset($game['dayNumber']) ? (int)$game['dayNumber'] : 0,
        'nightNumber' => isset($game['nightNumber']) ? (int)$game['nightNumber'] : 0,
    ];
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

    $currentGame = extractGameData($target, $ROLE_LABELS, $BLACK_ROLES);

    $gamesHistoryRaw = isset($target['gamesHistory']) && is_array($target['gamesHistory']) ? $target['gamesHistory'] : [];
    $gamesHistory = [];
    foreach ($gamesHistoryRaw as $idx => $g) {
        $gd = extractGameData($g, $ROLE_LABELS, $BLACK_ROLES);
        $gd['gameNumber'] = isset($g['gameNumber']) ? (int)$g['gameNumber'] : ($idx + 1);
        $gd['completedAt'] = isset($g['completedAt']) ? $g['completedAt'] : null;
        $gamesHistory[] = $gd;
    }

    if ($currentGame['gameFinished']) {
        $currentGame['gameNumber'] = count($gamesHistory) + 1;
        $gamesHistory[] = $currentGame;
    }

    echo json_encode([
        'sessionId' => $target['sessionId'],
        'tournamentName' => isset($target['tournamentName']) ? $target['tournamentName'] : null,
        'gameMode' => isset($target['gameMode']) ? $target['gameMode'] : null,
        'gameSelected' => isset($target['gameSelected']) ? $target['gameSelected'] : null,
        'tableSelected' => isset($target['tableSelected']) ? $target['tableSelected'] : null,
        'currentGame' => $currentGame,
        'gamesHistory' => $gamesHistory,
    ], JSON_UNESCAPED_UNICODE);

} catch (\Throwable $e) {
    error_log('Player session detail error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
}
