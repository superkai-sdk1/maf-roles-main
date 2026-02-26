// =====================================================
// Telegram Bot for MafBoard — Auth + Subscriptions
// =====================================================

const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const crypto = require('crypto');

// ======== КОНФИГУРАЦИЯ ========
const BOT_TOKEN = process.env.BOT_TOKEN || '8196046026:AAHP4j4JvjGReMfOiW09LqmrhavXriaPdjk';
const CONFIRM_API_URL = process.env.CONFIRM_API_URL || 'https://localhost/login/code-confirm.php';
const API_BASE_URL = process.env.API_BASE_URL || 'https://localhost/api';
const PAYMENT_PHONE = process.env.PAYMENT_PHONE || '+7 (XXX) XXX-XX-XX';
const BOT_SECRET = crypto.createHash('sha256').update(BOT_TOKEN).digest('hex');

const FEATURES = {
    gomafia: 'GoMafia', funky: 'Фанки', city_mafia: 'Городская мафия',
    minicaps: 'Миникапы', club_rating: 'Клубный рейтинг',
};
const PRICE_PER_FEATURE = 299;
const PRICE_ALL = 990;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const recentlyProcessed = new Map();
const confirmedCodes = new Set();
const userStates = new Map();

setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [id, ts] of recentlyProcessed) if (ts < cutoff) recentlyProcessed.delete(id);
}, 60_000);

console.log('🤖 MafBoard Bot запущен...');

// /start
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
        `🎭 Панель ведущего для игры в Мафию.\n\n` +
        `📋 <b>Команды:</b>\n` +
        `/subscribe — Подписка и тарифы\n` +
        `/status — Мои подписки\n` +
        `/promo — Активировать промокод\n` +
        `/pay — Оплатить подписку\n\n` +
        `🔢 Отправьте <b>4-значный код</b> для авторизации.`,
        {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [
                [{ text: '📋 Мои подписки', callback_data: 'show_status' }, { text: '💳 Тарифы', callback_data: 'show_subscribe' }],
                [{ text: '🎁 Промокод', callback_data: 'enter_promo' }, { text: '🆓 3 дня бесплатно', callback_data: 'activate_trial' }],
                [{ text: '🔐 Авторизация', callback_data: 'auth_info' }],
            ]}
        }
    );
});

// /subscribe
bot.onText(/\/subscribe/, async (msg) => { await showSubscribe(msg.chat.id); });
// /status
bot.onText(/\/status/, async (msg) => { await showStatus(msg.chat.id, msg.from.id); });
// /promo
bot.onText(/\/promo/, async (msg) => {
    userStates.set(msg.chat.id, 'awaiting_promo');
    bot.sendMessage(msg.chat.id, '🎁 Введите промокод:', { parse_mode: 'HTML' });
});
// /pay
bot.onText(/\/pay/, async (msg) => { await showPay(msg.chat.id, msg.from.id); });

async function showSubscribe(chatId) {
    let text = `💳 <b>Тарифы MafBoard</b>\n\n`;
    for (const [slug, name] of Object.entries(FEATURES)) {
        text += `▪️ <b>${name}</b> — ${PRICE_PER_FEATURE}₽/мес\n`;
    }
    text += `\n🔥 <b>Все разделы</b> — ${PRICE_ALL}₽/мес (экономия ${Object.keys(FEATURES).length * PRICE_PER_FEATURE - PRICE_ALL}₽)\n`;
    text += `\n🆓 Доступен пробный период на 3 дня!`;
    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [
            [{ text: '🆓 Попробовать бесплатно', callback_data: 'activate_trial' }],
            [{ text: '💳 Оплатить', callback_data: 'show_pay' }],
        ]}
    });
}

async function showStatus(chatId, telegramId) {
    try {
        const resp = await fetch(`${API_BASE_URL}/subscription-check.php?token=bot_status&telegram_id=${telegramId}`);
        const data = await resp.json();
        if (data.error) { bot.sendMessage(chatId, '⚠️ ' + data.error, { parse_mode: 'HTML' }); return; }
        let text = '📋 <b>Ваши подписки:</b>\n\n';
        let hasAny = false;
        for (const [slug, info] of Object.entries(data.subscriptions || {})) {
            if (info.has_access) {
                hasAny = true;
                text += `✅ <b>${info.name}</b>`;
                if (info.is_trial) text += ' (пробный)';
                text += ` — ещё ${info.days_left} дн.\n`;
            }
        }
        if (!hasAny) text += '❌ Нет активных подписок.\n';
        if (data.can_activate_trial) text += '\n🆓 Доступен пробный период!';
        bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (e) { bot.sendMessage(chatId, '⚠️ Ошибка при получении статуса.'); }
}

async function showPay(chatId, telegramId) {
    let text = `💰 <b>Оплата подписки</b>\n\n`;
    text += `Переведите нужную сумму по номеру:\n📱 <code>${PAYMENT_PHONE}</code>\n\n`;
    text += `Тарифы:\n`;
    for (const [slug, name] of Object.entries(FEATURES)) {
        text += `▪️ ${name} — ${PRICE_PER_FEATURE}₽\n`;
    }
    text += `🔥 Всё — ${PRICE_ALL}₽\n\n`;
    text += `После перевода выберите, что оплачиваете:`;

    const buttons = Object.entries(FEATURES).map(([slug, name]) =>
        [{ text: `${name} (${PRICE_PER_FEATURE}₽)`, callback_data: `pay_${slug}` }]
    );
    buttons.push([{ text: `🔥 Всё (${PRICE_ALL}₽)`, callback_data: 'pay_all' }]);
    bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } });
}

