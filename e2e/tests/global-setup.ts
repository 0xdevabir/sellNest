import { execFileSync } from 'node:child_process';

/**
 * Every test shares 127.0.0.1, so one person's rate limits soon cover the whole suite.
 * Clears only the rate-limit counters, and only in the local development Redis container.
 */
export default function globalSetup() {
  if (process.env.E2E_BASE_URL) return; // Never reach for local Docker when testing a deployed site.
  const script = "for _,k in ipairs(redis.call('keys','rl:*')) do redis.call('del',k) end";
  execFileSync('docker', ['exec', 'sellnest-dev-redis-1', 'redis-cli', 'EVAL', script, '0'], { stdio: 'ignore' });
}
