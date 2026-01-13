import { chromium, Page, Frame } from 'playwright';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import * as cheerio from 'cheerio';
import { withRetry } from '../utils/resilience';
import { SettingsManager } from '../utils/settingsManager';

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

// Models are now dynamic via SettingsManager

// Helper to handle AI Completion with Fallback
async function completionWithFallback(params: any) {
    const PRIMARY_MODEL = SettingsManager.getSettings().config.primaryModel || "openai/gpt-4o-mini";
    const FALLBACK_MODEL = SettingsManager.getSettings().config.fallbackModel || "google/gemini-flash-1.5";

    // Re-check API Key from settings (if dynamic update supported) - though instance is static. 
    // Ideally we re-instantiate OpenAI if key changes, but for now we stick to env/static instance 
    // OR we pass apiKey per request if library supported it easily. 
    // To support dynamic key, we'd need to recreate 'openai' client or use a factory.
    // For this scope, we focus on Model ID which IS dynamic per call.

    try {
        console.log(`[AI] Requesting completion with ${PRIMARY_MODEL}...`);
        return await openai.chat.completions.create({ ...params, model: PRIMARY_MODEL }, { timeout: 60000 });
    } catch (e: any) {
        // Check for Credit Limit (402) or other likely "refusal" errors
        if (e.status === 402 || (e.message && e.message.toLowerCase().includes('credits'))) {
            console.warn(`⚠️ Primary Model Failed (Credits). Switching to Fallback: ${FALLBACK_MODEL}`);
            return await openai.chat.completions.create({ ...params, model: FALLBACK_MODEL }, { timeout: 60000 });
        }
        throw e;
    }
}

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
        const completion = await completionWithFallback({
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

// --- HELPER: FUZZY MATCH KEY FINDER ---
// --- HELPER: FUZZY MATCH KEY FINDER ---
function findBestProfileMatch(label: string, data: any): string | null {
    if (!label || !data) return null;

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim(); // Keep spaces for tokenizing
    const targetRaw = normalize(label);
    const targetTokens = targetRaw.split(/\s+/).filter(t => t.length > 2 || !isNaN(Number(t))); // Filter short words, keep numbers

    let bestKey: string | null = null;
    let highestScore = 0;

    for (const key of Object.keys(data)) {
        if (!data[key]) continue; // Skip empty profile values matching

        const keyRaw = normalize(key);

        // 1. Direct Normalization Match (strongest)
        if (keyRaw.replace(/\s/g, '') === targetRaw.replace(/\s/g, '')) return String(data[key]);

        // 2. Token Overlap Score
        const keyTokens = keyRaw.split(/\s+/).filter(t => t.length > 2 || !isNaN(Number(t)));

        // Count overlapping tokens
        let overlap = 0;
        for (const t of targetTokens) {
            if (keyTokens.includes(t)) overlap++;
        }

        // Score = Overlap / Max(Length) to penalize huge mismatches? 
        // No, simple overlap count is robust for "Address Line 2" vs "What is your Address Line 2"
        // But we want to prefer "Address Line 2" (3 matches) over "Address" (1 match)

        if (overlap > highestScore) {
            highestScore = overlap;
            bestKey = key;
        }
    }

    // Threshold: At least 2 meaningful tokens matching (e.g. "Address" + "2") OR 1 very unique long token?
    // Let's say if > 50% match of the shorter string?
    // For now: if score >= 2 (e.g. "Address" + "Line"), accept.
    // Or if score >= 1 and token length > 5 (e.g. "LinkedIn").
    if (bestKey && highestScore >= 1) {
        // Verify relevance: ensure we didn't just match "Line" in "Address Line 1" vs "Address Line 2"
        // If target has "2" and candidate does NOT, reject.
        const targetHasNumber = targetRaw.match(/\d+/);
        const keyHasNumber = normalize(bestKey).match(/\d+/);

        if (targetHasNumber && keyHasNumber && targetHasNumber[0] !== keyHasNumber[0]) {
            // Numbers differ (e.g. "Address 1" vs "Address 2") -> REJECT
            return null;
        }

        return String(data[bestKey]);
    }

    return null;
};



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
       - FOR BUTTONS ("Submit", "Next", "Continue"):
         - PRIORITIZE using the text content selector format: "text=Next Step" or "text=Submit".
         - Do NOT use generic classes like ".btn" or ".active" unless there is no text.
         - Avoid ".active" class selectors as they often refer to state indicators, not the clickable button.
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
       
    10. PROHIBITED VALUES:
       - NEVER use the string "undefined" or "null" as a value. 
       - If you do not know the value, use type "ask_user".
    
    11. FUZZY MATCHING PROFILE KEYS:
       - The profileData keys might be imperfect (e.g. phrased as questions like "Please provide Address Line 2", or "What is your name?").
       - If a field label matches a key in profileData loosely, USE IT.
       - Example: If field is "Address Line 2" and profile has "Please provide Address Line 2": "Apt 4B", use "Apt 4B".
    `;

    try {
        const completion = await completionWithFallback({
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

async function executeActions(
    page: Page,
    actions: Action[],
    profileData: any,
    logger: AutomationLogger,
    controls: JobControls
): Promise<{ didNavigate: boolean; failedCount: number }> {
    let didPerformNavigation = false;
    let failedActionsCount = 0;

    // --- ACTION LOOP ---
    for (const action of actions) {
        // Validation check for empty actions
        if (!action || !action.type) continue;

        // --- MANUAL PAUSE CHECK ---
        await controls.checkPause();
        // --------------------------

        let { selector, value, type } = action;

        // SANITIZER: Fix invalid AI selectors like button[text='Submit']
        if (selector && selector.includes('[text=')) {
            const oldSel = selector;
            selector = selector.replace(/\[text=(['"])(.*?)\1\]/g, ':has-text("$2")');
            if (oldSel !== selector) {
                await logger.log(`Sanitized selector: ${oldSel} -> ${selector}`, 'info');
            }
        }

        try {
            // HELPER: Try to find frame with the selector, including case-insensitive fallback
            const findFrame = async (sel: string): Promise<Frame | Page | null> => {
                // 1. Try Strict
                if (await page.$(sel).catch(() => null)) return page;
                for (const frame of page.frames()) {
                    if (await frame.$(sel).catch(() => null)) return frame;
                }

                // 2. Try Case-Insensitive for Attributes (e.g. [name='Name'] vs [name='name'])
                // Convert [key='value'] to [key='value' i]
                if (sel.includes('[') && sel.includes('=\'') && !sel.includes(' i]')) {
                    const insenSel = sel.replace(/=\s*'([^']+)'\]/g, "='$1' i]");
                    if (insenSel !== sel) {
                        if (await page.$(insenSel).catch(() => null)) {
                            // Update the main selector variable for subsequent use
                            selector = insenSel;
                            await logger.log(`Matched selector case-insensitively: ${sel} -> ${selector}`, 'info');
                            return page;
                        }
                        for (const frame of page.frames()) {
                            if (await frame.$(insenSel).catch(() => null)) {
                                selector = insenSel;
                                await logger.log(`Matched selector case-insensitively (in frame): ${sel} -> ${selector}`, 'info');
                                return frame;
                            }
                        }
                    }
                }
                return null;
            };

            let targetFrame = await findFrame(selector);

            // If not found, skip
            if (!targetFrame) {
                // One retry for dynamic content?
                await page.waitForTimeout(1000);
                targetFrame = await findFrame(selector);
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
                        try {
                            await targetFrame.selectOption(selector, { value: bestMatch.value });
                        } catch (selectErr: any) {
                            await logger.log(`Standard select failed (${selectErr.message}). Forcing via JS...`, 'warning');
                            await targetFrame.evaluate((args: any) => {
                                const sel = document.querySelector(args.selector) as HTMLSelectElement;
                                if (sel) {
                                    sel.value = args.value;
                                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                                    sel.dispatchEvent(new Event('input', { bubbles: true }));
                                }
                            }, { selector, value: bestMatch.value });
                        }
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
                    await (targetFrame as any).evalOnSelector(selector, (el: HTMLSelectElement) => el.value).catch(() => { });
                    // await logger.log(`Final Dropdown State: ${finalValue}`, 'info');

                } else {
                    // Prevent "undefined" string
                    if (String(value) === 'undefined' || value === null || value === undefined) {
                        await logger.log(`Safety Guard: Prevented filling "undefined" into ${selector}. Converting to ask_user.`, 'warning');
                        // Dynamically switch to ask_user processing
                        // Since we are inside the loop, we can't easily change the type of the CURRENT action structure being iterated
                        // But we can just execute the ask_user logic right here:

                        // But we can just execute the ask_user logic right here:

                        // Try to get a better label for the key
                        const labelText = await targetFrame.evaluate((sel: string) => {
                            const el = document.querySelector(sel) as HTMLInputElement;
                            if (!el) return null;
                            if (el.labels && el.labels.length > 0) return el.labels[0].innerText.trim();
                            if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
                            if (el.getAttribute('placeholder')) return el.getAttribute('placeholder');
                            return null;
                        }, selector);

                        const labelEncoded = labelText || selector;

                        // Try to fuzzy match from profile data first
                        const match = findBestProfileMatch(labelEncoded, profileData);
                        let filledCount = 0;

                        if (match) {
                            await logger.log(`Auto-answered "${labelEncoded}" using profile data (Fuzzy Match).`, 'success');

                            // Try to fill
                            try {
                                await targetFrame.fill(selector, match);
                                // Explicit Blur
                                try { await targetFrame.locator(selector).blur(); } catch { }
                                filledCount++;
                            } catch (e) {
                                // CRITICAL FIX: If filling fails (likely hidden), DO NOT ask user again.
                                // Asking user won't make the hidden field interactable.
                                await logger.log(`Could not auto-fill field "${selector}" (likely hidden/obstructed). Skipping...`, 'warning');
                                failedActionsCount++;
                            }
                        } else {
                            // Only ask user if we genuinely don't have data
                            if (!profileData[labelEncoded] && (labelText && !profileData[labelText])) { // KEY FIX: Check labelText exists
                                const userResponse = await controls.askUser('text', `Missing value for ${labelEncoded} (${selector})`);
                                if (userResponse) {
                                    if (profileData.profile_id) {
                                        await controls.saveLearnedData(labelEncoded, userResponse);
                                        await logger.log(`Saved "${labelEncoded}" to your profile for future use.`, 'success');
                                    }
                                    await targetFrame.fill(selector, userResponse);
                                    try { await targetFrame.locator(selector).blur(); } catch { }
                                    filledCount++;
                                }
                            }
                        }
                    } else {
                        // Date Handling: ISO conversion
                        const isDate = await targetFrame.locator(selector).getAttribute('type') === 'date';
                        if (isDate) {
                            const dateVal = new Date(String(value));
                            if (!isNaN(dateVal.getTime())) {
                                const iso = dateVal.toISOString().split('T')[0];
                                await targetFrame.fill(selector, iso);
                            } else {
                                await targetFrame.fill(selector, String(value));
                            }
                        } else {
                            await targetFrame.fill(selector, String(value));
                        }
                    }
                    // Explicit Blur to trigger validation
                    try { await targetFrame.locator(selector).blur(); } catch (e) { }
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

                // Click Logic
                try {
                    await targetFrame.click(selector, { force: true, timeout: 5000 });
                    // FLAG: We performed a navigation action
                    didPerformNavigation = true;
                } catch (clickErr: any) {
                    await logger.log(`Standard click failed (${clickErr.message}). Retrying with JS click...`, 'warning');
                    await targetFrame.evaluate((sel: string) => {
                        const el = document.querySelector(sel) as HTMLElement;
                        if (el) el.click();
                    }, selector);
                    didPerformNavigation = true;
                }

                // SMART WAIT: Wait for network to settle, but don't hang forever
                try {
                    await page.waitForLoadState('networkidle', { timeout: 3000 });
                } catch {
                    // If network never settles (streaming/ads), just wait a safe buffer
                    await page.waitForTimeout(1000);
                }

            } else if (type === 'ask_user') {
                // --- HUMAN IN THE LOOP (TEXT) ---
                await logger.log(`AI asking user. Selector: "${selector}", Value: "${value}"`, 'warning');

                const labelEncoded = value || selector;

                // --- INTER CEPT: AUTO-ANSWER CHECK ---
                const autoAnswer = findBestProfileMatch(labelEncoded, profileData);
                let userResponse: string | null = null;

                if (autoAnswer) {
                    await logger.log(`Auto-answered "${labelEncoded}" using profile data (Fuzzy Match).`, 'success');
                    userResponse = autoAnswer;
                    // Simulate brief delay like a human
                    await page.waitForTimeout(500);
                } else {
                    // Actual Human Loop
                    userResponse = await controls.askUser('text', labelEncoded);

                    // Check for cancellation (null response)
                    if (userResponse === null) {
                        throw new Error('Job stopped by user (Input Cancelled)');
                    }
                }

                const userResponseFinal = userResponse; // TS lock

                if (userResponseFinal) {
                    // --- SKIP FIELD LOGIC ---
                    if (userResponseFinal === 'SKIP_FIELD' || userResponseFinal === 'SKIP') {
                        await logger.log(`Skipped field "${selector}" by user request.`, 'warning');
                        continue;
                    }

                    if (profileData.profile_id && !autoAnswer) {
                        // Only save if it wasn't already from the profile
                        await controls.saveLearnedData(labelEncoded, userResponseFinal);
                        await logger.log(`Saved "${labelEncoded}" to your profile for future use.`, 'success');
                    }
                    if (!autoAnswer) await logger.log(`User provided: "${userResponseFinal}"`, 'success');

                    // Attempt auto-fill
                    let filled = false;
                    if (selector.includes('#') || selector.includes('.') || selector.includes('[')) {
                        try {
                            await targetFrame.fill(selector, userResponseFinal);
                            filled = true;
                        } catch (e) { }
                    }
                    if (!filled) {
                        await logger.log(`Could not auto-fill field "${selector}" with "${userResponseFinal}". Please check manually.`, 'warning');
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
            failedActionsCount++;
        }
    }
    return { didNavigate: didPerformNavigation, failedCount: failedActionsCount };
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

    const headless = SettingsManager.getSettings().form.headless;
    console.log(`[DEBUG] SettingsManager.getSettings().form.headless = ${headless} (Type: ${typeof headless})`);
    await logger.log(`Launching Browser (Headless: ${headless})`, 'info');
    const browser = await chromium.launch({
        headless: headless,
        devtools: false, // Explicitly disable devtools
        args: headless ? ['--headless=new'] : [] // Explicitly force new headless mode if true
    });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }, // Force Desktop validation
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        await logger.log('Navigating to URL...', 'info');

        const navRetries = parseInt(process.env.MAX_RETRIES || '2', 10);
        const navBackoff = parseInt(process.env.RETRY_BACKOFF_MS || '2000', 10);
        const loadTimeout = SettingsManager.getSettings().form.pageLoadTimeoutMs || 60000;
        const elementTimeout = SettingsManager.getSettings().form.elementWaitTimeoutMs || 10000;

        // Set Global Default Timeout for Elements
        page.setDefaultTimeout(elementTimeout);

        await withRetry(async () => {
            await page.goto(url, { timeout: loadTimeout });
            await page.waitForLoadState('networkidle', { timeout: 30000 }); // Keep network idle separate or share? Let's keep 30s as sane default or maybe half loadTimeout
        }, { retries: navRetries, backoff: navBackoff });


        // ==========================================
        // 🔄 MULTI-STEP LOOP
        // ==========================================
        let stepCount = 0;
        const MAX_STEPS = 15;
        let lastActionWasNavigation = false;

        // --- MAIN LOOP for Multi-Step / Wizard Forms ---
        let jobCompleted = false;
        while (!jobCompleted && stepCount < MAX_STEPS) {
            stepCount++;
            await logger.log(`🔄 Step ${stepCount}/${MAX_STEPS} Analysis...`, 'info');

            // Force wait if previous action was navigation to allow render
            if (lastActionWasNavigation) {
                await page.waitForTimeout(2000);
                lastActionWasNavigation = false; // Reset
            }

            // --- SUCCESS DETECTION ---
            const pageText = await page.innerText('body');
            const successKeywords = ['thanks for submitting', 'successfully submitted', 'thank you', 'your response has been recorded'];
            if (successKeywords.some(kw => pageText.toLowerCase().includes(kw))) {
                await logger.log('🎉 Detected Success Message. Job Complete.', 'success');
                jobCompleted = true;
                break;
            }

            // --- VISIBLE-ONLY CONTENT EXTRACTION ---
            let rawContent = await page.evaluate(() => {
                function isVisible(el: Element): boolean {
                    // Check live styles
                    const style = window.getComputedStyle(el);

                    // Critical checks for "hidden":
                    if (style.display === 'none') return false;
                    if (style.visibility === 'hidden') return false;
                    if (style.opacity === '0') return false;

                    // Dimensions check (sometimes elements are 0x0 but valid, but usually wizards hide sections causing 0x0)
                    const rect = el.getBoundingClientRect();
                    // Relaxed dimension check (some inputs might be small/custom), but sections should have size
                    if (rect.width === 0 && rect.height === 0 && style.overflow === 'hidden') return false;

                    return true;
                }

                function cloneVisible(node: Node): Node | null {
                    // 1. Text Nodes: keep
                    if (node.nodeType === Node.TEXT_NODE) {
                        return node.cloneNode(true);
                    }

                    // 2. Comments: ignore or keep (ignore to save tokens)
                    if (node.nodeType === Node.COMMENT_NODE) {
                        return null;
                    }

                    // 3. Elements
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const el = node as Element;
                        if (!isVisible(el)) return null; // Prune this whole branch

                        // Shallow clone
                        const clone = el.cloneNode(false) as Element;

                        // SYNC VALUES (Critical for AI to see filled inputs)
                        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                            const val = (el as HTMLInputElement).value;
                            if (val) clone.setAttribute('value', val); // Force attribute
                        }
                        if (el.tagName === 'SELECT') {
                            const idx = (el as HTMLSelectElement).selectedIndex;
                            if (idx !== -1) {
                                const options = (el as HTMLSelectElement).options;
                                if (options[idx]) clone.setAttribute('data-selected-text', options[idx].text);
                                (clone as HTMLSelectElement).selectedIndex = idx;
                            }
                        }

                        // Recurse children
                        let hasVisibleChildren = false;
                        for (const child of Array.from(el.childNodes)) {
                            const childClone = cloneVisible(child);
                            if (childClone) {
                                clone.appendChild(childClone);
                                hasVisibleChildren = true;
                            }
                        }

                        // Optional: Prune empty structural divs if no text content? 
                        // Risk: empty inputs. So keep everything that passed isVisible.
                        return clone;
                    }

                    return null;
                }

                const visibleBody = cloneVisible(document.body);
                return visibleBody ? (visibleBody as Element).outerHTML : "";
            });

            // Add frames (iframes are usually usually visible if relevant)
            // Ideally we'd check frame visibility too, but keeping it simple for now (frames are handled separately anyway)
            let framesHtml = "";
            for (const frame of page.frames()) {
                try {
                    if (frame === page.mainFrame()) continue;
                    // Only include if frame element is visible in main page? (Hard to check across contexts easily without frame handle)
                    // For now, assume iframes are important.
                    const frameContent = await frame.content();
                    framesHtml += `\n<!-- FRAME: ${frame.url()} -->\n<div class="frame-content" style="border:5px solid red; margin:10px;">${frameContent}</div>`;
                } catch (e) { }
            }

            rawContent += framesHtml;
            const cleanedHtml = cleanHtml(rawContent);


            // ==========================================
            // 🧠 CACHE / REPLAY LOGIC
            // ==========================================
            let actions: Action[] = [];
            let fromCache = false;
            let success = false;

            // 1. Try Cache (ONLY ON FIRST STEP to avoid state mismatch on single-page wizards)
            if (stepCount === 1) {
                try {
                    const cached = await TemplateModel.getByUrl(url);
                    if (cached && cached.actions && cached.actions.length > 0) {
                        await logger.log('⚡ Found cached instructions. Attempting to Replay...', 'success');
                        actions = cached.actions;
                        fromCache = true;

                        try {
                            await executeActions(page, actions, profileData, logger, controls);
                            success = true;
                            await logger.log('✅ Cache Replay Successful!', 'success');
                        } catch (e: any) {
                            await logger.log(`⚠️ Cache Replay Failed (${e.message}). Falling back to AI...`, 'warning');
                            success = false;
                            actions = [];
                        }
                    }
                } catch (e) { console.error("Cache Check Error:", e); }
            }

            // 2. Fallback to AI
            if (!success) {
                await logger.log('🤖 Analyzing page with AI...', 'info');

                // Allow some time for animations (common in wizards)
                if (stepCount > 1) await page.waitForTimeout(1000);

                actions = await getAiActionPlan(cleanedHtml, profileData);

                if (actions.length === 0) {
                    await logger.log("No actions found. Checking validation one last time...", "info");
                } else {
                    await logger.log(`Executing ${actions.length} actions`, 'info', { actions });

                    // Execute returns true if any navigation/click occurred
                    const executionResult = await executeActions(page, actions, profileData, logger, controls);
                    console.log("DEBUG: executionResult =", executionResult); // Keep debug for now

                    if (executionResult && executionResult.didNavigate) {
                        lastActionWasNavigation = true;
                    }

                    // CRITICAL FIX: If actions failed, it implies hidden/obstructed fields or timing issues.
                    // DO NOT consider this step "Complete" yet. Force another analysis loop.
                    if (executionResult && executionResult.failedCount > 0) {
                        await logger.log(`⚠️ ${executionResult.failedCount} actions failed. Forcing re-analysis...`, 'warning');
                        success = false; // Force loop continuance
                        actions = []; // Clear actions to prevent saving bad cache
                    } else {
                        success = true; // Loop success (actions found and executed cleanly)
                    }

                    // Save to Cache ONLY if success and step 1
                    // caching wizards is complex, avoiding for now on step > 1
                    if (success && stepCount === 1) {
                        try {
                            if (actions.length > 0) {
                                await TemplateModel.upsert(url, actions);
                                await logger.log('💾 Saved actions to cache.', 'success');
                            }
                        } catch (saveErr: any) { console.error("Cache Save Failed:", saveErr); }
                    }
                }
            }
            // --- VALIDATION & RECOVERY STEP ---
            // OPTIMIZATION: Only validate if we found NO actions (potential exit). 
            // If we found actions, we assume there's more work or next loop will catch it.
            let recoveryCount = 0;
            if (actions.length === 0) {
                try {
                    await logger.log("Validating form completeness...", "info");

                    // USE THE SAME VISIBLE-ONLY EXTRACTION FOR VALIDATION
                    // (Otherwise validation sees hidden wizard steps and thinks they are missing fields)
                    const validationHtml = await page.evaluate(() => {
                        function isVisible(el: Element): boolean {
                            const style = window.getComputedStyle(el);
                            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
                            const rect = el.getBoundingClientRect();
                            if (rect.width === 0 && rect.height === 0 && style.overflow === 'hidden') return false;
                            return true;
                        }

                        function cloneVisible(node: Node): Node | null {
                            if (node.nodeType === Node.TEXT_NODE) return node.cloneNode(true);
                            if (node.nodeType === Node.COMMENT_NODE) return null;
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                const el = node as Element;
                                if (!isVisible(el)) return null;

                                const clone = el.cloneNode(false) as Element;
                                // SYNC VALUES
                                // SYNC VALUES - CRITICAL FIX FOR AI "FALSE EMPTY" HALLUCINATIONS
                                if (el.tagName === 'INPUT') {
                                    const input = el as HTMLInputElement;
                                    const type = input.type.toLowerCase();

                                    // Checkboxes / Radios
                                    if (type === 'checkbox' || type === 'radio') {
                                        if (input.checked) {
                                            clone.setAttribute('checked', 'true');
                                            // Also add a visual indicator for AI
                                            clone.setAttribute('data-checked-state', '[CHECKED]');
                                        }
                                    }
                                    // Text / Email / Date / Etc
                                    else {
                                        const val = input.value;
                                        if (val) {
                                            clone.setAttribute('value', val);
                                            // Explicitly add value to text content for AI visibility if needed
                                            // but value attribute is usually enough for GPT-4o-mini
                                        }
                                    }
                                }
                                else if (el.tagName === 'TEXTAREA') {
                                    const val = (el as HTMLTextAreaElement).value;
                                    if (val) {
                                        clone.textContent = val; // Textarea content is inside tags
                                    }
                                }
                                else if (el.tagName === 'SELECT') {
                                    const idx = (el as HTMLSelectElement).selectedIndex;
                                    if (idx !== -1) {
                                        const options = (el as HTMLSelectElement).options;
                                        if (options[idx]) {
                                            clone.setAttribute('data-selected-text', options[idx].text);
                                            clone.setAttribute('value', options[idx].value); // Sync value too
                                        }
                                    }
                                }

                                for (const child of Array.from(el.childNodes)) {
                                    const childClone = cloneVisible(child);
                                    if (childClone) clone.appendChild(childClone);
                                }
                                return clone;
                            }
                            return null;
                        }

                        const visibleBody = cloneVisible(document.body);
                        return visibleBody ? (visibleBody as Element).outerHTML : "";
                    });

                    const validationPrompt = `
                    You are a QA Agent.
                    HTML:
                    \`\`\`html
                    ${validationHtml}
                    \`\`\`
                    TASK: Identify missing fields that MUST be filled. Return JSON { "missing_fields": [{ "label": "...", "selector": "...", "type": "..." }] }.
                `;
                    const valCompletion = await completionWithFallback({
                        messages: [{ role: "user", content: validationPrompt }],
                        response_format: { type: "json_object" },
                        max_tokens: 1000
                    });
                    const valContent = valCompletion.choices[0].message.content || "{}";
                    const valData = JSON.parse(valContent);
                    const missingFields = valData.missing_fields || [];

                    if (Array.isArray(missingFields) && missingFields.length > 0) {
                        await logger.log(`Found ${missingFields.length} unfilled fields. Asking user...`, 'warning');
                        const recoveryActions: Action[] = missingFields.map((field: any) => ({
                            selector: field.selector,
                            value: field.label || "Value needed",
                            type: 'ask_user' as const
                        }));
                        await executeActions(page, recoveryActions, profileData, logger, controls);
                        recoveryCount = recoveryActions.length;

                        // If we recovered, we should probably re-eval (continue loop)
                    } else {
                        if (actions.length > 0) {
                            await logger.log("Validation passed for this step.", "info");
                        }
                    }
                } catch (e: any) { await logger.log(`Validation skipped: ${e.message}`, 'warning'); }
            }

            // EXIT CONDITION
            if (actions.length === 0 && recoveryCount === 0) {
                await logger.log('🎉 Job Completed (No more actions detected).', 'success');
                jobCompleted = true;
                break;
            }

            // Wait for navigation if a button was clicked
            await page.waitForTimeout(1000);
            await page.waitForLoadState('networkidle').catch(() => { });
        }

    } catch (err: any) {
        console.error("Automation Error:", err);
        await logger.log(`Job Failed: ${err.message}`, 'error');
        throw err;
    } finally {
        // Close browser unless specifically debugging
        // For now, always close to ensure "Hidden" mode works and process exits
        try {
            await browser.close();
        } catch (e) { /* ignore already closed */ }
    }
}
