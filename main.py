import asyncio
import os
import json
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from openai import AsyncOpenAI

load_dotenv()

# Configure OpenRouter Client
api_key = os.getenv("OPENROUTER_API_KEY")
if not api_key:
    raise ValueError("OPENROUTER_API_KEY not found in .env")

client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=api_key,
)

# Configuration
MODEL = "openai/gpt-4o-mini" # Switching to paid model to avoid free tier rate limits
TARGET_URL = "https://fs1.formsite.com/res/showFormEmbed?EParam=B6fiTn-RcO5Oi8C4iSTjsq4WXqv4L_Qk&748593425&EmbedId=748593425"

# Load form data
def load_form_data():
    try:
        with open("form_data.json", "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading form_data.json: {e}")
        return []

async def process_form(page, entry):
    # Determine URL
    url = entry.get("url", TARGET_URL)
    
    # Filter out 'url' from data to fill
    data_to_fill = {k: v for k, v in entry.items() if k != "url"}
    
    print(f"Propcessing entry for {data_to_fill.get('First Name', 'User')}...")
    print(f"Navigating to {url}...")
    await page.goto(url)
    await page.wait_for_load_state("networkidle")

    # Get relevant content
    content = await page.inner_html("body")
    if len(content) > 100000:
        content = content[:100000]

    print(f"Analyzing form with {MODEL}...")
    
    # Update global USER_DATA for the prompt generation helper if needed, 
    # but better to pass it. Refactoring get_ai_action_plan to accept data.
    actions = await get_ai_action_plan(content, data_to_fill)

    print(f"Received {len(actions)} actions from AI.")

    for action in actions:
        selector = action.get("selector")
        val = action.get("value")
        act_type = action.get("type", "fill")

        print(f"Executing: {act_type} on {selector} with '{val}'")

        try:
            # Highlight
            try:
                await page.evaluate(f"document.querySelector('{selector}').style.border = '2px solid red'")
            except:
                pass

            if act_type == "fill":
                 # Check for SELECT
                try:
                    tag_name = await page.locator(selector).evaluate("el => el.tagName", timeout=1000)
                    if tag_name == "SELECT":
                        try:
                            await page.select_option(selector, label=val)
                        except:
                            await page.select_option(selector, value=val)
                    else:
                        await page.fill(selector, str(val))
                except Exception as e:
                    print(f"DEBUG: Smart fill failed for {selector}: {e}")
                    if "Element is not an <input>" not in str(e):
                         await page.fill(selector, str(val))

            elif act_type == "click":
                await page.click(selector)

            await page.wait_for_timeout(500)

        except Exception as e:
            print(f"Failed action on {selector}: {e}")

    print("Form submission completed.")
    await page.wait_for_timeout(3000)

# Update helper to accept data
async def get_ai_action_plan(html_snippet, user_data):
    prompt = f"""
    You are an expert browser automation agent.
    
    TASK:
    Generate a JSON list of actions to fill the form below with this data:
    {json.dumps(user_data, indent=2)}

    HTML CONTEXT:
    ```html
    {html_snippet}
    ```

    REQUIREMENTS:
    1. Return strictly a JSON list. No markdown formatting.
    2. Example format:
       [
           {{"selector": "#name", "value": "John", "type": "fill"}},
           {{"selector": "#submit", "type": "click"}}
       ]
    3. Use 'fill' to input text.
    4. For dropdowns (<select>), use 'fill' and provide the EXACT VISIBLE TEXT of the option.
    5. Use 'click' for buttons (including "Submit") or checkboxes.
    6. Find the 'Submit' button and click it last.
    7. For dates, prefer filling the text input if available.
    """

    try:
        # Debug: Save HTML to file
        with open("debug_form.html", "w") as f:
            f.write(html_snippet)
            
        completion = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful automation assistant returning raw JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        content = completion.choices[0].message.content
        
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
        
        data = json.loads(content)
        if isinstance(data, dict):
            for key in data:
                if isinstance(data[key], list):
                    return data[key]
            return []
        return data

    except Exception as e:
        print(f"Error calling OpenRouter: {e}")
        return []

async def main():
    entries = load_form_data()
    if not entries:
        print("No entries found in form_data.json")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        for i, entry in enumerate(entries):
            print(f"\n--- Processing Entry {i+1}/{len(entries)} ---")
            await process_form(page, entry)
            # Optional: Refresh or new page for next entry if needed, but we iterate logic
            
        print("\nAll entries processes.")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
