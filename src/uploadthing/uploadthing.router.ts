import { createUploadthing, type FileRouter } from 'uploadthing/express';

const f = createUploadthing();

export const uploadRouter: FileRouter = {
  chatImage: f({
    image: {
      maxFileSize: '256MB',
      maxFileCount: 1,
    },
  }).onUploadComplete((data) => {
    console.log('Image upload completed', data);
  }),

  chatVideo: f({
    video: {
      maxFileSize: '256MB',
      maxFileCount: 1,
    },
  }).onUploadComplete((data) => {
    console.log('Video upload completed', data);
  }),

  chatFile: f({
    pdf: { maxFileSize: '8MB', maxFileCount: 1 },
    text: { maxFileSize: '2MB', maxFileCount: 1 },
  }).onUploadComplete((data) => {
    console.log('File upload completed', data);
  }),

  chatAudio: f({
    audio: {
      maxFileSize: '8MB',
      maxFileCount: 1,
    },
  }).onUploadComplete((data) => {
    console.log('Audio upload completed', data);
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
