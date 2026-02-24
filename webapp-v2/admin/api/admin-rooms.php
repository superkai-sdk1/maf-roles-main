<?php
// =====================================================
// Admin Rooms — управление комнатами
//
// GET  ?token=xxx                          — список всех комнат
// GET  ?token=xxx&action=detail&roomId=XXX — детали комнаты
// POST body:{action:"clear", roomId:"XXX"} — сбросить состояние комнаты
// POST body:{action:"delete", roomId:"XXX"} — удалить комнату полностью
// POST body:{action:"clearAll"}            — удалить все комнаты
// POST body:{action:"updateField", roomId:"XXX", field:"...", value:...}
// =====================================================

ini_set('display_errors', 0);
error_reporting(E_ALL);

register_shutdown_function(function() {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
        }
        echo json_encode(['error' => 'Fatal: ' . $err['message']], JSON_UNESCAPED_UNICODE);
    }
});

require_once __DIR__ . '/admin-config.php';
require_once __DIR__ . '/../../login/auth-helpers.php';
setJsonHeaders();

$rawBody = file_get_contents('php://input');
$parsedBody = json_decode($rawBody, true);

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
if (empty($token) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($parsedBody && isset($parsedBody['token'])) $token = trim($parsedBody['token']);
}
if (empty($token)) jsonError('Token required', 401);

$session = validateSession($database, $token);
if (!$session || !in_array((int)$session['telegram_id'], ADMIN_TELEGRAM_IDS)) {
    jsonError('Access denied', 403);
}

$API_DIR = __DIR__ . '/../../api';

/**
 * Получить список всех комнат (room_*.json файлов)
 */
function getRoomsList($apiDir) {
    $rooms = [];
    $roomFiles = glob($apiDir . '/room_*.json');

    foreach ($roomFiles as $filePath) {
        $filename = basename($filePath);
        // Извлекаем roomId из имени файла room_XXXX.json
        if (preg_match('/^room_(.+)\.json$/', $filename, $m)) {
            $roomId = $m[1];
        } else {
            continue;
        }

        $fileSize = filesize($filePath);
        $modified = filemtime($filePath);
        $data = json_decode(file_get_contents($filePath), true);

        if (!is_array($data)) $data = [];

        // Извлекаем основную информацию
        $peoples = isset($data['peoples']) && is_array($data['peoples']) ? $data['peoples'] : [];
        $activePlayers = array_filter($peoples, function($p) {
            return !empty($p['login']) || !empty($p['name']);
        });

        $hasRoles = false;
        if (isset($data['roles']) && is_array($data['roles'])) {
            $hasRoles = count(array_filter($data['roles'], function($r) { return !empty($r); })) > 0;
        }

        $winnerTeam = isset($data['winnerTeam']) ? $data['winnerTeam'] : null;
        $gameSelected = isset($data['gameSelected']) ? $data['gameSelected'] : null;
        $tableSelected = isset($data['tableSelected']) ? $data['tableSelected'] : null;
        $currentMode = isset($data['currentMode']) ? $data['currentMode'] : null;
        $nominations = isset($data['nominations']) && is_array($data['nominations']) ? $data['nominations'] : [];
        $activeNominations = count(array_filter($nominations, function($n) { return !empty($n); }));

        // Проверяем аватары
        $avatarsFile = $apiDir . '/avatars_' . $roomId . '.json';
        $hasAvatars = file_exists($avatarsFile);

        $rooms[] = [
            'roomId' => $roomId,
            'fileSize' => $fileSize,
            'modified' => date('c', $modified),
            'modifiedTs' => $modified,
            'playersCount' => count($activePlayers),
            'totalSeats' => count($peoples),
            'hasRoles' => $hasRoles,
            'winnerTeam' => $winnerTeam,
            'gameSelected' => $gameSelected,
            'tableSelected' => $tableSelected,
            'currentMode' => $currentMode,
            'activeNominations' => $activeNominations,
            'hasAvatars' => $hasAvatars,
        ];
    }

    // Сортируем по дате изменения (новые вверху)
    usort($rooms, function($a, $b) { return $b['modifiedTs'] - $a['modifiedTs']; });

    return $rooms;
}

/**
 * Получить полную информацию о комнате
 */
