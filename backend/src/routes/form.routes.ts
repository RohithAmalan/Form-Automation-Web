import { Router } from 'express';
import multer from 'multer';
import { FormController } from '../controllers/form.controller';
import { ensureAuthenticated, ensureAdmin } from '../middleware/auth';

const router = Router();

// --- Multer Config ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Routes ---


// Profiles (Authenticated Users)
// Profiles (Public)
router.get('/profiles', FormController.getProfiles);
router.post('/profiles', FormController.createProfile);
router.put('/profiles/:id', FormController.updateProfile);
router.delete('/profiles/:id', FormController.deleteProfile);

// Jobs (Queue Functions -> Admin Only)
// Jobs (Public)
router.get('/jobs', FormController.getJobs); // View is allowed for Auth users
router.post('/jobs', upload.array('files', 10), FormController.createJob); // Create is Public
router.delete('/jobs/:id', FormController.deleteJob);
router.delete('/jobs', FormController.deleteAllJobs);
router.post('/jobs/:id/pause', FormController.pauseJob);
router.post('/jobs/:id/continue', FormController.continueJob);
router.post('/jobs/:id/resume', upload.single('file'), FormController.resumeJob);
router.post('/jobs/:id/cancel', FormController.cancelJob);
router.patch('/jobs/:id/priority', FormController.updatePriority);

// Logs - Moved to top
console.log("Registering /logs route (TOP)");
router.get('/logs', (req, res) => {
    console.log("Hit /logs (Inline)");
    FormController.getSystemLogs(req, res);
});

// Logs
// router.get('/logs', ...); // MOVED
// Logs
// router.get('/logs', ...); // MOVED
router.get('/jobs/:id/logs', FormController.getJobLogs);

// Settings
router.get('/settings/health', FormController.getSystemHealth);

export default router;
