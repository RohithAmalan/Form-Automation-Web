import { SettingsManager } from './utils/settingsManager';
import path from 'path';
import dotenv from 'dotenv';

console.log('Testing SettingsManager...');
const settings = SettingsManager.getSettings();
console.log('Full Settings:', JSON.stringify(settings, null, 2));

const headless = SettingsManager.get('headless');
console.log(`headless value: ${headless} (Type: ${typeof headless})`);
