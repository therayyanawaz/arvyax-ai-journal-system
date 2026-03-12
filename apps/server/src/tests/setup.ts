import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prisma } from '../lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '../..');
const prismaDir = path.resolve(serverRoot, 'prisma');
const testDbPath = path.resolve(prismaDir, 'test.db');

process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.PORT = '4001';

if (existsSync(testDbPath)) {
  rmSync(testDbPath);
}

execSync('npm run db:push:test', {
  cwd: serverRoot,
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL
  },
  stdio: 'pipe'
});

afterAll(async () => {
  await prisma.$disconnect();
});
