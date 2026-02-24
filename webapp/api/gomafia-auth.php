<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if (!isset($_REQUEST['za'])) {
    exit();
}

$action = isset($_REQUEST['action']) ? $_REQUEST['action'] : '';
$UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

if ($action === 'login') {
    $nickname = isset($_POST['nickname']) ? trim($_POST['nickname']) : '';
    $password = isset($_POST['password']) ? $_POST['password'] : '';

    if (!$nickname || !$password) {
        echo json_encode(['success' => false, 'error' => 'Введите никнейм и пароль']);
        exit();
    }

    $cookieFile = tempnam(sys_get_temp_dir(), 'gm_');

    try {
        $result = doFullLogin($cookieFile, $nickname, $password);

        if ($result['success']) {
            echo json_encode([
                'success' => true,
                'profile' => $result['profile'] ?? ['nickname' => $nickname, 'avatar' => null]
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'error' => $result['error'] ?? 'Неверный никнейм или пароль'
            ]);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Ошибка: ' . $e->getMessage()]);
    }

    cleanup($cookieFile);
    exit();
}

if ($action === 'lookup') {
    $nickname = isset($_REQUEST['nickname']) ? trim($_REQUEST['nickname']) : '';
    if (!$nickname) {
        echo json_encode(['success' => false, 'error' => 'Введите никнейм']);
        exit();
    }

    $profile = lookupPlayer($nickname);
    echo json_encode($profile
        ? ['success' => true, 'profile' => $profile]
        : ['success' => false, 'error' => 'Игрок не найден']);
    exit();
}

echo json_encode(['success' => false, 'error' => 'Unknown action']);
exit();


// ==========================================================================
// LOGIN — tries multiple strategies in order
// ==========================================================================

function doFullLogin($cookieFile, $nickname, $password) {
    global $UA;

    // ---- Strategy 1: Direct API login — brute-force all possible formats ----
    // GoMafia uses custom JSON-RPC-like API. "wrong_method" on /api/login means
    // the endpoint exists but body format is wrong. Try all combinations.

    $bodyVariants = [
        // Different field names for nickname/password
        json_encode(['nickname' => $nickname, 'password' => $password]),
        json_encode(['login' => $nickname, 'password' => $password]),
        json_encode(['username' => $nickname, 'password' => $password]),
        json_encode(['email' => $nickname, 'password' => $password]),
        json_encode(['nick' => $nickname, 'pass' => $password]),
        // JSON-RPC style with method in body
        json_encode(['method' => 'login', 'nickname' => $nickname, 'password' => $password]),
        json_encode(['method' => 'user.login', 'params' => ['nickname' => $nickname, 'password' => $password]]),
        json_encode(['method' => 'auth.login', 'params' => ['nickname' => $nickname, 'password' => $password]]),
        json_encode(['method' => 'login', 'params' => ['login' => $nickname, 'password' => $password]]),
    ];

    $urlVariants = [
        'https://gomafia.pro/api/login',
        'https://gomafia.pro/api/user/login',
        'https://gomafia.pro/api/auth/signin',
        'https://gomafia.pro/api/',
    ];

    // Also try form-encoded for /api/login
    $formVariants = [
        http_build_query(['nickname' => $nickname, 'password' => $password]),
        http_build_query(['login' => $nickname, 'password' => $password]),
    ];

    // First: JSON bodies to all URLs
    foreach ($urlVariants as $url) {
        foreach ($bodyVariants as $body) {
            $result = tryApiCall($url, $body, 'application/json', $cookieFile, $nickname);
            if ($result) return $result;
        }
    }

    // Second: form-encoded to /api/login
    foreach ($formVariants as $body) {
        $result = tryApiCall('https://gomafia.pro/api/login', $body, 'application/x-www-form-urlencoded', $cookieFile, $nickname);
        if ($result) return $result;
    }

    // ---- Strategy 2: Form-encoded login (like NextAuth callback) ----
    $formEndpoints = [
        'https://gomafia.pro/api/auth/callback/credentials',
        'https://gomafia.pro/api/auth/callback/login',
    ];

    // First get cookies from login page
    $ch = curl_init('https://gomafia.pro/login');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_COOKIEJAR      => $cookieFile,
        CURLOPT_COOKIEFILE     => $cookieFile,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HEADER         => true,
        CURLOPT_HTTPHEADER     => [
            "User-Agent: $UA",
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ],
    ]);
    $fullResp = curl_exec($ch);
    curl_close($ch);

    $csrfToken = extractCsrfFromResponse($fullResp, $cookieFile);

    foreach ($formEndpoints as $url) {
        $postFields = [
            'nickname'    => $nickname,
            'password'    => $password,
            'callbackUrl' => 'https://gomafia.pro/profile',
            'json'        => 'true',
        ];
        if ($csrfToken) {
            $postFields['csrfToken'] = $csrfToken;
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query($postFields),
            CURLOPT_COOKIEJAR      => $cookieFile,
            CURLOPT_COOKIEFILE     => $cookieFile,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_HEADER         => true,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/x-www-form-urlencoded',
                'Origin: https://gomafia.pro',
                'Referer: https://gomafia.pro/login',
                "User-Agent: $UA",
            ],
        ]);
        $resp = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 302 || $httpCode === 301) {
            $profile = fetchProfileFromSession($cookieFile);
            return ['success' => true, 'profile' => $profile ?: ['nickname' => $nickname, 'avatar' => null]];
        }

        if ($httpCode === 200 && $resp) {
            $headerEnd = strpos($resp, "\r\n\r\n");
            $body = $headerEnd !== false ? substr($resp, $headerEnd + 4) : $resp;
            $data = json_decode($body, true);
            if ($data && isset($data['url']) && !isset($data['error'])) {
                $profile = fetchProfileFromSession($cookieFile);
                return ['success' => true, 'profile' => $profile ?: ['nickname' => $nickname, 'avatar' => null]];
            }
        }
    }

    // ---- Strategy 3: Simulate browser form submit to /login ----
    $formData = http_build_query(['nickname' => $nickname, 'password' => $password]);
    $ch = curl_init('https://gomafia.pro/login');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $formData,
        CURLOPT_COOKIEJAR      => $cookieFile,
        CURLOPT_COOKIEFILE     => $cookieFile,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/x-www-form-urlencoded',
            'Origin: https://gomafia.pro',
            'Referer: https://gomafia.pro/login',
            "User-Agent: $UA",
        ],
    ]);
    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $resp) {
        // If we landed on profile page or got user data, login succeeded
        if (strpos($resp, '/profile') !== false || strpos($resp, $nickname) !== false) {
            $profile = fetchProfileFromSession($cookieFile);
            if ($profile) {
                return ['success' => true, 'profile' => $profile];
            }
        }
    }

    // ---- All strategies failed ----
    // Collect diagnostic info
    $diag = collectDiagnostics($cookieFile, $nickname);
    return ['success' => false, 'error' => "Не удалось войти в GoMafia ($diag)"];
}


