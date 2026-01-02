import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { FormController } from '../controllers/form.controller';

import { ensureAuthenticated, ensureAdmin } from '../middleware/auth';

const router = Router();

// --- Multer Config ---
// Ensure uploads directory exists relative to project root (since we are in backend/src/routes)
// Ensure uploads directory exists relative to project root (since we are in backend/src/routes)
// New Path: backend/uploads (../../uploads)
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- Routes ---

// Profiles (Authenticated Users)
router.get('/profiles', ensureAuthenticated, FormController.getProfiles);
router.post('/profiles', ensureAuthenticated, FormController.createProfile);
router.put('/profiles/:id', ensureAuthenticated, FormController.updateProfile);
router.delete('/profiles/:id', ensureAuthenticated, FormController.deleteProfile);

// Jobs (Queue Functions -> Admin Only)
router.get('/jobs', ensureAuthenticated, FormController.getJobs); // View is allowed for Auth users
router.post('/jobs', ensureAdmin, upload.array('files', 10), FormController.createJob); // Create is Admin
router.delete('/jobs/:id', ensureAdmin, FormController.deleteJob);
router.delete('/jobs', ensureAdmin, FormController.deleteAllJobs);
router.post('/jobs/:id/pause', ensureAdmin, FormController.pauseJob);
router.post('/jobs/:id/continue', ensureAdmin, FormController.continueJob);
router.post('/jobs/:id/resume', ensureAdmin, upload.single('file'), FormController.resumeJob);

// Logs - Moved to top
console.log("Registering /logs route (TOP)");
router.get('/logs', ensureAuthenticated, (req, res) => {
    console.log("Hit /logs (Inline)");
    FormController.getSystemLogs(req, res);
});

// Logs
// router.get('/logs', ...); // MOVED
router.get('/jobs/:id/logs', ensureAuthenticated, FormController.getJobLogs);

// Settings
router.get('/settings/health', FormController.getSystemHealth);

export default router;
