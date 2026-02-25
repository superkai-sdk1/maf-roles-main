<?php
// =====================================================
// Sync Worker — фоновый процесс синхронизации игроков с GoMafia.pro
// Запускается из admin-sync-players.php (exec/proc_open/fastcgi)
// Аргументы: php sync-worker.php <rangeStart> <rangeEnd>
// =====================================================

set_time_limit(0);
ignore_user_abort(true);

$rangeStart = isset($argv[1]) ? (int)$argv[1] : 1;
$rangeEnd   = isset($argv[2]) ? (int)$argv[2] : 10000;

$STATUS_FILE = __DIR__ . '/sync-status.json';
$LOCK_FILE   = __DIR__ . '/sync.lock';
$LOG_FILE    = __DIR__ . '/sync.log';

function workerLog($msg) {
    global $LOG_FILE;
    @file_put_contents($LOG_FILE, '[' . date('Y-m-d H:i:s') . '] [worker] ' . $msg . "\n", FILE_APPEND | LOCK_EX);
}

workerLog("Worker started: range {$rangeStart}-{$rangeEnd}, PID=" . getmypid());

// DB — если уже загружен через admin-sync-players.php (FPM inline), не загружаем повторно
if (!isset($database)) {
    $_savedCwd = getcwd();
    chdir(__DIR__ . '/../../api');
    require_once __DIR__ . '/../../api/db.php';
    chdir($_savedCwd);
}

$TABLE_PLAYERS = 'players';

$BATCH_SIZE = 20;
$DELAY_USEC = 120000;  // 120ms между запросами к GoMafia
$MAX_CONSECUTIVE_EMPTY = 200;

// ========== Утилиты ==========

function readStatus() {
    global $STATUS_FILE;
    if (!file_exists($STATUS_FILE)) return [];
    $d = json_decode(file_get_contents($STATUS_FILE), true);
    return is_array($d) ? $d : [];
}