function getRoomDetail($apiDir, $roomId) {
    $roomId = preg_replace('/[^\w\-]/', '', $roomId);
    $filePath = $apiDir . '/room_' . $roomId . '.json';

    if (!file_exists($filePath)) return null;

    $data = json_decode(file_get_contents($filePath), true);
    if (!is_array($data)) $data = [];

    $fileSize = filesize($filePath);
    $modified = filemtime($filePath);

    // Обогащаем информацию об игроках
    $peoples = isset($data['peoples']) && is_array($data['peoples']) ? $data['peoples'] : [];
    $roles = isset($data['roles']) && is_array($data['roles']) ? $data['roles'] : [];
    $fouls = isset($data['fouls']) && is_array($data['fouls']) ? $data['fouls'] : [];
    $removed = isset($data['removed']) && is_array($data['removed']) ? $data['removed'] : [];

    $playersInfo = [];
    foreach ($peoples as $i => $p) {
        $login = isset($p['login']) ? $p['login'] : '';
        $name = isset($p['name']) ? $p['name'] : '';
        if (!$login && !$name) continue;

        $playersInfo[] = [
            'seat' => $i + 1,
            'login' => $login,
            'name' => $name,
            'role' => isset($roles[$i]) ? $roles[$i] : null,
            'fouls' => isset($fouls[$i]) ? (int)$fouls[$i] : 0,
            'removed' => isset($removed[$i]) ? (bool)$removed[$i] : false,
        ];
    }

    // Voting info
    $votingInfo = null;
    if (!empty($data['nominations']) || !empty($data['votingOrder'])) {
        $votingInfo = [
            'nominations' => isset($data['nominations']) ? $data['nominations'] : [],
            'nominationsLocked' => !empty($data['nominationsLocked']),
            'votingOrder' => isset($data['votingOrder']) ? $data['votingOrder'] : [],
            'votingResults' => isset($data['votingResults']) ? $data['votingResults'] : [],
            'votingFinished' => !empty($data['votingFinished']),
            'votingWinners' => isset($data['votingWinners']) ? $data['votingWinners'] : [],
            'votingStage' => isset($data['votingStage']) ? $data['votingStage'] : null,
        ];
    }

    // Avatars
    $avatarsFile = $apiDir . '/avatars_' . $roomId . '.json';
    $avatars = [];
    if (file_exists($avatarsFile)) {
        $avatars = json_decode(file_get_contents($avatarsFile), true) ?: [];
    }

    return [
        'roomId' => $roomId,
        'fileSize' => $fileSize,
        'modified' => date('c', $modified),
        'players' => $playersInfo,
        'totalSeats' => count($peoples),
        'winnerTeam' => isset($data['winnerTeam']) ? $data['winnerTeam'] : null,
        'gameSelected' => isset($data['gameSelected']) ? $data['gameSelected'] : null,
        'tableSelected' => isset($data['tableSelected']) ? $data['tableSelected'] : null,
        'currentMode' => isset($data['currentMode']) ? $data['currentMode'] : null,
        'manualMode' => !empty($data['manualMode']),
        'cityMode' => !empty($data['cityMode']),
        'cityPlayersCount' => isset($data['cityPlayersCount']) ? (int)$data['cityPlayersCount'] : null,
        'bestMove' => isset($data['bestMove']) ? $data['bestMove'] : [],
        'firstKilledPlayer' => isset($data['firstKilledPlayer']) ? $data['firstKilledPlayer'] : null,
        'killedOnNight' => isset($data['killedOnNight']) ? $data['killedOnNight'] : null,
        'voting' => $votingInfo,
        'avatars' => $avatars,
        'hideSeating' => !empty($data['hideSeating']),
        'hideLeaveOrder' => !empty($data['hideLeaveOrder']),
        'hideRolesStatus' => !empty($data['hideRolesStatus']),
        'hideBestMove' => !empty($data['hideBestMove']),
        'selectedColorScheme' => isset($data['selectedColorScheme']) ? $data['selectedColorScheme'] : null,
        'selectedBackgroundTheme' => isset($data['selectedBackgroundTheme']) ? $data['selectedBackgroundTheme'] : null,
        'mainInfoText' => isset($data['mainInfoText']) ? $data['mainInfoText'] : null,
        'additionalInfoText' => isset($data['additionalInfoText']) ? $data['additionalInfoText'] : null,
        'protocolData' => isset($data['protocolData']) ? $data['protocolData'] : null,
        'votingHistory' => isset($data['votingHistory']) ? $data['votingHistory'] : [],
        // Raw data keys for debug
        'rawKeys' => array_keys($data),
    ];
}

// ===== GET =====
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = isset($_GET['action']) ? $_GET['action'] : 'list';

    if ($action === 'list') {
        $rooms = getRoomsList($API_DIR);
        jsonResponse([
            'rooms' => $rooms,
            'total' => count($rooms),
        ]);
    }

    if ($action === 'detail') {
        $roomId = isset($_GET['roomId']) ? trim($_GET['roomId']) : '';
        if (empty($roomId)) jsonError('roomId required');

        $detail = getRoomDetail($API_DIR, $roomId);
        if (!$detail) jsonError('Комната не найдена', 404);

        jsonResponse($detail);
    }

    jsonError('Unknown action');
}

