<?php
// =====================================================
// Admin Sync Players — фоновая синхронизация игроков с GoMafia.pro
//
// GET  ?token=xxx&action=status    — статус текущей синхронизации
// POST ?token=xxx  body:{action:"start", rangeStart, rangeEnd}  — запуск
// POST ?token=xxx  body:{action:"stop"}  — остановка
// POST ?token=xxx  body:{action:"addPlayer", gomafiaId:"..."} — добавить одного
// =====================================================

ini_set('display_errors', 0);
error_reporting(E_ALL);

// Перехват fatal errors — всегда возвращаем JSON
register_shutdown_function(function() {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
        }
        echo json_encode([
            'error' => 'Fatal: ' . $err['message'],
            'file' => basename($err['file']),
            'line' => $err['line']
        ], JSON_UNESCAPED_UNICODE);
    }
});

require_once __DIR__ . '/admin-config.php';
require_once __DIR__ . '/../../login/auth-helpers.php';
setJsonHeaders();

// Читаем тело запроса один раз (php://input можно прочитать только один раз)
$rawBody = file_get_contents('php://input');
$parsedBody = json_decode($rawBody, true);

// Получаем token из GET или POST body
$token = isset($_GET['token']) ? trim($_GET['token']) : '';
if (empty($token) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($parsedBody && isset($parsedBody['token'])) $token = trim($parsedBody['token']);
}
if (empty($token)) jsonError('Token required', 401);

$session = validateSession($database, $token);
if (!$session || !in_array((int)$session['telegram_id'], ADMIN_TELEGRAM_IDS)) {
    jsonError('Access denied', 403);
}

$STATUS_FILE = __DIR__ . '/sync-status.json';
$LOCK_FILE   = __DIR__ . '/sync.lock';

/**
 * Прочитать текущий статус
 */
function readStatus() {
    global $STATUS_FILE;
    if (!file_exists($STATUS_FILE)) return null;
    $data = json_decode(file_get_contents($STATUS_FILE), true);
    return is_array($data) ? $data : null;
}

/**
 * Записать статус
 */
