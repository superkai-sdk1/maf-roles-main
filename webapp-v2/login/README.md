# Система авторизации MafBoard

## Обзор

Бесшовная авторизация через Telegram с двумя путями:

1. **Telegram Mini App** — автоматическая авторизация через `initData` (HMAC-SHA256 валидация)
2. **Браузер** — 4-значный код, который нужно отправить Telegram боту

## Структура файлов

```
webapp/login/
├── auth-config.php       # Конфигурация (токен бота, TTL)
├── auth-helpers.php      # Общие утилиты (HMAC, токены, сессии)
├── auth-migration.sql    # SQL для создания таблиц
├── auth.css              # Стили экрана авторизации
├── auth.js               # Клиентский модуль авторизации
├── bot.js                # Telegram бот (Node.js)
├── code-check.php        # API: проверка статуса кода
├── code-confirm.php      # API: подтверждение кода ботом
├── code-generate.php     # API: генерация 4-значного кода
├── package.json          # Зависимости бота
├── session-validate.php  # API: валидация токена сессии
└── tg-auth.php           # API: авторизация через Telegram initData
```

## Установка

### 1. База данных

Выполните SQL из `auth-migration.sql` в вашей базе данных:

```bash
mysql -u USERNAME -p DATABASE_NAME < webapp/login/auth-migration.sql
```

### 2. Создание Telegram бота

1. Напишите [@BotFather](https://t.me/BotFather) в Telegram
2. Создайте нового бота командой `/newbot`
3. Скопируйте полученный **токен бота**
4. Запомните **username бота** (без @)

### 3. Конфигурация PHP

Откройте `webapp/login/auth-config.php` и укажите:

```php
define('BOT_TOKEN', 'YOUR_BOT_TOKEN_HERE');     // Токен от @BotFather
define('BOT_USERNAME', 'your_bot_username');      // Username бота без @
```

### 4. Конфигурация бота (Node.js)

Откройте `webapp/login/bot.js` и укажите:

```javascript
const BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE';   // Тот же токен
const CONFIRM_API_URL = 'https://your-domain.com/webapp/login/code-confirm.php';
```

Или используйте переменные окружения:

```bash
export BOT_TOKEN="your_bot_token"
export CONFIRM_API_URL="https://your-domain.com/webapp/login/code-confirm.php"
```

### 5. Установка зависимостей бота

```bash
cd webapp/login
npm install
```

### 6. Запуск бота

```bash
cd webapp/login
node bot.js
```

Для постоянной работы рекомендуется PM2:

```bash
npm install -g pm2
pm2 start bot.js --name mafboard-auth-bot
pm2 save
```

## Как это работает

### Telegram Mini App (автоматически)

```
Пользователь открывает Mini App
  → auth.js получает window.Telegram.WebApp.initData
  → POST /login/tg-auth.php с initData
  → PHP валидирует HMAC-SHA256 подпись
  → Создаётся сессия, возвращается токен
  → Токен сохраняется в localStorage
  → Панель разблокируется
```

### Браузер (через код)

```
Пользователь открывает панель в браузере
  → auth.js запрашивает POST /login/code-generate.php
  → Получает 4-значный код и ссылку на бота
  → Отображается экран с кодом и кнопкой "Открыть бота"
  → Пользователь кликает ссылку → открывается Telegram → код автоматически отправляется боту
  → Бот получает код → POST /login/code-confirm.php
  → Создаётся сессия
  → auth.js опрашивает /login/code-check.php каждые 2.5 сек
  → Получает подтверждение и токен
  → Панель разблокируется
```

### Повторные визиты

```
Пользователь открывает панель
  → auth.js находит токен в localStorage
  → GET /login/session-validate.php?token=xxx
  → Сессия валидна → панель открывается мгновенно
  → Сессия просрочена → новая авторизация
```

## API для разработчиков

В клиентском коде доступен глобальный объект `window.mafAuth`:

```javascript
// Получить текущего пользователя
const user = window.mafAuth.getUser();
// { id: 123456, username: "user", first_name: "Name", last_name: "..." }

// Проверить авторизацию
window.mafAuth.isAuthenticated(); // true/false

// Получить токен
window.mafAuth.getToken(); // "abc123..."

// Выйти из системы
window.mafAuth.logout();
```

## Настройки

| Параметр | Файл | По умолчанию | Описание |
|----------|------|-------------|----------|
| `BOT_TOKEN` | auth-config.php, bot.js | - | Токен Telegram бота |
| `BOT_USERNAME` | auth-config.php | - | Username бота без @ |
| `SESSION_TTL_DAYS` | auth-config.php | 30 | Время жизни сессии (дни) |
| `CODE_TTL_SECONDS` | auth-config.php | 300 | Время жизни кода (5 мин) |
| `CONFIRM_API_URL` | bot.js | - | URL до code-confirm.php |

