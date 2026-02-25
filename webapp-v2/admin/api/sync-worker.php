<?php
// =====================================================
// Sync Worker — фоновый процесс синхронизации игроков с GoMafia.pro
// Запускается из admin-sync-players.php (exec/proc_open/fastcgi)
// Аргументы: php sync-worker.php <rangeStart> <rangeEnd>
//
// Использует curl_multi для параллельных запросов (до 10 одновременно).
// =====================================================

set_time_limit(0);
ignore_user_abort(true);

$rangeStart = isset($argv[1]) ? (int)$argv[1] : 1;
$rangeEnd   = isset($argv[2]) ? (int)$argv[2] : 10000;

$STATUS_FILE = __DIR__ . '/sync-status.json';
$LOCK_FILE   = __DIR__ . '/sync.lock';
$LOG_FILE    = __DIR__ . '/sync.log';

$CONCURRENCY = 10;
$DB_BATCH    = 50;
$MAX_CONSECUTIVE_EMPTY = 80;
$STATUS_UPDATE_INTERVAL = 2;

function workerLog($msg) {
    global $LOG_FILE;
    @file_put_contents($LOG_FILE, '[' . date('Y-m-d H:i:s') . '] [worker] ' . $msg . "\n", FILE_APPEND | LOCK_EX);
}

workerLog("Worker started: range {$rangeStart}-{$rangeEnd}, PID=" . getmypid());

if (!isset($database)) {
    $_savedCwd = getcwd();
    chdir(__DIR__ . '/../../api');
    require_once __DIR__ . '/../../api/db.php';
    chdir($_savedCwd);
}

$TABLE_PLAYERS = 'players';

// ========== Status helpers ==========

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

// ========== HTTP helpers ==========

function httpGet($url, $timeout = 12) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_USERAGENT => 'MafBoard-Sync/1.0',
            CURLOPT_ENCODING => '',
        ]);
        $result = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($result !== false && $code < 400 && strlen($result) > 0) return $result;
    }

    $ctx = @stream_context_create([
        'http' => ['timeout' => $timeout, 'header' => "User-Agent: MafBoard-Sync/1.0\r\n", 'ignore_errors' => true],
        'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
    ]);
    $result = @file_get_contents($url, false, $ctx);
    return ($result !== false && strlen($result) > 0) ? $result : null;
}

/**
 * Fetch multiple URLs in parallel via curl_multi.
 * Returns [url => responseBody|null, ...]
 */
function httpGetMulti($urls, $timeout = 10) {
    if (!function_exists('curl_multi_init') || empty($urls)) {
        $results = [];
        foreach ($urls as $url) $results[$url] = httpGet($url, $timeout);
        return $results;
    }

    $mh = curl_multi_init();
    $handles = [];

    foreach ($urls as $url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_USERAGENT => 'MafBoard-Sync/1.0',
            CURLOPT_ENCODING => '',
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$url] = $ch;
    }

    $running = null;
    do {
        curl_multi_exec($mh, $running);
        if ($running > 0) curl_multi_select($mh, 0.5);
    } while ($running > 0);

    $results = [];
    foreach ($handles as $url => $ch) {
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $body = curl_multi_getcontent($ch);
        $results[$url] = ($code < 400 && $body !== false && strlen($body) > 0) ? $body : null;
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);

    return $results;
}

// ========== GoMafia ==========

function getBuildId() {
    $html = httpGet('https://gomafia.pro/', 15);
    if (!$html) return null;
    if (preg_match('/"buildId"\s*:\s*"([^"]+)"/', $html, $m)) return $m[1];
    return null;
}

$clubCache = [];