function writeStatus($data) {
    global $STATUS_FILE;
    file_put_contents($STATUS_FILE, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

// ===== GET: статус =====
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = isset($_GET['action']) ? $_GET['action'] : 'status';

    if ($action === 'status') {
        $status = readStatus();
        if (!$status) {
            jsonResponse(['running' => false, 'status' => 'idle']);
        }

        // Проверяем, жив ли процесс (если прошло >60 сек без обновления — считаем мёртвым)
        if (isset($status['running']) && $status['running']) {
            $lastUpdate = isset($status['updatedAt']) ? strtotime($status['updatedAt']) : 0;
            if (time() - $lastUpdate > 60) {
                $status['running'] = false;
                $status['status'] = 'stalled';
                $status['error'] = 'Процесс не отвечает более 60 секунд';
                writeStatus($status);
                @unlink($LOCK_FILE);
            }
        }

        jsonResponse($status);
    }

    jsonError('Unknown action');
}

// ===== POST =====
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = $parsedBody;
    if (!$input || !isset($input['action'])) jsonError('action required');

    $action = $input['action'];

    // --- STOP ---
    if ($action === 'stop') {
        $status = readStatus();
        if ($status) {
            $status['running'] = false;
            $status['status'] = 'stopped';
            $status['stoppedAt'] = date('c');
            writeStatus($status);
        }
        @unlink($LOCK_FILE);
        jsonResponse(['ok' => true, 'message' => 'Stop signal sent']);
    }

    // --- START ---
    if ($action === 'start') {
        // Проверяем, не запущен ли уже
        if (file_exists($LOCK_FILE)) {
            $status = readStatus();
            if ($status && isset($status['running']) && $status['running']) {
                $lastUpdate = isset($status['updatedAt']) ? strtotime($status['updatedAt']) : 0;
                if (time() - $lastUpdate < 60) {
                    jsonError('Синхронизация уже запущена', 409);
                }
            }
        }

        $rangeStart = isset($input['rangeStart']) ? max(1, (int)$input['rangeStart']) : 1;
        $rangeEnd   = isset($input['rangeEnd'])   ? min(50000, (int)$input['rangeEnd']) : 10000;

        if ($rangeStart >= $rangeEnd) jsonError('rangeStart must be less than rangeEnd');

        // Создаём начальный статус
        $initStatus = [
            'running' => true,
            'status' => 'starting',
            'rangeStart' => $rangeStart,
            'rangeEnd' => $rangeEnd,
            'checked' => 0,
            'found' => 0,
            'updated' => 0,
            'inserted' => 0,
            'errors' => 0,
            'currentId' => $rangeStart,
            'lastPlayer' => '',
            'startedAt' => date('c'),
            'updatedAt' => date('c'),
            'error' => null,
        ];
        writeStatus($initStatus);
        file_put_contents($LOCK_FILE, getmypid(), LOCK_EX);

        // Запускаем фоновый процесс
        $phpBin = PHP_BINARY ?: 'php';
        $workerScript = __DIR__ . '/sync-worker.php';
        $cmd = sprintf(
            '%s %s %d %d > /dev/null 2>&1 &',
            escapeshellarg($phpBin),
            escapeshellarg($workerScript),
            $rangeStart,
            $rangeEnd
        );

        exec($cmd);

        jsonResponse([
            'ok' => true,
            'message' => 'Синхронизация запущена',
            'rangeStart' => $rangeStart,
            'rangeEnd' => $rangeEnd,
        ]);
    }

    // --- ADD SINGLE PLAYER ---
    if ($action === 'addPlayer') {
        $gomafiaInput = isset($input['gomafiaId']) ? trim($input['gomafiaId']) : '';

        // Извлекаем числовой ID из ссылки или прямого ввода
        // Поддержка: "9382", "https://gomafia.pro/stats/9382", "gomafia.pro/stats/9382"
        $gomafiaId = null;
        if (preg_match('/\/stats\/(\d+)/', $gomafiaInput, $m2)) {
            $gomafiaId = (int)$m2[1];
        } elseif (preg_match('/^(\d+)$/', $gomafiaInput, $m)) {
            $gomafiaId = (int)$m[1];
        }

        if (!$gomafiaId || $gomafiaId < 1) {
            jsonError('Введите корректную ссылку или ID (пример: https://gomafia.pro/stats/9382)');
        }

        // Функция для HTTP GET с fallback на cURL
        $httpGetFn = function($url) {
            // Сначала пробуем file_get_contents
            $ctx = @stream_context_create([
                'http' => [
                    'timeout' => 12,
                    'header' => "User-Agent: MafBoard-Sync/1.0\r\nAccept: text/html,application/json\r\n",
                    'ignore_errors' => true,
                ],
                'ssl' => [
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                ]
            ]);
            $result = @file_get_contents($url, false, $ctx);
            if ($result !== false && strlen($result) > 0) return $result;

            // Fallback: cURL
            if (function_exists('curl_init')) {
                $ch = curl_init($url);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 12,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_SSL_VERIFYHOST => 0,
                    CURLOPT_USERAGENT => 'MafBoard-Sync/1.0',
                ]);
                $result = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $err = curl_error($ch);
                curl_close($ch);
                if ($result !== false && $httpCode < 400 && strlen($result) > 0) return $result;
                if ($err) error_log("Sync cURL error: {$err}");
            }

            return null;
        };

        try {
            // Получаем buildId
            $html = $httpGetFn('https://gomafia.pro/');
            if (!$html) jsonError('Не удалось подключиться к gomafia.pro', 502);

            $buildId = null;
            if (preg_match('/"buildId"\s*:\s*"([^"]+)"/', $html, $bm)) {
                $buildId = $bm[1];
            }
            if (!$buildId) jsonError('Не удалось получить buildId с gomafia.pro', 502);

            // Загружаем данные игрока
            $url = "https://gomafia.pro/_next/data/{$buildId}/stats/{$gomafiaId}.json";
            $playerJson = $httpGetFn($url);

            if (!$playerJson) jsonError("Игрок с ID {$gomafiaId} не найден на gomafia.pro", 404);

            $playerData = json_decode($playerJson, true);
            if (!$playerData) jsonError("Некорректный ответ от gomafia.pro", 502);

            $user = isset($playerData['pageProps']['serverData']['user']) ? $playerData['pageProps']['serverData']['user'] : null;

            if (!$user || !isset($user['login'])) {
                jsonError("Игрок с ID {$gomafiaId} не найден или данные повреждены", 404);
            }

            // Получаем название клуба по club_id
            $clubTitle = 'Без клуба';
            $clubId = isset($user['club_id']) ? $user['club_id'] : null;
            if ($clubId && $clubId !== '0' && $clubId !== '') {
                $clubUrl = "https://gomafia.pro/_next/data/{$buildId}/club/{$clubId}.json";
                $clubJson = $httpGetFn($clubUrl);
                if ($clubJson) {
                    $clubData = json_decode($clubJson, true);
                    if (isset($clubData['pageProps']['serverData']['club']['title'])) {
                        $clubTitle = $clubData['pageProps']['serverData']['club']['title'];
                    }
                }
            }

            // Сохраняем в БД
            $TABLE_PLAYERS = 'players';
            $saveData = [
                'login' => $user['login'],
                'avatar_link' => isset($user['avatar_link']) ? $user['avatar_link'] : null,
                'id' => (string)(isset($user['id']) ? $user['id'] : $gomafiaId),
                'title' => $clubTitle,
            ];
            $jsonStr = json_encode($saveData, JSON_UNESCAPED_UNICODE);

            $existing = $database->select($TABLE_PLAYERS, 'id', ['login' => $user['login']]);
            if (!empty($existing)) {
                $database->update($TABLE_PLAYERS, ['data' => $jsonStr], ['login' => $user['login']]);
                $actionResult = 'updated';
            } else {
                $database->insert($TABLE_PLAYERS, ['data' => $jsonStr, 'login' => $user['login']]);
                $actionResult = 'inserted';
            }

            jsonResponse([
                'ok' => true,
                'action' => $actionResult,
                'player' => $saveData,
            ]);

        } catch (\Throwable $e) {
            jsonError('Ошибка: ' . $e->getMessage(), 500);
        }
    }

    jsonError('Unknown action');
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);

