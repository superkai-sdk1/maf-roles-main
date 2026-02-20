// =====================================================
// Модуль подключения к GoMafia API
// Часть 1 из 5: app-connector.js
// =====================================================

console.log('📦 Загружается app-connector.js...');

const waitPromise = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

class GoMafiaConnector {
    apiUrl = 'https://titanmafia.pro/api/';
    apiSuffix = '?za';

    async getTournament(tournamentID) {
        console.log('🌐 Загружаем турнир с ID:', tournamentID);
        
        const fd = new FormData();
        fd.set('url', `https://gomafia.pro/tournament/${tournamentID}`);
        
        try {
            console.log('📡 Отправляем запрос к API...');
            const response = await fetch(`${this.apiUrl}get.php${this.apiSuffix}`, { method: 'POST', body: fd });
            
            console.log('📨 Получен ответ от сервера:', response.status, response.statusText);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const text = await response.text();
            console.log('📄 Размер ответа:', text.length, 'символов');
            
            // Проверяем, что получили HTML, а не ошибку PHP
            if (text.startsWith('<?') || text.includes('Fatal error') || text.includes('Parse error')) {
                console.error('❌ Сервер вернул ошибку PHP:', text.substring(0, 200));
                throw new Error('Сервер вернул ошибку PHP');
            }
            
            const match = text.match(/<script id="__NEXT_DATA__" type="application\/json">(.*)<\/script>/);
            
            // Извлекаем название турнира из HTML GoMafia (несколько стратегий)
            let pageTitle = '';

            // Стратегия 1: класс содержит "tournament" и "title"
            const s1 = text.match(/class="[^"]*tournament[^"]*title[^"]*"[^>]*>([^<]+)</i);
            // Стратегия 2: класс содержит "top-left-title"
            const s2 = text.match(/class="[^"]*top-left-title[^"]*"[^>]*>([^<]+)</i);
            // Стратегия 3: og:title meta-тег
            const s3 = text.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
                     || text.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/i);
            // Стратегия 4: <title> тег
            const s4 = text.match(/<title[^>]*>([^<]+)<\/title>/i);
            // Стратегия 5: _tid класс
            const s5 = text.match(/class="[^"]*_tid[^"]*"[^>]*>([^<]{2,100})</);

            if (s1) pageTitle = s1[1].trim();
            else if (s2) pageTitle = s2[1].trim();
            else if (s3) pageTitle = s3[1].trim();
            else if (s4) {
                // Очищаем title от суффиксов GoMafia
                pageTitle = s4[1].replace(/\s*[\|–—-]\s*gomafia.*$/i, '').trim();
                if (/^gomafia/i.test(pageTitle)) pageTitle = '';
            }
            else if (s5) pageTitle = s5[1].trim();

            console.log('📝 Название турнира из HTML:', pageTitle || '(не найдено)',
                '| Стратегии:', { s1: !!s1, s2: !!s2, s3: !!s3, s4: !!s4, s5: !!s5 });

            if (!match || !match[1]) {
                console.error('❌ Не найден __NEXT_DATA__ в ответе');
                console.log('Начало ответа:', text.substring(0, 500));
                throw new Error('Не удалось найти данные турнира на странице');
            }            console.log('✅ Найдены данные турнира, парсим JSON...');
            const tournamentData = JSON.parse(match[1]);
            console.log('✅ JSON успешно спарсен');

            // Логируем serverData для отладки названия
            const sd = tournamentData?.props?.pageProps?.serverData;
            if (sd) {
                const sdKeys = Object.keys(sd);
                console.log('🔍 serverData keys:', sdKeys);
                // Показываем все строковые поля serverData (потенциальные названия)
                const stringFields = {};
                for (const k of sdKeys) {
                    if (typeof sd[k] === 'string' && sd[k].length > 0 && sd[k].length < 300) {
                        stringFields[k] = sd[k];
                    }
                }
                console.log('🔍 serverData строковые поля:', stringFields);
            } else {
                console.warn('⚠️ serverData не найден в ответе');
                console.log('🔍 pageProps keys:', Object.keys(tournamentData?.props?.pageProps || {}));
            }

            // Извлекаем buildId из данных
            if (tournamentData.buildId) {
                console.log('✅ buildId найден:', tournamentData.buildId);
            } else {
                console.warn('⚠️ buildId не найден в данных турнира');
                console.log('🔍 Ключи верхнего уровня tournamentData:', Object.keys(tournamentData));
                
                // Попробуем найти buildId в других местах
                if (tournamentData.props?.buildId) {
                    console.log('✅ buildId найден в props:', tournamentData.props.buildId);
                } else if (tournamentData.query?.buildId) {
                    console.log('✅ buildId найден в query:', tournamentData.query.buildId);
                } else {
                    console.log('❌ buildId не найден нигде в данных');
                }
            }
            
            // Сохраняем title из HTML-заголовка страницы
            // Если HTML-стратегии не нашли название, пробуем из serverData
            if (!pageTitle && sd) {
                pageTitle = sd.name || sd.title || sd.tournamentName || sd.tournament_name || '';
                if (pageTitle) {
                    console.log('📝 Название из serverData:', pageTitle);
                }
            }

            // Рекурсивный поиск поля name/title во всей структуре pageProps
            if (!pageTitle) {
                const pp = tournamentData?.props?.pageProps;
                if (pp) {
                    // Ищем поле name или title на первых двух уровнях вложенности
                    const findName = (obj, depth) => {
                        if (!obj || depth > 2 || typeof obj !== 'object') return '';
                        // Приоритет: name > title > tournament_name
                        if (typeof obj.name === 'string' && obj.name.length > 1 && obj.name.length < 200
                            && !obj.name.startsWith('http') && !/^\d+$/.test(obj.name)) return obj.name;
                        if (typeof obj.title === 'string' && obj.title.length > 1 && obj.title.length < 200
                            && !obj.title.startsWith('http')) return obj.title;
                        if (typeof obj.tournament_name === 'string' && obj.tournament_name.length > 1) return obj.tournament_name;
                        if (typeof obj.tournamentName === 'string' && obj.tournamentName.length > 1) return obj.tournamentName;
                        for (const k of Object.keys(obj)) {
                            if (k === 'games' || k === 'landingData' || Array.isArray(obj[k])) continue;
                            if (typeof obj[k] === 'object' && obj[k] !== null) {
                                const found = findName(obj[k], depth + 1);
                                if (found) return found;
                            }
                        }
                        return '';
                    };
                    pageTitle = findName(pp, 0);
                    if (pageTitle) {
                        console.log('📝 Название найдено рекурсивным поиском:', pageTitle);
                    }
                }
            }

            if (pageTitle) {
                tournamentData._pageTitle = pageTitle;
                console.log('📝 Итоговое название турнира:', pageTitle);
            } else {
                console.warn('⚠️ Название турнира не найдено в HTML и serverData, пробуем _next/data API...');

                // Пробуем загрузить через Next.js JSON API (_next/data)
                const buildId = tournamentData.buildId;
                if (buildId) {
                    try {
                        const fd2 = new FormData();
                        fd2.set('url', `https://gomafia.pro/_next/data/${buildId}/tournament/${tournamentID}.json`);
                        const resp2 = await fetch(`${this.apiUrl}get.php${this.apiSuffix}`, { method: 'POST', body: fd2 });
                        if (resp2.ok) {
                            const json2 = await resp2.json();
                            const sd2 = json2?.pageProps?.serverData;
                            console.log('🔍 _next/data API serverData keys:', sd2 ? Object.keys(sd2) : 'null');
                            if (sd2) {
                                const stringFields2 = {};
                                for (const k of Object.keys(sd2)) {
                                    if (typeof sd2[k] === 'string' && sd2[k].length > 0 && sd2[k].length < 300) {
                                        stringFields2[k] = sd2[k];
                                    }
                                }
                                console.log('🔍 _next/data API строковые поля:', stringFields2);
                                pageTitle = sd2.name || sd2.title || sd2.tournamentName || sd2.tournament_name || '';
                            }
                            if (pageTitle) {
                                tournamentData._pageTitle = pageTitle;
                                console.log('📝 Название из _next/data API:', pageTitle);
                            }
                        }
                    } catch (e2) {
                        console.warn('⚠️ _next/data API запрос не удался:', e2.message);
                    }
                }

                if (!pageTitle) {
                    // Последний fallback — дампим всю структуру pageProps для отладки
                    const pp = tournamentData?.props?.pageProps;
                    if (pp) {
                        console.log('🔍 ПОЛНЫЙ ДАМП pageProps (без games):',
                            JSON.stringify(pp, (key, val) => key === 'games' || key === 'game' || key === 'table' ? '[...]' : val, 2)?.substring(0, 2000));
                    }
                }
            }

            return tournamentData;
        } catch (error) {
            console.error('❌ Ошибка загрузки турнира:', error);
            return undefined;
        }
    }    /**
     * Загружает список турниров с gomafia.pro/tournaments
     * @param {Object} filters - Фильтры { period, type, fsm, search, page }
     * @returns {Object} { tournaments: [], totalCount: number, hasMore: boolean }
     */
    async getTournamentsList(filters = {}) {
        console.log('🌐 Загружаем список турниров с фильтрами:', filters);

        const params = new URLSearchParams();
        params.set('za', '1');
        if (filters.period) params.set('period', filters.period);
        if (filters.type) params.set('type', filters.type);
        if (filters.fsm) params.set('fsm', filters.fsm);
        if (filters.search) params.set('search', filters.search);
        if (filters.page && filters.page > 1) params.set('page', filters.page);

        try {
            const response = await fetch(`${this.apiUrl}tournaments-list.php?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📨 Ответ от tournaments-list.php:', data);

            // Логируем ELO debug info
            if (data._eloTournaments) {
                console.log(`🏆 Турниры с ELO (рассадкой): ${data._eloCount} шт из ${data._totalTournamentLinks || '?'} ссылок:`, data._eloTournaments);
                console.log('🔍 Debug: eloValues sample:', data._debug_eloValues, 'chunks:', data._debug_chunks);
            }

            if (!data.success) {
                throw new Error(data.error || 'Unknown error');
            }

            // Извлекаем турниры из serverData
            const serverData = data.data?.serverData || data.data;
            let tournaments = [];
            let totalCount = 0;

            // GoMafia может возвращать данные в разных форматах
            if (serverData?.tournaments) {
                tournaments = serverData.tournaments;
                totalCount = serverData.totalCount || serverData.total || tournaments.length;
            } else if (serverData?.items) {
                tournaments = serverData.items;
                totalCount = serverData.totalCount || serverData.total || tournaments.length;
            } else if (Array.isArray(serverData)) {
                tournaments = serverData;
                totalCount = tournaments.length;
            } else {
                // Пробуем найти массив турниров в любом ключе
                for (const key of Object.keys(serverData || {})) {
                    if (Array.isArray(serverData[key]) && serverData[key].length > 0) {
                        const first = serverData[key][0];
                        if (first && (first.id || first.tournamentId || first.name || first.title)) {
                            tournaments = serverData[key];
                            break;
                        }
                    }
                }
                totalCount = serverData?.totalCount || serverData?.total || tournaments.length;
            }

            console.log(`✅ Найдено ${tournaments.length} турниров (всего: ${totalCount})`);

            // Дамп первого турнира для отладки полей
            if (tournaments.length > 0) {
                console.log('🔍 Первый турнир — все поля:', JSON.stringify(tournaments[0], null, 2));
                console.log('🔍 Ключи первого турнира:', Object.keys(tournaments[0]));
                // Показываем поля связанные с рассадкой
                const t0 = tournaments[0];
                console.log('🪑 Поля рассадки первого турнира:', {
                    _hasSeating: t0._hasSeating,
                    _elo: t0._elo,
                    elo: t0.elo,
                    rating: t0.rating,
                    eloRating: t0.eloRating,
                    games: t0.games,
                    gamesCount: t0.gamesCount,
                    games_count: t0.games_count,
                    tablesCount: t0.tablesCount
                });
                // Подсчитываем сколько с рассадкой
                const withSeating = tournaments.filter(t => t._hasSeating).length;
                console.log(`🪑 Турниров с _hasSeating: ${withSeating} из ${tournaments.length}`);
            }

            return {
                tournaments: tournaments,
                totalCount: totalCount,
                hasMore: tournaments.length > 0 && tournaments.length < totalCount,
                buildId: data.buildId || ''
            };
        } catch (error) {
            console.error('❌ Ошибка загрузки списка турниров:', error);

            // Fallback: пробуем загрузить через основной get.php прокси
            try {
                console.log('🔄 Пробуем загрузить через get.php...');
                const fd = new FormData();
                let url = 'https://gomafia.pro/tournaments';
                const queryParams = [];
                if (filters.period) queryParams.push(`period=${encodeURIComponent(filters.period)}`);
                if (filters.type) queryParams.push(`type=${encodeURIComponent(filters.type)}`);
                if (filters.fsm) queryParams.push(`fsm=${encodeURIComponent(filters.fsm)}`);
                if (filters.search) queryParams.push(`search=${encodeURIComponent(filters.search)}`);
                if (filters.page && filters.page > 1) queryParams.push(`page=${filters.page}`);
                if (queryParams.length) url += '?' + queryParams.join('&');

                fd.set('url', url);
                const resp = await fetch(`${this.apiUrl}get.php${this.apiSuffix}`, { method: 'POST', body: fd });
                const text = await resp.text();

                const match = text.match(/<script id="__NEXT_DATA__" type="application\/json">(.*)<\/script>/);
                if (match && match[1]) {
                    const nextData = JSON.parse(match[1]);
                    const sd = nextData?.props?.pageProps?.serverData || nextData?.props?.pageProps;
                    let tournaments = [];

                    if (sd) {
                        for (const key of Object.keys(sd)) {
                            if (Array.isArray(sd[key]) && sd[key].length > 0) {
                                const first = sd[key][0];
                                if (first && (first.id || first.tournamentId || first.name || first.title)) {
                                    tournaments = sd[key];
                                    break;
                                }
                            }
                        }
                    }

                    return {
                        tournaments: tournaments,
                        totalCount: tournaments.length,
                        hasMore: false,
                        buildId: nextData?.buildId || ''
                    };
                }
            } catch (e2) {
                console.error('❌ Fallback также не удался:', e2);
            }

            return { tournaments: [], totalCount: 0, hasMore: false, buildId: '' };
        }
    }

    async playersGet(logins) {
        const fd = new FormData();
        logins.forEach(playerLogin => fd.append('playerLogin[]', playerLogin));
        
        try {
            const response = await fetch('https://titanmafia.pro/api/players-get.php?za', { method: 'POST', body: fd });
            
            // Проверяем, что получили успешный ответ
            if (!response.ok) {
                console.warn('⚠️ playersGet: Сервер вернул ошибку:', response.status, response.statusText);
                return null;
            }
            
            // Проверяем content-type
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.warn('⚠️ playersGet: Сервер вернул не JSON:', contentType);
                const text = await response.text();
                if (text.startsWith('<?') || text.includes('<html>')) {
                    console.warn('⚠️ playersGet: Сервер вернул PHP/HTML код вместо JSON');
                    console.warn('⚠️ Начало ответа:', text.substring(0, 200));
                    return null;
                }
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ playersGet: Ошибка загрузки данных игроков:', error.message);
            return null;
        }
    }    async getUserData(buildId, userId) {
        console.log('🔄 getUserData: Загружаем данные пользователя', userId, 'с buildId:', buildId);
        const fd = new FormData();
        fd.set('url', `https://gomafia.pro/_next/data/${buildId}/stats/${userId}.json`);
        
        const requestUrl = `https://gomafia.pro/_next/data/${buildId}/stats/${userId}.json`;
        console.log('📡 getUserData: Запрашиваем:', requestUrl);
        
        try {
            const response = await fetch(`${this.apiUrl}get.php${this.apiSuffix}`, { method: 'POST', body: fd });
            console.log('📨 getUserData: Ответ получен, статус:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ getUserData: Данные пользователя', userId, ':', data);
            
            const serverData = data?.pageProps?.serverData;
            console.log('👤 getUserData: serverData для', userId, ':', serverData);
            
            return serverData;
        } catch (error) {
            console.error('❌ getUserData: Ошибка для пользователя', userId, ':', error);
            return null;
        }
    }    async getUsersData(buildId, usersIdArray) {
        console.log('🔄 getUsersData: Начинаем загрузку данных для пользователей:', usersIdArray);
        console.log('🔍 getUsersData: buildId:', buildId);
        
        const uIds = [...(usersIdArray || [])];
        const result = [];
        
        for (let userId = uIds.shift(); userId; userId = uIds.shift()) {
            console.log(`⏳ getUsersData: Загружаем пользователя ${userId} (осталось: ${uIds.length})`);
            const r = await this.getUserData(buildId, userId);
            result.push(r);
            await waitPromise(50);
        }
        
        console.log('✅ getUsersData: Загрузка завершена, результат:', result);
        console.log('📊 getUsersData: Успешно загружено:', result.filter(r => r !== null).length, 'из', usersIdArray.length);
        
        return result;
    }
}

// Глобальный экземпляр коннектора
const goMafia = new GoMafiaConnector();

// Экспортируем в глобальную область
window.goMafia = goMafia;

console.log('✅ app-connector.js загружен, goMafia доступен в window.goMafia');
