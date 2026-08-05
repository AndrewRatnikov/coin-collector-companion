import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { FeedbackResponse } from '@coin-collector/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { FeedbackService } from './feedback.service';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';

@ApiTags('feedback')
@ApiBearerAuth()
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({ summary: 'Submit user feedback' })
  @ApiCreatedResponse({ description: 'The newly created feedback row' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitFeedbackDto): Promise<FeedbackResponse> {
    return this.feedbackService.submit(user.userId, dto.text);
  }
}
