import { verifyToken } from '@clerk/backend';
import { createUploadthing, FileRouter } from 'uploadthing/express';
import { Logger } from '@nestjs/common';
import { UploadThingError } from 'uploadthing/server';
import type { Request as ExpressRequest } from 'express';

const f = createUploadthing();
const logger = new Logger('UploadThing');

const auth = async (req: ExpressRequest) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UploadThingError(
      'Unauthorized: No authorization header provided',
    );
  }
  const token = authHeader.substring(7);

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    const userId = payload.sub;
    if (!userId) {
      throw new UploadThingError('Unauthorized: Invalid token payload');
    }

    return { userId: userId };
  } catch (error) {
    logger.error('UploadThing Auth Error:', error.message);
    throw new UploadThingError('Unauthorized: Invalid token');
  }
};

export const ourFileRouter: FileRouter = {
  chatFiles: f({
    image: { maxFileSize: '4MB', maxFileCount: 1 },
    video: { maxFileSize: '64MB', maxFileCount: 1 },
    audio: { maxFileSize: '8MB', maxFileCount: 1 },
    pdf: { maxFileSize: '16MB', maxFileCount: 1 },
  })
    .middleware(async ({ req }) => await auth(req))
    .onUploadComplete(async ({ metadata, file }) => {
      logger.log(`Upload Complete for user ${metadata.userId}: ${file.url}`);

      return { uploadedBy: metadata.userId, fileUrl: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
