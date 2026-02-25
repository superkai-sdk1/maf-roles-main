<?php
// Reusable GoMafia login & lookup functions
// Extracted from gomafia-auth.php for use in both API and auth endpoints

$GM_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function doFullLogin($cookieFile, $nickname, $password) {
    global $GM_UA;

    $bodyVariants = [
        json_encode(['nickname' => $nickname, 'password' => $password]),
        json_encode(['login' => $nickname, 'password' => $password]),
        json_encode(['username' => $nickname, 'password' => $password]),
        json_encode(['email' => $nickname, 'password' => $password]),
        json_encode(['nick' => $nickname, 'pass' => $password]),
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

    $formVariants = [
        http_build_query(['nickname' => $nickname, 'password' => $password]),
        http_build_query(['login' => $nickname, 'password' => $password]),
    ];

    foreach ($urlVariants as $url) {
        foreach ($bodyVariants as $body) {
            $result = gmTryApiCall($url, $body, 'application/json', $cookieFile, $nickname);
            if ($result) return $result;
        }
    }

    foreach ($formVariants as $body) {
        $result = gmTryApiCall('https://gomafia.pro/api/login', $body, 'application/x-www-form-urlencoded', $cookieFile, $nickname);
        if ($result) return $result;
    }

    $formEndpoints = [
        'https://gomafia.pro/api/auth/callback/credentials',
        'https://gomafia.pro/api/auth/callback/login',
    ];

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
            "User-Agent: $GM_UA",
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ],
    ]);
    $fullResp = curl_exec($ch);
    curl_close($ch);

    $csrfToken = gmExtractCsrfFromResponse($fullResp, $cookieFile);

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
                "User-Agent: $GM_UA",
            ],
        ]);
        $resp = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 302 || $httpCode === 301) {
            $profile = gmFetchProfileFromSession($cookieFile);
            return ['success' => true, 'profile' => $profile ?: ['nickname' => $nickname, 'avatar' => null]];
        }

        if ($httpCode === 200 && $resp) {
            $headerEnd = strpos($resp, "\r\n\r\n");
            $body = $headerEnd !== false ? substr($resp, $headerEnd + 4) : $resp;
            $data = json_decode($body, true);
            if ($data && isset($data['url']) && !isset($data['error'])) {
                $profile = gmFetchProfileFromSession($cookieFile);
                return ['success' => true, 'profile' => $profile ?: ['nickname' => $nickname, 'avatar' => null]];
            }
        }
    }

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
            "User-Agent: $GM_UA",
        ],
    ]);
    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $resp) {
        if (strpos($resp, '/profile') !== false || strpos($resp, $nickname) !== false) {
            $profile = gmFetchProfileFromSession($cookieFile);
            if ($profile) {
                return ['success' => true, 'profile' => $profile];
            }
        }
    }

    $diag = gmCollectDiagnostics($cookieFile, $nickname);
    return ['success' => false, 'error' => "Не удалось войти в GoMafia ($diag)"];
}


function gmTryApiCall($url, $body, $contentType, $cookieFile, $nickname) {
    global $GM_UA;

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
            "User-Agent: $GM_UA",
        ],
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);

    if (!$resp) return null;
    $data = json_decode($resp, true);
    if (!$data) return null;

    if (isset($data['error']) && in_array($data['error'], ['method_not_found', 'wrong_method', 'method_is_not_post'])) {
        return null;
    }

    if (isset($data['result']) && $data['result'] === 'ok') {
        $profile = gmExtractProfileAnywhere($data);
        return ['success' => true, 'profile' => $profile ?: ['nickname' => $nickname, 'avatar' => null]];
    }
    if (isset($data['token']) || isset($data['accessToken']) || isset($data['access_token'])) {
        $profile = gmExtractProfileAnywhere($data);
        return ['success' => true, 'profile' => $profile ?: ['nickname' => $nickname, 'avatar' => null]];
    }
    if (isset($data['user']) && is_array($data['user'])) {
        return ['success' => true, 'profile' => gmExtractProfileFromData($data['user']) ?: ['nickname' => $nickname, 'avatar' => null]];
    }
    if (isset($data['success']) && $data['success'] === true) {
        $profile = gmExtractProfileAnywhere($data);
        return ['success' => true, 'profile' => $profile ?: ['nickname' => $nickname, 'avatar' => null]];
    }

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


