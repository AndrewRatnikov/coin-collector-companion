import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const MAX_FEEDBACK_LENGTH = 2000;

export class SubmitFeedbackDto {
  @ApiProperty({ example: 'I love the gap-view feature!' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_FEEDBACK_LENGTH)
  text!: string;
}
