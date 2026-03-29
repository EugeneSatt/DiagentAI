import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Document } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  create(data: Prisma.DocumentCreateInput): Promise<Document> {
    return this.prismaService.document.create({ data });
  }

  async findById(documentId: string): Promise<Document> {
    const document = await this.prismaService.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  update(
    documentId: string,
    data: Prisma.DocumentUpdateInput,
  ): Promise<Document> {
    return this.prismaService.document.update({
      where: { id: documentId },
      data,
    });
  }

  upsertRawDocument(
    documentId: string,
    data: Prisma.DocumentRawUncheckedCreateInput,
  ) {
    return this.prismaService.documentRaw.upsert({
      where: { documentId },
      create: data,
      update: {
        rawTextEncrypted: data.rawTextEncrypted,
        normalizedJson: data.normalizedJson,
        aiResponseEncrypted: data.aiResponseEncrypted,
        schemaVersion: data.schemaVersion,
        ocrProvider: data.ocrProvider,
        model: data.model,
      },
    });
  }

  listByUser(userId: string) {
    return this.prismaService.document.findMany({
      where: { userId },
      orderBy: {
        uploadedAt: 'desc',
      },
    });
  }
}