function resolveClubs($buildId, $clubIds) {
    global $clubCache;
    $toFetch = [];
    foreach ($clubIds as $cid) {
        if (!$cid || $cid === '0' || $cid === '' || isset($clubCache[$cid])) continue;
        $toFetch[$cid] = "https://gomafia.pro/_next/data/{$buildId}/club/{$cid}.json";
    }
    if (empty($toFetch)) return;

    $responses = httpGetMulti(array_values($toFetch), 8);
    foreach ($toFetch as $cid => $url) {
        $body = isset($responses[$url]) ? $responses[$url] : null;
        if ($body) {
            $data = json_decode($body, true);
            if (isset($data['pageProps']['serverData']['club']['title'])) {
                $clubCache[$cid] = $data['pageProps']['serverData']['club']['title'];
                continue;
            }
        }
        $clubCache[$cid] = 'Без клуба';
    }
}

function getClubTitle($clubId) {
    global $clubCache;
    if (!$clubId || $clubId === '0' || $clubId === '') return 'Без клуба';
    return isset($clubCache[$clubId]) ? $clubCache[$clubId] : 'Без клуба';
}

// ========== DB ==========

function saveBatchToDb($database, $batch) {
    global $TABLE_PLAYERS;
    if (empty($batch)) return ['updated' => 0, 'inserted' => 0];

    $updated = 0;
    $inserted = 0;

    // Try single efficient query first
    try {
        $pdo = $database->pdo;
        $stmt = $pdo->prepare("INSERT INTO `{$TABLE_PLAYERS}` (`login`, `data`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `data` = VALUES(`data`)");

        foreach ($batch as $p) {
            $login = isset($p['login']) ? $p['login'] : null;
            if (!$login) continue;
            $json = json_encode($p, JSON_UNESCAPED_UNICODE);
            try {
                $stmt->execute([$login, $json]);
                if ($stmt->rowCount() === 1) $inserted++;
                else $updated++;
            } catch (\Throwable $e) {
                workerLog("DB error for {$login}: " . $e->getMessage());
            }
        }
    } catch (\Throwable $e) {
        workerLog("DB batch error: " . $e->getMessage());
        // Fallback to Medoo
        foreach ($batch as $p) {
            $login = isset($p['login']) ? $p['login'] : null;
            if (!$login) continue;
            $json = json_encode($p, JSON_UNESCAPED_UNICODE);
            try {
                $existing = $database->select($TABLE_PLAYERS, 'id', ['login' => $login]);
                if (!empty($existing)) {
                    $database->update($TABLE_PLAYERS, ['data' => $json], ['login' => $login]);
                    $updated++;
                } else {
                    $database->insert($TABLE_PLAYERS, ['data' => $json, 'login' => $login]);
                    $inserted++;
                }
            } catch (\Throwable $e2) {
                workerLog("DB fallback error for {$login}: " . $e2->getMessage());
            }
        }
    }

    return ['updated' => $updated, 'inserted' => $inserted];
}

// ========== Main sync loop ==========

