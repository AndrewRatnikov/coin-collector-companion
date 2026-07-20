import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

export class CloneFromDto {
  @ApiProperty({ enum: ['canonical', 'user'] })
  @IsIn(['canonical', 'user'])
  type!: 'canonical' | 'user';

  @ApiProperty()
  @IsUUID()
  id!: string;
}
