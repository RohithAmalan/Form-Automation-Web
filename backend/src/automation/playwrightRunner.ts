import { chromium, Page, Frame } from 'playwright';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import * as cheerio from 'cheerio';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const apiKey = process.env.OPENROUTER_API_KEY;
console.log(`[PlaywrightRunner] Init OpenAI. Key Present: ${!!apiKey}, Length: ${apiKey?.length}`);
if (apiKey) {
    console.log(`[PlaywrightRunner] Key Start: ${apiKey.substring(0, 5)}...`);
}

const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "FormAutomation",
    }
});

const MODEL = "openai/gpt-4o-mini";

// Helper to clean HTML using Cheerio
function cleanHtml(rawHtml: string): string {
    const $ = cheerio.load(rawHtml);

    // Remove scripts, styles, iframes (unless crucial, but usually ads), svgs, noscript
    $('script').remove();
    $('style').remove();
    $('noscript').remove();
    $('iframe').remove(); // We handle frames separately in Playwright, so nested iframes are likely ads
    $('svg').remove();
    $('meta').remove();
    $('link').remove();

    // Remove known ad selectors (generic)
    $('.ad').remove();
    $('.ads').remove();
    $('[id*="google_ads"]').remove();
    $('[class*="ad-"]').remove();

    // Return body content only to save tokens
    return $('body').html() || "";
}

interface Action {
    selector: string;
    value?: string;
    type: "fill" | "click" | "upload" | "ask_user";
}

import { AutomationLogger, JobControls, JobParams } from '../types/job.types';

// Helper to clean HTML using Cheerio

