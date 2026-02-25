// =====================================================
// Telegram Bot for MafBoard Authentication
// Принимает 4-значные коды от пользователей и подтверждает авторизацию
// =====================================================

const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');

// ======== КОНФИГУРАЦИЯ ========
// Токен бота (тот же что в auth-config.php)
const BOT_TOKEN = process.env.BOT_TOKEN || '8196046026:AAHP4j4JvjGReMfOiW09LqmrhavXriaPdjk';

// URL до API подтверждения кода (адрес вашего сервера)
const CONFIRM_API_URL = process.env.CONFIRM_API_URL || 'https://localhost/login/code-confirm.php';

// Секрет для авторизации запросов к API (SHA256 от BOT_TOKEN)
const crypto = require('crypto');
const BOT_SECRET = crypto.createHash('sha256').update(BOT_TOKEN).digest('hex');
// ==============================

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const recentlyProcessed = new Map();
setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [id, ts] of recentlyProcessed) {
        if (ts < cutoff) recentlyProcessed.delete(id);
    }
}, 60_000);

console.log('🤖 MafBoard Auth Bot запущен...');

// Обработка команды /start
bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param = match[1] ? match[1].trim() : '';

    if (/^\d{4}$/.test(param)) {
        recentlyProcessed.set(msg.message_id, Date.now());
        await handleCode(chatId, msg.from, param);
        return;
    }

    const name = msg.from.first_name || msg.from.username || 'друг';

    bot.sendMessage(chatId,
        `👋 Привет, <b>${escapeHtml(name)}</b>! Добро пожаловать в <b>MafBoard</b>!\n\n` +
        `🎭 <b>MafBoard</b> — это панель ведущего для игры в Мафию.\n\n` +
        `Что умеет панель:\n` +
        `🃏 Раздача и управление ролями\n` +
        `⏱ Таймер для фаз игры\n` +
        `🗳 Голосование и подсчёт голосов\n` +
        `🌙 Ночные действия\n` +
        `👥 База игроков с интеграцией GoMafia\n` +
        `📊 Статистика и итоги игр\n` +
        `🔄 Синхронизация в реальном времени\n\n` +
        `Нажмите кнопку ниже, чтобы узнать как авторизоваться.`,
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔐 Авторизация', callback_data: 'auth_info' }
                ]]
            }
        }
    );
});

// Обработка нажатия кнопки "Авторизация"
bot.on('callback_query', async (query) => {
    if (query.data === 'auth_info') {
        const chatId = query.message.chat.id;

        await bot.answerCallbackQuery(query.id);

        bot.sendMessage(chatId,
            `🔐 <b>Как авторизоваться в MafBoard</b>\n\n` +
            `<b>Способ 1 — Telegram Mini App (самый простой):</b>\n` +
            `Откройте панель прямо в Telegram — авторизация произойдёт автоматически.\n\n` +
            `<b>Способ 2 — Через браузер:</b>\n` +
            `1. Откройте панель в браузере\n` +
            `2. На экране входа появится 4-значный код\n` +
            `3. Отправьте этот код мне в чат\n` +
            `4. Готово — панель авторизуется автоматически!\n\n` +
            `📝 Вы также можете просто отправить мне 4-значный код прямо сейчас.`,
            { parse_mode: 'HTML' }
        );
    }
});

// Обработка текстовых сообщений (коды)
bot.on('message', async (msg) => {
    if (recentlyProcessed.has(msg.message_id)) {
        return;
    }

    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    if (text.startsWith('/')) return;

    if (/^\d{4}$/.test(text)) {
        recentlyProcessed.set(msg.message_id, Date.now());
        await handleCode(chatId, msg.from, text);
        return;
    }

    bot.sendMessage(chatId,
        '❓ Не совсем понимаю. Вот что я могу:\n\n' +
        '🔢 Отправьте <b>4-значный код</b> с экрана авторизации для входа в панель.\n' +
        '📋 Нажмите /start чтобы узнать подробнее о MafBoard.',
        { parse_mode: 'HTML' }
    );
});

/**
 * Обработка 4-значного кода авторизации
 */
const confirmedCodes = new Set();

async function handleCode(chatId, fromUser, code) {
    if (confirmedCodes.has(code)) return;

    try {
        const response = await fetch(CONFIRM_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                telegram_id: fromUser.id,
                username: fromUser.username || null,
                first_name: fromUser.first_name || null,
                last_name: fromUser.last_name || null,
                bot_secret: BOT_SECRET
            })
        });

        const result = await response.json();

        if (result.success) {
            confirmedCodes.add(code);
            setTimeout(() => confirmedCodes.delete(code), 300_000);
            const name = fromUser.first_name || fromUser.username || 'пользователь';
            bot.sendMessage(chatId,
                `✅ Авторизация успешна!\n\n` +
                `Добро пожаловать, <b>${escapeHtml(name)}</b>! 🎉\n\n` +
                `Вернитесь в панель — она уже авторизована.`,
                { parse_mode: 'HTML' }
            );
        } else if (result.error) {
            if (response.status === 404) {
                bot.sendMessage(chatId,
                    '❌ Код не найден или истёк.\n\n' +
                    '🔄 Запросите новый код на экране авторизации.',
                    { parse_mode: 'HTML' }
                );
            } else {
                bot.sendMessage(chatId,
                    '⚠️ Ошибка авторизации: ' + escapeHtml(result.error),
                    { parse_mode: 'HTML' }
                );
            }
        }
    } catch (error) {
        console.error('Ошибка подтверждения кода:', error);
        bot.sendMessage(chatId,
            '⚠️ Произошла ошибка при авторизации. Попробуйте позже.',
            { parse_mode: 'HTML' }
        );
    }
}

/**
 * Экранирование HTML
 */
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Обработка ошибок polling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code, error.message);
});

console.log('🤖 Bot is listening for messages...');

