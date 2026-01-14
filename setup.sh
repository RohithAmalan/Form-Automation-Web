#!/bin/bash

# define colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting Auto-Setup for Form Automation System...${NC}"

# 1. Environment Setup (Interactive)
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Let's configure it now.${NC}"
    
    echo -e "\n${BLUE}--- Database Config ---${NC}"
    read -p "Enter Database Password [default: password]: " DB_PASS
    DB_PASS=${DB_PASS:-password}
    DB_URL="postgresql://postgres:${DB_PASS}@localhost:5432/form_automation"

    echo -e "\n${BLUE}--- AI Configuration ---${NC}"
    echo "You need an API Key from OpenRouter.ai (or OpenAI)."
    read -p "Enter OpenRouter Key [leave empty if you want to add later]: " AI_KEY
    AI_KEY=${AI_KEY:-"sk-placeholder-key"}

    echo -e "\n${BLUE}--- Admin User ---${NC}"
    read -p "Set Admin Email [default: admin@local]: " ADMIN_EMAIL
    ADMIN_EMAIL=${ADMIN_EMAIL:-"admin@local"}
    
    read -p "Set Admin Password [default: admin123]: " ADMIN_PASSWORD
    ADMIN_PASSWORD=${ADMIN_PASSWORD:-"admin123"}

    echo -e "\n${GREEN}📝 Generatng .env file...${NC}"
    cat > .env << EOL
# Server Configuration
PORT=3001
SESSION_SECRET=dev_secret_auto_generated
DATABASE_URL=${DB_URL}

# AI Configuration
OPENROUTER_API_KEY=${AI_KEY}

# Admin Credentials
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# Google OAuth (Optional placeholders)
GOOGLE_CLIENT_ID=placeholder_id
GOOGLE_CLIENT_SECRET=placeholder_secret
CALLBACK_URL=http://localhost:3001/auth/google/callback

# Defaults
MAX_RETRIES=2
RETRY_BACKOFF_MS=2000
PAGE_LOAD_TIMEOUT_MS=60000
ELEMENT_WAIT_TIMEOUT_MS=10000
EOL
    echo -e "${GREEN}✅ .env file created!${NC}"
else
    echo -e "${BLUE}✅ .env file already exists. Skipping config.${NC}"
fi

# 2. Install Backend Dependencies
echo -e "\n${BLUE}📦 Installing Backend Dependencies...${NC}"
cd backend
npm install
if [ $? -ne 0 ]; then echo -e "${RED}❌ Backend install failed.${NC}"; exit 1; fi
cd ..

# 3. Install Frontend Dependencies
echo -e "\n${BLUE}📦 Installing Frontend Dependencies...${NC}"
cd frontend
npm install --legacy-peer-deps
if [ $? -ne 0 ]; then echo -e "${RED}❌ Frontend install failed.${NC}"; exit 1; fi
cd ..

# 4. Database Setup prompt
echo -e "\n${YELLOW}🗄️  Database Setup${NC}"
echo -e "Requires PostgreSQL running on localhost:5432."
read -p "Do you want to initialize the database now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v psql &> /dev/null; then
        psql -d form_automation -f database/schema.sql
    else
        echo -e "${YELLOW}⚠️ 'psql' not found. Ensure DB 'form_automation' exists.${NC}"
    fi

    # Run Node scripts to seed data
    npx ts-node backend/scripts/setupAdmin.ts
    npx ts-node backend/scripts/initSessionTable.ts
fi

echo -e "\n${GREEN}✅ Setup Complete!${NC}"
echo -e "👉 Run './run.sh' to start the system."
