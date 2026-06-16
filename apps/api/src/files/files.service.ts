import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, mongo } from 'mongoose';
import {
  MEDIA_MAX_BYTES,
  isAllowedMedia,
  mediaTypeForMime,
  type PromptMedia,
} from '@lyra/shared';

const { GridFSBucket, ObjectId } = mongo;
const BUCKET = 'prompt_media';

// What multer hands us (memory storage). Typed locally to avoid an
// @types/multer dependency.
export interface UploadedFileLike {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

// File storage on MongoDB GridFS (no external object store yet — Phase 6 can
// migrate this to R2/S3 behind the same PromptMedia.url contract). Metadata
// records the owning workspace so a future authed/signed-URL scheme is easy.
@Injectable()
export class FilesService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  private bucket(): InstanceType<typeof GridFSBucket> {
    const db = this.conn.db;
    if (!db) throw new Error('Database connection not ready');
    return new GridFSBucket(db, { bucketName: BUCKET });
  }

  async upload(
    workspaceId: string,
    actorId: string,
    file: UploadedFileLike | undefined,
  ): Promise<PromptMedia> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!isAllowedMedia(file.mimetype, file.originalname)) {
      throw new BadRequestException(`File type not allowed: ${file.originalname}`);
    }
    if (file.size > MEDIA_MAX_BYTES) {
      throw new BadRequestException('File exceeds the 25 MB limit');
    }

    const id = new ObjectId();
    const bucket = this.bucket();
    await new Promise<void>((resolve, reject) => {
      const stream = bucket.openUploadStreamWithId(id, file.originalname, {
        metadata: { workspaceId, createdBy: actorId, contentType: file.mimetype },
      });
      stream.on('error', reject);
      stream.on('finish', () => resolve());
      stream.end(file.buffer);
    });

    return {
      type: mediaTypeForMime(file.mimetype),
      url: `/files/${id.toHexString()}`,
      name: file.originalname,
      mime: file.mimetype,
      size: file.size,
    };
  }

  async open(id: string): Promise<{
    file: mongo.GridFSFile;
    stream: NodeJS.ReadableStream;
  }> {
    let oid: InstanceType<typeof ObjectId>;
    try {
      oid = new ObjectId(id);
    } catch {
      throw new NotFoundException('File not found');
    }
    const bucket = this.bucket();
    const [file] = await bucket.find({ _id: oid }).limit(1).toArray();
    if (!file) throw new NotFoundException('File not found');
    return { file, stream: bucket.openDownloadStream(oid) };
  }
}
