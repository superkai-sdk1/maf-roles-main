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
            
            if (!match || !match[1]) {
                console.error('❌ Не найден __NEXT_DATA__ в ответе');
                console.log('Начало ответа:', text.substring(0, 500));
                throw new Error('Не удалось найти данные турнира на странице');
            }            console.log('✅ Найдены данные турнира, парсим JSON...');
            const tournamentData = JSON.parse(match[1]);
            console.log('✅ JSON успешно спарсен');
            console.log('🔍 Полная структура tournamentData:', tournamentData);
            
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
            
            return tournamentData;
        } catch (error) {
            console.error('❌ Ошибка загрузки турнира:', error);
            return undefined;
        }
    }    async playersGet(logins) {
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
