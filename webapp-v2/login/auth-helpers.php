<?php
// =====================================================
// Auth Helpers — multi-method authentication
// Supports: Telegram, GoMafia, PassKey (WebAuthn)
// =====================================================

require_once __DIR__ . '/auth-config.php';

if (!extension_loaded('pdo_mysql')) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode([
        'error' => 'На сервере не установлено расширение pdo_mysql. Установите: sudo apt install php8.2-mysql && sudo systemctl restart php8.2-fpm'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$_savedCwd = getcwd();
chdir(__DIR__ . '/../api');
try {
    require_once __DIR__ . '/../api/db.php';
} catch (\Throwable $e) {
    chdir($_savedCwd);
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}
chdir($_savedCwd);

// Table names
$TABLE_AUTH_SESSIONS = 'auth_sessions';
$TABLE_AUTH_CODES = 'auth_codes';
$TABLE_USERS = 'users';
$TABLE_USER_PASSKEYS = 'user_passkeys';
$TABLE_AUTH_CHALLENGES = 'auth_challenges';

// =====================================================
// Auto-migration
// =====================================================
try {
    // Users table — universal identity linking all auth methods
    $database->pdo->exec("
        CREATE TABLE IF NOT EXISTS `{$TABLE_USERS}` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `telegram_id` bigint(20) DEFAULT NULL,
            `telegram_username` varchar(255) DEFAULT NULL,
            `telegram_first_name` varchar(255) DEFAULT NULL,
            `telegram_last_name` varchar(255) DEFAULT NULL,
            `gomafia_id` varchar(100) DEFAULT NULL,
            `gomafia_nickname` varchar(255) DEFAULT NULL,
            `display_name` varchar(255) DEFAULT NULL,
            `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `telegram_id` (`telegram_id`),
            UNIQUE KEY `gomafia_id` (`gomafia_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    // Auth sessions
    $database->pdo->exec("
        CREATE TABLE IF NOT EXISTS `{$TABLE_AUTH_SESSIONS}` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `token` varchar(128) NOT NULL,
            `user_id` int(11) DEFAULT NULL,
            `auth_method` varchar(20) NOT NULL DEFAULT 'telegram',
            `telegram_id` bigint(20) DEFAULT NULL,
            `telegram_username` varchar(255) DEFAULT NULL,
            `telegram_first_name` varchar(255) DEFAULT NULL,
            `telegram_last_name` varchar(255) DEFAULT NULL,
            `user_agent` text DEFAULT NULL,
            `ip_address` varchar(45) DEFAULT NULL,
            `device_name` varchar(255) DEFAULT NULL,
            `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `expires_at` datetime NOT NULL,
            `last_active` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `token` (`token`),
            KEY `telegram_id` (`telegram_id`),
            KEY `user_id` (`user_id`),
            KEY `expires_at` (`expires_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    // Migration for existing auth_sessions: add user_id, auth_method columns
    $columns = $database->pdo->query("SHOW COLUMNS FROM `{$TABLE_AUTH_SESSIONS}`")->fetchAll(\PDO::FETCH_COLUMN);
    if (!in_array('user_agent', $columns)) {
        $database->pdo->exec("ALTER TABLE `{$TABLE_AUTH_SESSIONS}` ADD COLUMN `user_agent` text DEFAULT NULL AFTER `telegram_last_name`");
        $database->pdo->exec("ALTER TABLE `{$TABLE_AUTH_SESSIONS}` ADD COLUMN `ip_address` varchar(45) DEFAULT NULL AFTER `user_agent`");
        $database->pdo->exec("ALTER TABLE `{$TABLE_AUTH_SESSIONS}` ADD COLUMN `device_name` varchar(255) DEFAULT NULL AFTER `ip_address`");
    }
    if (!in_array('user_id', $columns)) {
        $database->pdo->exec("ALTER TABLE `{$TABLE_AUTH_SESSIONS}` ADD COLUMN `user_id` int(11) DEFAULT NULL AFTER `token`");
        $database->pdo->exec("ALTER TABLE `{$TABLE_AUTH_SESSIONS}` ADD KEY `user_id` (`user_id`)");
    }
    if (!in_array('auth_method', $columns)) {
        $database->pdo->exec("ALTER TABLE `{$TABLE_AUTH_SESSIONS}` ADD COLUMN `auth_method` varchar(20) NOT NULL DEFAULT 'telegram' AFTER `user_id`");
    }
    // Allow NULL telegram_id for GoMafia/PassKey auth sessions
    try {
        $database->pdo->exec("ALTER TABLE `{$TABLE_AUTH_SESSIONS}` MODIFY COLUMN `telegram_id` bigint(20) DEFAULT NULL");
    } catch (\Throwable $e) {
        // Already nullable or other non-critical error
    }

    // Auth codes (for Telegram browser login)
    $database->pdo->exec("
        CREATE TABLE IF NOT EXISTS `{$TABLE_AUTH_CODES}` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `code` varchar(4) NOT NULL,
            `telegram_id` bigint(20) DEFAULT NULL,
            `token` varchar(128) DEFAULT NULL,
            `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `expires_at` datetime NOT NULL,
            `confirmed_at` datetime DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `code` (`code`),
            KEY `expires_at` (`expires_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    // Auth codes: add user_id for Telegram linking flow
    $codeColumns = $database->pdo->query("SHOW COLUMNS FROM `{$TABLE_AUTH_CODES}`")->fetchAll(\PDO::FETCH_COLUMN);
    if (!in_array('user_id', $codeColumns)) {
        $database->pdo->exec("ALTER TABLE `{$TABLE_AUTH_CODES}` ADD COLUMN `user_id` int(11) DEFAULT NULL AFTER `code`");
    }

    // PassKey credentials (WebAuthn)
    $database->pdo->exec("
        CREATE TABLE IF NOT EXISTS `{$TABLE_USER_PASSKEYS}` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `user_id` int(11) NOT NULL,
            `credential_id` varchar(512) NOT NULL,
            `public_key` text NOT NULL,
            `algorithm` int(11) NOT NULL DEFAULT -7,
            `counter` int(10) unsigned NOT NULL DEFAULT 0,
            `transports` text DEFAULT NULL,
            `device_name` varchar(255) DEFAULT NULL,
            `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `last_used_at` datetime DEFAULT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `credential_id` (`credential_id`),
            KEY `user_id` (`user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    // WebAuthn challenges (temporary, short-lived)
    $database->pdo->exec("
        CREATE TABLE IF NOT EXISTS `{$TABLE_AUTH_CHALLENGES}` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `challenge` varchar(255) NOT NULL,
            `user_id` int(11) DEFAULT NULL,
            `type` varchar(20) NOT NULL,
            `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `expires_at` datetime NOT NULL,
            PRIMARY KEY (`id`),
            KEY `challenge` (`challenge`),
            KEY `expires_at` (`expires_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
} catch (\Throwable $e) {
    error_log('Auth migration error: ' . $e->getMessage());
}

// =====================================================
// Utility functions
// =====================================================

function setJsonHeaders() {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError($message, $code = 400) {
    jsonResponse(['error' => $message], $code);
}

function generateToken() {
    return bin2hex(random_bytes(48));
}

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
}

function generateUniqueCode($database) {
    global $TABLE_AUTH_CODES;

    $maxAttempts = 50;
    for ($i = 0; $i < $maxAttempts; $i++) {
        $code = str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        $existing = $database->get($TABLE_AUTH_CODES, 'id', [
            'code' => $code,
            'confirmed_at' => null,
            'expires_at[>]' => date('Y-m-d H:i:s')
        ]);
        if (!$existing) {
            return $code;
        }
    }
    return str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT);
}

// =====================================================
// Telegram validation
// =====================================================

function validateTelegramInitData($initData, $botToken) {
    $params = [];
    parse_str($initData, $params);

    if (empty($params['hash'])) {
        return false;
    }

    $hash = $params['hash'];
    unset($params['hash']);
    ksort($params);

    $dataCheckArr = [];
    foreach ($params as $key => $value) {
        $dataCheckArr[] = $key . '=' . $value;
    }
    $dataCheckString = implode("\n", $dataCheckArr);

    $secretKey = hash_hmac('sha256', $botToken, 'WebAppData', true);
    $calculatedHash = bin2hex(hash_hmac('sha256', $dataCheckString, $secretKey, true));

    return hash_equals($calculatedHash, $hash);
}

function extractUserFromInitData($initData) {
    $params = [];
    parse_str($initData, $params);
    if (empty($params['user'])) return null;
    $user = json_decode($params['user'], true);
    if (!$user || empty($user['id'])) return null;
    return $user;
}

// =====================================================
// Device detection
// =====================================================

function parseDeviceName($ua) {
    if (empty($ua)) return 'Неизвестное устройство';

    $device = '';
    $browser = '';

    if (preg_match('/iPad/', $ua)) $device = 'iPad';
    elseif (preg_match('/iPhone/', $ua)) $device = 'iPhone';
    elseif (preg_match('/Macintosh|Mac OS/', $ua)) $device = 'Mac';
    elseif (preg_match('/Android/', $ua)) {
        if (preg_match('/Android[^;]*;\s*([^)]+)\)/', $ua, $m)) {
            $raw = trim(preg_replace('/Build\/.*/', '', $m[1]));
            $device = $raw ?: 'Android';
        } else {
            $device = 'Android';
        }
    }
    elseif (preg_match('/Windows/', $ua)) $device = 'Windows';
    elseif (preg_match('/Linux/', $ua)) $device = 'Linux';
    elseif (preg_match('/CrOS/', $ua)) $device = 'ChromeOS';
    else $device = 'Устройство';

    if (preg_match('/Telegram/', $ua)) $browser = 'Telegram';
    elseif (preg_match('/EdgA?\//', $ua)) $browser = 'Edge';
    elseif (preg_match('/OPR\/|Opera/', $ua)) $browser = 'Opera';
    elseif (preg_match('/YaBrowser/', $ua)) $browser = 'Яндекс';
    elseif (preg_match('/SamsungBrowser/', $ua)) $browser = 'Samsung Browser';
    elseif (preg_match('/Chrome\//', $ua) && !preg_match('/Chromium/', $ua)) $browser = 'Chrome';
    elseif (preg_match('/Safari\//', $ua) && !preg_match('/Chrome/', $ua)) $browser = 'Safari';
    elseif (preg_match('/Firefox\//', $ua)) $browser = 'Firefox';

    if ($browser) return "$device · $browser";
    return $device;
}

// =====================================================
// Users — find or create by auth method
// =====================================================

function findOrCreateUserByTelegram($database, $telegramId, $username = null, $firstName = null, $lastName = null) {
    global $TABLE_USERS;

    $user = $database->get($TABLE_USERS, '*', ['telegram_id' => $telegramId]);

    if ($user) {
        $updates = ['updated_at' => date('Y-m-d H:i:s')];
        if ($username !== null) $updates['telegram_username'] = $username;
        if ($firstName !== null) $updates['telegram_first_name'] = $firstName;
        if ($lastName !== null) $updates['telegram_last_name'] = $lastName;
        $displayName = trim(($firstName ?: '') . ' ' . ($lastName ?: ''));
        if ($displayName) $updates['display_name'] = $displayName;

        $database->update($TABLE_USERS, $updates, ['id' => $user['id']]);
        $user = array_merge($user, $updates);
        return $user;
    }

    $displayName = trim(($firstName ?: '') . ' ' . ($lastName ?: ''));
    $database->insert($TABLE_USERS, [
        'telegram_id' => $telegramId,
        'telegram_username' => $username,
        'telegram_first_name' => $firstName,
        'telegram_last_name' => $lastName,
        'display_name' => $displayName ?: "User $telegramId",
        'created_at' => date('Y-m-d H:i:s'),
    ]);

    return $database->get($TABLE_USERS, '*', ['telegram_id' => $telegramId]);
}

function findOrCreateUserByGomafia($database, $gomafiaId, $nickname = null) {
    global $TABLE_USERS;

    $gomafiaId = (string)$gomafiaId;
    $user = $database->get($TABLE_USERS, '*', ['gomafia_id' => $gomafiaId]);

    if ($user) {
        $updates = ['updated_at' => date('Y-m-d H:i:s')];
        if ($nickname) $updates['gomafia_nickname'] = $nickname;
        if ($nickname && empty($user['display_name'])) $updates['display_name'] = $nickname;
        $database->update($TABLE_USERS, $updates, ['id' => $user['id']]);
        $user = array_merge($user, $updates);
        return $user;
    }

    $database->insert($TABLE_USERS, [
        'gomafia_id' => $gomafiaId,
        'gomafia_nickname' => $nickname,
        'display_name' => $nickname ?: "GoMafia $gomafiaId",
        'created_at' => date('Y-m-d H:i:s'),
    ]);

    return $database->get($TABLE_USERS, '*', ['gomafia_id' => $gomafiaId]);
}

function getUserById($database, $userId) {
    global $TABLE_USERS;
    return $database->get($TABLE_USERS, '*', ['id' => $userId]);
}

// =====================================================
// Sessions
// =====================================================

function createSession($database, $userId, $authMethod = 'telegram', $userAgent = null, $ipAddress = null) {
    global $TABLE_AUTH_SESSIONS, $TABLE_USERS;

    $user = getUserById($database, $userId);
    if (!$user) return null;

    $token = generateToken();
    $expiresAt = date('Y-m-d H:i:s', time() + SESSION_TTL_DAYS * 24 * 60 * 60);

    if ($userAgent === null) $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
    if ($ipAddress === null) $ipAddress = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
    if ($ipAddress && strpos($ipAddress, ',') !== false) {
        $ipAddress = trim(explode(',', $ipAddress)[0]);
    }

    $database->insert($TABLE_AUTH_SESSIONS, [
        'token' => $token,
        'user_id' => $userId,
        'auth_method' => $authMethod,
        'telegram_id' => $user['telegram_id'],
        'telegram_username' => $user['telegram_username'],
        'telegram_first_name' => $user['telegram_first_name'],
        'telegram_last_name' => $user['telegram_last_name'],
        'user_agent' => $userAgent,
        'ip_address' => $ipAddress,
        'device_name' => parseDeviceName($userAgent),
        'created_at' => date('Y-m-d H:i:s'),
        'expires_at' => $expiresAt,
        'last_active' => date('Y-m-d H:i:s')
    ]);

    return $token;
}

function validateSession($database, $token) {
    global $TABLE_AUTH_SESSIONS, $TABLE_USERS;

    if (empty($token)) return null;

    $session = $database->get($TABLE_AUTH_SESSIONS, [
        'id', 'token', 'user_id', 'auth_method',
        'telegram_id', 'telegram_username',
        'telegram_first_name', 'telegram_last_name', 'expires_at'
    ], [
        'token' => $token,
        'expires_at[>]' => date('Y-m-d H:i:s')
    ]);

    if (!$session) return null;

    // Lazy migration: backfill user_id for pre-migration sessions
    if (empty($session['user_id']) && !empty($session['telegram_id'])) {
        $user = findOrCreateUserByTelegram(
            $database,
            $session['telegram_id'],
            $session['telegram_username'],
            $session['telegram_first_name'],
            $session['telegram_last_name']
        );
        if ($user) {
            $database->update($TABLE_AUTH_SESSIONS, ['user_id' => $user['id']], ['id' => $session['id']]);
            $session['user_id'] = $user['id'];
        }
    }

    // Sliding expiration + device backfill
    $updateData = [
        'last_active' => date('Y-m-d H:i:s'),
        'expires_at' => date('Y-m-d H:i:s', time() + SESSION_TTL_DAYS * 24 * 60 * 60)
    ];

    $existingDevice = $database->get($TABLE_AUTH_SESSIONS, 'device_name', ['id' => $session['id']]);
    if (empty($existingDevice)) {
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
        if ($ip && strpos($ip, ',') !== false) $ip = trim(explode(',', $ip)[0]);
        $updateData['user_agent'] = $ua;
        $updateData['ip_address'] = $ip;
        $updateData['device_name'] = parseDeviceName($ua);
    }

    $database->update($TABLE_AUTH_SESSIONS, $updateData, ['id' => $session['id']]);

    return $session;
}

// =====================================================
// WebAuthn / PassKey helpers
// =====================================================

function createChallenge($database, $type, $userId = null) {
    global $TABLE_AUTH_CHALLENGES;

    $challenge = base64url_encode(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', time() + CHALLENGE_TTL_SECONDS);

    $database->insert($TABLE_AUTH_CHALLENGES, [
        'challenge' => $challenge,
        'user_id' => $userId,
        'type' => $type,
        'created_at' => date('Y-m-d H:i:s'),
        'expires_at' => $expiresAt,
    ]);

    return $challenge;
}

function validateAndConsumeChallenge($database, $challenge, $type) {
    global $TABLE_AUTH_CHALLENGES;

    $row = $database->get($TABLE_AUTH_CHALLENGES, 'id', [
        'challenge' => $challenge,
        'type' => $type,
        'expires_at[>]' => date('Y-m-d H:i:s')
    ]);

    if (!$row) return false;

    $database->delete($TABLE_AUTH_CHALLENGES, ['id' => $row]);
    return true;
}

function getUserPasskeys($database, $userId) {
    global $TABLE_USER_PASSKEYS;
    return $database->select($TABLE_USER_PASSKEYS, [
        'id', 'credential_id', 'public_key', 'algorithm', 'counter', 'transports', 'device_name', 'created_at', 'last_used_at'
    ], [
        'user_id' => $userId
    ]);
}

function getPasskeyByCredentialId($database, $credentialId) {
    global $TABLE_USER_PASSKEYS;
    return $database->get($TABLE_USER_PASSKEYS, '*', [
        'credential_id' => $credentialId
    ]);
}

function getAllPasskeyCredentialIds($database) {
    global $TABLE_USER_PASSKEYS;
    return $database->select($TABLE_USER_PASSKEYS, ['credential_id', 'transports', 'user_id'], []);
}

/**
 * Convert IEEE P1363 ECDSA signature (r||s) to DER format for openssl_verify
 */
function ecSignatureToDer($signature) {
    $length = strlen($signature);
    $half = intdiv($length, 2);
    $r = substr($signature, 0, $half);
    $s = substr($signature, $half);

    $r = ltrim($r, "\x00");
    if ($r === '') $r = "\x00";
    if (ord($r[0]) & 0x80) $r = "\x00" . $r;

    $s = ltrim($s, "\x00");
    if ($s === '') $s = "\x00";
    if (ord($s[0]) & 0x80) $s = "\x00" . $s;

    $rLen = strlen($r);
    $sLen = strlen($s);

    return "\x30" . chr($rLen + $sLen + 4) . "\x02" . chr($rLen) . $r . "\x02" . chr($sLen) . $s;
}

/**
 * Verify a WebAuthn assertion signature
 */
function verifyWebAuthnSignature($authenticatorData, $clientDataJSON, $signature, $publicKeyPem, $algorithm) {
    $clientDataHash = hash('sha256', $clientDataJSON, true);
    $signedData = $authenticatorData . $clientDataHash;

    if ($algorithm === -7) {
        // ES256 — signature is IEEE P1363, convert to DER
        $derSignature = ecSignatureToDer($signature);
        return openssl_verify($signedData, $derSignature, $publicKeyPem, OPENSSL_ALGO_SHA256) === 1;
    } elseif ($algorithm === -257) {
        // RS256
        return openssl_verify($signedData, $signature, $publicKeyPem, OPENSSL_ALGO_SHA256) === 1;
    }

    return false;
}

/**
 * Convert raw SPKI DER bytes to PEM format for openssl
 */
function spkiToPem($spkiDer) {
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spkiDer), 64, "\n") . "-----END PUBLIC KEY-----\n";
}

/**
 * Build user response object (used in session-validate and auth responses)
 */
function buildUserResponse($database, $session) {
    global $TABLE_USERS;

    $response = [
        'id' => $session['telegram_id'] ?? null,
        'user_id' => $session['user_id'] ?? null,
        'username' => $session['telegram_username'] ?? null,
        'first_name' => $session['telegram_first_name'] ?? null,
        'last_name' => $session['telegram_last_name'] ?? null,
        'auth_method' => $session['auth_method'] ?? 'telegram',
    ];

    if (!empty($session['user_id'])) {
        $user = getUserById($database, $session['user_id']);
        if ($user) {
            $response['user_id'] = (int)$user['id'];
            $response['display_name'] = $user['display_name'];
            $response['telegram_linked'] = !empty($user['telegram_id']);
            $response['gomafia_linked'] = !empty($user['gomafia_id']);
            $response['gomafia_nickname'] = $user['gomafia_nickname'];

            $hasPasskeys = $database->count('user_passkeys', ['user_id' => $user['id']]);
            $response['passkey_linked'] = $hasPasskeys > 0;

            if (!empty($user['telegram_id'])) {
                $response['id'] = $user['telegram_id'];
                $response['username'] = $user['telegram_username'];
                $response['first_name'] = $user['telegram_first_name'];
                $response['last_name'] = $user['telegram_last_name'];
            }
        }
    }

    return $response;
}

// =====================================================
// Cleanup
// =====================================================

function cleanupExpired($database) {
    global $TABLE_AUTH_SESSIONS, $TABLE_AUTH_CODES, $TABLE_AUTH_CHALLENGES;

    $now = date('Y-m-d H:i:s');
    $database->delete($TABLE_AUTH_SESSIONS, ['expires_at[<]' => $now]);
    $database->delete($TABLE_AUTH_CODES, ['expires_at[<]' => $now]);
    $database->delete($TABLE_AUTH_CHALLENGES, ['expires_at[<]' => $now]);
}
