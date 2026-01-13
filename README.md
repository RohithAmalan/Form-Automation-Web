# Intelligent Form Automation (Full-Stack)

A robust, AI-powered form automation agent featuring **Human-in-the-Loop (HITL)** capabilities, a production-grade **Job Queue**, and deep system observability. The system uses a **Next.js Frontend** for control and a **Node.js/Express Backend** with **Playwright** for automation, backed by **PostgreSQL**.

> **Pro Agent**: Capable of learning from profile data, handling file uploads, intelligent recovery, and integrated Email Automation.

## 🚀 Key Features

### 🔐 Authentication & Security [NEW]
*   **Google OAuth 2.0**: Secure login with your Google Account.
*   **Admin Access**: Dedicated "System Admin" login for management.
*   **Permissions**: Granular control for automation scopes (including Gmail).

### 🤖 Automation & Intelligence
*   **Human-in-the-Loop (HITL)**: Intelligently pauses when data is missing (e.g., File Uploads) and waits for user input via the dashboard.
*   **📂 Smart File Handling**: Support for **Multiple File Uploads**. The AI intelligently selects the correct file from your upload list.
*   **🧠 Profile Learning**: Automatically learns from your inputs and saves them to your profile.
*   **📧 Gmail Integration**: Capable of sending emails via your Gmail account directly from the automation queue.

### ⚙️ Robust Job Backend
*   **Queue Architecture**: Implements a generic Producer-Consumer job queue with PostgreSQL (`SKIP LOCKED`) for concurrency safety.
*   **Exclusive Priority**: Critical mode to pause all other jobs and focus resources on a single urgent task.
*   **Retry Logic**: Configurable exponential backoff and retry limits.
*   **Lifecycle Management**: Full state tracking: `PENDING` → `PROCESSING` → `PAUSED` → `COMPLETED` / `FAILED`.

### 📊 Observability
*   **Live Dashboard**: Real-time status, timeline visualization of every action.
*   **Global System Logs**: Unified stream of all agent activities across the platform.
*   **Settings Management**: dynamic configuration of timeouts, AI models, and queue behavior via the UI.

---

## 🛠️ Tech Stack

*   **Frontend**: Next.js 15, React 19, Tailwind CSS, Lucide Icons
*   **Backend**: Node.js, Express, TypeScript, Playwright, Passport.js
*   **AI**: OpenAI (GPT-4o) / Google Gemini (via OpenRouter)
*   **Database**: PostgreSQL (with `pg` and `uuid-ossp`)

---

## 📦 Setup & Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/RohithAmalan/Form-Automation_3.git
    cd Form_Automation_3
    ```

2.  **Install Dependencies**:
    ```bash
    # Root & Backend
    npm install
    
    # Frontend
    cd frontend && npm install && cd ..
    ```

3.  **Environment Variables**:
    Create a `.env` file in the root directory:
    ```env
    PORT=3001
    DATABASE_URL=postgresql://postgres:password@localhost:5432/form_automation
    OPENROUTER_API_KEY=sk-your-key
    SESSION_SECRET=dev_secret
    
    # Google OAuth
    GOOGLE_CLIENT_ID=your_id_here
    GOOGLE_CLIENT_SECRET=your_secret_here
    CALLBACK_URL=http://localhost:3001/auth/google/callback
    ```

4.  **Database Setup**:
    Initialize the schema and create the default admin user:
    ```bash
    # 1. Create Tables
    psql -d form_automation -f database/schema.sql
    
    # 2. Create Admin User & Session Table
    npx ts-node backend/scripts/setupAdmin.ts
    npx ts-node backend/scripts/initSessionTable.ts
    ```

---

## 🏃‍♂️ Usage

**Start the System** (Frontend + Backend):
```bash
./run.sh
```
*   **Dashboard**: `http://localhost:3000`
*   **API**: `http://localhost:3001`

### 🔑 Admin Login
If Google Login is not configured, you can use the local admin account:
*   **Email**: `admin@local`
*   **Password**: `admin123`

---

## 📁 Project Structure

*   `frontend/`: Next.js React Application (Logs, Dashboard, Sidebar).
*   `backend/src/`:
    *   `auth/`: Passport.js authentication strategies.
    *   `automation/`: Playwright logic & AI Prompts.
    *   `queue/`: **Task Queue Worker** (Producer/Consumer logic).
    *   `models/`: DB interaction (JobModel, LogModel).
    *   `scripts/`: DB Init & Migrations.
*   `database/`: SQL Schema & Migrations.

---
*Built by Rohith Amalan*
