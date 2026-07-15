import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class LinkCoinDto {
  @ApiProperty({ description: 'Id of the open SetSlot to link this coin to' })
  @IsUUID()
  slotId!: string;
}
