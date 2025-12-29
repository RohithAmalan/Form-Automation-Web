import express from 'express';
import { TemplateController } from '../controllers/template.controller';

const router = express.Router();

router.get('/', TemplateController.getAll);
router.patch('/:id', TemplateController.update);
router.delete('/:id', TemplateController.delete);

export default router;
