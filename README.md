# MafBoard v2

Панель ведущего для игры «Мафия». Работает как Telegram Mini App и в браузере.

## Архитектура

```
┌─────────────────────────────────────────────────┐
│  Nginx (443 SSL)                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  /       │ │ /api/    │ │ /socket.io/      │ │
│  │  SPA     │ │ PHP-FPM  │ │ → Node.js :8081  │ │
│  │  React   │ │ MySQL    │ │                  │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────┘
         │                          │
    webapp-v2/dist         socketio/server.js
                                    │
                           webapp-v2/login/bot.js
                           (Telegram Auth Bot)
```

| Компонент | Технология | Порт |
|-----------|-----------|------|
| Frontend SPA | React 18, Vite 4, Tailwind CSS 3 | — (Nginx) |
| API Backend | PHP 8.2-FPM, MySQL 8, Medoo ORM | unix socket |
| Real-time | Socket.IO | 8081 |
| Auth Bot | Node.js, node-telegram-bot-api | — (polling) |
| Process Manager | PM2 | — |
| Web Server | Nginx + Let's Encrypt SSL | 80, 443 |

## Структура проекта

```
MafBoard/
├── install.sh              # Скрипт установки (Ubuntu)
├── uninstall.sh            # Скрипт удаления
├── start-dev.sh            # Запуск для разработки
├── README.md
├── .gitignore
│
├── socketio/               # Socket.IO сервер (real-time sync)
│   ├── server.js           # Сервер — комнаты, коды, роли, state
│   └── package.json
│
├── webapp-v2/              # React SPA + PHP Backend + Auth + Admin
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── dist/               # Собранные файлы (gitignored)
│   ├── api/                # PHP API эндпоинты
│   │   ├── db.php          # Подключение к MySQL
│   │   ├── medoo.php       # Medoo ORM
│   │   ├── get.php         # Прокси для GoMafia
│   │   ├── players-*.php   # CRUD игроков
│   │   ├── avatars-*.php   # Кеш аватаров
│   │   ├── room-state.php  # Состояние комнаты
│   │   ├── sessions-sync.php
│   │   ├── summary-*.php   # Итоги вечера
│   │   ├── tournaments-list.php
│   │   └── gomafia-auth.php
│   ├── login/              # Авторизация через Telegram
│   │   ├── bot.js          # Telegram бот
│   │   ├── auth-config.php # Конфигурация бота
│   │   ├── auth-helpers.php
│   │   ├── tg-auth.php     # Авто-авторизация Mini App
│   │   ├── code-generate.php
│   │   ├── code-confirm.php
│   │   ├── code-check.php
│   │   └── session-validate.php
│   ├── admin/              # Админ-панель
│   │   ├── index.html
│   │   ├── admin.js
│   │   ├── admin.css
│   │   └── api/            # Admin API PHP
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── components/     # React-компоненты
│       ├── constants/      # Роли, темы
│       ├── context/        # GameContext (состояние игры)
│       ├── hooks/          # useTimer, useSwipeBack, useNativeScroll
│       ├── services/       # API, Sessions, Auth, Socket.IO client
│       ├── utils/          # Иконки, хаптика, Telegram SDK
│       └── media/          # SVG-ассеты
```

## Требования к серверу

- **OS**: Ubuntu 20.04 / 22.04 / 24.04
- **RAM**: минимум 1 GB
- **CPU**: 1 vCPU
- **Диск**: 5 GB+
- **Домен**: привязанный A-запись к серверу
- **Telegram бот**: токен от @BotFather

## Установка на сервер

### 1. Подготовка

Привяжите домен к IP-адресу сервера (A-запись в DNS).

