import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsInt, Min } from 'class-validator';

export class TopupWalletDto {
  @ApiProperty({ example: 5000, minimum: 100 })
  @IsInt()
  @Min(100)
  public amount!: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.cinetpay })
  @IsEnum(PaymentMethod)
  public method!: PaymentMethod;
}
