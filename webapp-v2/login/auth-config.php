<?php
// =====================================================
// Auth Configuration
// Настройте эти параметры перед использованием
// =====================================================

// Токен вашего Telegram бота (получите у @BotFather)
define('BOT_TOKEN', '8196046026:AAHP4j4JvjGReMfOiW09LqmrhavXriaPdjk');

// Username бота без @ (например: mafboard_auth_bot)
define('BOT_USERNAME', 'mafboard_bot');

// Время жизни сессии в днях
define('SESSION_TTL_DAYS', 30);

// Время жизни кода авторизации в секундах (5 минут)
define('CODE_TTL_SECONDS', 300);

// Интервал поллинга кода на клиенте (мс) - информационный параметр
define('CODE_POLL_INTERVAL_MS', 2500);

// WebAuthn / PassKey
$_rpHost = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
$_rpHostParts = explode(':', $_rpHost);
define('WEBAUTHN_RP_ID', $_rpHostParts[0]);
define('WEBAUTHN_RP_NAME', 'MafBoard');
$_rpScheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
define('WEBAUTHN_ORIGIN', "{$_rpScheme}://{$_rpHost}");
define('CHALLENGE_TTL_SECONDS', 300);

