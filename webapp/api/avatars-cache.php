<?php
/**
 * Глобальный кэш аватаров игроков (по логину).
 * Кэш хранится 30 дней.
 *
 * GET  ?za=1&logins[]=Login1&logins[]=Login2
 *   → возвращает JSON { "Login1": "https://...", "Login2": "https://..." }
 *
 * POST za=1&action=get&logins=["Login1","Login2"]
 *   → то же самое через POST (для длинных списков)
 *
 * POST za=1&avatars={"Login1":"url1","Login2":"url2"}
 *   → сохраняет/обновляет кэш, возвращает OK
 */

// Не показываем ошибки в output — только в логи
ini_set('display_errors', 0);
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: *");
header('Content-Type: application/json; charset=utf-8');

try {

$CACHE_DIR = __DIR__ . '/avatar_cache';
$CACHE_TTL = 30 * 24 * 3600; // 30 дней

// Создаём директорию кэша
if (!is_dir($CACHE_DIR)) {
    @mkdir($CACHE_DIR, 0777, true);
}
if (!is_dir($CACHE_DIR)) {
    // Fallback во временную директорию
    $CACHE_DIR = sys_get_temp_dir() . '/mafboard_avatar_cache';
    if (!is_dir($CACHE_DIR)) {
        @mkdir($CACHE_DIR, 0777, true);
    }
}
if (!is_dir($CACHE_DIR) || !is_writable($CACHE_DIR)) {
    echo json_encode(['error' => 'cache dir not writable', 'dir' => $CACHE_DIR]);
    exit();
}

/**
 * Безопасное имя файла из логина
 */
function cacheKey($login) {
    $trimmed = trim($login);
    if (function_exists('mb_strtolower')) {
        $lower = mb_strtolower($trimmed, 'UTF-8');
    } else {
        $lower = strtolower($trimmed);
    }
    return md5($lower);
}

/**
 * Получить аватары из кэша по списку логинов
 */
function getCachedAvatars($logins, $cacheDir, $cacheTTL) {
    $result = [];
    $now = time();

    foreach ($logins as $login) {
        $login = trim($login);
        if ($login === '') continue;

        $file = $cacheDir . '/' . cacheKey($login) . '.json';
        if (file_exists($file)) {
            $raw = @file_get_contents($file);
            if ($raw === false) continue;
            $data = @json_decode($raw, true);
            if ($data && isset($data['url']) && isset($data['ts'])) {
                if (($now - intval($data['ts'])) < $cacheTTL) {
                    $result[$login] = $data['url'];
                }
            }
        }
    }

    return $result;
}

// ==================== GET: получение кэшированных аватаров ====================
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!isset($_GET['za'])) {
        echo '{}';
        exit();
    }

    $logins = isset($_GET['logins']) ? $_GET['logins'] : [];
    if (!is_array($logins) || count($logins) === 0) {
        echo '{}';
        exit();
    }

    $result = getCachedAvatars($logins, $CACHE_DIR, $CACHE_TTL);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

// ==================== POST ====================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_POST['za'])) {
        echo '{}';
        exit();
    }

    // POST action=get — получение кэшированных аватаров (альтернатива GET для длинных списков)
    if (isset($_POST['action']) && $_POST['action'] === 'get') {
        $loginsJson = isset($_POST['logins']) ? $_POST['logins'] : '[]';
        $logins = @json_decode($loginsJson, true);
        if (!is_array($logins)) {
            echo '{}';
            exit();
        }
        $result = getCachedAvatars($logins, $CACHE_DIR, $CACHE_TTL);
        echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit();
    }

    // POST avatars={...} — сохранение аватаров в кэш
    $avatarsJson = isset($_POST['avatars']) ? $_POST['avatars'] : '';
    $avatars = @json_decode($avatarsJson, true);

    if (!is_array($avatars) || count($avatars) === 0) {
        echo '{}';
        exit();
    }

    $now = time();
    $saved = 0;

    foreach ($avatars as $login => $url) {
        $login = trim($login);
        $url = trim($url);
        if ($login === '' || $url === '') continue;

        $file = $CACHE_DIR . '/' . cacheKey($login) . '.json';
        $data = json_encode([
            'login' => $login,
            'url'   => $url,
            'ts'    => $now
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if (@file_put_contents($file, $data) !== false) {
            $saved++;
        }
    }

    echo json_encode(['ok' => true, 'saved' => $saved]);
    exit();
}

echo '{}';

} catch (Exception $e) {
    // Ловим любые исключения
    echo json_encode(['error' => $e->getMessage()]);
} catch (Error $e) {
    // Ловим фатальные ошибки (PHP 7+)
    echo json_encode(['error' => $e->getMessage()]);
}

