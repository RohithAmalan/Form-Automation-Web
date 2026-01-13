import pool from '../config/db';
import { JobModel } from '../models/job.model';
import { LogModel } from '../models/log.model';
import { ProfileModel } from '../models/profile.model';
import { processJob } from '../automation/playwrightRunner';
import { AutomationLogger, JobControls, JobParams } from '../types/job.types';
import { SettingsManager } from '../utils/settingsManager';

// ==========================================
// 🛠️ JOB REGISTRY & DEFINITIONS (Single File)
// ==========================================


// 1. Define what an "Executor" looks like
type JobExecutor = (params: JobParams) => Promise<void>;

// 2. The Registry Map
const REGISTRY: Record<string, JobExecutor> = {};

/**
 * Register a new project/task type here.
 */
export function registerJobType(type: string, executor: JobExecutor) {
    REGISTRY[type] = executor;
    console.log(`[Queue] Registered Job Type: '${type}'`);
}

// ==========================================
// 🧩 EXECUTORS (Add your project logic here)
// ==========================================

// Executor A: Form Automation
const formAutomationExecutor: JobExecutor = async (params) => {
    // Calls the external Playwright logic with specific controls
    await processJob(params);
};

// Executor B: Example Scraper (Placeholder)
const scraperExecutor: JobExecutor = async ({ url, logger }) => {
    await logger.log(`Starting Scraper for ${url}`, 'info');
    await new Promise(r => setTimeout(r, 2000)); // Simulaton
    await logger.log(`Scraping complete`, 'success');
};


// 3. AUTO-REGISTER HANDLERS
registerJobType('FORM_SUBMISSION', formAutomationExecutor);

// Executor B: Gmail Sending (Simulation)
const gmailExecutor: JobExecutor = async ({ url, profileData, logger, askUser, saveLearnedData }) => {
    // 1. Initialization
    await logger.log("📧 Starting Gmail Automation...", "info");

    // 2. Data Extraction
    const recipient = profileData.email || profileData['Email Address'] || "unknown@example.com";
    const subject = profileData.subject || "Automation Test";
    const body = profileData.body || "This is an automated message.";

    await logger.log(`Drafting email to: ${recipient}`, "info");
    await logger.log(`Subject: ${subject}`, "info");

    // 3. Simulation (Wait)
    await new Promise(r => setTimeout(r, 2000));
    await logger.log("Writing email content...", "info");

    // 4. Verification Step (Simulated Wait for User?)
    // This demonstrates we can use askUser even here!
    // const approval = await askUser('text', 'Confirm Send? (yes/no)');
    // if (approval !== 'yes') throw new Error("User rejected send");

    await new Promise(r => setTimeout(r, 1500));

    // 5. "Send"
    console.log(`[Gmail] Sending email to ${recipient}...`);
    await logger.log(`✅ Email sent successfully to ${recipient}`, "success");

    // Learned Data Example
    await saveLearnedData("last_email_sent_to", recipient);
};

registerJobType('GMAIL', gmailExecutor);
registerJobType('SCRAPER', scraperExecutor); // Example
registerJobType('DEFAULT', formAutomationExecutor); // Fallback


