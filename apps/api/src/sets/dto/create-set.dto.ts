import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CloneFromDto } from './clone-from.dto';

export class CreateSetDto {
  @ApiProperty({ example: 'My Lincoln Cents' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ type: CloneFromDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CloneFromDto)
  cloneFrom?: CloneFromDto;
}
