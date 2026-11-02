import { resolve } from 'node:path';

/** Points tests at their own database and Redis db, so they can never touch development data. */
export function loadTestEnv() {
  try {
    process.loadEnvFile(resolve(__dirname, '../../../.env'));
  } catch {
    // CI provides real environment variables instead of a file.
  }
  const db = new URL(process.env.DATABASE_URL!);
  db.pathname = '/sellnest_test';
  process.env.DATABASE_URL = db.toString();
  const redis = new URL(process.env.REDIS_URL!);
  redis.pathname = '/1';
  process.env.REDIS_URL = redis.toString();
  process.env.NODE_ENV = 'test';
  process.env.RUN_WORKER_IN_API = 'false';
  process.env.WEB_URL = 'http://localhost:3100';
}

loadTestEnv();
