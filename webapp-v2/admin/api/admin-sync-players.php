<?php
// =====================================================
// Admin Sync Players — фоновая синхронизация игроков с GoMafia.pro
//
// GET  ?token=xxx&action=status       — статус текущей синхронизации
// GET  ?token=xxx&action=diagnostics  — диагностика окружения
// POST ?token=xxx  body:{action:"start", rangeStart, rangeEnd}  — запуск
// POST ?token=xxx  body:{action:"stop"}  — остановка
// POST ?token=xxx  body:{action:"addPlayer", gomafiaId:"..."} — добавить одного
// =====================================================

ini_set('display_errors', 0);
error_reporting(E_ALL);

$LOG_FILE = __DIR__ . '/sync.log';

function syncLog($msg) {
    global $LOG_FILE;
    @file_put_contents($LOG_FILE, '[' . date('Y-m-d H:i:s') . '] ' . $msg . "\n", FILE_APPEND | LOCK_EX);
}

register_shutdown_function(function() {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        syncLog("FATAL: {$err['message']} in {$err['file']}:{$err['line']}");
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

$STATUS_FILE = __DIR__ . '/sync-status.json';
$LOCK_FILE   = __DIR__ . '/sync.lock';

function readStatus() {
    global $STATUS_FILE;
    if (!file_exists($STATUS_FILE)) return null;
    $data = json_decode(file_get_contents($STATUS_FILE), true);
    return is_array($data) ? $data : null;
}

function writeStatus($data) {
    global $STATUS_FILE;
    file_put_contents($STATUS_FILE, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

function httpGet($url, $timeout = 12) {
    $ctx = @stream_context_create([
        'http' => [
            'timeout' => $timeout,
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

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
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
        if ($err) syncLog("cURL error for {$url}: {$err}");
    }

    return null;
}

/**
 * Попытка запустить sync-worker.php в фоне.
 * Возвращает 'fpm' | 'exec' | 'proc_open' | false
 */
function launchWorker($rangeStart, $rangeEnd) {
    $workerScript = __DIR__ . '/sync-worker.php';

    if (!file_exists($workerScript)) {
        syncLog("Worker script not found: {$workerScript}");
        return false;
    }

    // Способ 1: exec() — классический вариант
    if (function_exists('exec') && !isDisabled('exec')) {
        $phpBin = findPhpCli();
        $logFile = __DIR__ . '/sync-worker-output.log';
        $cmd = sprintf(
            '%s %s %d %d >> %s 2>&1 &',
            escapeshellarg($phpBin),
            escapeshellarg($workerScript),
            $rangeStart,
            $rangeEnd,
            escapeshellarg($logFile)
        );
        syncLog("Launching via exec: {$cmd}");
        @exec($cmd);
        usleep(500000);

        $status = readStatus();
        if ($status && isset($status['status']) && $status['status'] !== 'starting') {
            return 'exec';
        }

        if (file_exists(__DIR__ . '/sync.lock')) {
            return 'exec';
        }
        syncLog("exec() did not start worker, trying next method");
    }

    // Способ 2: proc_open()
    if (function_exists('proc_open') && !isDisabled('proc_open')) {
        $phpBin = findPhpCli();
        $cmd = sprintf('%s %s %d %d', escapeshellarg($phpBin), escapeshellarg($workerScript), $rangeStart, $rangeEnd);
        syncLog("Launching via proc_open: {$cmd}");
        $descriptors = [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']];
        $proc = @proc_open($cmd, $descriptors, $pipes);
        if (is_resource($proc)) {
            proc_close($proc);
            usleep(300000);
            return 'proc_open';
        }
        syncLog("proc_open failed");
    }

    // Способ 3: fastcgi_finish_request() — запуск inline после отправки ответа
    if (function_exists('fastcgi_finish_request')) {
        syncLog("Using fastcgi_finish_request for inline sync");
        return 'fpm';
    }

    syncLog("No method available to launch background worker");
    return false;
}

function findPhpCli() {
    $binary = PHP_BINARY;
    if ($binary && strpos($binary, 'fpm') !== false) {
        foreach (['/usr/bin/php', '/usr/local/bin/php', '/usr/bin/php8.2', '/usr/bin/php8.1', '/usr/bin/php8.3'] as $path) {
            if (file_exists($path) && is_executable($path)) return $path;
        }
    }
    return $binary ?: 'php';
}

function isDisabled($fn) {
    $disabled = explode(',', (string)ini_get('disable_functions'));
    return in_array($fn, array_map('trim', $disabled));
}

// ===== GET =====
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = isset($_GET['action']) ? $_GET['action'] : 'status';

    if ($action === 'status') {
        $status = readStatus();
        if (!$status) {
            jsonResponse(['running' => false, 'status' => 'idle']);
        }

        if (isset($status['running']) && $status['running']) {
            $lastUpdate = isset($status['updatedAt']) ? strtotime($status['updatedAt']) : 0;
            if (time() - $lastUpdate > 90) {
                $status['running'] = false;
                $status['status'] = 'stalled';
                $status['error'] = 'Процесс не отвечает более 90 секунд';
                writeStatus($status);
                @unlink($LOCK_FILE);
            }
        }

        jsonResponse($status);
    }

    if ($action === 'diagnostics') {
        $diag = [
            'php_binary' => PHP_BINARY,
            'php_cli' => findPhpCli(),
            'php_sapi' => php_sapi_name(),
            'exec_available' => function_exists('exec') && !isDisabled('exec'),
            'proc_open_available' => function_exists('proc_open') && !isDisabled('proc_open'),
            'fastcgi_finish_request' => function_exists('fastcgi_finish_request'),
            'disabled_functions' => ini_get('disable_functions'),
            'allow_url_fopen' => (bool)ini_get('allow_url_fopen'),
            'curl_available' => function_exists('curl_init'),
            'worker_exists' => file_exists(__DIR__ . '/sync-worker.php'),
            'dir_writable' => is_writable(__DIR__),
            'status_file_exists' => file_exists($STATUS_FILE),
            'lock_file_exists' => file_exists($LOCK_FILE),
            'log_file' => file_exists($LOG_FILE) ? @file_get_contents($LOG_FILE) : null,
            'gomafia_reachable' => false,
        ];

        $test = httpGet('https://gomafia.pro/', 5);
        if ($test && strlen($test) > 100) {
            $diag['gomafia_reachable'] = true;
            if (preg_match('/"buildId"\s*:\s*"([^"]+)"/', $test, $bm)) {
                $diag['gomafia_build_id'] = $bm[1];
            }
        }

        jsonResponse($diag);
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

        // Try to kill the worker process if PID is in the lock file
        if (file_exists($LOCK_FILE)) {
            $pid = (int)trim(@file_get_contents($LOCK_FILE));
            if ($pid > 0) {
                @posix_kill($pid, 15); // SIGTERM
                syncLog("Sent SIGTERM to PID {$pid}");
            }
            @unlink($LOCK_FILE);
        }

        jsonResponse(['ok' => true, 'message' => 'Stop signal sent']);
    }

    // --- START ---
    if ($action === 'start') {
        // Atomic lock via flock() — prevents race conditions
        $lockFp = @fopen($LOCK_FILE, 'c+');
        if (!$lockFp) jsonError('Не удалось создать lock файл', 500);

        if (!flock($lockFp, LOCK_EX | LOCK_NB)) {
            fclose($lockFp);
            jsonError('Синхронизация уже запущена', 409);
        }

        // Double-check status (lock acquired, but maybe stale lock file)
        $status = readStatus();
        if ($status && isset($status['running']) && $status['running']) {
            $lastUpdate = isset($status['updatedAt']) ? strtotime($status['updatedAt']) : 0;
            if (time() - $lastUpdate < 90) {
                flock($lockFp, LOCK_UN);
                fclose($lockFp);
                jsonError('Синхронизация уже запущена', 409);
            }
        }

        $rangeStart = isset($input['rangeStart']) ? max(1, (int)$input['rangeStart']) : 1;
        $rangeEnd   = isset($input['rangeEnd'])   ? min(50000, (int)$input['rangeEnd']) : 10000;

        if ($rangeStart >= $rangeEnd) {
            flock($lockFp, LOCK_UN);
            fclose($lockFp);
            jsonError('rangeStart must be less than rangeEnd');
        }

        // Write PID to lock file
        ftruncate($lockFp, 0);
        rewind($lockFp);
        fwrite($lockFp, (string)getmypid());
        fflush($lockFp);

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

        syncLog("=== Sync start request: range {$rangeStart}-{$rangeEnd} ===");

        // Release flock BEFORE launching worker — worker needs to acquire its own
        flock($lockFp, LOCK_UN);
        fclose($lockFp);

        $method = launchWorker($rangeStart, $rangeEnd);

        if ($method === 'fpm') {
            http_response_code(200);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'ok' => true,
                'message' => 'Синхронизация запущена (inline FPM)',
                'method' => 'fpm',
                'rangeStart' => $rangeStart,
                'rangeEnd' => $rangeEnd,
            ], JSON_UNESCAPED_UNICODE);
            fastcgi_finish_request();

            set_time_limit(0);
            ignore_user_abort(true);
            $argv = [__FILE__, $rangeStart, $rangeEnd];
            include __DIR__ . '/sync-worker.php';
            exit;
        }

        if ($method) {
            syncLog("Worker launched via {$method}");
            jsonResponse([
                'ok' => true,
                'message' => 'Синхронизация запущена',
                'method' => $method,
                'rangeStart' => $rangeStart,
                'rangeEnd' => $rangeEnd,
            ]);
        }

        // Nothing worked
        @unlink($LOCK_FILE);
        $initStatus['running'] = false;
        $initStatus['status'] = 'error';
        $initStatus['error'] = 'Не удалось запустить фоновый процесс (exec/proc_open недоступны, fastcgi_finish_request отсутствует)';
        writeStatus($initStatus);
        syncLog("FAILED to launch worker — no method available");
        jsonError('Не удалось запустить синхронизацию. Проверьте: exec() или proc_open() должны быть разрешены в PHP.', 500);
    }

    // --- ADD SINGLE PLAYER ---
    if ($action === 'addPlayer') {
        $gomafiaInput = isset($input['gomafiaId']) ? trim($input['gomafiaId']) : '';

        $gomafiaId = null;
        if (preg_match('/\/stats\/(\d+)/', $gomafiaInput, $m2)) {
            $gomafiaId = (int)$m2[1];
        } elseif (preg_match('/^(\d+)$/', $gomafiaInput, $m)) {
            $gomafiaId = (int)$m[1];
        }

        if (!$gomafiaId || $gomafiaId < 1) {
            jsonError('Введите корректную ссылку или ID (пример: https://gomafia.pro/stats/9382)');
        }

        try {
            $html = httpGet('https://gomafia.pro/');
            if (!$html) jsonError('Не удалось подключиться к gomafia.pro', 502);

            $buildId = null;
            if (preg_match('/"buildId"\s*:\s*"([^"]+)"/', $html, $bm)) {
                $buildId = $bm[1];
            }
            if (!$buildId) jsonError('Не удалось получить buildId с gomafia.pro', 502);

            $url = "https://gomafia.pro/_next/data/{$buildId}/stats/{$gomafiaId}.json";
            $playerJson = httpGet($url);

            if (!$playerJson) jsonError("Игрок с ID {$gomafiaId} не найден на gomafia.pro", 404);

            $playerData = json_decode($playerJson, true);
            if (!$playerData) jsonError("Некорректный ответ от gomafia.pro", 502);

            $user = isset($playerData['pageProps']['serverData']['user']) ? $playerData['pageProps']['serverData']['user'] : null;

            if (!$user || !isset($user['login'])) {
                jsonError("Игрок с ID {$gomafiaId} не найден или данные повреждены", 404);
            }

            $clubTitle = 'Без клуба';
            $clubId = isset($user['club_id']) ? $user['club_id'] : null;
            if ($clubId && $clubId !== '0' && $clubId !== '') {
                $clubUrl = "https://gomafia.pro/_next/data/{$buildId}/club/{$clubId}.json";
                $clubJson = httpGet($clubUrl);
                if ($clubJson) {
                    $clubData = json_decode($clubJson, true);
                    if (isset($clubData['pageProps']['serverData']['club']['title'])) {
                        $clubTitle = $clubData['pageProps']['serverData']['club']['title'];
                    }
                }
            }

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

            syncLog("addPlayer: {$user['login']} (ID {$gomafiaId}) — {$actionResult}");

            jsonResponse([
                'ok' => true,
                'action' => $actionResult,
                'player' => $saveData,
            ]);

        } catch (\Throwable $e) {
            syncLog("addPlayer error: " . $e->getMessage());
            jsonError('Ошибка: ' . $e->getMessage(), 500);
        }
    }

    jsonError('Unknown action');
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);

