import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IMAGE_MAX_BYTES, IMAGE_MIN_DIMENSION, IMAGE_VARIANT_WIDTHS } from '@sellnest/shared';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { AuthUser, CurrentUser, RateLimit } from '../../common/auth.decorators';
import { PrismaService } from '../../common/prisma.service';
import { StorageService } from '../../common/storage.service';
import { ListingMapper } from '../listings/listing.mapper';

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_PIXELS = 50_000_000;
const MAX_UNATTACHED = 60;
const MAX_CONCURRENT = 2;

/**
 * Uploads go through the API instead of presigned URLs. Every image has to be decoded and
 * re-encoded on the server anyway; sending the bytes here makes that unavoidable, so nothing
 * unprocessed can reach the bucket. Re-encoding also removes EXIF data, including the GPS
 * position phones embed, which would otherwise reveal where a seller lives.
 */
@Injectable()
export class UploadsService {
  private active = 0;
  private waiting: (() => void)[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly mapper: ListingMapper,
  ) {}

  /** Image work is CPU-heavy, so a burst must not starve a small VPS. */
  private async withSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= MAX_CONCURRENT) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }

  async process(buffer: Buffer) {
    // sharp identifies the format from the bytes; the filename and Content-Type are never used.
    const image = sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: 'error' });
    let meta: sharp.Metadata;
    try {
      meta = await image.metadata();
    } catch {
      throw new BadRequestException('That file is not a readable image');
    }
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
      throw new BadRequestException('Use a JPEG, PNG or WebP image');
    }
    if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < IMAGE_MIN_DIMENSION) {
      throw new BadRequestException(`Photos must be at least ${IMAGE_MIN_DIMENSION}px on each side`);
    }
    try {
      const variants = await Promise.all(
        IMAGE_VARIANT_WIDTHS.map(async (width) => ({
          width,
          data: await image
            .clone()
            .rotate()
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: width === 320 ? 72 : 80 })
            .toBuffer({ resolveWithObject: true }),
        })),
      );
      const largest = variants[variants.length - 1]!.data.info;
      return { variants, width: largest.width, height: largest.height };
    } catch {
      throw new BadRequestException('That image is damaged and could not be processed');
    }
  }

  async upload(userId: string, buffer: Buffer) {
    if (!this.storage.enabled) throw new ServiceUnavailableException('Photo uploads are not set up yet');
    const unattached = await this.prisma.listingImage.count({ where: { uploaderId: userId, listingId: null } });
    if (unattached >= MAX_UNATTACHED) {
      throw new BadRequestException('You have too many unused photos. Finish a listing or try again tomorrow.');
    }
    const { variants, width, height } = await this.withSlot(() => this.process(buffer));
    const keyBase = `images/${randomUUID()}`;
    try {
      await Promise.all(
        variants.map((v) => this.storage.put(`${keyBase}/${v.width}.webp`, v.data.data, 'image/webp')),
      );
    } catch (e) {
      await this.storage.deleteMany(variants.map((v) => `${keyBase}/${v.width}.webp`)).catch(() => undefined);
      throw e;
    }
    const row = await this.prisma.listingImage.create({ data: { uploaderId: userId, keyBase, width, height } });
    return this.mapper.image(row);
  }

  /** Unlinks only; the cleanup job removes the objects, so storage errors cannot strand the UI. */
  async release(userId: string, id: string) {
    const image = await this.prisma.listingImage.findUnique({ where: { id } });
    if (!image) throw new NotFoundException('Photo not found');
    if (image.uploaderId !== userId) throw new ForbiddenException('This is not your photo');
    await this.prisma.listingImage.update({ where: { id }, data: { listingId: null, createdAt: new Date() } });
  }
}

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @RateLimit({ name: 'upload', limit: 60, windowSeconds: 3600, by: 'user' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMAGE_MAX_BYTES, files: 1 } }))
  @Post('images')
  image(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Choose a photo to upload');
    return this.uploads.upload(user.id, file.buffer);
  }

  @HttpCode(204)
  @Delete('images/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.uploads.release(user.id, id);
  }
}