Создайте Telegram-бота через [@BotFather](https://t.me/BotFather):
1. `/newbot` → укажите имя и username
2. Скопируйте токен
3. `/mybots` → ваш бот → Bot Settings → Menu Button → укажите URL `https://ваш-домен`

Узнайте свой Telegram ID через [@userinfobot](https://t.me/userinfobot).

### 2. Загрузка проекта на сервер

```bash
# Вариант А: через Git
ssh root@your-server
git clone https://github.com/your-repo/MafBoard.git /tmp/mafboard
cd /tmp/mafboard

# Вариант Б: загрузка архивом
scp -r ./MafBoard root@your-server:/tmp/mafboard
ssh root@your-server
cd /tmp/mafboard
```

### 3. Запуск установки

```bash
sudo bash install.sh
```

Скрипт задаст вопросы:
- **Домен** — ваш домен (например: `mafboard.example.com`)
- **Git URL** — URL репозитория (для будущих обновлений, можно оставить пустым)
- **MySQL** — имя БД, пользователь, пароль (есть значения по умолчанию)
- **Telegram Bot Token** — токен от @BotFather
- **Bot Username** — username бота без `@`
- **Admin Telegram ID** — ваш Telegram ID

Скрипт автоматически:
1. Установит Nginx, PHP 8.2, MySQL, Node.js 20, PM2, Certbot
2. Создаст базу данных и таблицы
3. Скопирует файлы проекта
4. Настроит конфигурационные файлы (db.php, auth-config.php, bot.js)
5. Установит npm-зависимости
6. Соберёт React-приложение (`npm run build`)
7. Настроит Nginx с SSL сертификатом
8. Настроит файрвол (UFW)
9. Запустит Telegram бота через PM2

### 4. После установки

Проверьте статус сервисов:
```bash
pm2 status
pm2 logs
```

Откройте `https://ваш-домен` — должна загрузиться панель.

## Обновление

Если проект размещён на GitHub:

```bash
# На сервере
cd /var/www/your-domain
git pull origin main
sudo bash install.sh --update
```

Или из директории со скриптом:
```bash
sudo bash install.sh --update
```

Команда `--update`:
1. Подтянет последний код из Git (или rsync из текущей директории)
2. Обновит npm-зависимости
3. Пересоберёт React-приложение
4. Перезапустит PM2 сервисы
5. Перезагрузит Nginx

## Разработка (локально)

```bash
# Запуск Vite dev server + Socket.IO server
bash start-dev.sh
```

Откройте:
- Панель: `http://localhost:5173`
- OBS-оверлей: `http://localhost:5173/overlay`

Socket.IO сервер запускается на порту 8081. API-запросы проксируются через Vite к `http://localhost` (настраивается в `vite.config.js`).

## Управление

### PM2

```bash
pm2 status                           # Статус сервисов
pm2 logs                             # Все логи
pm2 logs mafboard-socketio           # Логи Socket.IO
pm2 logs mafboard-auth-bot           # Логи бота
pm2 restart all                      # Перезапуск всех
```

### Nginx

```bash
sudo nginx -t                        # Проверка конфигурации
sudo systemctl reload nginx          # Перезагрузка
sudo cat /etc/nginx/sites-available/your-domain  # Посмотреть конфиг
```

### MySQL

```bash
sudo mysql                           # Вход в MySQL
USE mafboard_db;
SELECT COUNT(*) FROM players;
SELECT COUNT(*) FROM auth_sessions;
```

### SSL

Сертификат обновляется автоматически через certbot. Для ручного обновления:
```bash
sudo certbot renew
```

## Авторизация

### Telegram Mini App
При открытии через Telegram (как Mini App) авторизация происходит автоматически через `tg-auth.php` — валидация `initData` по HMAC-SHA256.

### Браузер
При открытии в обычном браузере:
1. Показывается 4-значный код
2. Пользователь отправляет код Telegram-боту
3. Бот подтверждает код через `code-confirm.php`
4. Панель автоматически авторизуется (polling через `code-check.php`)

## API Эндпоинты

| Эндпоинт | Метод | Описание |
|-----------|-------|----------|
| `/api/get.php` | POST | Прокси для GoMafia страниц |
| `/api/tournaments-list.php` | GET | Список турниров |
| `/api/players-get.php` | POST | Получить игроков по логинам |
| `/api/players-search.php` | GET | Поиск игроков |
| `/api/players-add.php` | POST | Добавить игрока |
| `/api/avatars-cache.php` | POST | Кеш аватаров |
| `/api/avatars-save.php` | POST | Сохранить аватары комнаты |
| `/api/room-state.php` | GET/POST | Состояние комнаты |
| `/api/sessions-sync.php` | POST | Синхронизация сессий |
| `/api/summary-save.php` | POST | Сохранить итоги |
| `/api/summary-get.php` | GET | Получить итоги |
| `/api/gomafia-auth.php` | POST/GET | GoMafia авторизация/поиск |
| `/login/tg-auth.php` | POST | Авто-авторизация Mini App |
| `/login/code-generate.php` | POST | Генерация 4-значного кода |
| `/login/code-check.php` | GET | Проверка подтверждения кода |
| `/login/code-confirm.php` | POST | Подтверждение кода ботом |
| `/login/session-validate.php` | GET | Валидация токена сессии |

## Удаление

```bash
sudo bash uninstall.sh
```

Скрипт спросит:
- Домен для удаления
- Удалять ли базу данных
- Удалять ли PHP/MySQL пакеты

## Troubleshooting

### Сайт не открывается
```bash
sudo nginx -t                        # Проверить конфиг
sudo systemctl status nginx          # Статус nginx
sudo systemctl status php8.2-fpm     # Статус PHP
pm2 status                           # Статус PM2
```

### Бот не отвечает
```bash
pm2 logs mafboard-auth-bot           # Логи бота
pm2 restart mafboard-auth-bot        # Перезапуск
```

### API возвращает ошибки
```bash
curl -s https://your-domain/api/players-search.php?za&q=test | head
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/php8.2-fpm.log
```

### Пересборка фронтенда
```bash
cd /var/www/your-domain/webapp-v2
npm run build
sudo systemctl reload nginx
```
