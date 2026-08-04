/**
 * Tests for: FeedbackController
 * Contract source: runs/run_20260804_165504/plan.md § Interface Contract → Backend controller:
 *                   apps/api/src/feedback/feedback.controller.ts (CREATE)
 * Covers criteria: #3, #7 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * FeedbackService is mocked entirely — this file only proves the controller delegates to
 * the service with `user.userId` (never a raw user object) and `dto.text`, and that
 * `create` carries no @Public() metadata (protected by the global JwtAuthGuard by default,
 * per plan.md's Approach step 2). No real network/DB call anywhere in this file. Follows
 * the same convention as apps/api/src/collection/collection.controller.spec.ts.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('FeedbackController', () => {
  let controller: FeedbackController;
  let mockFeedbackService: {
    submit: jest.Mock;
  };

  const user: AuthenticatedUser = { userId: 'user-1', email: 'a@example.com' };

  beforeEach(async () => {
    mockFeedbackService = {
      submit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedbackController],
      providers: [{ provide: FeedbackService, useValue: mockFeedbackService }],
    }).compile();

    controller = module.get(FeedbackController);
  });

  describe('criterion #7: @Public() metadata — create requires auth', () => {
    it('does not mark create as public', () => {
      const reflector = new Reflector();
      expect(reflector.get<boolean>(IS_PUBLIC_KEY, controller.create)).toBeFalsy();
    });
  });

  describe('criterion #3: create delegates to feedbackService.submit', () => {
    it('calls feedbackService.submit with user.userId and dto.text, and returns its result unchanged', async () => {
      const dto: SubmitFeedbackDto = Object.assign(new SubmitFeedbackDto(), { text: 'Great app!' });
      const serviceResult = {
        id: 'feedback-1',
        userId: 'user-1',
        text: 'Great app!',
        createdAt: new Date('2026-08-04T00:00:00.000Z'),
      };
      mockFeedbackService.submit.mockResolvedValue(serviceResult);

      const result = await controller.create(user, dto);

      expect(mockFeedbackService.submit).toHaveBeenCalledWith('user-1', 'Great app!');
      expect(result).toEqual(serviceResult);
    });

    it('never passes the raw user object as the first service arg, only user.userId', async () => {
      const dto: SubmitFeedbackDto = Object.assign(new SubmitFeedbackDto(), { text: 'Feedback text' });
      mockFeedbackService.submit.mockResolvedValue({});

      await controller.create(user, dto);

      const [firstArg] = mockFeedbackService.submit.mock.calls[0] as [unknown, unknown];
      expect(firstArg).toBe('user-1');
      expect(firstArg).not.toBe(user);
    });
  });
});
