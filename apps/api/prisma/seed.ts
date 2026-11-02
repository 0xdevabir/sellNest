import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { DEMO_ITEMS } from './seed-data/demo-items';
import { CATEGORIES, LOCATIONS, PROHIBITED_KEYWORDS } from './seed-data/reference';

const prisma = new PrismaClient();
const WIDTHS = [320, 800, 1600];
const DAY = 86_400_000;

async function seedReference() {
  // Parents are listed before children, so one ordered pass resolves the hierarchy.
  const locationIds = new Map<string, string>();
  for (const l of LOCATIONS) {
    const data = {
      name: l.name,
      type: l.type,
      latitude: l.lat,
      longitude: l.lng,
      isFeatured: l.featured ?? false,
      parentId: l.parent ? locationIds.get(l.parent)! : null,
    };
    // Existing rows are left alone: an admin's corrections must survive a re-seed.
    const row = await prisma.location.upsert({ where: { slug: l.slug }, create: { slug: l.slug, ...data }, update: {} });
    locationIds.set(l.slug, row.id);
  }
  let sortOrder = 0;
  for (const c of CATEGORIES) {
    const parent = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, icon: c.icon, sortOrder: sortOrder++ },
      update: {},
    });
    for (const [i, [slug, name]] of c.children.entries()) {
      await prisma.category.upsert({
        where: { slug },
        create: { slug, name, parentId: parent.id, sortOrder: i },
        update: {},
      });
    }
  }
  await prisma.platformSetting.upsert({
    where: { key: 'platform' },
    create: {
      key: 'platform',
      value: {
        maxListingImages: 8,
        dailyPublishLimit: 10,
        newAccountReviewDays: 7,
        prohibitedKeywords: PROHIBITED_KEYWORDS,
        radiiKm: [3, 5, 10, 25],
        defaultRadiusKm: 5,
      },
    },
    update: {},
  });
  return locationIds;
}

