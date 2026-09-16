import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScanResult, ScanResultDocument } from './schemas/scan-result.schema';
import { ScanImageDto } from './dto/scan-image.dto';
import { ScanAudioDto } from './dto/scan-audio.dto';
import { ScanTextDto } from './dto/scan-text.dto';
import { GamesService } from '../games/games.service';
import { S3UploadService } from '../../common/services/s3-upload.service';

export interface ScanResponse {
  scanId: string;
  classId: string;
  dishName: string;
  dishNameEN: string;
  region: string;
  confidence: number;
  imageUrl?: string;
}

export interface ScanHistoryItem {
  scanId: string;
  classId: string;
  dishName: string;
  confidence: number;
  imageUrl?: string;
  scannedAt: string;
}

interface PaginatedScanHistory {
  items: ScanHistoryItem[];
  total: number;
  page: number;
}

interface AiPrediction {
  plat: string;
  confiance: number;
  description?: string;
}

interface AiServiceResponse {
  prediction?: AiPrediction;
  error?: string;
}

const PAGE_SIZE = 20;

@Injectable()
export class ScanService {
  public constructor(
    private readonly configService: ConfigService,
    @InjectModel(ScanResult.name) private readonly scanResultModel: Model<ScanResultDocument>,
    private readonly gamesService: GamesService,
    private readonly s3UploadService: S3UploadService,
  ) {}

  public async scanImage(userId: string | undefined, dto: ScanImageDto): Promise<ScanResponse> {
    const mimeType = dto.mimeType ?? 'image/jpeg';
    const imageBuffer = Buffer.from(dto.imageBase64, 'base64');

    const prediction = await this.callAiService('/predict', imageBuffer, mimeType);

    const imageUrl = await this.s3UploadService.uploadBase64Image(dto.imageBase64, mimeType, 'scans');

    const scanId = userId
      ? await this.persistScanResult(userId, prediction, 'image', imageUrl)
      : this.anonymousScanId();
    return this.toScanResponse(scanId, prediction, imageUrl);
  }

  public async scanAudio(userId: string | undefined, dto: ScanAudioDto): Promise<ScanResponse> {
    const mimeType = dto.mimeType ?? 'audio/wav';
    const audioBuffer = Buffer.from(dto.audioBase64, 'base64');

    // The current Python AI service only exposes /predict (image) and
    // /identify_by_text — this path mirrors that naming for when audio support
    // lands, and surfaces a clear 502 in the meantime rather than a wrong result.
    const prediction = await this.callAiService('/identify_by_audio', audioBuffer, mimeType);

    const scanId = userId
      ? await this.persistScanResult(userId, prediction, 'audio')
      : this.anonymousScanId();
    return this.toScanResponse(scanId, prediction);
  }

  public async scanText(userId: string | undefined, dto: ScanTextDto): Promise<ScanResponse> {
    const prediction = await this.callTextRecognition(dto.text);

    const scanId = userId
      ? await this.persistScanResult(userId, prediction, 'text')
      : this.anonymousScanId();
    return this.toScanResponse(scanId, prediction);
  }

  // Un invité n'a pas d'historique en base — l'app mobile n'utilise ce scanId
  // que pour naviguer vers l'écran de résultat, jamais pour le relire ensuite.
  private anonymousScanId(): string {
    return `anon-${Date.now()}`;
  }

  public async getResult(userId: string, scanId: string): Promise<ScanResponse> {
    const doc = await this.scanResultModel.findOne({ _id: scanId, userId }).exec();
    if (!doc) {
      throw new NotFoundException('Scan result not found');
    }

    return {
      scanId: String(doc._id),
      classId: doc.dishId,
      dishName: doc.dishName,
      dishNameEN: doc.dishName,
      region: '',
      confidence: doc.confidence,
      imageUrl: doc.imageUrl,
    };
  }

  public async clearHistory(userId: string): Promise<{ deleted: number }> {
    const result = await this.scanResultModel.deleteMany({ userId }).exec();
    return { deleted: result.deletedCount ?? 0 };
  }

  public async getHistory(userId: string, page: number): Promise<PaginatedScanHistory> {
    const skip = (page - 1) * PAGE_SIZE;

    const [docs, total] = await Promise.all([
      this.scanResultModel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(PAGE_SIZE).exec(),
      this.scanResultModel.countDocuments({ userId }).exec(),
    ]);

    const items: ScanHistoryItem[] = docs.map((doc) => ({
      scanId: String(doc._id),
      classId: doc.dishId,
      dishName: doc.dishName,
      confidence: doc.confidence,
      imageUrl: doc.imageUrl,
      scannedAt: (doc.createdAt ?? new Date()).toISOString(),
    }));

    return { items, total, page };
  }

  private async callAiService(path: string, fileBuffer: Buffer, mimeType: string): Promise<AiPrediction> {
    const baseUrl = this.configService.get<string>('AI_SERVICE_URL');
    const extension = mimeType.split('/')[1] ?? 'bin';

    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), `scan.${extension}`);

    try {
      const response = await fetch(`${baseUrl}${path}`, { method: 'POST', body: formData });

      if (!response.ok) {
        throw new Error(`AI service responded with status ${response.status}`);
      }

      const data = (await response.json()) as AiServiceResponse;
      if (!data.prediction) {
        throw new Error(data.error ?? 'AI service returned no prediction');
      }

      return data.prediction;
    } catch (error) {
      throw new BadGatewayException(
        `Unable to reach the AI recognition service: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async callTextRecognition(description: string): Promise<AiPrediction> {
    const baseUrl = this.configService.get<string>('AI_SERVICE_URL');

    try {
      const response = await fetch(`${baseUrl}/identify_by_text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });

      if (!response.ok) {
        throw new Error(`AI service responded with status ${response.status}`);
      }

      const data = (await response.json()) as AiServiceResponse;
      if (!data.prediction) {
        throw new Error(data.error ?? 'AI service returned no prediction');
      }

      return data.prediction;
    } catch (error) {
      throw new BadGatewayException(
        `Unable to reach the AI recognition service: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private toScanResponse(scanId: string, prediction: AiPrediction, imageUrl?: string): ScanResponse {
    const displayName = this.formatClassIdAsName(prediction.plat);
    return {
      scanId,
      classId: prediction.plat,
      dishName: displayName,
      dishNameEN: displayName,
      region: '',
      confidence: prediction.confiance,
      imageUrl,
    };
  }

  private async persistScanResult(
    userId: string,
    prediction: AiPrediction,
    scanType: string,
    imageUrl?: string,
  ): Promise<string> {
    const doc = await this.scanResultModel.create({
      userId,
      dishId: prediction.plat,
      dishName: this.formatClassIdAsName(prediction.plat),
      confidence: prediction.confiance,
      scanType,
      imageUrl,
      alternatives: [],
    });

    await this.gamesService.awardScanXp(userId);

    return String(doc._id);
  }

  private formatClassIdAsName(classId: string): string {
    return classId
      .split('_')
      .filter((word) => word.length > 0)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
