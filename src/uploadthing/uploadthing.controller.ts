import {
  All,
  Controller,
  Next,
  Req,
  Res,
} from '@nestjs/common';
import { createRouteHandler } from 'uploadthing/express';
import { uploadRouter } from './uploadthing.router';
import { NextFunction, Request, Response } from 'express';

@Controller('api/uploadthing')
export class UploadthingController {
  private readonly handler: ReturnType<typeof createRouteHandler>;

  constructor() {
    this.handler = createRouteHandler({
      router: uploadRouter,
    });
  }

  handleUploadThing(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    return this.handler(req, res, next);
  }
}
