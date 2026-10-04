import { Global, Module } from '@nestjs/common';
import { FileStorage } from './file-storage';
import { ImageService } from './image.service';
import { S3FileStorage } from './s3-file-storage';

@Global()
@Module({
  providers: [{ provide: FileStorage, useClass: S3FileStorage }, ImageService],
  exports: [FileStorage, ImageService],
})
export class StorageModule {}
