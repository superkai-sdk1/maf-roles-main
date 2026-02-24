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

