import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePaymentMethodsDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  public acceptsMtn?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  public acceptsOrange?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  public acceptsCard?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  public acceptsCash?: boolean;

  @ApiPropertyOptional({ example: '+237670000000' })
  @IsOptional()
  @IsString()
  public mtnPhone?: string;

  @ApiPropertyOptional({ example: '+237690000000' })
  @IsOptional()
  @IsString()
  public orangePhone?: string;
}
