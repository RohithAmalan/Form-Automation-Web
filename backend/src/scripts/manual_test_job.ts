
import dotenv from 'dotenv';
import path from 'path';
import { processJob } from '../automation/playwrightRunner';
import { JobParams } from '../types/job.types';

// Load env
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function runTest() {
    console.log("🚀 Starting Manual Job Test...");

    // Mock Data
    const mockProfile = {
        name: "Test Profile",
        payload: {
            first_name: "John",
            last_name: "Doe",
            email: "john.doe@example.com"
        }
    };

    // Generic huge HTML to duplicate high token usage
    const hugeHtml = "<div>" + "<span>some text content</span>".repeat(5000) + "</div>";

    const mockParams: JobParams = {
        jobId: "test-job-heavy",
        url: "data:text/html," + encodeURIComponent(hugeHtml), // Load huge HTML directly

        profileData: mockProfile,
        logger: {
            log: async (msg, type, details) => console.log(`[${type?.toUpperCase()}] ${msg}`, details || "")
        },
        checkPause: async () => { },
        askUser: async () => { console.log("Asked user... returning mock"); return "Mock Answer"; },
        saveLearnedData: async () => { }
    };

    try {
        await processJob(mockParams);
        console.log("✅ Test Completed Successfully");
    } catch (e) {
        console.error("❌ Test Failed:", e);
    }
}

runTest();
