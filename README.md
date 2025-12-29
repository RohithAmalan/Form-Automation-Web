# Intelligent Form Automation (Full-Stack)

A robust, AI-powered form automation agent featuring **Human-in-the-Loop (HITL)** capabilities. The system uses a **Next.js Frontend** for control and a **Node.js/Express Backend** with **Playwright** for automation, backed by **PostgreSQL**.

## 🚀 Key Features

*   **Human-in-the-Loop (HITL)**: Intelligently pauses when data is missing (e.g., File Uploads, specific text fields) and waits for user input via the dashboard.
*   **📂 Smart File Handling (New)**: Support for **Multiple File Uploads**. The AI intelligently selects the correct file from your upload list for specific fields (e.g., Resume vs. Cover Letter).
*   **⚡ Quick Replay & Caching (New)**: Automatically caches successful form actions. Re-run complex forms in seconds with the **Quick Replay** sidebar.
*   **📝 Organize History (New)**: Rename or Delete your Quick Replay templates to keep your workspace clean.
*   **🧠 Profile Learning**: Automatically learns from your inputs. If you provide information once (e.g., "Address Line 2"), it saves it to your profile and never asks again.
*   **Full-Stack Dashboard**: Real-time status, logs, and interaction UI with a professional, icon-based aesthetic.

## 🛠️ Tech Stack

*   **Frontend**: Next.js, React, Tailwind CSS
*   **Backend**: Node.js, Express, TypeScript
*   **Automation**: Playwright, OpenAI (GPT-4o/Gemini via OpenRouter)
*   **Database**: PostgreSQL
*   **Process Management**: Concurrently (run both servers with one command)

## 📦 Setup & Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/RohithAmalan/Form-Automation_2.git
    cd Form_Automation_2
    ```

2.  **Install Dependencies**:
    ```bash
    # Install Root/Backend dependencies
    npm install
    
    # Install Frontend dependencies
    cd frontend && npm install && cd ..
    ```

3.  **Environment Variables**:
    Create a `.env` file in the root directory:
    ```env
    PORT=3001
    DATABASE_URL=postgresql://postgres:password@localhost:5432/form_automation_v2
    OPENROUTER_API_KEY=sk-or-your-key-here
    ```

4.  **Database Setup**:
    Ensure PostgreSQL is running, then initialize the schema:
    ```bash
    npx ts-node backend/src/scripts/init_db.ts
    ```

## 🏃‍♂️ Usage

**Start the System** (Frontend + Backend):
```bash
./run.sh
```
*   **Dashboard**: `http://localhost:3000`
*   **API**: `http://localhost:3001`

### Workflow
1.  **Submit a Job**: Enter a Form URL in the dashboard.
2.  **Monitor**: Watch real-time logs and status.
3.  **Handle Pauses**:
    *   If the bot misses a field (e.g., "Proposal Title") or needs a file, the status changes to **⚠️ NEED INPUT**.
    *   Click **RESUME**.
    *   Enter the value or upload the file in the popup.
    *   The bot resumes and completes the form.

## 📁 Project Structure

*   `frontend/`: Next.js React Application (Dashboard, Modals).
*   `backend/src/`:
    *   `automation/`: Core Playwright logic & AI Prompts.
    *   `controllers/` & `routes/`: API endpoints.
    *   `models/`: DB interaction (Jobs, Profiles, Logs).
    *   `queue/`: Job processing worker.
*   `database/`: SQL Schema.

---
*Built by Rohith Amalan*
