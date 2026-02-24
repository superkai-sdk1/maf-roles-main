<?php
// =====================================================
// Auth Helpers - утилиты для авторизации
// =====================================================

require_once __DIR__ . '/auth-config.php';

// Проверяем наличие PDO MySQL драйвера
if (!extension_loaded('pdo_mysql')) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode([
        'error' => 'На сервере не установлено расширение pdo_mysql. Установите: sudo apt install php8.2-mysql && sudo systemctl restart php8.2-fpm'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// db.php использует relative require для medoo.php, поэтому меняем рабочую директорию
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

// Таблицы
$TABLE_AUTH_SESSIONS = 'auth_sessions';
$TABLE_AUTH_CODES = 'auth_codes';

// Автоматическая миграция — создаём таблицы если их нет
try {
    $database->pdo->exec("
        CREATE TABLE IF NOT EXISTS `{$TABLE_AUTH_SESSIONS}` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `token` varchar(128) NOT NULL,
            `telegram_id` bigint(20) NOT NULL,
            `telegram_username` varchar(255) DEFAULT NULL,
            `telegram_first_name` varchar(255) DEFAULT NULL,
            `telegram_last_name` varchar(255) DEFAULT NULL,
            `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `expires_at` datetime NOT NULL,
            `last_active` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `token` (`token`),
            KEY `telegram_id` (`telegram_id`),
            KEY `expires_at` (`expires_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
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
} catch (\Throwable $e) {
    // Миграция не удалась — логируем, но не блокируем (таблицы могут уже существовать)
    error_log('Auth migration error: ' . $e->getMessage());
}

/**
 * Установить JSON заголовки и CORS
 */
function setJsonHeaders() {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

/**
 * Вернуть JSON ответ и завершить скрипт
 */
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Вернуть JSON ошибку
 */
function jsonError($message, $code = 400) {
    jsonResponse(['error' => $message], $code);
}

/**
 * Генерация безопасного токена сессии
 */
function generateToken() {
    return bin2hex(random_bytes(48));
}

/**
 * Генерация уникального 4-значного кода (проверка на дубликаты среди активных кодов)
 */
function generateUniqueCode($database) {
    global $TABLE_AUTH_CODES;

    $maxAttempts = 50;
    for ($i = 0; $i < $maxAttempts; $i++) {
        $code = str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT);

        // Проверяем, нет ли активного неподтверждённого кода с таким же значением
        $existing = $database->get($TABLE_AUTH_CODES, 'id', [
            'code' => $code,
            'confirmed_at' => null,
            'expires_at[>]' => date('Y-m-d H:i:s')
        ]);

        if (!$existing) {
            return $code;
        }
    }

    // Если после 50 попыток не нашли уникальный - возвращаем случайный
    return str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT);
}

/**
 * Валидация Telegram initData по HMAC-SHA256
 * Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateTelegramInitData($initData, $botToken) {
    // Парсим initData как URL-encoded строку
    $params = [];
    parse_str($initData, $params);

    if (empty($params['hash'])) {
        return false;
    }

    $hash = $params['hash'];
    unset($params['hash']);

    // Сортируем параметры по ключу
    ksort($params);

    // Создаём строку для проверки
    $dataCheckArr = [];
    foreach ($params as $key => $value) {
        $dataCheckArr[] = $key . '=' . $value;
    }
    $dataCheckString = implode("\n", $dataCheckArr);

    // Генерируем secret key: HMAC-SHA256 от bot token с ключом "WebAppData"
    $secretKey = hash_hmac('sha256', $botToken, 'WebAppData', true);

    // Вычисляем HMAC от data-check-string
    $calculatedHash = bin2hex(hash_hmac('sha256', $dataCheckString, $secretKey, true));

    return hash_equals($calculatedHash, $hash);
}

/**
 * Извлечь данные пользователя из initData
 */
function extractUserFromInitData($initData) {
    $params = [];
    parse_str($initData, $params);

    if (empty($params['user'])) {
        return null;
    }

    $user = json_decode($params['user'], true);
    if (!$user || empty($user['id'])) {
        return null;
    }

    return $user;
}

/**
 * Создать или обновить сессию для пользователя
 */
function createSession($database, $telegramId, $username = null, $firstName = null, $lastName = null) {
    global $TABLE_AUTH_SESSIONS;

    $token = generateToken();
    $expiresAt = date('Y-m-d H:i:s', time() + SESSION_TTL_DAYS * 24 * 60 * 60);

    $database->insert($TABLE_AUTH_SESSIONS, [
        'token' => $token,
        'telegram_id' => $telegramId,
        'telegram_username' => $username,
        'telegram_first_name' => $firstName,
        'telegram_last_name' => $lastName,
        'created_at' => date('Y-m-d H:i:s'),
        'expires_at' => $expiresAt,
        'last_active' => date('Y-m-d H:i:s')
    ]);

    return $token;
}

/**
 * Валидация токена сессии
 */
function validateSession($database, $token) {
    global $TABLE_AUTH_SESSIONS;

    if (empty($token)) {
        return null;
    }

    $session = $database->get($TABLE_AUTH_SESSIONS, [
        'id', 'token', 'telegram_id', 'telegram_username',
        'telegram_first_name', 'telegram_last_name', 'expires_at'
    ], [
        'token' => $token,
        'expires_at[>]' => date('Y-m-d H:i:s')
    ]);

    if (!$session) {
        return null;
    }

    // Обновляем last_active (sliding expiration)
    $database->update($TABLE_AUTH_SESSIONS, [
        'last_active' => date('Y-m-d H:i:s'),
        'expires_at' => date('Y-m-d H:i:s', time() + SESSION_TTL_DAYS * 24 * 60 * 60)
    ], [
        'id' => $session['id']
    ]);

    return $session;
}

/**
 * Очистка просроченных записей
 */
function cleanupExpired($database) {
    global $TABLE_AUTH_SESSIONS, $TABLE_AUTH_CODES;

    $now = date('Y-m-d H:i:s');

    $database->delete($TABLE_AUTH_SESSIONS, [
        'expires_at[<]' => $now
    ]);

    $database->delete($TABLE_AUTH_CODES, [
        'expires_at[<]' => $now
    ]);
}


