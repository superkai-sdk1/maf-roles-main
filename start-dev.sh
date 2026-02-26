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
    if [ ! -z "$VITE_PID" ]; then
        kill $VITE_PID 2>/dev/null
        echo -e "  Vite dev сервер остановлен (PID: $VITE_PID)"
    fi
    echo -e "${GREEN}Готово!${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

# 1. Проверяем зависимости webapp-v2
echo -e "${YELLOW}[1/2] Проверяю зависимости webapp-v2...${NC}"
if [ ! -d "$SCRIPT_DIR/webapp-v2/node_modules" ]; then
    cd "$SCRIPT_DIR/webapp-v2" && npm install
else
    echo -e "  ${GREEN}✓ Зависимости уже установлены${NC}"
fi

# 2. Запускаем Vite dev сервер
echo -e "${YELLOW}[2/2] Запускаю Vite dev сервер (порт 5173)...${NC}"
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
echo ""
echo -e "  ${YELLOW}Ctrl+C для остановки${NC}"
echo ""

# Ожидаем завершения
wait
