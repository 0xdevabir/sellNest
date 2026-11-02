import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { loadTestEnv } from './env';

/** Creates the test database if needed and brings it up to the latest migration. */
export default async function setup() {
  loadTestEnv();
  const testUrl = process.env.DATABASE_URL!;
  const admin = new URL(testUrl);
  admin.pathname = '/postgres';
  const prisma = new PrismaClient({ datasources: { db: { url: admin.toString() } } });
  const existing = await prisma.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = 'sellnest_test'`;
  if (existing.length === 0) await prisma.$executeRawUnsafe('CREATE DATABASE sellnest_test');
  await prisma.$disconnect();
  execSync('pnpm exec prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'pipe',
  });
}
