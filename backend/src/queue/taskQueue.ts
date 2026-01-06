import pool from '../config/db';
import { JobModel } from '../models/job.model';
import { LogModel } from '../models/log.model';
import { ProfileModel } from '../models/profile.model';
import { processJob } from '../automation/playwrightRunner';
import { AutomationLogger, JobControls, JobParams } from '../types/job.types';

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
registerJobType('SCRAPER', scraperExecutor); // Example
registerJobType('DEFAULT', formAutomationExecutor); // Fallback


// ==========================================
// 👷 WORKER LOOP
// ==========================================
// Polling Loop
export const runWorker = async () => {
    console.log("👷 Worker started. Polling for jobs...");
    console.log(`Supported Types: ${Object.keys(REGISTRY).join(', ')}`);

    while (true) {
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const pendingJobs = await JobModel.getPending();

            if (pendingJobs.rowCount === 0) continue;

            const job = pendingJobs.rows[0];
            await pool.query("UPDATE jobs SET status = 'PROCESSING', started_at = NOW() WHERE id = $1", [job.id]);

            console.log(`👷 Worker picked up job ${job.id} for ${job.url}`);

            const logger: AutomationLogger = {
                log: async (message, type = 'info', metadata) => {
                    await LogModel.create(job.id, type, message, metadata);
                    console.log(`[Job ${job.id}] [${type.toUpperCase()}] ${message}`);
                }
            };

            // Build Profile Data from Profile + Custom Data + File
            let profileData: any = {};
            if (job.profile_id) {
                try {
                    const profRes = await pool.query('SELECT payload FROM profiles WHERE id = $1', [job.profile_id]);
                    if (profRes.rows.length > 0) profileData = { ...profRes.rows[0].payload };
                } catch (e) { console.error("Profile Fetch Error", e); }
            }

            if (job.custom_data) profileData = { ...profileData, ...job.custom_data };
            // Pass the raw string (path OR json array) to runner. Runner handles parsing.
            if (job.file_path) profileData = { ...profileData, uploaded_file_path: job.file_path };

            // Inject Date/Time Context
            const now = new Date();
            profileData = {
                ...profileData,
                job_id: job.id,
                profile_id: job.profile_id,
                current_date: now.toISOString().split('T')[0], // YYYY-MM-DD
                current_day: now.toLocaleDateString('en-US', { weekday: 'long' }),
                current_year: now.getFullYear()
            };

            // Find Executor
            // Default to 'FORM_SUBMISSION' if type is missing (DB schema might not have it yet or it's implicitly 'DEFAULT')
            // Actually job table might not have 'type' column yet based on previous views?
            // Existing code checked job.type. Let's assume it exists or fallback.
            const jobType = (job as any).type || 'FORM_SUBMISSION';
            const executor = REGISTRY[jobType] || REGISTRY['DEFAULT'];

            if (!executor) {
                await logger.log(`Unknown Job Type: ${jobType}`, 'error');
                throw new Error(`No executor found for type '${jobType}'`);
            }

            // --- LIFECYCLE CONTROLS IMPLEMENTATION ---

            const checkPause = async () => {
                const res = await pool.query("SELECT status FROM jobs WHERE id = $1", [job.id]);
                const status = res.rows[0]?.status;

                // 1. Immediate Kill Check
                if (status === 'CANCELLED' || status === 'CANCELLING' || status === 'DEAD') {
                    throw new Error(`Job stopped by user (Status: ${status})`);
                }

                // 2. Pause Logic
                if (status === 'PAUSED') {
                    await logger.log("⏸️ Job manually PAUSED. Waiting for Continue...", "warning");
                    while (true) {
                        await new Promise(r => setTimeout(r, 2000));
                        const check = await pool.query("SELECT status FROM jobs WHERE id = $1", [job.id]);
                        const cur = check.rows[0]?.status;
                        if (cur === 'PROCESSING') {
                            await logger.log("▶️ Job Manually Resumed!", "success");
                            break;
                        }
                        if (cur === 'FAILED' || cur === 'COMPLETED' || cur === 'DEAD' || cur === 'CANCELLED' || cur === 'CANCELLING') throw new Error(`Job stopped (Status: ${cur})`);
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

            // ------------------------------------------

            // Run
            try {
                await executor({
                    jobId: job.id,
                    url: job.url,
                    profileData,
                    logger,
                    checkPause,
                    askUser,
                    saveLearnedData
                });

                await pool.query(`UPDATE jobs SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`, [job.id]);
                console.log(`✅ Job ${job.id} Completed`);
            } catch (err: any) {
                // Check if it was cancelled
                const check = await pool.query("SELECT status FROM jobs WHERE id = $1", [job.id]);
                const curStatus = check.rows[0]?.status;

                if (curStatus === 'CANCELLED' || err.message.includes('Job stopped by user')) {
                    console.log(`🛑 Job ${job.id} Cancelled confirmed.`);
                    await LogModel.create(job.id, 'warning', `Job Cancelled by User`, {});
                    // Ensure it stays Cancelled (already set by API, but safety)
                    if (curStatus !== 'CANCELLED') {
                        await pool.query(`UPDATE jobs SET status = 'CANCELLED', completed_at = NOW() WHERE id = $1`, [job.id]);
                    }
                    return; // EXIT WORKER LOOP for this job
                }

                const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '1', 10);
                const currentRetries = (job as any).retries || 0;

                if (currentRetries < MAX_RETRIES) {
                    await pool.query(
                        "UPDATE jobs SET status = 'PENDING', retries = COALESCE(retries, 0) + 1 WHERE id = $1",
                        [job.id]
                    );
                    await LogModel.create(job.id, 'warning', `Job Failed. Retrying (${currentRetries + 1}/${MAX_RETRIES})...`, { error: err.message });
                    console.log(`⚠️ Job ${job.id} Failed. Retrying...`);
                } else {
                    await pool.query(`UPDATE jobs SET status = 'DEAD', completed_at = NOW() WHERE id = $1`, [job.id]);
                    console.error(`❌ Job ${job.id} Dead:`, err);
                    await LogModel.create(job.id, 'error', `Job Failed Permanently (Dead)`, { error: err.message, stack: err.stack });
                }
            }

        } catch (err) {
            console.error("Worker Loop Error:", err);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}
