import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpgradeProDto {
  @ApiProperty({ example: 'Restaurant Chez Maman Ngo' })
  @IsString()
  public businessName!: string;

  @ApiProperty({ example: 'restaurant' })
  @IsString()
  public businessType!: string;

  @ApiProperty({ example: '+237690000000' })
  @IsString()
  public phone!: string;

  @ApiProperty({ example: 'Akwa, Douala, Cameroun' })
  @IsString()
  public address!: string;

  @ApiPropertyOptional({ example: 'Spécialités camerounaises faites maison depuis 2010' })
  @IsOptional()
  @IsString()
  public description?: string;
}
