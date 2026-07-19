import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateSetDto {
  @ApiProperty({ example: 'My Renamed Set' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
