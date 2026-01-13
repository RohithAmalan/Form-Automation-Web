import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';

const router = Router();

router.get('/', SettingsController.getSettings);
router.post('/', SettingsController.updateSettings);
router.get('/health', SettingsController.getHealth); // Move health check here

export default router;
