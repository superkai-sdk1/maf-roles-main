// =====================================================
// Telegram Bot for MafBoard Authentication
// Принимает 4-значные коды от пользователей и подтверждает авторизацию
// =====================================================

const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');

// ======== КОНФИГУРАЦИЯ ========
// Токен бота (тот же что в auth-config.php)
const BOT_TOKEN = process.env.BOT_TOKEN || '7656955712:AAHqAzwzatfGif1fL7tNcTvYpfGsDKeE_nE';

// URL до API подтверждения кода (адрес вашего сервера)
const CONFIRM_API_URL = process.env.CONFIRM_API_URL || 'https://titanmafia.pro/login/code-confirm.php';

// Секрет для авторизации запросов к API (SHA256 от BOT_TOKEN)
const crypto = require('crypto');
const BOT_SECRET = crypto.createHash('sha256').update(BOT_TOKEN).digest('hex');
// ==============================

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 MafBoard Auth Bot запущен...');

// Обработка команды /start
bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param = match[1] ? match[1].trim() : '';

    // Если пришёл код через deep link (/start 1234)
    if (/^\d{4}$/.test(param)) {
        await handleCode(chatId, msg.from, param);
        return;
    }

    bot.sendMessage(chatId,
        '👋 Привет! Я бот авторизации для MafBoard.\n\n' +
        '📝 Отправьте мне 4-значный код, который отображается на экране авторизации.\n\n' +
        '🔐 После этого вы будете автоматически авторизованы в панели.',
        { parse_mode: 'HTML' }
    );
});

// Обработка текстовых сообщений (коды)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    // Пропускаем команды (они обрабатываются отдельно)
    if (text.startsWith('/')) return;

    // Проверяем, является ли сообщение 4-значным кодом
    if (/^\d{4}$/.test(text)) {
        await handleCode(chatId, msg.from, text);
        return;
    }

    // Некорректное сообщение
    bot.sendMessage(chatId,
        '❓ Пожалуйста, отправьте 4-значный код авторизации.\n' +
        'Код отображается на экране входа в панель.',
        { parse_mode: 'HTML' }
    );
});

/**
 * Обработка 4-значного кода авторизации
 */
async function handleCode(chatId, fromUser, code) {
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

