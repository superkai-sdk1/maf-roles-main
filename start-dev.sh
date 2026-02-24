#!/bin/bash
# ============================================
# MafBoard v2 — Запуск для разработки/тестирования
# ============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  MafBoard v2 — Development Launcher    ${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Функция остановки при выходе
cleanup() {
    echo ""
    echo -e "${YELLOW}Останавливаю серверы...${NC}"
    if [ ! -z "$WS_PID" ]; then
        kill $WS_PID 2>/dev/null
        echo -e "  WebSocket сервер остановлен (PID: $WS_PID)"
    fi
    if [ ! -z "$VITE_PID" ]; then
        kill $VITE_PID 2>/dev/null
        echo -e "  Vite dev сервер остановлен (PID: $VITE_PID)"
    fi
    echo -e "${GREEN}Готово!${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

# 1. Проверяем зависимости WebSocket
echo -e "${YELLOW}[1/4] Проверяю зависимости WebSocket сервера...${NC}"
if [ ! -d "$SCRIPT_DIR/websocket/node_modules" ]; then
    cd "$SCRIPT_DIR/websocket" && npm install
else
    echo -e "  ${GREEN}✓ Зависимости уже установлены${NC}"
fi

# 2. Проверяем зависимости webapp-v2
echo -e "${YELLOW}[2/4] Проверяю зависимости webapp-v2...${NC}"
if [ ! -d "$SCRIPT_DIR/webapp-v2/node_modules" ]; then
    cd "$SCRIPT_DIR/webapp-v2" && npm install
else
    echo -e "  ${GREEN}✓ Зависимости уже установлены${NC}"
fi

# 3. Запускаем WebSocket сервер
echo -e "${YELLOW}[3/4] Запускаю WebSocket сервер (порт 8081)...${NC}"
cd "$SCRIPT_DIR/websocket"
node ws.js &
WS_PID=$!
sleep 1

if kill -0 $WS_PID 2>/dev/null; then
    echo -e "  ${GREEN}✓ WebSocket сервер запущен (PID: $WS_PID)${NC}"
else
    echo -e "  ${RED}✗ Ошибка запуска WebSocket сервера${NC}"
fi

# 4. Запускаем Vite dev сервер
echo -e "${YELLOW}[4/4] Запускаю Vite dev сервер (порт 5173)...${NC}"
cd "$SCRIPT_DIR/webapp-v2"
npx vite &
VITE_PID=$!
sleep 2

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Всё запущено! Откройте:${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC}  http://localhost:5173"
echo -e "  ${CYAN}WebSocket:${NC} ws://localhost:8081"
echo ""
echo -e "  ${YELLOW}Ctrl+C для остановки всех серверов${NC}"
echo ""

# Ожидаем завершения
wait

