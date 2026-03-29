import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  bytes: number;
  resourceType: string;
  format?: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.getOrThrow<string>(
        'storage.cloudinaryCloudName',
      ),
      api_key: this.configService.getOrThrow<string>(
        'storage.cloudinaryApiKey',
      ),
      api_secret: this.configService.getOrThrow<string>(
        'storage.cloudinaryApiSecret',
      ),
      secure: true,
    });
  }

  async uploadBuffer(
    fileBuffer: Buffer,
    fileName: string,
    folder?: string,
  ): Promise<CloudinaryUploadResult> {
    const cloudinaryFolder =
      folder ??
      this.configService.get<string>('storage.cloudinaryFolder', 'diagent');

    this.logger.log(
      JSON.stringify({
        event: 'cloudinary.upload.started',
        fileName,
        folder: cloudinaryFolder,
        bytes: fileBuffer.length,
      }),
    );

    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
          {
            folder: cloudinaryFolder,
            public_id: fileName,
            resource_type: 'auto',
            use_filename: true,
            unique_filename: true,
            overwrite: false,
          },
          (error, response) => {
            if (error || !response) {
              reject(
                error instanceof Error
                  ? error
                  : new Error('Cloudinary upload failed'),
              );
              return;
            }

            resolve(response);
          },
        );

        Readable.from(fileBuffer).pipe(upload);
      });

      this.logger.log(
        JSON.stringify({
          event: 'cloudinary.upload.completed',
          fileName,
          folder: cloudinaryFolder,
          bytes: result.bytes,
          publicId: result.public_id,
          resourceType: result.resource_type,
          format: result.format,
        }),
      );

      return {
        url: result.secure_url,
        publicId: result.public_id,
        bytes: result.bytes,
        resourceType: result.resource_type,
        format: result.format,
      };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'cloudinary.upload.failed',
          fileName,
          folder: cloudinaryFolder,
          bytes: fileBuffer.length,
          message:
            error instanceof Error ? error.message : 'Cloudinary upload failed',
        }),
      );
      throw error;
    }
  }
}
