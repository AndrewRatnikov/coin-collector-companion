import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { sanitizeIdentityField } from '@coin-collector/shared';

export const REJECTION_REASON_MAX_LENGTH = 500;

const MAX_YEAR = new Date().getFullYear() + 1; // computed once at module load, same as CreateCoinDto

const trimIfString = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// PATCH /admin/coins/:id body. The edit fields carry the same validators/transforms as
// CreateCoinDto but are all optional and have NO class-field initializers: an absent key
// means "leave this column unchanged". (PartialType(CreateCoinDto) would copy CreateCoinDto's
// `= ''` initializers for mintMark/variety and silently clear them.) The "reason only with
// rejected" rule lives in AdminService.reviewCoin, not here.
export class ReviewCoinDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @ApiPropertyOptional({ maxLength: REJECTION_REASON_MAX_LENGTH, example: 'Photo is too blurry to verify' })
  @IsOptional()
  @Transform(trimIfString)
  @IsString()
  @MaxLength(REJECTION_REASON_MAX_LENGTH)
  rejectionReason?: string;

  @ApiPropertyOptional({ example: 'USA' })
  @IsOptional()
  @Transform(trimIfString)
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Cent' })
  @IsOptional()
  @Transform(trimIfString)
  @IsString()
  denomination?: string;

  @ApiPropertyOptional({ example: 'Indian Head Cent' })
  @IsOptional()
  @Transform(trimIfString)
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 1943 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(MAX_YEAR)
  year?: number;

  @ApiPropertyOptional({ example: 'D' })
  @IsOptional()
  @Transform(({ value }) => sanitizeIdentityField(value))
  @IsString()
  mintMark?: string;

  @ApiPropertyOptional({ example: 'Doubled Die' })
  @IsOptional()
  @Transform(({ value }) => sanitizeIdentityField(value))
  @IsString()
  variety?: string;
}
