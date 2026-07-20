import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetOwnershipDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  owned!: boolean;
}