// Callback query handler
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    await bot.answerCallbackQuery(query.id);

    if (query.data === 'auth_info') {
        bot.sendMessage(chatId,
            `🔐 <b>Авторизация</b>\n\n` +
            `<b>Способ 1 — Mini App:</b> откройте панель в Telegram.\n` +
            `<b>Способ 2 — Браузер:</b> откройте панель → код → отправьте мне.\n\n` +
            `📝 Просто отправьте 4-значный код.`, { parse_mode: 'HTML' });
        return;
    }
    if (query.data === 'show_status') { await showStatus(chatId, telegramId); return; }
    if (query.data === 'show_subscribe') { await showSubscribe(chatId); return; }
    if (query.data === 'show_pay') { await showPay(chatId, telegramId); return; }
    if (query.data === 'enter_promo') {
        userStates.set(chatId, 'awaiting_promo');
        bot.sendMessage(chatId, '🎁 Введите промокод:', { parse_mode: 'HTML' }); return;
    }
    if (query.data === 'activate_trial') {
        try {
            const resp = await fetch(`${API_BASE_URL}/bot-message-save.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bot_secret: BOT_SECRET, telegram_id: telegramId, action: 'activate_trial' }),
            });
            const data = await resp.json();
            if (data.ok) bot.sendMessage(chatId, '🎉 <b>Пробный период активирован!</b>\nВам доступны все разделы на 3 дня.', { parse_mode: 'HTML' });
            else bot.sendMessage(chatId, '❌ Пробный период уже был использован.', { parse_mode: 'HTML' });
        } catch (e) { bot.sendMessage(chatId, '⚠️ Ошибка. Попробуйте позже.'); }
        return;
    }
    if (query.data.startsWith('pay_')) {
        const feature = query.data.replace('pay_', '');
        const features = feature === 'all' ? ['all'] : [feature];
        try {
            const resp = await fetch(`${API_BASE_URL}/payment-request.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: 'bot_pay', telegram_id: telegramId, features }),
            });
            const data = await resp.json();
            if (data.error) { bot.sendMessage(chatId, '⚠️ ' + data.error, { parse_mode: 'HTML' }); return; }
            bot.sendMessage(chatId,
                `✅ <b>Заявка создана!</b>\n\nСумма: <b>${data.amount}₽</b>\n` +
                `Переведите на: <code>${PAYMENT_PHONE}</code>\n\n` +
                `После перевода администратор подтвердит оплату и подписка активируется.`,
                { parse_mode: 'HTML' });
        } catch (e) { bot.sendMessage(chatId, '⚠️ Ошибка создания заявки.'); }
        return;
    }
});

// Message handler
bot.on('message', async (msg) => {
    if (recentlyProcessed.has(msg.message_id)) return;
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    if (text.startsWith('/')) return;

    // 4-digit auth code
    if (/^\d{4}$/.test(text)) {
        recentlyProcessed.set(msg.message_id, Date.now());
        await handleCode(chatId, msg.from, text);
        return;
    }

    // Promo code
    if (userStates.get(chatId) === 'awaiting_promo') {
        userStates.delete(chatId);
        try {
            const resp = await fetch(`${API_BASE_URL}/promo-activate.php`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: 'bot_promo', telegram_id: msg.from.id, code: text }),
            });
            const data = await resp.json();
            if (data.error) { bot.sendMessage(chatId, '❌ ' + data.error, { parse_mode: 'HTML' }); return; }
            const names = data.granted_features.map(f => f === 'all' ? 'Все разделы' : (FEATURES[f] || f)).join(', ');
            bot.sendMessage(chatId, `🎉 <b>Промокод активирован!</b>\n\nРазделы: ${names}\nСрок: ${data.duration_days} дней`, { parse_mode: 'HTML' });
        } catch (e) { bot.sendMessage(chatId, '⚠️ Ошибка активации промокода.'); }
        return;
    }

    // Save to bot_messages for admin chat
    try {
        await fetch(`${API_BASE_URL}/bot-message-save.php`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bot_secret: BOT_SECRET, telegram_id: msg.from.id, message_text: text, direction: 'in' }),
        });
    } catch (e) {}

    bot.sendMessage(chatId,
        '❓ Не совсем понимаю. Вот что я могу:\n\n' +
        '🔢 <b>4-значный код</b> — авторизация\n' +
        '/subscribe — тарифы\n/status — мои подписки\n/promo — промокод\n/pay — оплата',
        { parse_mode: 'HTML' });
});

async function handleCode(chatId, fromUser, code) {
    if (confirmedCodes.has(code)) return;
    try {
        const response = await fetch(CONFIRM_API_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code, telegram_id: fromUser.id, username: fromUser.username || null,
                first_name: fromUser.first_name || null, last_name: fromUser.last_name || null, bot_secret: BOT_SECRET,
            }),
        });
        const result = await response.json();
        if (result.success) {
            confirmedCodes.add(code);
            setTimeout(() => confirmedCodes.delete(code), 300_000);
            const name = fromUser.first_name || fromUser.username || 'пользователь';
            bot.sendMessage(chatId, `✅ Авторизация успешна!\n\nДобро пожаловать, <b>${escapeHtml(name)}</b>! 🎉`, { parse_mode: 'HTML' });
        } else if (result.error) {
            bot.sendMessage(chatId, response.status === 404
                ? '❌ Код не найден или истёк.\n🔄 Запросите новый.'
                : '⚠️ Ошибка: ' + escapeHtml(result.error), { parse_mode: 'HTML' });
        }
    } catch (error) {
        console.error('Code confirm error:', error);
        bot.sendMessage(chatId, '⚠️ Ошибка авторизации. Попробуйте позже.', { parse_mode: 'HTML' });
    }
}

function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

bot.on('polling_error', (error) => { console.error('Polling error:', error.code, error.message); });
console.log('🤖 Bot is listening...');
