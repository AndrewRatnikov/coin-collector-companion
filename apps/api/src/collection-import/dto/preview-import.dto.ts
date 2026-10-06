import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// Multipart text fields that accompany the uploaded `file`.
export class PreviewImportDto {
  @ApiPropertyOptional({
    description: 'JSON object of field -> 0-based column index; omit to use the suggested mapping',
    example: '{"year":0,"country":1,"denomination":2}',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mapping?: string;
}