function runSync($database, $rangeStart, $rangeEnd) {
    global $CONCURRENCY, $DB_BATCH, $MAX_CONSECUTIVE_EMPTY, $LOCK_FILE, $STATUS_UPDATE_INTERVAL;

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

    workerLog("Got buildId: {$buildId}, concurrency: {$CONCURRENCY}");
    $status['status'] = 'syncing';
    $status['buildId'] = $buildId;
    writeStatus($status);

    $checked = 0;
    $found = 0;
    $totalUpdated = 0;
    $totalInserted = 0;
    $totalErrors = 0;
    $consecutiveEmpty = 0;
    $dbBatch = [];
    $lastStatusWrite = time();
    $lastPlayer = '';

    for ($batchStart = $rangeStart; $batchStart <= $rangeEnd; $batchStart += $CONCURRENCY) {
        if (shouldStop()) {
            $status = readStatus();
            $status['status'] = 'stopped';
            $status['running'] = false;
            writeStatus($status);
            @unlink($LOCK_FILE);
            workerLog("Stopped by user at ID {$batchStart}");
            return;
        }

        $batchEnd = min($batchStart + $CONCURRENCY - 1, $rangeEnd);
        $urls = [];
        for ($id = $batchStart; $id <= $batchEnd; $id++) {
            $urls[$id] = "https://gomafia.pro/_next/data/{$buildId}/stats/{$id}.json";
        }

        $responses = httpGetMulti(array_values($urls), 10);

        $clubIdsToResolve = [];
        $foundInBatch = [];

        foreach ($urls as $id => $url) {
            $checked++;
            $body = isset($responses[$url]) ? $responses[$url] : null;

            if (!$body) {
                $consecutiveEmpty++;
                continue;
            }

            $data = json_decode($body, true);
            if (!$data) {
                $consecutiveEmpty++;
                continue;
            }

            $user = isset($data['pageProps']['serverData']['user']) ? $data['pageProps']['serverData']['user'] : null;
            if (!$user || !isset($user['login'])) {
                $consecutiveEmpty++;
                continue;
            }

            $consecutiveEmpty = 0;
            $found++;
            $lastPlayer = $user['login'];

            $clubId = isset($user['club_id']) ? $user['club_id'] : null;
            if ($clubId && $clubId !== '0' && $clubId !== '') {
                $clubIdsToResolve[] = $clubId;
            }

            $foundInBatch[] = [
                'id' => $id,
                'user' => $user,
                'club_id' => $clubId,
            ];
        }

        // Resolve all new club titles in parallel
        if (!empty($clubIdsToResolve)) {
            resolveClubs($buildId, array_unique($clubIdsToResolve));
        }

        // Build player records
        foreach ($foundInBatch as $item) {
            $user = $item['user'];
            $dbBatch[] = [
                'login' => $user['login'],
                'avatar_link' => isset($user['avatar_link']) ? $user['avatar_link'] : null,
                'id' => (string)(isset($user['id']) ? $user['id'] : $item['id']),
                'title' => getClubTitle($item['club_id']),
            ];
        }

        // Flush DB batch
        if (count($dbBatch) >= $DB_BATCH) {
            $result = saveBatchToDb($database, $dbBatch);
            $totalUpdated += $result['updated'];
            $totalInserted += $result['inserted'];
            $dbBatch = [];
        }

        // Update status periodically (not every iteration)
        $now = time();
        if ($now - $lastStatusWrite >= $STATUS_UPDATE_INTERVAL) {
            $status['checked'] = $checked;
            $status['found'] = $found;
            $status['updated'] = $totalUpdated;
            $status['inserted'] = $totalInserted;
            $status['currentId'] = $batchEnd;
            $status['lastPlayer'] = $lastPlayer;
            $status['errors'] = $totalErrors;
            $status['speed'] = $checked > 0 ? round($checked / max(1, $now - strtotime($status['startedAt']))) : 0;
            writeStatus($status);
            $lastStatusWrite = $now;
        }

        if ($consecutiveEmpty >= $MAX_CONSECUTIVE_EMPTY && $batchEnd > $rangeStart + $MAX_CONSECUTIVE_EMPTY) {
            workerLog("Stopping: {$consecutiveEmpty} consecutive empty IDs at {$batchEnd}");
            break;
        }

        // Small delay between batches to avoid hammering
        usleep(50000); // 50ms
    }

    // Flush remaining
    if (!empty($dbBatch)) {
        $result = saveBatchToDb($database, $dbBatch);
        $totalUpdated += $result['updated'];
        $totalInserted += $result['inserted'];
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
    $elapsed = time() - strtotime($status['startedAt']);
    $status['elapsedSeconds'] = $elapsed;
    $status['speed'] = $checked > 0 ? round($checked / max(1, $elapsed)) : 0;
    if ($consecutiveEmpty >= $MAX_CONSECUTIVE_EMPTY) {
        $status['note'] = "Остановлено: {$MAX_CONSECUTIVE_EMPTY} пустых ID подряд";
    }
    writeStatus($status);
    @unlink($LOCK_FILE);
    workerLog("Sync finished in {$elapsed}s: checked={$checked}, found={$found}, updated={$totalUpdated}, inserted={$totalInserted}, speed={$status['speed']} IDs/s");
}

// ========== Launch ==========
runSync($database, $rangeStart, $rangeEnd);
