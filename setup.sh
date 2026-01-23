#!/bin/bash

# define colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting Auto-Setup for Form Automation System...${NC}"

# 1. Environment Setup (Interactive)
if [ ! -f .env ]; then
    echo -e "${BLUE}⚠️  No .env file found. Let's configure it now.${NC}"
    
    # --- CLOUD DEMO CONFIGURATION ---
    # Paste your Neon/Supabase URL here to make it auto-connect for the mentor:
    DEMO_DB_URL="postgresql://neondb_owner:npg_Slyq5AdbGO3M@ep-snowy-breeze-ahwl6yw8.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" 
    # --------------------------------

    echo -e "\n${BLUE}--- Database Config ---${NC}"
    if [ -n "$DEMO_DB_URL" ]; then
         echo -e "${GREEN}✨ Using Embedded Cloud Database URL!${NC}"
         DB_URL=$DEMO_DB_URL
    else
        read -p "Enter Database Password [default: password]: " DB_PASS
        DB_PASS=${DB_PASS:-password}
        DB_URL="postgresql://postgres:${DB_PASS}@localhost:5432/form_automation"
    fi

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
echo -e "\n${MAGENTA}📦 [Step 2/4] Installing Backend Dependencies...${NC}"
cd backend
npm install
if [ $? -ne 0 ]; then echo -e "${RED}❌ Backend install failed.${NC}"; exit 1; fi
cd ..

# 3. Install Frontend Dependencies
echo -e "\n${CYAN}💻 [Step 3/4] Installing Frontend Dependencies...${NC}"
cd frontend
npm install --legacy-peer-deps
if [ $? -ne 0 ]; then echo -e "${RED}❌ Frontend install failed.${NC}"; exit 1; fi
cd ..

# 4. Database Setup prompt
echo -e "\n${YELLOW}🗄️  [Step 4/4] Database Setup${NC}"
echo -e "Requires PostgreSQL running on localhost:5432."
read -p "Do you want to initialize the database now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # PRE-CHECK: Is Postgres actually running & accessible?
    echo -e "${YELLOW}🔍 Checking Database Connection...${NC}"
    
    if command -v psql &> /dev/null; then
        # Check connection explicitly
        if ! psql -U postgres -h localhost -c "\q" > /dev/null 2>&1; then
             echo -e "${RED}❌ Error: Could not connect to PostgreSQL at localhost:5432.${NC}"
             echo -e "${YELLOW}👉 Make sure the Postgres server is STARTED.${NC}"
             echo -e "${YELLOW}👉 Make sure the password in .env matches your local DB password.${NC}"
             echo -e "   (Try running 'psql -U postgres -h localhost' manually to debug)"
             exit 1
        fi

        # Check if database exists, create if not
        psql -U postgres -h localhost -tc "SELECT 1 FROM pg_database WHERE datname = 'form_automation'" | grep -q 1 || psql -U postgres -h localhost -c "CREATE DATABASE form_automation"
        
        # Run Schema
        psql -d form_automation -f database/schema.sql
        
        # Run Node scripts to seed data ONLY if DB is okay
        echo -e "${MAGENTA}🌱 Seeding default data...${NC}"
        npx ts-node backend/scripts/setupAdmin.ts
        npx ts-node backend/scripts/initSessionTable.ts

    else
        echo -e "${RED}❌ 'psql' command not found.${NC}"
        echo -e "${YELLOW}⚠️  PostgreSQL is not installed or not in PATH.${NC}"
        echo -e "${YELLOW}👉 If you are using a CLOUD DATABASE (Neon/Supabase), this is fine!${NC}"
        echo -e "   Just manually update the DATABASE_URL in the .env file."
        echo -e "   Skipping local database setup..."
        # Do NOT exit 1 here, just continue
    fi
fi
fi

echo -e "\n${GREEN}✅ Setup Complete!${NC}"
echo -e "👉 Run './run.sh' to start the system."
