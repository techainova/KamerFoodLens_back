import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class BuyTicketDto {
  @ApiProperty({ example: 'tombola-uuid' })
  @IsString()
  public tombolaId!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  public qty!: number;
}
