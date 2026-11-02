import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Removes rows flagged isDemo, plus anything real users attached to them. Needs --yes. */
async function main() {
  const [users, listings] = await Promise.all([
    prisma.user.findMany({ where: { isDemo: true }, select: { id: true } }),
    prisma.listing.findMany({ where: { isDemo: true }, select: { id: true } }),
  ]);
  const userIds = users.map((u) => u.id);
  const listingIds = listings.map((l) => l.id);
  if (!process.argv.includes('--yes')) {
    console.log(`Would remove ${userIds.length} demo accounts and ${listingIds.length} demo listings. Add --yes to do it.`);
    return;
  }
  const images = await prisma.listingImage.findMany({
    where: { OR: [{ listingId: { in: listingIds } }, { uploaderId: { in: userIds } }] },
    select: { keyBase: true },
  });
  const byUser = { in: userIds };
  await prisma.$transaction(async (tx) => {
    const involved = { OR: [{ listingId: { in: listingIds } }, { buyerId: byUser }, { sellerId: byUser }] };
    await tx.report.deleteMany({
      where: { OR: [{ listingId: { in: listingIds } }, { reporterId: byUser }, { reportedUserId: byUser }] },
    });
    await tx.review.deleteMany({
      where: { OR: [{ listingId: { in: listingIds } }, { reviewerId: byUser }, { revieweeId: byUser }] },
    });
    await tx.offer.deleteMany({ where: involved });
    await tx.conversation.deleteMany({ where: involved });
    await tx.message.deleteMany({ where: { senderId: byUser } });
    // Real listings keep existing if a demo account was merely named as their buyer.
    await tx.listing.updateMany({ where: { soldToUserId: byUser }, data: { soldToUserId: null } });
    await tx.listingImage.deleteMany({ where: { OR: [{ listingId: { in: listingIds } }, { uploaderId: byUser }] } });
    await tx.listing.deleteMany({ where: { OR: [{ id: { in: listingIds } }, { sellerId: byUser }] } });
    await tx.user.deleteMany({ where: { id: byUser } });
  });
  const bucket = process.env.S3_BUCKET;
  if (bucket && images.length) {
    const s3 = new S3Client({
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
    });
    const keys = images.flatMap((i) => [320, 800, 1600].map((w) => ({ Key: `${i.keyBase}/${w}.webp` })));
    for (let i = 0; i < keys.length; i += 1000) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.slice(i, i + 1000), Quiet: true } }));
    }
  }
  console.log(`Removed ${userIds.length} demo accounts and ${listingIds.length} demo listings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
