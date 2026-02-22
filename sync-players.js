#!/usr/bin/env node
/**
 * sync-players.js — Скрипт обновления базы игроков из GoMafia.pro
 *
 * Запуск:
 *   node sync-players.js [--tournament ID] [--range START-END] [--api-url URL]
 *
 * Примеры:
 *   # Обновить игроков из конкретного турнира
 *   node sync-players.js --tournament 12345
 *
 *   # Обновить игроков по диапазону GoMafia ID (от 1 до 5000)
 *   node sync-players.js --range 1-5000
 *
 *   # С указанием URL вашего сервера (по умолчанию http://localhost:31006)
 *   node sync-players.js --range 1-3000 --api-url https://titanmafia.pro
 *
 * Что делает:
 *   1. Получает buildId с gomafia.pro (нужен для API)
 *   2. Загружает данные каждого игрока с gomafia.pro
 *   3. Сохраняет/обновляет в вашей БД через players-update.php
 *   4. Опционально генерирует новый mafia.sql дамп
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ======================== Настройки ========================
const DEFAULT_API_URL = 'http://localhost:31006';
const BATCH_SIZE = 20;       // сколько игроков отправлять в одном POST
const DELAY_MS = 100;        // пауза между запросами к GoMafia (мс)
const TIMEOUT_MS = 10000;    // таймаут запроса
// ===========================================================

function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        tournament: null,
        rangeStart: null,
        rangeEnd: null,
        apiUrl: DEFAULT_API_URL,
        dumpSql: false,
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--tournament':
            case '-t':
                config.tournament = args[++i];
                break;
            case '--range':
            case '-r':
                const [start, end] = (args[++i] || '').split('-').map(Number);
                config.rangeStart = start;
                config.rangeEnd = end;
                break;
            case '--api-url':
            case '-u':
                config.apiUrl = args[++i];
                break;
            case '--dump-sql':
                config.dumpSql = true;
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
        }
    }

    return config;
}

function printHelp() {
    console.log(`
Использование: node sync-players.js [опции]

Опции:
  --tournament, -t ID     Загрузить игроков из турнира GoMafia
  --range, -r START-END   Загрузить игроков по диапазону GoMafia ID
  --api-url, -u URL       URL вашего сервера (по умолчанию: ${DEFAULT_API_URL})
  --dump-sql              После обновления сгенерировать SQL-дамп
  --help, -h              Показать эту справку

Примеры:
  node sync-players.js --tournament 12345
  node sync-players.js --range 1-5000
  node sync-players.js --range 1-3000 --api-url https://titanmafia.pro
`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * HTTP(S) GET запрос, возвращает строку
 */
function httpGet(url, timeout = TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const req = lib.get(url, { timeout, headers: { 'User-Agent': 'MafBoard-Sync/1.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(httpGet(res.headers.location, timeout));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

/**
 * HTTP POST запрос (application/x-www-form-urlencoded)
 */
function httpPost(url, body, timeout = TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const lib = parsed.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: 'POST',
            timeout,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body),
                'User-Agent': 'MafBoard-Sync/1.0'
            }
        };
        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(body);
        req.end();
    });
}

/**
 * Получить buildId с gomafia.pro (нужен для API _next/data)
 */
async function getBuildId() {
    console.log('🔍 Получаем buildId с gomafia.pro...');
    const html = await httpGet('https://gomafia.pro/');
    const match = html.match(/"buildId"\s*:\s*"([^"]+)"/);
    if (!match) {
        throw new Error('Не удалось получить buildId с gomafia.pro. Сайт мог обновить структуру.');
    }
    console.log(`✅ buildId: ${match[1]}`);
    return match[1];
}

/**
 * Загрузить данные одного пользователя с GoMafia
 */
