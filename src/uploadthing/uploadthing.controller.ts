import { All, Controller, Next, Req, Res } from '@nestjs/common';
import { UploadthingService } from './uploadthing.service';
import { createRouteHandler } from 'uploadthing/express';
import { ourFileRouter } from './uploadthing.router';
import { NextFunction, Request, Response } from 'express';

@Controller('uploadthing')
export class UploadthingController {
  constructor(private readonly uploadthingService: UploadthingService) {}

  private readonly routeHandler = createRouteHandler({
    router: ourFileRouter,
    config: {
      token: process.env.UPLOADTHING_SECRET,
      logLevel: 'Info',
    },
  });

  @All('*')
  handleUpload(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    return this.routeHandler(req, res, next);
  }
}
