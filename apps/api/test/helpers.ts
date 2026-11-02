import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaClient, User, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/common/redis.service';
import { MailJob, MailService } from '../src/modules/jobs/mail.service';
import { configureApp } from '../src/setup';

export const PASSWORD = 'correct-horse-battery';
const ORIGIN = 'http://localhost:3100';

export const prisma = new PrismaClient();
export const outbox: MailJob[] = [];

export interface Harness {
  app: NestExpressApplication;
  base: string;
  close(): Promise<void>;
}

export async function startApp(): Promise<Harness> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue({
      enqueue: async (job: MailJob) => void outbox.push(job),
      deliver: async () => undefined,
    })
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, base: `http://127.0.0.1:${port}/api/v1`, close: () => app.close() };
}

export async function resetData(app: NestExpressApplication) {
  await prisma.$executeRawUnsafe(`TRUNCATE
    "AuditLog","Block","Review","Report","Notification","OfferEvent","Offer","Message",
    "ConversationParticipant","Conversation","Favorite","ListingImage","Listing","Category",
    "Location","AuthToken","Session","User","PlatformSetting" CASCADE`);
  await app.get(RedisService).client.flushdb();
  outbox.length = 0;
}

export interface Res<T = any> {
  status: number;
  body: T;
  setCookie: string | null;
}

export class Client {
  cookie = '';
  constructor(
    private readonly base: string,
    public user?: User,
  ) {}

  async req<T = any>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res<T>> {
    const res = await fetch(this.base + path, {
      method,
      headers: {
        origin: ORIGIN,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0]!;
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, setCookie };
  }
  get<T = any>(path: string) {
    return this.req<T>('GET', path);
  }
  post<T = any>(path: string, body?: unknown) {
    return this.req<T>('POST', path, body);
  }
  patch<T = any>(path: string, body?: unknown) {
    return this.req<T>('PATCH', path, body);
  }
}

let hashed: Promise<string> | undefined;

export async function signedIn(
  base: string,
  name: string,
  opts: { role?: UserRole; verified?: boolean; ageDays?: number } = {},
) {
  hashed ??= argon2.hash(PASSWORD, { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: {
      email: `${name}-${randomUUID().slice(0, 8)}@test.invalid`,
      username: `${name}_${randomUUID().slice(0, 8)}`,
      displayName: name,
      passwordHash: await hashed,
      role: opts.role ?? 'USER',
      emailVerifiedAt: opts.verified === false ? null : new Date(),
      createdAt: new Date(Date.now() - (opts.ageDays ?? 30) * 86_400_000),
    },
  });
  const client = new Client(base, user);
  const res = await client.post('/auth/login', { email: user.email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  return client;
}

/** Two locations 9 km or so apart, plus one in another city, for radius checks. */
export async function seedPlaces() {
  const near = await prisma.location.create({
    data: { slug: 'campus', name: 'Campus', type: 'CAMPUS', latitude: 23.8769, longitude: 90.3206, isFeatured: true },
  });
  const mid = await prisma.location.create({
    data: { slug: 'uttara', name: 'Uttara', type: 'AREA', latitude: 23.8759, longitude: 90.3795 },
  });
  const far = await prisma.location.create({
    data: { slug: 'sylhet', name: 'Sylhet', type: 'CITY', latitude: 24.8949, longitude: 91.8687 },
  });
  const category = await prisma.category.create({ data: { slug: 'laptops', name: 'Laptops' } });
  return { near, mid, far, category };
}

export function createListing(
  sellerId: string,
  places: { categoryId: string; location: { id: string; latitude: number; longitude: number } },
  over: Partial<{ title: string; status: 'ACTIVE' | 'DRAFT' | 'PENDING_REVIEW' | 'SOLD'; negotiable: boolean; priceBdt: number }> = {},
) {
  return prisma.listing.create({
    data: {
      sellerId,
      status: over.status ?? 'ACTIVE',
      title: over.title ?? 'Lenovo laptop for sale',
      description: 'A perfectly reasonable description of this item.',
      categoryId: places.categoryId,
      condition: 'GOOD',
      priceBdt: over.priceBdt ?? 30000,
      negotiable: over.negotiable ?? true,
      locationId: places.location.id,
      latitude: places.location.latitude,
      longitude: places.location.longitude,
      publishedAt: new Date(),
    },
  });
}
