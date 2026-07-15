import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class FindSetsQueryDto {
  @ApiPropertyOptional({
    description:
      'true = templates only, false = the caller\'s own custom sets only, omitted = both',
  })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isTemplate?: boolean;
}
