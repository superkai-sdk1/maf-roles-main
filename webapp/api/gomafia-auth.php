<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
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

if ($action === 'login') {
    $nickname = isset($_POST['nickname']) ? trim($_POST['nickname']) : '';
    $password = isset($_POST['password']) ? $_POST['password'] : '';

    if (!$nickname || !$password) {
        echo json_encode(['success' => false, 'error' => 'Введите никнейм и пароль']);
        exit();
    }

    $cookieFile = tempnam(sys_get_temp_dir(), 'gm_');

    try {
        $csrfToken = getCSRFToken($cookieFile);
        if (!$csrfToken) {
            // Diagnostic: check what gomafia returns
            $diag = '';
            $ch = curl_init('https://gomafia.pro/api/auth/csrf');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_HTTPHEADER => [
                    'Accept: application/json',
                    'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                ],
            ]);
            $resp = curl_exec($ch);
            $err = curl_error($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($err) {
                $diag = "curl error: $err";
            } else {
                $diag = "HTTP $code, body: " . substr($resp, 0, 200);
            }
            echo json_encode(['success' => false, 'error' => "Не удалось получить CSRF токен ($diag)"]);
            cleanup($cookieFile);
            exit();
        }

        $loginResult = doLogin($cookieFile, $csrfToken, $nickname, $password);
        if (!$loginResult['success']) {
            echo json_encode(['success' => false, 'error' => $loginResult['error'] ?? 'Неверный никнейм или пароль']);
            cleanup($cookieFile);
            exit();
        }

        $profile = fetchProfile($cookieFile);
        cleanup($cookieFile);

        if ($profile) {
            echo json_encode([
                'success' => true,
                'profile' => $profile
            ]);
        } else {
            echo json_encode([
                'success' => true,
                'profile' => [
                    'nickname' => $nickname,
                    'avatar' => null
                ]
            ]);
        }

    } catch (Exception $e) {
        cleanup($cookieFile);
        echo json_encode(['success' => false, 'error' => 'Ошибка авторизации: ' . $e->getMessage()]);
    }
    exit();
}

if ($action === 'lookup') {
    $nickname = isset($_REQUEST['nickname']) ? trim($_REQUEST['nickname']) : '';
    if (!$nickname) {
        echo json_encode(['success' => false, 'error' => 'Введите никнейм']);
        exit();
    }

    $profile = lookupPlayer($nickname);
    echo json_encode($profile ? ['success' => true, 'profile' => $profile] : ['success' => false, 'error' => 'Игрок не найден']);
    exit();
}

echo json_encode(['success' => false, 'error' => 'Unknown action']);

// --- Helper functions ---

function getCSRFToken($cookieFile) {
    $userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    // Strategy 1: NextAuth CSRF API
    $ch = curl_init('https://gomafia.pro/api/auth/csrf');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_COOKIEJAR => $cookieFile,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json, text/plain, */*',
            "User-Agent: $userAgent",
            'Referer: https://gomafia.pro/login',
            'Origin: https://gomafia.pro',
        ],
    ]);
    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);
        if (isset($data['csrfToken'])) {
            return $data['csrfToken'];
        }
    }

    // Strategy 2: Load login page, extract CSRF from cookies + __NEXT_DATA__
    $ch = curl_init('https://gomafia.pro/login');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_COOKIEJAR => $cookieFile,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HEADER => true,
        CURLOPT_HTTPHEADER => [
            "User-Agent: $userAgent",
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: ru-RU,ru;q=0.9,en;q=0.8',
        ],
    ]);
    $fullResponse = curl_exec($ch);
    curl_close($ch);

    if ($fullResponse) {
        $headerSize = strpos($fullResponse, "\r\n\r\n");
        $headers = substr($fullResponse, 0, $headerSize);
        $html = substr($fullResponse, $headerSize + 4);

        // Try extracting csrf-token from Set-Cookie header
        if (preg_match('/next-auth\.csrf-token=([^;%]+)/', $headers, $m)) {
            return urldecode(explode('|', $m[1])[0]);
        }

        // Try __NEXT_DATA__
        if (preg_match('/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s', $html, $m)) {
            $nd = json_decode($m[1], true);
            if (isset($nd['props']['pageProps']['csrfToken'])) {
                return $nd['props']['pageProps']['csrfToken'];
            }
            // Some NextAuth versions put it at different paths
            if (isset($nd['props']['csrfToken'])) {
                return $nd['props']['csrfToken'];
            }
        }

        // Try any csrfToken pattern in HTML
        if (preg_match('/csrfToken["\s:=]+["\']([\w\-]+)["\']/', $html, $m)) {
            return $m[1];
        }

        // Try input hidden field
        if (preg_match('/name=["\']csrfToken["\'][^>]*value=["\']([\w\-]+)["\']/', $html, $m)) {
            return $m[1];
        }
    }

    // Strategy 3: Read csrf-token from cookie file directly
    if (file_exists($cookieFile)) {
        $cookies = file_get_contents($cookieFile);
        if (preg_match('/next-auth\.csrf-token\s+(\S+)/', $cookies, $m)) {
            return explode('|', urldecode($m[1]))[0];
        }
        // Also check for __Host-next-auth or __Secure- prefixes
        if (preg_match('/(csrf-token|csrfToken)\s+(\S+)/', $cookies, $m)) {
            return explode('|', urldecode($m[2]))[0];
        }
    }

    // Strategy 4: Retry CSRF API with cookies from login page
    $ch = curl_init('https://gomafia.pro/api/auth/csrf');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_COOKIEJAR => $cookieFile,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json, text/plain, */*',
            "User-Agent: $userAgent",
            'Referer: https://gomafia.pro/login',
            'Origin: https://gomafia.pro',
        ],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);
        if (isset($data['csrfToken'])) {
            return $data['csrfToken'];
        }
    }

    return null;
}