// New helper to ask AI for a specific JS fix
async function getAiJavascriptFallback(html: string, selector: string, value: string): Promise<string> {
    const prompt = `
    You are a DOM Manipulation Expert.
    
    PROBLEM:
    I am trying to set the value of a dropdown (<select>) to "${value}", but it is not sticking or triggering validation.
    
    HTML CONTEXT:
    \`\`\`html
    ${html}
    \`\`\`
    
    TASK:
    Write a specific JavaScript snippet that I can run in the browser console to FORCE execution of this change.
    - Use 'document.querySelector("${selector}")' to find the element.
    - Try finding the option by text or value.
    - Force set the value.
    - Dispatch 'change', 'input', 'click', and 'blur' events manually.
    - If it looks like a React/Angular component, try to set the internal value tracker if known, or just use standard events aggressively.
    
    OUTPUT:
    Return ONLY the raw JavaScript code. No markdown. No comments wrapping it.
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: "system", content: "You are a coding machine. Return only code." },
                { role: "user", content: prompt }
            ]
        });

        let code = completion.choices[0].message.content || "";
        code = code.replace(/```javascript/g, "").replace(/```/g, "").trim();
        return code;
    } catch (e) {
        console.error("AI Fallback Error:", e);
        return "";
    }
}

import pool from '../config/db';
import { JobModel } from '../models/job.model';
import { TemplateModel } from '../models/template.model';

// [Removed local Helper to update custom_data in DB]
// [Removed local Helper to SAVE learned data to Profile]
// [Removed local waitForResume]

// Helper for Manual Pause
// [Removed local checkForManualPause]


async function getAiActionPlan(html: string, profileData: any): Promise<Action[]> {
    // Check if uploaded_file_path contains JSON array or single string
    let availableFiles: string[] = [];
    if (profileData.uploaded_file_path) {
        try {
            const parsed = JSON.parse(profileData.uploaded_file_path);
            if (Array.isArray(parsed)) availableFiles = parsed;
            else availableFiles = [profileData.uploaded_file_path];
        } catch {
            availableFiles = [profileData.uploaded_file_path];
        }
    }

    const hasFile = availableFiles.length > 0;
    const fileListStr = JSON.stringify(availableFiles);
    const filePathInfo = hasFile
        ? `Files available to upload: ${fileListStr}. Look for <input type="file">.`
        : "No file path provided in profile. If <input type='file'> exists, you MUST ask the user for it.";

    const prompt = `
    You are an expert browser automation agent.
    
    TASK:
    Generate a JSON list of actions to fill the form below with this data:
    ${JSON.stringify(profileData, null, 2)}
    
    ${filePathInfo}

    HTML CONTEXT:
    \`\`\`html
    ${html}
    \`\`\`

    REQUIREMENTS:
    1. Return strictly a valid JSON Object. No markdown formatting.
    2. Example format:
       {
         "actions": [
            {"selector": "#name", "value": "John", "type": "fill"},
            {"selector": "input[type='file']", "value": "['/path/1', '/path/2']", "type": "upload"},
            {"selector": "#submit", "type": "click"},
            {"selector": "field_label", "value": "Question for user?", "type": "ask_user"}
         ]
       }
    3. Use 'fill' to input text.
    4. For dropdowns (<select>):
       - Use 'fill' type.
       - The 'value' MUST be the text of the option you want to select.
    5. Use 'click' for buttons, checkboxes, AND RADIO BUTTONS.
    6. For file uploads (<input type="file">):
       - Use type 'upload'.
       - The 'value' should be the JSON stringified array of paths: '${fileListStr}'.
       - If there are multiple file inputs, assign the appropriate file from the list if possible, or use all.
    7. CRITICAL: Find the 'Submit' button and \`click\` it as the VERY LAST action.

    8. SPECIAL INSTRUCTION FOR DATES:
       - The profile data includes keys: "current_date" (YYYY-MM-DD), "current_day", "current_year".
       - If you see a field asking for "Today's Date", "Date", or similar, USE these values!
       - DO NOT ask the user for the date if you can infer it from these keys.
       - If the field expects a specific format (e.g. MM/DD/YYYY), convert "current_date" accordingly.
    
    9. MISSING DATA STRATEGY (HUMAN-IN-THE-LOOP):
       - YOUR GOAL IS TO FILL **EVERY** VISIBLE FIELD, NOT JUST REQUIRED ONES.
       - If a visible field (<input>, <select>, <textarea>) needs a value:
         -> Check the provided profileData.
         -> If the key is missing OR the value is empty:
            -> CREATE an action with type "ask_user".
            -> "target_selector": The CSS SELECTOR of the input field.
            -> "question_label": The HUMAN-READABLE text label.
       - FOR FILE UPLOADS:
         - If <input type="file"> exists and profileData.uploaded_file_path is missing/empty:
         - YOU MUST GENERATE type "upload" with value "". This will trigger the system to pause and ask the user.
       - Do not skip "Address Line 2" or other optional fields if they are visible.
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: "system", content: "You are a helpful automation assistant returning raw JSON." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            max_tokens: 3000
        });

        let content = completion.choices[0].message.content || "{}";
        // Clean markdown
        content = content.replace(/```json/g, "").replace(/```/g, "");

        const data = JSON.parse(content);
        let actions: any[] = [];

        // Handle nested keys like {"actions": [...]}
        if (data.actions && Array.isArray(data.actions)) actions = data.actions;
        else if (Array.isArray(data)) actions = data;
        else {
            // Fallback: check values
            for (const key in data) {
                if (Array.isArray(data[key])) {
                    actions = data[key];
                    break;
                }
            }
        }

        // Normalize actions to standard format
        return actions.map(a => ({
            type: a.type,
            selector: a.selector || a.target_selector,
            value: a.value || a.question_label
        }));

    } catch (error) {
        console.error("AI Error:", error);
        return [];
    }
}

async function executeActions(page: Page, actions: Action[], profileData: any, logger: AutomationLogger, controls: JobControls) {
    for (const action of actions) {
        // --- MANUAL PAUSE CHECK ---
        await controls.checkPause();
        // --------------------------

        const { selector, value, type } = action;

        try {
            // Find which frame has this selector
            let targetFrame: any = null;
            // Check main frame first
            if (await page.$(selector).catch(() => null)) {
                targetFrame = page;
            } else {
                // Check other frames
                for (const frame of page.frames()) {
                    if (await frame.$(selector).catch(() => null)) {
                        targetFrame = frame;
                        break;
                    }
                }
            }

            // If not found, skip
            if (!targetFrame) {
                // One retry for dynamic content?
                await page.waitForTimeout(1000);
                if (await page.$(selector).catch(() => null)) targetFrame = page;
            }

            if (!targetFrame) {
                await logger.log(`Element not found: ${selector}`, 'warning');
                continue;
            }

            // Highlight
            await targetFrame.evaluate((sel: string) => {
                try {
                    const el = document.querySelector(sel) as HTMLElement;
                    if (el) {
                        el.style.border = '2px solid red';
                        el.scrollIntoView({ block: 'center', inline: 'center' });
                    }
                } catch (e) { }
            }, selector);

            if (type === 'fill') {
                // Check editable
                const isEditable = await targetFrame.locator(selector).isEditable().catch(() => true);
                if (!isEditable) {
                    await logger.log(`Skipping read-only: ${selector}`, 'warning');
                    continue;
                }

                // Handle Select or Input
                const tagName = await targetFrame.evaluate((sel: string) => {
                    const el = document.querySelector(sel);
                    return el ? el.tagName : '';
                }, selector);

                if (tagName === 'SELECT') {

                    const options = await targetFrame.evaluate((sel: string) => {
                        const select = document.querySelector(sel) as HTMLSelectElement;
                        if (!select) return [];
                        return Array.from(select.options).map(opt => ({
                            text: opt.text.trim(),
                            value: opt.value,
                            index: opt.index
                        }));
                    }, selector);

                    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
                    const targetVal = normalize(value || "");

                    // Find Match - Enhanced Logic
                    let bestMatch = options.find((o: any) => o.text === value);
                    if (!bestMatch) bestMatch = options.find((o: any) => normalize(o.text) === targetVal);
                    if (!bestMatch) bestMatch = options.find((o: any) => normalize(o.text).includes(targetVal));
                    if (!bestMatch) bestMatch = options.find((o: any) => o.value === value);

                    // Try strict label match if value failed
                    if (!bestMatch && value) {
                        bestMatch = options.find((o: any) =>
                            o.text.toLowerCase().trim() === value.toLowerCase().trim()
                        );
                    }

                    if (bestMatch) {
                        // STRATEGY: Double Selection + Focus/Blur
                        await targetFrame.focus(selector);

                        // Select a DIFFERENT option first (to force change event)
                        const dummyOption = options.find((o: any) => o.index !== bestMatch.index);
                        if (dummyOption) {
                            await targetFrame.selectOption(selector, { index: dummyOption.index });
                            await page.waitForTimeout(200);
                        }

                        // Select the CORRECT option
                        await logger.log(`Selecting option "${bestMatch.text}" (val: ${bestMatch.value})`, 'action');
                        await targetFrame.selectOption(selector, { value: bestMatch.value });
                    } else {
                        // Fallback
                        await logger.log(`Option match failed. Trying direct selectOption by label: "${value}"`, 'warning');
                        try {
                            await targetFrame.selectOption(selector, { label: value });
                        } catch (e) {
                            await targetFrame.selectOption(selector, { value: value }).catch(() => { });
                        }
                    }

                    // Force Events & Blur
                    await page.waitForTimeout(100);
                    await targetFrame.locator(selector).dispatchEvent('change');
                    await targetFrame.locator(selector).dispatchEvent('input');
                    await targetFrame.locator(selector).blur();

                    // Debug Final State
                    const finalValue = await targetFrame.evalOnSelector(selector, (el: HTMLSelectElement) => el.value);
                    await logger.log(`Final Dropdown State: ${finalValue}`, 'info');

                } else {
                    await targetFrame.fill(selector, String(value));
                }

            } else if (type === 'click') {
                // Self-Healing
                const isOption = selector.toLowerCase().includes('option');
                if (isOption) {
                    const parentId = await targetFrame.evaluate((sel: string) => {
                        const el = document.querySelector(sel);
                        const p = el?.closest('select');
                        return p ? p.id : null;
                    }, selector);

                    const val = await targetFrame.locator(selector).getAttribute('value');

                    if (parentId && val) {
                        await targetFrame.selectOption(`#${parentId}`, { value: val });
                        await logger.log(`Healed click-option to select-option`, 'action', { selector });
                        continue;
                    }
                }

                await targetFrame.click(selector);
                await page.waitForTimeout(1000); // Wait for reaction

            } else if (type === 'ask_user') {
                // --- HUMAN IN THE LOOP (TEXT) ---
                await logger.log(`AI asking user. Selector: "${selector}", Value: "${value}"`, 'warning');

                const labelEncoded = value || selector;
                const userResponse = await controls.askUser('text', labelEncoded);

                if (userResponse) {
                    if (profileData.profile_id) {
                        await controls.saveLearnedData(labelEncoded, userResponse);
                        await logger.log(`Saved "${labelEncoded}" to your profile for future use.`, 'success');
                    }
                    await logger.log(`User provided: "${userResponse}"`, 'success');

                    // Attempt auto-fill
                    let filled = false;
                    if (selector.includes('#') || selector.includes('.') || selector.includes('[')) {
                        try {
                            await targetFrame.fill(selector, userResponse);
                            filled = true;
                        } catch (e) { }
                    }
                    if (!filled) {
                        await logger.log(`Could not auto-fill field "${selector}" with "${userResponse}". Please check manually.`, 'warning');
                    } else {
                        await logger.log(`Auto-filled "${selector}" successfully.`, 'action');
                    }
                } else {
                    throw new Error("User cancelled text input.");
                }

            } else if (type === 'upload') {
                // 1. Determine files to use
                // Override with current job's files if available (REPLAY override)
                let filesToUse: string[] = [];

                // Logic: 
                // A. Check if current job profile has files (NEW files for this run)
                if (profileData.uploaded_file_path) {
                    try {
                        const parsed = JSON.parse(profileData.uploaded_file_path);
                        if (Array.isArray(parsed)) filesToUse = parsed;
                        else filesToUse = [profileData.uploaded_file_path];
                    } catch {
                        filesToUse = [profileData.uploaded_file_path];
                    }
                }

                // B. If NO new files, use value from Action (Cached path)
                if (filesToUse.length === 0 && value) {
                    try {
                        const parsed = JSON.parse(value);
                        if (Array.isArray(parsed)) filesToUse = parsed;
                        else filesToUse = [value];
                    } catch {
                        filesToUse = [value];
                    }
                }

                // 2. Validate Files
                const validPaths: string[] = [];
                for (const fPath of filesToUse) {
                    if (fPath && (fs.existsSync(path.resolve(fPath)) || fs.existsSync(path.join(__dirname, '../../../', fPath)))) {
                        const p = fs.existsSync(path.resolve(fPath)) ? path.resolve(fPath) : path.join(__dirname, '../../../', fPath);
                        validPaths.push(p);
                    }
                }

                if (validPaths.length === 0) {
                    await logger.log(`Missing file for upload selector: ${selector}. Pausing for user input...`, 'warning');
                    const newPath = await controls.askUser('file', 'Missing File Upload');
                    if (newPath) {
                        // Simplify: Assume user provides single path string
                        validPaths.push(newPath); // Usually absolute if from prompt
                        await logger.log(`User provided file: ${newPath}. Resuming...`, 'success');
                    } else {
                        throw new Error("User cancelled or timed out on file upload.");
                    }
                }

                if (validPaths.length > 0) {
                    await targetFrame.setInputFiles(selector, validPaths);
                    await logger.log(`Uploaded ${validPaths.length} file(s): ${validPaths.map(p => path.basename(p)).join(', ')}`, 'action');
                }
            }

            // Brief pause
            await page.waitForTimeout(500);

        } catch (err: any) {
            await logger.log(`Failed action on ${selector}`, 'error', { error: err.message });
        }
    }
}