function gmExtractCsrfFromResponse($fullResponse, $cookieFile) {
    if (!$fullResponse) return null;

    $headerEnd = strpos($fullResponse, "\r\n\r\n");
    $headers = $headerEnd !== false ? substr($fullResponse, 0, $headerEnd) : '';
    $html = $headerEnd !== false ? substr($fullResponse, $headerEnd + 4) : $fullResponse;

    if (preg_match('/next-auth\.csrf-token=([^;%\s]+)/', $headers, $m)) {
        $val = urldecode($m[1]);
        return explode('|', $val)[0];
    }

    if (preg_match('/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s', $html, $m)) {
        $nd = json_decode($m[1], true);
        if (isset($nd['props']['pageProps']['csrfToken'])) return $nd['props']['pageProps']['csrfToken'];
        if (isset($nd['props']['csrfToken'])) return $nd['props']['csrfToken'];
    }

    if (preg_match('/name=["\']csrfToken["\'][^>]*value=["\']([\w\-]+)["\']/', $html, $m)) {
        return $m[1];
    }

    if (file_exists($cookieFile)) {
        $cookies = file_get_contents($cookieFile);
        if (preg_match('/csrf[_-]token\s+(\S+)/', $cookies, $m)) {
            return explode('|', urldecode($m[1]))[0];
        }
    }

    return null;
}


function gmFetchProfileFromSession($cookieFile) {
    global $GM_UA;

    $ch = curl_init('https://gomafia.pro/api/auth/session');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_COOKIEFILE     => $cookieFile,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => ["Accept: application/json", "User-Agent: $GM_UA"],
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);

    if ($resp) {
        $data = json_decode($resp, true);
        if ($data && isset($data['user'])) {
            return gmExtractProfileFromData($data['user']);
        }
        $profile = gmExtractProfileAnywhere($data);
        if ($profile) return $profile;
    }

    $ch = curl_init('https://gomafia.pro/profile');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_COOKIEFILE     => $cookieFile,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => ["User-Agent: $GM_UA"],
    ]);
    $html = curl_exec($ch);
    curl_close($ch);

    if ($html && preg_match('/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s', $html, $m)) {
        $data = json_decode($m[1], true);
        $pp = $data['props']['pageProps'] ?? null;
        if ($pp) {
            return gmExtractProfileFromData($pp['user'] ?? $pp['profile'] ?? $pp['serverData'] ?? $pp);
        }
    }

    return null;
}

function gmExtractProfileFromData($data) {
    if (!$data || !is_array($data)) return null;

    $nickname = $data['nickname'] ?? $data['login'] ?? $data['name'] ?? $data['username'] ?? null;
    $avatar = $data['avatar'] ?? $data['avatar_link'] ?? $data['image'] ?? $data['photo'] ?? $data['photoUrl'] ?? null;
    $id = $data['id'] ?? $data['userId'] ?? null;
    $title = $data['title'] ?? $data['rank'] ?? null;

    if (!$nickname && !$avatar) {
        foreach ($data as $val) {
            if (is_array($val)) {
                $found = gmExtractProfileFromData($val);
                if ($found && ($found['nickname'] || $found['avatar'])) return $found;
            }
        }
        return null;
    }

    return compact('nickname', 'avatar', 'id', 'title');
}

function gmExtractProfileAnywhere($data) {
    if (!$data || !is_array($data)) return null;
    if (isset($data['user'])) return gmExtractProfileFromData($data['user']);
    if (isset($data['profile'])) return gmExtractProfileFromData($data['profile']);
    if (isset($data['data']['user'])) return gmExtractProfileFromData($data['data']['user']);
    if (isset($data['data'])) return gmExtractProfileFromData($data['data']);
    return gmExtractProfileFromData($data);
}


function gmLookupPlayer($nickname) {
    global $GM_UA;
    $url = "https://gomafia.pro/player/" . urlencode($nickname);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => ["User-Agent: $GM_UA"],
    ]);
    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$html) return null;

    if (preg_match('/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s', $html, $m)) {
        $data = json_decode($m[1], true);
        $pp = $data['props']['pageProps'] ?? null;
        if ($pp) {
            return gmExtractProfileFromData($pp['serverData'] ?? $pp);
        }
    }

    return null;
}


function gmCollectDiagnostics($cookieFile, $nickname) {
    global $GM_UA;

    $parts = [];
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
            CURLOPT_HTTPHEADER     => ["Content-Type: $ct", "User-Agent: $GM_UA"],
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $parts[] = "$path($ct): $code " . substr($resp ?: '', 0, 60);
    }

    return implode(' | ', $parts);
}

function gmCleanup($cookieFile) {
    if ($cookieFile && file_exists($cookieFile)) {
        @unlink($cookieFile);
    }
}
