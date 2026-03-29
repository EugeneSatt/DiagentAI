import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtPayload } from '../../../domain/auth/jwt-payload.interface';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../auth/guards/access-token.guard';
import { UploadDocumentDto } from '../dto/upload-document.dto';
import { DocumentsService } from '../services/documents.service';

@Controller({
  path: 'documents',
  version: '1',
})
@UseGuards(AccessTokenGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 25 * 1024 * 1024,
      },
    }),
  )
  upload(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documentsService.upload(user.sub, dto, file);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.documentsService.list(user.sub);
  }

  @Get('doctor-notes')
  listDoctorNotes(@CurrentUser() user: JwtPayload) {
    return this.documentsService.listDoctorNotes(user.sub);
  }
}
