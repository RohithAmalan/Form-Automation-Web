#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Form Automation System...${NC}"

# Function to kill all background jobs on exit
cleanup() {
    echo -e "${BLUE}🛑 Shutting down all services...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit
}
trap cleanup EXIT INT TERM

# Get absolute path to this script's directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Create logs directory
mkdir -p "$DIR/logs"

# 1. Start Server
echo -e "${CYAN}📦 Starting Backend Server (Port 3001)...${NC}"
cd "$DIR/backend"
npm run dev > ../logs/server.log 2>&1 &
SERVER_PID=$!

# 2. Worker is now integrated into Server
# echo -e "${CYAN}👷 Starting Automation Worker...${NC}"
# npx ts-node src/worker.ts > ../logs/worker.log 2>&1 &
# WORKER_PID=$!

# 3. Start Client
echo -e "${CYAN}💻 Starting Frontend Client (Port 3000)...${NC}"
cd "$DIR/frontend"
npm run dev > ../logs/client.log 2>&1 &
CLIENT_PID=$!

echo -e "${GREEN}✅ All services started!${NC}"
echo -e "   - 🌍 Dashboard: ${BLUE}http://localhost:3000${NC}"
echo -e "   - 🔌 API:       http://localhost:3001"
echo -e "   - 📄 Logs are being written to logs/server.log and logs/client.log"
echo -e "${GREEN}Press Ctrl+C to stop everything.${NC}"

# Wait for all processes
wait