function doLogin($cookieFile, $csrfToken, $nickname, $password) {
    // NextAuth credentials callback
    $postData = http_build_query([
        'nickname' => $nickname,
        'password' => $password,
        'csrfToken' => $csrfToken,
        'callbackUrl' => 'https://gomafia.pro/profile',
        'json' => 'true',
    ]);

    $ch = curl_init('https://gomafia.pro/api/auth/callback/credentials');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $postData,
        CURLOPT_COOKIEJAR => $cookieFile,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HEADER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/x-www-form-urlencoded',
            'Origin: https://gomafia.pro',
            'Referer: https://gomafia.pro/login',
            'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ],
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // NextAuth returns 302 redirect on success, 200/401 on failure
    if ($httpCode === 302 || $httpCode === 301) {
        return ['success' => true];
    }

    // Some setups return 200 with a URL field on success
    if ($httpCode === 200 && $response) {
        $headerSize = strpos($response, "\r\n\r\n");
        $body = substr($response, $headerSize + 4);
        $data = json_decode($body, true);
        if ($data && isset($data['url']) && !isset($data['error'])) {
            return ['success' => true];
        }
        if ($data && isset($data['error'])) {
            return ['success' => false, 'error' => $data['error']];
        }
    }

    // Try alternative login endpoint
    $altResult = tryAlternativeLogin($cookieFile, $nickname, $password);
    if ($altResult['success']) {
        return $altResult;
    }

    return ['success' => false, 'error' => 'Неверный никнейм или пароль'];
}

function tryAlternativeLogin($cookieFile, $nickname, $password) {
    $postData = json_encode([
        'nickname' => $nickname,
        'password' => $password,
    ]);

    $endpoints = [
        'https://gomafia.pro/api/login',
        'https://gomafia.pro/api/auth/login',
        'https://gomafia.pro/api/v1/auth/login',
    ];

    foreach ($endpoints as $url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $postData,
            CURLOPT_COOKIEJAR => $cookieFile,
            CURLOPT_COOKIEFILE => $cookieFile,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Origin: https://gomafia.pro',
                'Referer: https://gomafia.pro/login',
                'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $response) {
            $data = json_decode($response, true);
            if ($data && (isset($data['token']) || isset($data['user']) || isset($data['success']))) {
                return ['success' => true, 'data' => $data];
            }
        }
    }

    return ['success' => false];
}

function fetchProfile($cookieFile) {
    // Try session endpoint first (NextAuth)
    $ch = curl_init('https://gomafia.pro/api/auth/session');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
        $session = json_decode($response, true);
        if ($session && isset($session['user'])) {
            $user = $session['user'];
            return [
                'nickname' => $user['nickname'] ?? $user['name'] ?? $user['login'] ?? null,
                'avatar' => $user['image'] ?? $user['avatar'] ?? $user['avatar_link'] ?? $user['photo'] ?? null,
                'id' => $user['id'] ?? null,
                'title' => $user['title'] ?? null,
            ];
        }
    }

    // Fallback: parse profile page HTML
    $ch = curl_init('https://gomafia.pro/profile');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ],
    ]);
    $html = curl_exec($ch);
    curl_close($ch);

    if (!$html) return null;

    // Parse __NEXT_DATA__
    if (preg_match('/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/', $html, $m)) {
        $data = json_decode($m[1], true);
        $pp = $data['props']['pageProps'] ?? null;
        if ($pp) {
            $user = $pp['user'] ?? $pp['profile'] ?? $pp['serverData'] ?? $pp;
            return extractProfileFromData($user);
        }
    }

    // Parse meta tags as fallback
    $result = [];
    if (preg_match('/property="og:image"[^>]*content="([^"]+)"/', $html, $m)) {
        $result['avatar'] = $m[1];
    }
    if (preg_match('/property="og:title"[^>]*content="([^"]+)"/', $html, $m)) {
        $result['nickname'] = $m[1];
    }

    return !empty($result) ? $result : null;
}

function extractProfileFromData($data) {
    if (!$data || !is_array($data)) return null;

    $nickname = $data['nickname'] ?? $data['login'] ?? $data['name'] ?? $data['username'] ?? null;
    $avatar = $data['avatar'] ?? $data['avatar_link'] ?? $data['image'] ?? $data['photo'] ?? $data['photoUrl'] ?? null;
    $id = $data['id'] ?? $data['userId'] ?? null;
    $title = $data['title'] ?? $data['rank'] ?? null;

    if (!$nickname && !$avatar) {
        foreach ($data as $key => $val) {
            if (is_array($val)) {
                $found = extractProfileFromData($val);
                if ($found && ($found['nickname'] || $found['avatar'])) return $found;
            }
        }
        return null;
    }

    return compact('nickname', 'avatar', 'id', 'title');
}

function lookupPlayer($nickname) {
    $url = "https://gomafia.pro/player/" . urlencode($nickname);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ],
    ]);
    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$html) return null;

    if (preg_match('/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/', $html, $m)) {
        $data = json_decode($m[1], true);
        $pp = $data['props']['pageProps'] ?? null;
        if ($pp) {
            return extractProfileFromData($pp['serverData'] ?? $pp);
        }
    }

    return null;
}

function cleanup($cookieFile) {
    if ($cookieFile && file_exists($cookieFile)) {
        @unlink($cookieFile);
    }
}
