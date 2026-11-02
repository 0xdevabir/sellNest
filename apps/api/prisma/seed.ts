import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ListingCondition, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
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

const DEMO_ITEMS: {
  title: string;
  category: string;
  condition: ListingCondition;
  price: number;
  original?: number;
  negotiable?: boolean;
  location: string;
  seller: number;
  brand?: string;
  description: string;
}[] = [
  { title: 'Lenovo IdeaPad 3 laptop, Ryzen 5, 8 GB', category: 'laptops', condition: 'GOOD', price: 38000, original: 58000, negotiable: true, location: 'daffodil-smart-city', seller: 0, brand: 'Lenovo', description: 'Used for two semesters. Battery lasts about four hours. Comes with the original charger. Small scratch on the lid, screen is clean.' },
  { title: 'HP Pavilion 15, Core i5, 512 GB SSD', category: 'laptops', condition: 'LIKE_NEW', price: 52000, original: 72000, negotiable: true, location: 'khagan', seller: 1, brand: 'HP', description: 'Bought last year and hardly used. Runs Windows 11 smoothly, and the keyboard backlight works. Box and bill available.' },
  { title: 'Samsung Galaxy A34 5G, 8/128', category: 'phones', condition: 'GOOD', price: 21500, negotiable: true, location: 'ashulia', seller: 2, brand: 'Samsung', description: 'One owner. Always used with a cover and screen protector. Official variant with charger and box.' },
  { title: 'Xiaomi Redmi Note 12, 6/128', category: 'phones', condition: 'FAIR', price: 11000, location: 'birulia', seller: 0, brand: 'Xiaomi', description: 'Back glass has a hairline crack; everything else works. A good backup phone at a fair price.' },
  { title: 'Sony WH-CH520 wireless headphones', category: 'audio', condition: 'LIKE_NEW', price: 4200, original: 6200, location: 'daffodil-smart-city', seller: 3, brand: 'Sony', description: 'Used for a month. Long battery life and clean sound. Includes the charging cable.' },
  { title: 'Logitech mechanical keyboard and mouse set', category: 'accessories', condition: 'GOOD', price: 3500, negotiable: true, location: 'khagan', seller: 1, brand: 'Logitech', description: 'Both work perfectly. Selling because I moved to a laptop-only setup. The USB receiver is included.' },
  { title: '24 inch Dell monitor, full HD', category: 'accessories', condition: 'GOOD', price: 12500, negotiable: true, location: 'uttara', seller: 4, brand: 'Dell', description: 'No dead pixels. HDMI and VGA inputs. Stand adjusts for height. Pick up from Uttara sector 10.' },
  { title: 'Introduction to Algorithms, CLRS, 3rd edition', category: 'course-books', condition: 'GOOD', price: 900, location: 'daffodil-smart-city', seller: 2, description: 'Local print. Some highlighting in the first eight chapters. Useful for the algorithms course and for interviews.' },
  { title: 'Engineering mathematics book set, 3 volumes', category: 'course-books', condition: 'FAIR', price: 750, negotiable: true, location: 'ashulia', seller: 3, description: 'Three volumes with pencil notes in the margins. Covers are worn but all pages are intact.' },
  { title: 'Humayun Ahmed novel collection, 12 books', category: 'fiction', condition: 'GOOD', price: 1800, location: 'mirpur', seller: 4, description: 'Twelve novels in good condition. Selling them together because I am moving out of my flat.' },
  { title: 'Study table with drawer, wood finish', category: 'desks-chairs', condition: 'GOOD', price: 4500, original: 7500, negotiable: true, location: 'khagan', seller: 0, description: 'Solid table that fits a hostel room. You will need to arrange a van; I can help carry it downstairs.' },
  { title: 'Ergonomic mesh office chair', category: 'desks-chairs', condition: 'LIKE_NEW', price: 8500, negotiable: true, location: 'birulia', seller: 1, description: 'Adjustable height and armrests, used for six months. No tears in the mesh, and the wheels roll smoothly.' },
  { title: 'Single bed with mattress', category: 'beds-storage', condition: 'FAIR', price: 6000, negotiable: true, location: 'ashulia', seller: 2, description: 'Wooden frame and a foam mattress. Some marks on the frame. Must be picked up this month.' },
  { title: 'Plastic wardrobe, 4 shelves', category: 'beds-storage', condition: 'GOOD', price: 2200, location: 'daffodil-smart-city', seller: 3, description: 'Lightweight and easy to take apart for moving. Zip cover has no tears.' },
  { title: 'Miyako rice cooker, 1.8 litre', category: 'kitchen', condition: 'GOOD', price: 1500, location: 'khagan', seller: 4, brand: 'Miyako', description: 'Works well and the inner pot has no scratches. Ideal for a shared hostel kitchen.' },
  { title: 'Walton mini fridge, 50 litre', category: 'appliances', condition: 'GOOD', price: 9500, original: 14000, negotiable: true, location: 'ashulia', seller: 0, brand: 'Walton', description: 'Cools properly and runs quietly. Fits under a desk. Used for one and a half years.' },
  { title: 'Table fan, 16 inch', category: 'appliances', condition: 'FAIR', price: 1200, location: 'birulia', seller: 1, description: 'All three speeds work. It has a little noise at top speed, but nothing that bothers me at night.' },
  { title: 'Formal blazer, navy, size 40', category: 'clothing', condition: 'LIKE_NEW', price: 2500, original: 5000, location: 'dhanmondi', seller: 4, description: 'Worn twice for presentations. Dry cleaned and ready to wear.' },
  { title: 'Bata leather shoes, size 42', category: 'shoes-bags', condition: 'GOOD', price: 1400, location: 'mohammadpur', seller: 2, brand: 'Bata', description: 'Lightly used formal shoes. Soles are in good shape, and they have just been polished.' },
  { title: 'Laptop backpack, water resistant', category: 'shoes-bags', condition: 'LIKE_NEW', price: 900, location: 'daffodil-smart-city', seller: 3, description: 'Fits a 15.6 inch laptop. All zips work, and there are no stains.' },
  { title: 'Phoenix mountain bicycle, 26 inch', category: 'bicycles', condition: 'GOOD', price: 11500, negotiable: true, location: 'savar', seller: 0, brand: 'Phoenix', description: 'Recently serviced with new brake pads. Good for getting around campus and the nearby area.' },
  { title: 'Yonex badminton racket pair', category: 'sports-gear', condition: 'GOOD', price: 1600, location: 'khagan', seller: 1, brand: 'Yonex', description: 'Two rackets with covers. Strings still have good tension.' },
  { title: 'Acoustic guitar with bag', category: 'instruments', condition: 'GOOD', price: 5500, negotiable: true, location: 'uttara', seller: 4, description: 'Good beginner guitar with a nice tone. Comes with a bag, a capo and spare strings.' },
  { title: 'Casio scientific calculator fx-991EX', category: 'accessories', condition: 'LIKE_NEW', price: 1700, location: 'daffodil-smart-city', seller: 2, brand: 'Casio', description: 'Used for one semester. Genuine unit, with the cover and manual.' },
];

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
