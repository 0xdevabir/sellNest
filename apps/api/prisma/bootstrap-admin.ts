import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/**
 * Creates the first admin from server-side environment variables. There is deliberately no
 * HTTP route for this, and it stops once an admin exists: later admins are promoted in the
 * admin UI, where the change is audited.
 */
async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) throw new Error('Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD first.');
  if (password.length < 12) throw new Error('ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.');
  if (await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } })) {
    throw new Error('An admin already exists. Promote new admins from the admin area.');
  }
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const base = email.split('@')[0]!.replace(/[^a-z0-9]/g, '_').slice(0, 20) || 'admin';
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      username: `${base}_admin`,
      displayName: 'SellNest admin',
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
    },
    update: { role: 'ADMIN', status: 'ACTIVE', passwordHash, emailVerifiedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: 'admin.bootstrap', entityType: 'User', entityId: user.id },
  });
  console.log(`Admin ready: ${email}. Remove ADMIN_BOOTSTRAP_PASSWORD from the environment now.`);
}

main()
  .catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