/**
 * Pure Automation Function
 * Doesn't know about DB. Communicates via Logger callback.
 * Throws error on failure, Resolves on success.
 */
export async function processJob({ url, profileData, logger, checkPause, askUser, saveLearnedData }: JobParams) {
    // Controls Object
    const controls: JobControls = { checkPause, askUser, saveLearnedData };

    // VITALITY CHECK
    try {
        await logger.log('Testing AI connection...', 'info');
        // ... (connection logic)
    } catch (e: any) {
        await logger.log(`AI Connection Failed: ${e.message}`, 'error');
        throw e; // Fail early
    }

    const browser = await chromium.launch({ headless: false }); // Visible for demo
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await logger.log('Navigating to URL...', 'info');
        await page.goto(url);
        await page.waitForLoadState('networkidle');


        // Extract HTML form frames
        // STRATEGY: Aggregate HTML from all frames to ensure AI sees embedded forms (e.g. Typeform, Google Forms)
        let rawContent = await page.content();
        let framesHtml = "";

        for (const frame of page.frames()) {
            try {
                if (frame === page.mainFrame()) continue;
                const frameContent = await frame.content();
                framesHtml += `\n<!-- FRAME: ${frame.url()} -->\n<div class="frame-content" style="border:5px solid red; margin:10px;">${frameContent}</div>`;
            } catch (e) { }
        }

        if (rawContent.includes('</body>')) {
            rawContent = rawContent.replace('</body>', `${framesHtml}</body>`);
        } else {
            rawContent += framesHtml;
        }

        const cleanedHtml = cleanHtml(rawContent);


        // ==========================================
        // 🧠 CACHE / REPLAY LOGIC
        // ==========================================
        let actions: Action[] = [];
        let fromCache = false;
        let success = false;

        // 1. Try to fetch cached actions
        try {
            const cached = await TemplateModel.getByUrl(url);
            if (cached && cached.actions && cached.actions.length > 0) {
                await logger.log('⚡ Found cached instructions. Attempting to Replay...', 'success');
                actions = cached.actions;
                fromCache = true;

                // Try Executing Cache
                try {
                    await executeActions(page, actions, profileData, logger, controls);
                    success = true;
                    await logger.log('✅ Cache Replay Successful!', 'success');
                } catch (e: any) {
                    await logger.log(`⚠️ Cache Replay Failed (${e.message}). Falling back to AI...`, 'warning');
                    success = false;
                    // Reset for AI
                    actions = [];
                }
            }
        } catch (e) {
            console.error("Cache Check Error:", e);
        } // Ignore DB errors, just proceed

        // 2. Fallback to AI (If no cache or cache failed)
        if (!success) {
            await logger.log('🤖 Analyzing page with AI (Slow path)...', 'info');

            // Re-eval HTML just in case
            // (We already cleaned it above)

            actions = await getAiActionPlan(cleanedHtml, profileData);
            await logger.log(`Executing ${actions.length} actions`, 'info', { actions });

            // Execute AI Actions
            await executeActions(page, actions, profileData, logger, controls);

            // If we reached here without error, it was successful.
            success = true;

            // 3. Save to Cache
            try {
                logger.log(`DEBUG: Actions Length: ${actions.length}`, 'info');
                console.log(`DEBUG: Saving ${actions.length} actions to cache for ${url}`);
                if (actions.length > 0) {
                    await TemplateModel.upsert(url, actions);
                    await logger.log('💾 Saved actions to cache for future speedup.', 'success');
                    console.log("DEBUG: Save Complete");
                } else {
                    console.log("DEBUG: Actions length is 0, skipping save");
                }
            } catch (saveErr: any) {
                console.error("DEBUG: Save Failed:", saveErr);
                logger.log(`Cache Save Failed: ${saveErr.message}`, 'error');
            }
        }

        // --- VALIDATION & RECOVERY STEP ---
        await logger.log("Validating form completeness...", "info");
        const validationPrompt = `
            You are a QA Agent.
            HTML:
            \`\`\`html
            ${await page.content()}
            \`\`\`
            TASK: Identify missing fields. Return JSON { "missing_fields": [{ "label": "...", "selector": "...", "type": "..." }] }.
        `;

        try {
            const valCompletion = await openai.chat.completions.create({
                model: MODEL,
                messages: [{ role: "user", content: validationPrompt }],
                response_format: { type: "json_object" },
                max_tokens: 1000
            });
            const valContent = valCompletion.choices[0].message.content || "{}";
            const valData = JSON.parse(valContent);
            const missingFields = valData.missing_fields || [];

            if (Array.isArray(missingFields) && missingFields.length > 0) {
                await logger.log(`Found ${missingFields.length} unfilled fields. Asking user...`, 'warning');

                // Create actions to ask user for each missing field
                const recoveryActions: Action[] = missingFields.map((field: any) => ({
                    selector: field.selector,
                    value: field.label || "Value needed",
                    type: 'ask_user' as const
                }));

                await executeActions(page, recoveryActions, profileData, logger, controls);
            } else {
                await logger.log("Validation passed. All relevant fields appear filled.", "info");
            }
        } catch (e: any) {
            await logger.log(`Validation check skipped/failed: ${e.message}`, 'warning');
        }

        await logger.log('Job Completed Successfully', 'success');

    } catch (err: any) {
        console.error("Automation Error:", err);
        await logger.log(`Job Failed: ${err.message}`, 'error');
        throw err;
    } finally {
        // await browser.close(); 
        console.log("Browser left open for debugging.");
    }
}
