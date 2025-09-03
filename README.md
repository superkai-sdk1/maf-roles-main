# Maf Roles Panel

Интерактивная веб-панель для ведущего игры "Мафия" с интеграцией в Telegram Web App, синхронизацией состояния через WebSocket и загрузкой данных о турнирах.

## ✨ Возможности

-   Управление списком игроков и их ролями.
-   Автоматическое ведение игрового процесса: день, ночь, голосование.
-   Синхронизация в реальном времени между несколькими устройствами через WebSocket.
-   Загрузка данных о турнирах с внешнего API.
-   Сохранение и восстановление сессий.
-   Адаптивный дизайн и поддержка тем оформления Telegram.

## ⚙️ Технологии

-   **Фронтенд:** HTML, CSS, JavaScript, Vue.js 2
-   **Бэкенд (WebSocket):** Node.js, ws
-   **API:** PHP
-   **Сервер:** Nginx, PM2, Let's Encrypt

## 🚀 Установка

Установка протестирована на **Ubuntu 22.04 / 24.04**.

### Предварительные требования

1.  Чистый сервер с Ubuntu.
2.  Доменное имя, **A-запись** которого указывает на IP-адрес вашего сервера.

### Автоматическая установка

Подключитесь к вашему серверу по SSH, а затем выполните следующие команды:

```bash
# Клонируем репозиторий
git clone https://github.com/superkai-sdk1/maf-roles-main.git
cd maf-roles-main

# Запускаем скрипт установки
sudo bash install.sh
```
Скрипт запросит ваше доменное имя и автоматически выполнит все необходимые шаги: установит зависимости, настроит Nginx, запустит WebSocket сервер и получит SSL-сертификат.

### Ручная установка

Если вы предпочитаете контролировать каждый шаг, следуйте этой инструкции.

**1. Подключитесь к серверу и обновите пакеты:**
```bash
sudo apt update && sudo apt upgrade -y
```

**2. Установите зависимости:**
```bash
sudo apt install -y nginx nodejs npm php-fpm php-curl certbot python3-certbot-nginx git
```

**3. Настройте брандмауэр:**
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

**4. Клонируйте репозиторий:**
```bash
git clone https://github.com/superkai-sdk1/maf-roles-main.git /var/www/maf-roles
```

**5. Настройте Nginx:**

Создайте конфигурационный файл для вашего сайта. Замените `your_domain` на ваше доменное имя.
```bash
sudo nano /etc/nginx/sites-available/your_domain
```

Вставьте в файл следующую конфигурацию, снова заменив `your_domain` на ваш домен:
```nginx
server {
    listen 80;
    server_name your_domain www.your_domain;
    root /var/www/maf-roles/webapp;
    index index.php panel.html index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        # Убедитесь, что путь до сокета PHP-FPM указан верно для вашей системы
        fastcgi_pass unix:/var/run/php/php-fpm.sock;
    }

    location /bridge {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Активируйте конфигурацию и перезапустите Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/your_domain /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**6. Запустите WebSocket сервер:**

Установите зависимости и запустите сервер с помощью менеджера процессов PM2.
```bash
cd /var/www/maf-roles/websocket
npm install
sudo npm install -g pm2
pm2 start ws.js --name maf-bridge
pm2 save
pm2 startup
```

**7. Получите SSL-сертификат:**

Certbot автоматически изменит конфигурацию Nginx для поддержки HTTPS.
```bash
sudo certbot --nginx -d your_domain -d www.your_domain
```

После выполнения этих шагов ваше приложение будет доступно по адресу `https://your_domain`.

## 卸载

Для удаления приложения и всех его компонентов с сервера, используйте скрипт `uninstall.sh`.

**Внимание:** Этот скрипт удалит все файлы проекта, конфигурацию Nginx, сервис PM2 и остановит связанные службы.

```bash
cd maf-roles-main
sudo bash uninstall.sh
```