// ==========================================================================
// API call helper
// ==========================================================================

function tryApiCall($url, $body, $contentType, $cookieFile, $nickname) {
    global $UA;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_COOKIEJAR      => $cookieFile,
        CURLOPT_COOKIEFILE     => $cookieFile,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => [
            "Content-Type: $contentType",
            'Accept: application/json, text/plain, */*',
            'Origin: https://gomafia.pro',
            'Referer: https://gomafia.pro/login',
            "User-Agent: $UA",
        ],
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);

    if (!$resp) return null;
    $data = json_decode($resp, true);
    if (!$data) return null;

    // Skip known "not found" / "wrong" errors
    if (isset($data['error']) && in_array($data['error'], ['method_not_found', 'wrong_method', 'method_is_not_post'])) {
        return null;
    }

    // Success indicators
    if (isset($data['result']) && $data['result'] === 'ok') {
        $profile = extractProfileAnywhere($data);
        return ['success' => true, 'profile' => $profile ?: ['nickname' => $nickname, 'avatar' => null]];
    }
    if (isset($data['token']) || isset($data['accessToken']) || isset($data['access_token'])) {
        $profile = extractProfileAnywhere($data);
        return ['success' => true, 'profile' => $profile ?: ['nickname' => $nickname, 'avatar' => null]];
    }
    if (isset($data['user']) && is_array($data['user'])) {
        return ['success' => true, 'profile' => extractProfileFromData($data['user']) ?: ['nickname' => $nickname, 'avatar' => null]];
    }
    if (isset($data['success']) && $data['success'] === true) {
        $profile = extractProfileAnywhere($data);
        return ['success' => true, 'profile' => $profile ?: ['nickname' => $nickname, 'avatar' => null]];
    }

    // Clear wrong-password errors → stop
    if (isset($data['error']) && (
        stripos($data['error'], 'password') !== false ||
        stripos($data['error'], 'пароль') !== false ||
        stripos($data['error'], 'credentials') !== false ||
        stripos($data['error'], 'not_found') !== false ||
        stripos($data['error'], 'wrong_password') !== false
    )) {
        return ['success' => false, 'error' => $data['error']];
    }

    return null;
}


// ==========================================================================
// CSRF Extraction from login page response
// ==========================================================================

