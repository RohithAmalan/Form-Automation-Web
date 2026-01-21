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

## ⚡ Quick Start

Get up and running in **2 minutes**.

### 1. Clone & Setup
```bash
git clone https://github.com/RohithAmalan/Form-Automation-Web.git
cd Form_Automation_3

# First, make sure they are executable (run this once):
chmod +x setup.sh run.sh

# Run the automated installer (Follow the prompts!)
./setup.sh
```

### 2. Start the App
```bash
./run.sh
```

> **Dashboard**: `http://localhost:3000`  
> **Backend**: `http://localhost:3001`

---

## 🔑 Default Credentials
If you skip the prompt setup, you can login with:
*   **Email**: `admin@local`
*   **Password**: `admin123`

## 🤖 AI Configuration (Important!)
To use the **automation features**, the system needs an **OpenRouter API Key**.

1.  **During Setup**: The `./setup.sh` script will ask you for this key.
2.  **Manual Update**: If you skipped it, open the `.env` file and add it manually:
    ```bash
    OPENROUTER_API_KEY=sk-or-v1-your-key-here...
    ```
    > **Note**: Without this key, the AI agent cannot analyze forms.



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

## ⚙️ Configuration (`config/settings.json`)

The system uses a nested `settings.json` file (managed via the **Settings Page**) to control runtime behavior dynamically.

```json
{
  "queue": {
    "pollInterval": 2000,          // (ms) How often worker checks for jobs
    "concurrency": 1,              // Max jobs running at once
    "maxRetries": 2,               // Max re-attempts before failure
    "retryBackoffMs": 2000,        // (ms) Wait time between retries
    "retryEscalation": false,      // If true, retried jobs become Priority -1
    "exclusivePriority": false,    // If true, pauses all non-urgent jobs
    "defaultPriority": 0           // 0=Normal, -1=Urgent
  },
  "form": {
    "headless": false,             // Run browser in background (true/false)
    "pageLoadTimeoutMs": 60000,    // (ms) Wait for page load
    "elementWaitTimeoutMs": 10000  // (ms) Wait for element to appear
  },
  "config": {
    "primaryModel": "openai/gpt-4... // Main AI Model
    "fallbackModel": "google/gemini.. // Backup AI Model
  }
}
```

> **Note**: Sensitive Infrastructure keys (`DATABASE_URL`, `GOOGLE_CLIENT_SECRET`) are kept in `.env`, while runtime behavior is in `settings.json`.

---
*Built by Rohith Amalan*
