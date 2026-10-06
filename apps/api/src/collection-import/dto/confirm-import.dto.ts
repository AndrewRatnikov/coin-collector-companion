import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { IMPORT_MAX_ROWS } from '@coin-collector/shared';

export class ConfirmImportDto {
  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: IMPORT_MAX_ROWS,
    example: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(IMPORT_MAX_ROWS)
  @IsUUID('4', { each: true })
  coinIds!: string[];
}
