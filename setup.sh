#!/bin/bash

# define colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting Auto-Setup for Form Automation System...${NC}"

# 1. Environment Setup
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating form .env.example...${NC}"
    cp .env.example .env
    echo -e "${RED}❗ IMPORTANT: Please edit the .env file with your real Database & API credentials after this script finishes!${NC}"
else
    echo -e "${BLUE}✅ .env file already exists.${NC}"
fi

# 2. Install Backend Dependencies
echo -e "${BLUE}📦 Installing Backend Dependencies...${NC}"
cd backend
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Backend install failed.${NC}"
    exit 1
fi

# 3. Build Backend (setup scripts use ts-node, but good to ensure it builds)
# npm run build 

cd ..

# 4. Install Frontend Dependencies
echo -e "${BLUE}📦 Installing Frontend Dependencies...${NC}"
cd frontend
npm install --legacy-peer-deps
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend install failed.${NC}"
    exit 1
fi
cd ..

# 5. Database Setup prompt
echo -e "${YELLOW}🗄️  Database Setup${NC}"
echo -e "This requires a PostgreSQL database to be running."
echo -e "Default URL: postgresql://postgres:password@localhost:5432/form_automation"
read -p "Do you want to run the database initialization now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🔨 Creating Tables...${NC}"
    # Try psql if available, else warn
    if command -v psql &> /dev/null; then
        psql -d form_automation -f database/schema.sql
    else
        echo -e "${YELLOW}⚠️  'psql' command not found. Using Node script fallback...${NC}"
        # Node script requires the DB to exist first.
        # We can't easily create the DB from node without connecting to 'postgres' db.
        # Let's assume the user has created the EMPTY database named 'form_automation'.
    fi

    echo -e "${BLUE}👤 Creating Admin User & Session Table...${NC}"
    npx ts-node backend/scripts/setupAdmin.ts
    npx ts-node backend/scripts/initSessionTable.ts
fi

echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "👉 1. Edit .env with your keys."
echo -e "👉 2. Run './run.sh' to start."
