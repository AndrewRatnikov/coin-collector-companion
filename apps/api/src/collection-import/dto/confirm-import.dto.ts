import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { COIN_GRADES, IMPORT_MAX_ROWS, type CoinGrade } from '@coin-collector/shared';

export class ImportConfirmGradeDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID('4')
  coinId!: string;

  @ApiProperty({ enum: [...COIN_GRADES], example: 'VF' })
  @IsIn(COIN_GRADES)
  grade!: CoinGrade;
}

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

  // Only coins with a recognised grade are sent; omitted coins keep their current grade.
  @ApiProperty({
    type: [ImportConfirmGradeDto],
    required: false,
    maxItems: IMPORT_MAX_ROWS,
    description: 'Grades to set on the confirmed coins; each coinId must be one of coinIds, once',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(IMPORT_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ImportConfirmGradeDto)
  grades?: ImportConfirmGradeDto[];
}
