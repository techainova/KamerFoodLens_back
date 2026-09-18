import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class ScanImageDto {
  @ApiProperty({ example: 'base64-encoded-image-bytes' })
  @IsString()
  public imageBase64!: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  public mimeType?: string;

  // Résultat déjà calculé par le modèle TFLite embarqué sur l'appareil (fallback
  // hors-ligne côté app mobile) — utilisé UNIQUEMENT si le service IA distant est
  // injoignable, pour que le scan soit quand même historisé/synchronisé en base
  // au lieu d'échouer silencieusement.
  @ApiPropertyOptional({ example: 'ndole' })
  @IsOptional()
  @IsString()
  public localClassId?: string;

  @ApiPropertyOptional({ example: 0.82, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  public localConfidence?: number;
}
