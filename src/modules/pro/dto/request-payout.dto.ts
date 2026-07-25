import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class RequestPayoutDto {
  @ApiProperty({ example: 50000 })
  @IsInt()
  @Min(1)
  public amountXAF!: number;

  @ApiProperty({ example: 'cinetpay' })
  @IsString()
  public method!: string;

  @ApiProperty({ example: '+237600000000' })
  @IsString()
  public phone!: string;
}
