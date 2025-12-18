# Form Automation with OpenRouter

This project automates form submission using **Playwright** for browser control and **OpenRouter (GPT-4o-mini)** for intelligent decision making.

## Setup

1.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    playwright install
    ```

2.  **Environment Variables**:
    Create a `.env` file with your OpenRouter key:
    ```env
    OPENROUTER_API_KEY=sk-or-v1-...
    ```

## Usage

1.  **Edit Form Data**:
    Update `form_data.json` with the entries you want to submit.

2.  **Run Automation**:
    ```bash
    python3 main.py
    ```

## Structure
- `main.py`: Core automation logic (Hybrid Playwright + LLM).
- `form_data.json`: Data source for bulk processing.
- `requirements.txt`: Python package dependencies.