function writeStatus($data) {
    global $STATUS_FILE;
    $data['updatedAt'] = date('c');
    file_put_contents($STATUS_FILE, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

function shouldStop() {
    $s = readStatus();
    return !(isset($s['running']) && $s['running']);
}

function httpGet($url, $timeout = 15) {
    // file_get_contents
    $ctx = stream_context_create([
        'http' => [
            'timeout' => $timeout,
            'header' => "User-Agent: MafBoard-Sync/1.0\r\nAccept: application/json,text/html\r\n",
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
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_USERAGENT => 'MafBoard-Sync/1.0',
        ]);
        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($result !== false && $httpCode < 400 && strlen($result) > 0) return $result;
    }

    return null;
}

// Кеш названий клубов (club_id => title)
$clubCache = [];

function getClubTitle($buildId, $clubId) {
    global $clubCache;

    if (!$clubId || $clubId === '0' || $clubId === '') return 'Без клуба';

    if (isset($clubCache[$clubId])) return $clubCache[$clubId];

    $url = "https://gomafia.pro/_next/data/{$buildId}/club/{$clubId}.json";
    $json = httpGet($url, 8);
    if ($json) {
        $data = json_decode($json, true);
        if (isset($data['pageProps']['serverData']['club']['title'])) {
            $title = $data['pageProps']['serverData']['club']['title'];
            $clubCache[$clubId] = $title;
            return $title;
        }
    }

    $clubCache[$clubId] = 'Без клуба';
    return 'Без клуба';
}

// ========== GoMafia API ==========

function getBuildId() {
    $html = httpGet('https://gomafia.pro/');
    if (!$html) return null;
    if (preg_match('/"buildId"\s*:\s*"([^"]+)"/', $html, $m)) {
        return $m[1];
    }
    return null;
}

function getUserData($buildId, $userId) {
    $url = "https://gomafia.pro/_next/data/{$buildId}/stats/{$userId}.json";
    $text = httpGet($url, 10);
    if (!$text) return null;

    $data = json_decode($text, true);
    if (!$data) return null;

    $user = isset($data['pageProps']['serverData']['user']) ? $data['pageProps']['serverData']['user'] : null;
    return $user;
}

// ========== Сохранение в БД ==========

function saveBatchToDb($database, $batch) {
    global $TABLE_PLAYERS;
    $updated = 0;
    $inserted = 0;

    foreach ($batch as $playerData) {
        $login = isset($playerData['login']) ? $playerData['login'] : null;
        if (!$login) continue;

        $jsonData = json_encode($playerData, JSON_UNESCAPED_UNICODE);

        try {
            $existing = $database->select($TABLE_PLAYERS, 'id', ['login' => $login]);
            if (!empty($existing)) {
                $database->update($TABLE_PLAYERS, ['data' => $jsonData], ['login' => $login]);
                $updated++;
            } else {
                $database->insert($TABLE_PLAYERS, ['data' => $jsonData, 'login' => $login]);
                $inserted++;
            }
        } catch (\Throwable $e) {
            error_log("Sync: DB error for {$login}: " . $e->getMessage());
        }
    }

    return ['updated' => $updated, 'inserted' => $inserted];
}

// ========== Основной цикл ==========

function runSync($database, $rangeStart, $rangeEnd) {
    global $BATCH_SIZE, $DELAY_USEC, $MAX_CONSECUTIVE_EMPTY, $LOCK_FILE;

    $status = readStatus();
    $status['running'] = true;
    $status['status'] = 'getting_build_id';
    writeStatus($status);

    $buildId = getBuildId();
    if (!$buildId) {
        workerLog("ERROR: Failed to get buildId from gomafia.pro");
        $status['running'] = false;
        $status['status'] = 'error';
        $status['error'] = 'Не удалось получить buildId с gomafia.pro';
        writeStatus($status);
        @unlink($LOCK_FILE);
        return;
    }

    workerLog("Got buildId: {$buildId}");
    $status['status'] = 'syncing';
    $status['buildId'] = $buildId;
    writeStatus($status);

    $checked = 0;
    $found = 0;
    $totalUpdated = 0;
    $totalInserted = 0;
    $totalErrors = 0;
    $consecutiveEmpty = 0;
    $batch = [];

    for ($userId = $rangeStart; $userId <= $rangeEnd; $userId++) {
        // Проверяем сигнал остановки каждые 10 итераций
        if ($checked % 10 === 0 && shouldStop()) {
            $status = readStatus();
            $status['status'] = 'stopped';
            $status['running'] = false;
            writeStatus($status);
            @unlink($LOCK_FILE);
            return;
        }

        $checked++;
        $user = getUserData($buildId, $userId);

        if ($user && isset($user['login'])) {
            $consecutiveEmpty = 0;
            $found++;

            // Получаем название клуба по club_id
            $clubId = isset($user['club_id']) ? $user['club_id'] : null;
            $clubTitle = getClubTitle($buildId, $clubId);

            $playerData = [
                'login' => $user['login'],
                'avatar_link' => isset($user['avatar_link']) ? $user['avatar_link'] : null,
                'id' => (string)(isset($user['id']) ? $user['id'] : $userId),
                'title' => $clubTitle,
            ];
            $batch[] = $playerData;

            // Сохраняем батч
            if (count($batch) >= $BATCH_SIZE) {
                $result = saveBatchToDb($database, $batch);
                $totalUpdated += $result['updated'];
                $totalInserted += $result['inserted'];
                $batch = [];
            }

            // Обновляем статус
            $status['checked'] = $checked;
            $status['found'] = $found;
            $status['updated'] = $totalUpdated;
            $status['inserted'] = $totalInserted;
            $status['currentId'] = $userId;
            $status['lastPlayer'] = $user['login'];
            $status['errors'] = $totalErrors;
            writeStatus($status);

        } else {
            $consecutiveEmpty++;

            // Обновляем статус каждые 20 пустых
            if ($consecutiveEmpty % 20 === 0) {
                $status['checked'] = $checked;
                $status['found'] = $found;
                $status['updated'] = $totalUpdated;
                $status['inserted'] = $totalInserted;
                $status['currentId'] = $userId;
                $status['errors'] = $totalErrors;
                writeStatus($status);
            }

            // Стоп если слишком много пустых подряд
            if ($consecutiveEmpty >= $MAX_CONSECUTIVE_EMPTY && $userId > $rangeStart + $MAX_CONSECUTIVE_EMPTY) {
                break;
            }
        }

        usleep($DELAY_USEC);
    }

    if (!empty($batch)) {
        $result = saveBatchToDb($database, $batch);
        $totalUpdated += $result['updated'];
        $totalInserted += $result['inserted'];
        $batch = [];
    }

    $status = readStatus();
    $status['running'] = false;
    $status['status'] = 'done';
    $status['checked'] = $checked;
    $status['found'] = $found;
    $status['updated'] = $totalUpdated;
    $status['inserted'] = $totalInserted;
    $status['errors'] = $totalErrors;
    $status['finishedAt'] = date('c');
    if ($consecutiveEmpty >= $MAX_CONSECUTIVE_EMPTY) {
        $status['note'] = "Остановлено: {$MAX_CONSECUTIVE_EMPTY} пустых ID подряд";
    }
    writeStatus($status);
    @unlink($LOCK_FILE);
    workerLog("Sync finished: checked={$checked}, found={$found}, updated={$totalUpdated}, inserted={$totalInserted}");
}

// ========== Запуск ==========
runSync($database, $rangeStart, $rangeEnd);

