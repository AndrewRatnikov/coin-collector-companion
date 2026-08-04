import { Injectable } from '@nestjs/common';
import type { FeedbackResponse } from '@coin-collector/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(userId: string, text: string): Promise<FeedbackResponse> {
    return this.prisma.feedback.create({ data: { userId, text } });
  }
}