function extractCsrfFromResponse($fullResponse, $cookieFile) {
    if (!$fullResponse) return null;

    $headerEnd = strpos($fullResponse, "\r\n\r\n");
    $headers = $headerEnd !== false ? substr($fullResponse, 0, $headerEnd) : '';
    $html = $headerEnd !== false ? substr($fullResponse, $headerEnd + 4) : $fullResponse;

    // From Set-Cookie header
    if (preg_match('/next-auth\.csrf-token=([^;%\s]+)/', $headers, $m)) {
        $val = urldecode($m[1]);
        return explode('|', $val)[0];
    }

    // From __NEXT_DATA__
    if (preg_match('/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s', $html, $m)) {
        $nd = json_decode($m[1], true);
        if (isset($nd['props']['pageProps']['csrfToken'])) return $nd['props']['pageProps']['csrfToken'];
        if (isset($nd['props']['csrfToken'])) return $nd['props']['csrfToken'];
    }

    // From hidden input
    if (preg_match('/name=["\']csrfToken["\'][^>]*value=["\']([\w\-]+)["\']/', $html, $m)) {
        return $m[1];
    }

    // From cookie file
    if (file_exists($cookieFile)) {
        $cookies = file_get_contents($cookieFile);
        if (preg_match('/csrf[_-]token\s+(\S+)/', $cookies, $m)) {
            return explode('|', urldecode($m[1]))[0];
        }
    }

    return null;
}


// ==========================================================================
// Profile fetching
// ==========================================================================

function fetchProfileFromSession($cookieFile) {
    global $UA;

    // Try NextAuth session
    $ch = curl_init('https://gomafia.pro/api/auth/session');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_COOKIEFILE     => $cookieFile,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => ["Accept: application/json", "User-Agent: $UA"],
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);

    if ($resp) {
        $data = json_decode($resp, true);
        if ($data && isset($data['user'])) {
            return extractProfileFromData($data['user']);
        }
        $profile = extractProfileAnywhere($data);
        if ($profile) return $profile;
    }

    // Try profile page
    $ch = curl_init('https://gomafia.pro/profile');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_COOKIEFILE     => $cookieFile,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => ["User-Agent: $UA"],
    ]);
    $html = curl_exec($ch);
    curl_close($ch);

    if ($html && preg_match('/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s', $html, $m)) {
        $data = json_decode($m[1], true);
        $pp = $data['props']['pageProps'] ?? null;
        if ($pp) {
            return extractProfileFromData($pp['user'] ?? $pp['profile'] ?? $pp['serverData'] ?? $pp);
        }
    }

    return null;
}

function extractProfileFromData($data) {
    if (!$data || !is_array($data)) return null;

    $nickname = $data['nickname'] ?? $data['login'] ?? $data['name'] ?? $data['username'] ?? null;
    $avatar = $data['avatar'] ?? $data['avatar_link'] ?? $data['image'] ?? $data['photo'] ?? $data['photoUrl'] ?? null;
    $id = $data['id'] ?? $data['userId'] ?? null;
    $title = $data['title'] ?? $data['rank'] ?? null;

    if (!$nickname && !$avatar) {
        foreach ($data as $val) {
            if (is_array($val)) {
                $found = extractProfileFromData($val);
                if ($found && ($found['nickname'] || $found['avatar'])) return $found;
            }
        }
        return null;
    }

    return compact('nickname', 'avatar', 'id', 'title');
}

function extractProfileAnywhere($data) {
    if (!$data || !is_array($data)) return null;
    if (isset($data['user'])) return extractProfileFromData($data['user']);
    if (isset($data['profile'])) return extractProfileFromData($data['profile']);
    if (isset($data['data']['user'])) return extractProfileFromData($data['data']['user']);
    if (isset($data['data'])) return extractProfileFromData($data['data']);
    return extractProfileFromData($data);
}


// ==========================================================================
// Player lookup (public, no auth needed)
// ==========================================================================

function lookupPlayer($nickname) {
    global $UA;
    $url = "https://gomafia.pro/player/" . urlencode($nickname);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => ["User-Agent: $UA"],
    ]);
    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$html) return null;

    if (preg_match('/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s', $html, $m)) {
        $data = json_decode($m[1], true);
        $pp = $data['props']['pageProps'] ?? null;
        if ($pp) {
            return extractProfileFromData($pp['serverData'] ?? $pp);
        }
    }

    return null;
}


// ==========================================================================
// Diagnostics & Cleanup
// ==========================================================================

function collectDiagnostics($cookieFile, $nickname) {
    global $UA;

    $parts = [];

    // Test different body formats against /api/login
    $tests = [
        ['/api/login', json_encode(['login' => $nickname, 'password' => 'x']), 'application/json'],
        ['/api/login', json_encode(['method' => 'login', 'login' => $nickname, 'password' => 'x']), 'application/json'],
        ['/api/login', http_build_query(['login' => $nickname, 'password' => 'x']), 'application/x-www-form-urlencoded'],
        ['/api/', json_encode(['method' => 'login', 'login' => $nickname, 'password' => 'x']), 'application/json'],
        ['/api/user/login', json_encode(['login' => $nickname, 'password' => 'x']), 'application/json'],
    ];

    foreach ($tests as [$path, $body, $ct]) {
        $ch = curl_init("https://gomafia.pro$path");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_HTTPHEADER     => ["Content-Type: $ct", "User-Agent: $UA"],
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $parts[] = "$path($ct): $code " . substr($resp ?: '', 0, 60);
    }

    return implode(' | ', $parts);
}

function cleanup($cookieFile) {
    if ($cookieFile && file_exists($cookieFile)) {
        @unlink($cookieFile);
    }
}
