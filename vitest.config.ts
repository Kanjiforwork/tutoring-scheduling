import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
export default defineConfig({test:{env:loadEnv('test',process.cwd(),''),testTimeout:60000,hookTimeout:30000,maxWorkers:1}});
