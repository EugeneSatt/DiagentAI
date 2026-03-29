import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class LocalStagingService {
  private readonly logger = new Logger(LocalStagingService.name);
  private readonly baseDir = join(tmpdir(), 'diagent-staging');

  async saveBuffer(input: {
    buffer: Buffer;
    fileName?: string;
    prefix: string;
  }): Promise<string> {
    await mkdir(this.baseDir, { recursive: true });

    const extension = extname(input.fileName ?? '') || '.bin';
    const filePath = join(
      this.baseDir,
      `${input.prefix}-${randomUUID()}${extension}`,
    );

    await writeFile(filePath, input.buffer);
    this.logger.log(
      JSON.stringify({
        event: 'local-staging.save.completed',
        filePath,
        bytes: input.buffer.length,
      }),
    );

    return filePath;
  }

  async readBuffer(filePath: string): Promise<Buffer> {
    this.logger.log(
      JSON.stringify({
        event: 'local-staging.read.started',
        filePath,
      }),
    );
    const buffer = await readFile(filePath);
    this.logger.log(
      JSON.stringify({
        event: 'local-staging.read.completed',
        filePath,
        bytes: buffer.length,
      }),
    );
    return buffer;
  }

  async delete(filePath: string): Promise<void> {
    try {
      await rm(filePath, { force: true });
      this.logger.log(
        JSON.stringify({
          event: 'local-staging.delete.completed',
          filePath,
        }),
      );
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'local-staging.delete.failed',
          filePath,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to delete temp file',
        }),
      );
    }
  }
}