async function getUserData(buildId, userId) {
    try {
        const url = `https://gomafia.pro/_next/data/${buildId}/stats/${userId}.json`;
        const text = await httpGet(url);
        const data = JSON.parse(text);
        const serverData = data?.pageProps?.serverData;
        if (serverData?.user) {
            return serverData.user;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Кеш названий клубов и функция получения
 */
const clubCache = {};
async function getClubTitle(buildId, clubId) {
    if (!clubId || clubId === '0' || clubId === '') return 'Без клуба';
    if (clubCache[clubId]) return clubCache[clubId];
    try {
        const url = `https://gomafia.pro/_next/data/${buildId}/club/${clubId}.json`;
        const text = await httpGet(url);
        const data = JSON.parse(text);
        const title = data?.pageProps?.serverData?.club?.title;
        if (title) {
            clubCache[clubId] = title;
            return title;
        }
    } catch (e) { /* ignore */ }
    clubCache[clubId] = 'Без клуба';
    return 'Без клуба';
}

/**
 * Загрузить список игроков из турнира GoMafia
 */
async function getPlayersFromTournament(buildId, tournamentId) {
    console.log(`📋 Загружаем турнир ${tournamentId}...`);

    // Сначала пробуем _next/data JSON API
    try {
        const url = `https://gomafia.pro/_next/data/${buildId}/tournament/${tournamentId}.json`;
        const text = await httpGet(url);
        const data = JSON.parse(text);
        const games = data?.pageProps?.serverData?.games;
        if (games && games.length > 0) {
            const players = [];
            const seen = new Set();
            for (const gameGroup of games) {
                const tables = gameGroup?.game || [];
                for (const table of tables) {
                    const seats = table?.table || [];
                    for (const player of seats) {
                        if (player?.id && !seen.has(String(player.id))) {
                            seen.add(String(player.id));
                            players.push({
                                id: String(player.id),
                                login: player.login || ''
                            });
                        }
                    }
                }
            }
            console.log(`✅ Найдено ${players.length} уникальных игроков в турнире`);
            return players;
        }
    } catch (e) {
        console.warn(`⚠️ JSON API не сработал: ${e.message}`);
    }

    // Fallback: парсим HTML
    try {
        const html = await httpGet(`https://gomafia.pro/tournament/${tournamentId}`);
        const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*)<\/script>/);
        if (match) {
            const data = JSON.parse(match[1]);
            const games = data?.props?.pageProps?.serverData?.games;
            if (games && games.length > 0) {
                const players = [];
                const seen = new Set();
                for (const gameGroup of games) {
                    const tables = gameGroup?.game || [];
                    for (const table of tables) {
                        const seats = table?.table || [];
                        for (const player of seats) {
                            if (player?.id && !seen.has(String(player.id))) {
                                seen.add(String(player.id));
                                players.push({
                                    id: String(player.id),
                                    login: player.login || ''
                                });
                            }
                        }
                    }
                }
                console.log(`✅ Найдено ${players.length} уникальных игроков в турнире (HTML)`);
                return players;
            }
        }
    } catch (e) {
        console.warn(`⚠️ HTML парсинг не сработал: ${e.message}`);
    }

    throw new Error('Не удалось получить список игроков из турнира');
}

/**
 * Отправить батч игроков на обновление в БД
 */
async function sendBatchToServer(apiUrl, playersData) {
    const params = playersData
        .map(p => `player[]=${encodeURIComponent(JSON.stringify(p))}`)
        .join('&');

    const url = `${apiUrl}/api/players-update.php?za`;
    const response = await httpPost(url, params);

    try {
        return JSON.parse(response);
    } catch {
        return { raw: response };
    }
}

/**
 * Основная функция: обновление по диапазону ID
 */
async function syncByRange(buildId, start, end, apiUrl) {
    console.log(`\n🔄 Обновление игроков с GoMafia ID от ${start} до ${end}`);
    console.log(`📡 Сервер: ${apiUrl}`);
    console.log(`📦 Размер батча: ${BATCH_SIZE}`);
    console.log('');

    let total = 0;
    let found = 0;
    let batch = [];
    let totalUpdated = 0;
    let totalInserted = 0;
    let consecutive404 = 0;
    const MAX_CONSECUTIVE_404 = 200; // остановка если 200 подряд не найдено

    for (let userId = start; userId <= end; userId++) {
        total++;
        const user = await getUserData(buildId, userId);

        if (user) {
            consecutive404 = 0;
            found++;
            const clubTitle = await getClubTitle(buildId, user.club_id);
            const playerData = {
                login: user.login,
                avatar_link: user.avatar_link || null,
                id: String(user.id || userId),
                title: clubTitle
            };
            batch.push(playerData);

            process.stdout.write(`\r  ✅ ${found} найдено / ${total} проверено (ID: ${userId} — ${user.login})          `);

            if (batch.length >= BATCH_SIZE) {
                const result = await sendBatchToServer(apiUrl, batch);
                totalUpdated += result.updated || 0;
                totalInserted += result.inserted || 0;
                batch = [];
            }
        } else {
            consecutive404++;
            process.stdout.write(`\r  ⏳ ${found} найдено / ${total} проверено (ID: ${userId} — пусто)          `);

            if (consecutive404 >= MAX_CONSECUTIVE_404 && userId > start + MAX_CONSECUTIVE_404) {
                console.log(`\n\n⚠️ ${MAX_CONSECUTIVE_404} ID подряд без результата — останавливаемся.`);
                console.log(`   Последний найденный ID примерно ${userId - MAX_CONSECUTIVE_404}.`);
                break;
            }
        }

        await sleep(DELAY_MS);
    }

    // Отправляем оставшийся батч
    if (batch.length > 0) {
        const result = await sendBatchToServer(apiUrl, batch);
        totalUpdated += result.updated || 0;
        totalInserted += result.inserted || 0;
    }

    console.log('\n');
    console.log('═══════════════════════════════════════');
    console.log(`  📊 Итого`);
    console.log(`  Проверено ID:     ${total}`);
    console.log(`  Найдено игроков:  ${found}`);
    console.log(`  Обновлено в БД:   ${totalUpdated}`);
    console.log(`  Добавлено в БД:   ${totalInserted}`);
    console.log('═══════════════════════════════════════');
}

/**
 * Основная функция: обновление по турниру
 */
async function syncByTournament(buildId, tournamentId, apiUrl) {
    console.log(`\n🏆 Обновление игроков из турнира ${tournamentId}`);
    console.log(`📡 Сервер: ${apiUrl}`);
    console.log('');

    const players = await getPlayersFromTournament(buildId, tournamentId);

    let found = 0;
    let batch = [];
    let totalUpdated = 0;
    let totalInserted = 0;

    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        const user = await getUserData(buildId, p.id);

        if (user) {
            found++;
            const clubTitle = await getClubTitle(buildId, user.club_id);
            const playerData = {
                login: user.login,
                avatar_link: user.avatar_link || null,
                id: String(user.id || p.id),
                title: clubTitle
            };
            batch.push(playerData);
            process.stdout.write(`\r  ✅ ${found}/${players.length} — ${user.login}          `);

            if (batch.length >= BATCH_SIZE) {
                const result = await sendBatchToServer(apiUrl, batch);
                totalUpdated += result.updated || 0;
                totalInserted += result.inserted || 0;
                batch = [];
            }
        } else {
            process.stdout.write(`\r  ⏳ ${i + 1}/${players.length} — ID ${p.id} не найден          `);
        }

        await sleep(DELAY_MS);
    }

    // Отправляем оставшийся батч
    if (batch.length > 0) {
        const result = await sendBatchToServer(apiUrl, batch);
        totalUpdated += result.updated || 0;
        totalInserted += result.inserted || 0;
    }

    console.log('\n');
    console.log('═══════════════════════════════════════');
    console.log(`  📊 Итого (турнир ${tournamentId})`);
    console.log(`  Игроков в турнире: ${players.length}`);
    console.log(`  Загружено данных:  ${found}`);
    console.log(`  Обновлено в БД:    ${totalUpdated}`);
    console.log(`  Добавлено в БД:    ${totalInserted}`);
    console.log('═══════════════════════════════════════');
}

// ======================== Запуск ========================
async function main() {
    const config = parseArgs();

    if (!config.tournament && !config.rangeStart) {
        console.log('❌ Укажите --tournament ID или --range START-END');
        console.log('   Используйте --help для справки');
        process.exit(1);
    }

    try {
        const buildId = await getBuildId();

        if (config.tournament) {
            await syncByTournament(buildId, config.tournament, config.apiUrl);
        }

        if (config.rangeStart && config.rangeEnd) {
            await syncByRange(buildId, config.rangeStart, config.rangeEnd, config.apiUrl);
        }

        console.log('\n✅ Синхронизация завершена!');

        if (config.dumpSql) {
            console.log('\n📄 Для создания SQL-дампа выполните на сервере:');
            console.log(`   mysqldump -u kai -p webrarium_mafia players > webapp/api/mafia.sql`);
        }

    } catch (error) {
        console.error('\n❌ Ошибка:', error.message);
        process.exit(1);
    }
}

main();

