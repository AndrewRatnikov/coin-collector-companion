/**
 * Tests for: FeedbackService
 * Contract source: runs/run_20260804_165504/plan.md § Interface Contract → Backend service:
 *                   apps/api/src/feedback/feedback.service.ts (CREATE)
 * Covers criteria: #3 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaService is mocked entirely (feedback.create) — no real DB or network call, no
 * Prisma error-code branching to exercise (the service has none, per plan.md's Approach
 * step 2 — a plain create() is the whole implementation).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { FeedbackService } from './feedback.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let mockPrismaService: {
    feedback: {
      create: jest.Mock;
    };
  };

  const userId = 'user-1';
  const text = 'This app is great, thanks!';
  const CREATED_ROW = {
    id: 'feedback-1',
    userId,
    text,
    createdAt: new Date('2026-08-04T00:00:00.000Z'),
  };

  beforeEach(async () => {
    mockPrismaService = {
      feedback: {
        create: jest.fn().mockResolvedValue(CREATED_ROW),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FeedbackService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get(FeedbackService);
  });

  describe('criterion #3: submit persists userId + text via prisma.feedback.create', () => {
    it('calls prisma.feedback.create with { data: { userId, text } }', async () => {
      await service.submit(userId, text);
      expect(mockPrismaService.feedback.create).toHaveBeenCalledWith({ data: { userId, text } });
    });

    it('returns the created row unchanged', async () => {
      const result = await service.submit(userId, text);
      expect(result).toEqual(CREATED_ROW);
    });

    it('propagates a rejection from prisma.feedback.create', async () => {
      mockPrismaService.feedback.create.mockRejectedValue(new Error('db unavailable'));
      await expect(service.submit(userId, text)).rejects.toThrow('db unavailable');
    });
  });
});