// ==========================================
// 👷 WORKER LOOP
// ==========================================
// Polling Loop
export const runWorker = async () => {
    console.log("👷 Worker started. Polling for jobs...");
    console.log(`Supported Types: ${Object.keys(REGISTRY).join(', ')}`);

    // Track active jobs
    const activeJobs = new Set<Promise<void>>();

    while (true) {
        try {
            // 1. Check Concurrency Limit
            const maxConcurrency = SettingsManager.get('concurrency') || 1;
            const freeSlots = maxConcurrency - activeJobs.size;

            // Debug Heartbeat (only if slots changed or every 5s?) - actually just log if we have capacity
            if (freeSlots > 0 && Math.random() > 0.9) {
                // Reduce spam, but keep visibility
                // console.log(`[Worker] Free Slots: ${freeSlots}/${maxConcurrency} | Active: ${activeJobs.size}`);
            }

            if (freeSlots <= 0) {
                // console.log(`[Worker] Saturated (${activeJobs.size}/${maxConcurrency}). Waiting...`);
                await Promise.race(activeJobs);
                continue;
            }

            // 2. Poll for NEW jobs (up to freeSlots)
            const pendingJobs = await JobModel.getPending(freeSlots);

            if ((pendingJobs.rowCount || 0) > 0) {
                console.log(`[Worker] Found ${pendingJobs.rowCount} pending job(s). Priority Order.`);
            }

            if ((pendingJobs.rowCount || 0) === 0) {
                // If no jobs and no active jobs, sleep long.
                // If active jobs exist, sleep short which effectively is waiting for race.
                if (activeJobs.size > 0) {
                    // Wait for any job to finish OR timeout
                    const interval = SettingsManager.get('pollInterval') || 2000;
                    const timer = new Promise(resolve => setTimeout(resolve, interval));
                    await Promise.race([...activeJobs, timer]);
                } else {
                    const interval = SettingsManager.get('pollInterval') || 2000;
                    await new Promise(resolve => setTimeout(resolve, interval));
                }
                continue;
            }

            // 3. Process each fetched job
            for (const job of pendingJobs.rows) {
                // Update status to PROCESSING
                await pool.query("UPDATE jobs SET status = 'PROCESSING', started_at = NOW() WHERE id = $1", [job.id]);
                console.log(`👷 Worker picked up job ${job.id} for ${job.url}`);

                // Define the async job execution (IIFE not needed, just a function)
                const jobPromise = (async () => {
                    try {
                        const logger: AutomationLogger = {
                            log: async (message, type = 'info', metadata) => {
                                await LogModel.create(job.id, type, message, metadata);
                                console.log(`[Job ${job.id}] [${type.toUpperCase()}] ${message}`);
                            }
                        };

                        // Build Profile Data
                        let profileData: any = {};
                        if (job.profile_id) {
                            try {
                                const profRes = await pool.query('SELECT payload FROM profiles WHERE id = $1', [job.profile_id]);
                                if (profRes.rows.length > 0) profileData = { ...profRes.rows[0].payload };
                            } catch (e) { console.error("Profile Fetch Error", e); }
                        }

                        if (job.custom_data) profileData = { ...profileData, ...job.custom_data };
                        if (job.file_path) profileData = { ...profileData, uploaded_file_path: job.file_path };

                        const now = new Date();
                        profileData = {
                            ...profileData,
                            job_id: job.id,
                            profile_id: job.profile_id,
                            current_date: now.toISOString().split('T')[0],
                            current_day: now.toLocaleDateString('en-US', { weekday: 'long' }),
                            current_year: now.getFullYear()
                        };

                        const jobType = (job as any).type || 'FORM_SUBMISSION';
                        const executor = REGISTRY[jobType] || REGISTRY['DEFAULT'];

                        if (!executor) {
                            await logger.log(`Unknown Job Type: ${jobType}`, 'error');
                            throw new Error(`No executor found for type '${jobType}'`);
                        }

                        // --- LIFECYCLE CONTROLS (Simplificado para o contexto desta rewrite) ---
                        const checkPause = async () => {
                            const res = await pool.query("SELECT status FROM jobs WHERE id = $1", [job.id]);
                            if (res.rows.length === 0) throw new Error("Job deleted from database");
                            const status = res.rows[0]?.status;
                            if (['CANCELLED', 'CANCELLING', 'DEAD'].includes(status)) throw new Error(`Job stopped by user (Status: ${status})`);
                            if (status === 'PAUSED') {
                                await logger.log("⏸️ Job manually PAUSED.", "warning");
                                while (true) {
                                    await new Promise(r => setTimeout(r, 2000));
                                    const check = await pool.query("SELECT status FROM jobs WHERE id = $1", [job.id]);
                                    if (check.rows[0]?.status === 'PROCESSING') break;
                                    if (['FAILED', 'COMPLETED', 'DEAD', 'CANCELLED', 'CANCELLING'].includes(check.rows[0]?.status)) throw new Error(`Job stopped`);
                                }
                            }
                        };
                        const askUser = async (type: 'file' | 'text', label: string): Promise<string | null> => {
                            console.log(`⏸️ Job ${job.id} WAITING FOR INPUT (${type}): ${label}`);

                            // 0. Pre-Check: Don't enter wait state if already dead/cancelled
                            const preCheck = await pool.query("SELECT status FROM jobs WHERE id = $1", [job.id]);
                            if (['FAILED', 'DEAD', 'CANCELLED', 'CANCELLING', 'COMPLETED'].includes(preCheck.rows[0]?.status)) {
                                return null;
                            }

                            // 1. Set Info in Custom Data
                            const jRes = await pool.query("SELECT custom_data FROM jobs WHERE id = $1", [job.id]);
                            const cData = jRes.rows[0]?.custom_data || {};
                            const nData = { ...cData, _missing_type: type, _missing_label: label };

                            // Use Conditional Update to avoid overwriting a Cancel that happened milliseconds ago
                            const updateRes = await pool.query(
                                "UPDATE jobs SET custom_data = $1, status = 'WAITING_INPUT' WHERE id = $2 AND status NOT IN ('CANCELLED', 'CANCELLING', 'DEAD', 'FAILED', 'COMPLETED')",
                                [nData, job.id]
                            );

                            if (updateRes.rowCount === 0) {
                                // Update failed, meaning status changed concurrently?
                                return null;
                            }

                            // 2. Wait Loop
                            const POLL = 3000;
                            const MAX = 10 * 60 * 1000;
                            let elapsed = 0;

                            while (elapsed < MAX) {
                                await new Promise(r => setTimeout(r, POLL));
                                elapsed += POLL;

                                const check = await pool.query("SELECT status, file_path, custom_data FROM jobs WHERE id = $1", [job.id]);
                                const curJob = check.rows[0];

                                if (curJob.status === 'RESUMING') {
                                    console.log(`▶️ Job ${job.id} RESUMING with Input!`);
                                    await pool.query("UPDATE jobs SET status = 'PROCESSING' WHERE id = $1", [job.id]);

                                    if (type === 'file') return curJob.file_path;
                                    if (curJob.custom_data && curJob.custom_data[label]) return curJob.custom_data[label];
                                    if (curJob.custom_data && curJob.custom_data.user_response) return curJob.custom_data.user_response;
                                    return null; // Fallback
                                }
                                if (['FAILED', 'DEAD', 'CANCELLED', 'COMPLETED'].includes(curJob.status)) return null;
                            }
                            return null;
                        };
                        const saveLearnedData = async (key: string, value: string) => {
                            if (!job.profile_id) return;
                            try {
                                const pRes = await pool.query("SELECT payload FROM profiles WHERE id = $1", [job.profile_id]);
                                if (pRes.rows.length === 0) return;
                                const pl = { ...pRes.rows[0].payload, [key]: value };
                                await pool.query("UPDATE profiles SET payload = $1, updated_at = NOW() WHERE id = $2", [pl, job.profile_id]);
                                console.log(`🧠 Learned: ${key} = ${value.substring(0, 20)}...`);
                            } catch (e) { console.error("Save Learned Fail:", e); }
                        };

                        // RUN
                        await executor({
                            jobId: job.id, url: job.url, profileData, logger,
                            checkPause,
                            askUser,
                            saveLearnedData
                        });

                        await pool.query(`UPDATE jobs SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`, [job.id]);
                        console.log(`✅ Job ${job.id} Completed`);

                    } catch (err: any) {
                        // Error Handling Logic
                        const check = await pool.query("SELECT status FROM jobs WHERE id = $1", [job.id]);
                        if (check.rows[0]?.status === 'CANCELLED' || err.message.includes('Job stopped')) {
                            await pool.query(`UPDATE jobs SET status = 'CANCELLED', completed_at = NOW() WHERE id = $1`, [job.id]);
                            return;
                        }

                        const MAX_RETRIES = SettingsManager.get('maxRetries') || 1; // Use SettingsManager
                        const currentRetries = (job as any).retries || 0;

                        if (currentRetries < MAX_RETRIES) {
                            let query = "UPDATE jobs SET status = 'PENDING', retries = COALESCE(retries, 0) + 1";
                            const params: any[] = [job.id];

                            // Retry Escalation
                            if (SettingsManager.get('retryEscalation')) {
                                // Escalate priority (decrement by 1, min -1)
                                query += ", priority = -1"; // Force to urgent/critical on retry? Or just decrement? 
                                // Let's set to -1 (Critical) to retry ASAP as per requirement "Run Next" behavior usually implies speed.
                                // Or better: priority - 1. But simple approach: set to -1.
                            }

                            query += " WHERE id = $1";
                            await pool.query(query, params);
                            console.log(`⚠️ Job ${job.id} retrying... (Priority Escalated: ${SettingsManager.get('retryEscalation')})`);
                        } else {
                            await pool.query(`UPDATE jobs SET status = 'DEAD', completed_at = NOW() WHERE id = $1`, [job.id]);
                            console.error(`❌ Job ${job.id} Dead:`, err);
                        }
                    }
                })();

                // Add to active set
                activeJobs.add(jobPromise);
                // Remove from set when done
                jobPromise.finally(() => activeJobs.delete(jobPromise));
            }

        } catch (err) {
            console.error("Worker Loop Error:", err);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}