// ===== POST =====
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = $parsedBody;
    if (!$input || !isset($input['action'])) jsonError('action required');

    $action = $input['action'];

    // --- CLEAR: сбросить состояние комнаты ---
    if ($action === 'clear') {
        $roomId = isset($input['roomId']) ? preg_replace('/[^\w\-]/', '', $input['roomId']) : '';
        if (empty($roomId)) jsonError('roomId required');

        $filePath = $API_DIR . '/room_' . $roomId . '.json';
        if (!file_exists($filePath)) jsonError('Комната не найдена', 404);

        // Сбрасываем до пустого состояния
        file_put_contents($filePath, json_encode([
            'peoples' => [],
            'panelState' => [],
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        jsonResponse(['ok' => true, 'message' => "Комната {$roomId} очищена"]);
    }

    // --- DELETE: удалить комнату ---
    if ($action === 'delete') {
        $roomId = isset($input['roomId']) ? preg_replace('/[^\w\-]/', '', $input['roomId']) : '';
        if (empty($roomId)) jsonError('roomId required');

        $roomFile = $API_DIR . '/room_' . $roomId . '.json';
        $avatarsFile = $API_DIR . '/avatars_' . $roomId . '.json';

        $deleted = [];
        if (file_exists($roomFile)) {
            unlink($roomFile);
            $deleted[] = 'room';
        }
        if (file_exists($avatarsFile)) {
            unlink($avatarsFile);
            $deleted[] = 'avatars';
        }

        if (empty($deleted)) jsonError('Комната не найдена', 404);

        jsonResponse(['ok' => true, 'message' => "Комната {$roomId} удалена", 'deleted' => $deleted]);
    }

    // --- CLEAR ALL: удалить все комнаты ---
    if ($action === 'clearAll') {
        $roomFiles = glob($API_DIR . '/room_*.json');
        $avatarFiles = glob($API_DIR . '/avatars_*.json');

        $count = 0;
        foreach ($roomFiles as $f) { unlink($f); $count++; }
        foreach ($avatarFiles as $f) { unlink($f); }

        jsonResponse(['ok' => true, 'message' => "Удалено {$count} комнат"]);
    }

    // --- UPDATE FIELD: изменить поле в комнате ---
    if ($action === 'updateField') {
        $roomId = isset($input['roomId']) ? preg_replace('/[^\w\-]/', '', $input['roomId']) : '';
        $field = isset($input['field']) ? $input['field'] : '';
        $value = isset($input['value']) ? $input['value'] : null;

        if (empty($roomId) || empty($field)) jsonError('roomId and field required');

        $filePath = $API_DIR . '/room_' . $roomId . '.json';
        if (!file_exists($filePath)) jsonError('Комната не найдена', 404);

        $data = json_decode(file_get_contents($filePath), true);
        if (!is_array($data)) $data = [];

        // Безопасные поля для редактирования
        $safeFields = [
            'winnerTeam', 'hideSeating', 'hideLeaveOrder', 'hideRolesStatus',
            'hideBestMove', 'mainInfoText', 'additionalInfoText',
            'mainInfoVisible', 'additionalInfoVisible',
            'selectedColorScheme', 'selectedBackgroundTheme',
            'nominations', 'nominationsLocked',
        ];

        if (!in_array($field, $safeFields)) {
            jsonError("Поле '{$field}' нельзя редактировать через админку");
        }

        $data[$field] = $value;
        file_put_contents($filePath, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        jsonResponse(['ok' => true, 'message' => "Поле '{$field}' обновлено"]);
    }

    // --- KICK PLAYER: убрать игрока из комнаты ---
    if ($action === 'kickPlayer') {
        $roomId = isset($input['roomId']) ? preg_replace('/[^\w\-]/', '', $input['roomId']) : '';
        $seat = isset($input['seat']) ? (int)$input['seat'] : -1;

        if (empty($roomId) || $seat < 0) jsonError('roomId and seat required');

        $filePath = $API_DIR . '/room_' . $roomId . '.json';
        if (!file_exists($filePath)) jsonError('Комната не найдена', 404);

        $data = json_decode(file_get_contents($filePath), true);
        if (!is_array($data)) $data = [];

        if (isset($data['peoples'][$seat])) {
            $kicked = $data['peoples'][$seat];
            $data['peoples'][$seat] = ['login' => '', 'name' => ''];
            if (isset($data['roles'][$seat])) $data['roles'][$seat] = '';
            if (isset($data['fouls'][$seat])) $data['fouls'][$seat] = 0;
            if (isset($data['removed'][$seat])) $data['removed'][$seat] = false;

            file_put_contents($filePath, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
            jsonResponse(['ok' => true, 'message' => 'Игрок убран', 'kicked' => $kicked]);
        }

        jsonError('Место не найдено', 404);
    }

    // --- SET ROLE: изменить роль игрока ---
    if ($action === 'setRole') {
        $roomId = isset($input['roomId']) ? preg_replace('/[^\w\-]/', '', $input['roomId']) : '';
        $seat = isset($input['seat']) ? (int)$input['seat'] : -1;
        $role = isset($input['role']) ? $input['role'] : '';

        if (empty($roomId) || $seat < 0) jsonError('roomId and seat required');

        $filePath = $API_DIR . '/room_' . $roomId . '.json';
        if (!file_exists($filePath)) jsonError('Комната не найдена', 404);

        $data = json_decode(file_get_contents($filePath), true);
        if (!is_array($data)) $data = [];
        if (!isset($data['roles'])) $data['roles'] = [];

        $data['roles'][$seat] = $role;
        file_put_contents($filePath, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        jsonResponse(['ok' => true, 'message' => "Роль на месте " . ($seat + 1) . " изменена на '{$role}'"]);
    }

    jsonError('Unknown action');
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);