/** Generated placeholder artwork, clearly labelled, rather than borrowed product photos. */
async function placeholderImage(title: string, hue: number) {
  const width = 1600;
  const height = 1200;
  const words = title.split(' ');
  const lines = [words.slice(0, 3).join(' '), words.slice(3, 6).join(' ')].filter(Boolean);
  const safe = (s: string) => s.replace(/[&<>"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="hsl(${hue},18%,86%)"/>
    <circle cx="1240" cy="330" r="420" fill="hsl(${hue},20%,78%)"/>
    <rect x="130" y="760" width="620" height="300" rx="12" fill="hsl(${hue},16%,72%)"/>
    ${lines.map((l, i) => `<text x="130" y="${380 + i * 120}" font-family="Helvetica,Arial,sans-serif" font-size="100" font-weight="700" fill="hsl(${hue},24%,22%)">${safe(l)}</text>`).join('')}
    <text x="170" y="930" font-family="Helvetica,Arial,sans-serif" font-size="52" fill="hsl(${hue},24%,22%)">Sample photo</text>
  </svg>`;
  return { svg: Buffer.from(svg), width, height };
}

async function seedDemo(locationIds: Map<string, string>) {
  if (await prisma.user.findFirst({ where: { isDemo: true }, select: { id: true } })) {
    console.log('Demo data already exists; skipping it.');
    return;
  }
  const password = process.env.DEMO_PASSWORD ?? 'sellnest-demo-only';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const people = [
    ['rafi', 'Rafi (demo)', 'daffodil-smart-city'],
    ['nusrat', 'Nusrat (demo)', 'khagan'],
    ['tanvir', 'Tanvir (demo)', 'ashulia'],
    ['sadia', 'Sadia (demo)', 'daffodil-smart-city'],
    ['imran', 'Imran (demo)', 'uttara'],
  ] as const;
  const now = Date.now();
  const sellers = [];
  for (const [username, displayName, location] of people) {
    sellers.push(
      await prisma.user.create({
        data: {
          email: `${username}@demo.sellnest.invalid`,
          username: `demo_${username}`,
          displayName,
          passwordHash,
          isDemo: true,
          // Lets the account use verified-only features. The API never shows demo accounts as verified.
          emailVerifiedAt: new Date(),
          profileCompleted: true,
          locationId: locationIds.get(location)!,
          createdAt: new Date(now - 90 * DAY),
        },
      }),
    );
  }

  const bucket = process.env.S3_BUCKET;
  const s3 = bucket
    ? new S3Client({
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
      })
    : null;

  const categories = new Map((await prisma.category.findMany()).map((c) => [c.slug, c]));
  const locations = new Map((await prisma.location.findMany()).map((l) => [l.slug, l]));
  const listings = [];
  for (const [i, item] of DEMO_ITEMS.entries()) {
    const location = locations.get(item.location)!;
    const seller = sellers[item.seller]!;
    const publishedAt = new Date(now - (i + 1) * 0.3 * DAY);
    const listing = await prisma.listing.create({
      data: {
        sellerId: seller.id,
        status: 'ACTIVE',
        title: item.title,
        description: item.description,
        categoryId: categories.get(item.category)!.id,
        condition: item.condition,
        brand: item.brand,
        priceBdt: item.price,
        originalPriceBdt: item.original,
        negotiable: item.negotiable ?? false,
        locationId: location.id,
        latitude: location.latitude,
        longitude: location.longitude,
        meetupAvailable: true,
        isDemo: true,
        publishedAt,
        createdAt: publishedAt,
      },
    });
    listings.push(listing);
    if (s3) {
      const { svg, width, height } = await placeholderImage(item.title, (i * 47) % 360);
      const keyBase = `demo/${randomUUID()}`;
      for (const w of WIDTHS) {
        const body = await sharp(svg).resize({ width: w }).webp({ quality: 78 }).toBuffer();
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: `${keyBase}/${w}.webp`, Body: body, ContentType: 'image/webp' }));
      }
      await prisma.listingImage.create({ data: { listingId: listing.id, uploaderId: seller.id, keyBase, width, height, position: 0 } });
    }
  }

  // One sample negotiation, so the inbox and offers pages have something to show.
  const listing = listings[0]!;
  const seller = sellers[0]!;
  const buyer = sellers[3]!;
  const conversation = await prisma.conversation.create({
    data: {
      listingId: listing.id,
      buyerId: buyer.id,
      sellerId: seller.id,
      lastMessageAt: new Date(now - 3_600_000),
      participants: { create: [{ userId: buyer.id }, { userId: seller.id, unreadCount: 1 }] },
    },
  });
  await prisma.message.createMany({
    data: [
      { conversationId: conversation.id, senderId: buyer.id, body: 'Hi, is the laptop still available?', createdAt: new Date(now - 7_200_000) },
      { conversationId: conversation.id, senderId: seller.id, body: 'Yes it is. You can check it at the campus cafeteria.', createdAt: new Date(now - 6_000_000) },
      { conversationId: conversation.id, type: 'SYSTEM', body: 'Sadia (demo) offered ৳35,000', createdAt: new Date(now - 3_600_000) },
    ],
  });
  const offer = await prisma.offer.create({
    data: { listingId: listing.id, buyerId: buyer.id, sellerId: seller.id, amountBdt: 35000 },
  });
  await prisma.offerEvent.create({ data: { offerId: offer.id, actorId: buyer.id, type: 'CREATED', amountBdt: 35000 } });

  console.log(`Created ${sellers.length} demo accounts and ${listings.length} demo listings.`);
  console.log(`Sign in with rafi@demo.sellnest.invalid. Password: ${process.env.DEMO_PASSWORD ? 'the DEMO_PASSWORD you set' : password}`);
  if (!s3) console.log('S3 is not configured, so demo listings have no photos.');
}

async function main() {
  const production = process.env.NODE_ENV === 'production';
  const locationIds = await seedReference();
  console.log('Reference data ready.');
  // Production gets demo data only when explicitly requested, and never with a default password.
  if (process.env.SEED_DEMO === 'false' || (production && process.env.SEED_DEMO !== 'true')) return;
  if (production && !process.env.DEMO_PASSWORD) throw new Error('Set DEMO_PASSWORD to seed demo data in production.');
  await seedDemo(locationIds);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
