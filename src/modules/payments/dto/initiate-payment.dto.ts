import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({ example: 'order-uuid' })
  @IsString()
  public orderId!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.cinetpay })
  @IsEnum(PaymentMethod)
  public method!: PaymentMethod;
}
