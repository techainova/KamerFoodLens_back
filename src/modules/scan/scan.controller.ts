import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AesDecryptGuard } from '../../common/guards/aes-decrypt.guard';
import { ScanImageDto } from './dto/scan-image.dto';
import { ScanAudioDto } from './dto/scan-audio.dto';
import { ScanTextDto } from './dto/scan-text.dto';
import { ScanHistoryItem, ScanResponse, ScanService } from './scan.service';

@ApiTags('scan')
@ApiBearerAuth()
@Controller('scan')
export class ScanController {
  public constructor(private readonly scanService: ScanService) {}

  @Post('image')
  @UseGuards(AesDecryptGuard)
  @ApiOperation({ summary: 'Scan a dish photo (AES-256-GCM encrypted payload)' })
  @ApiResponse({ status: 201, description: 'Recognized dish with nutrition facts' })
  public async scanImage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ScanImageDto,
  ): Promise<ScanResponse> {
    return this.scanService.scanImage(user.id, dto);
  }

  @Post('audio')
  @UseGuards(AesDecryptGuard)
  @ApiOperation({ summary: 'Scan a dish from an audio description (AES-256-GCM encrypted payload)' })
  @ApiResponse({ status: 201, description: 'Recognized dish with nutrition facts' })
  public async scanAudio(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ScanAudioDto,
  ): Promise<ScanResponse> {
    return this.scanService.scanAudio(user.id, dto);
  }

  @Post('text')
  @UseGuards(AesDecryptGuard)
  @ApiOperation({ summary: 'Look up a dish by text query (AES-256-GCM encrypted payload)' })
  @ApiResponse({ status: 201, description: 'Recognized dish with nutrition facts' })
  public async scanText(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ScanTextDto,
  ): Promise<ScanResponse> {
    return this.scanService.scanText(user.id, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Paginated scan history for the current user' })
  @ApiResponse({ status: 200, description: 'Scan history page' })
  public async getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
  ): Promise<{ items: ScanHistoryItem[]; total: number; page: number }> {
    return this.scanService.getHistory(user.id, page ? parseInt(page, 10) : 1);
  }

  @Delete('history')
  @ApiOperation({ summary: 'Clear the current user scan history' })
  @ApiResponse({ status: 200, description: 'Number of scan results deleted' })
  public async clearHistory(@CurrentUser() user: AuthenticatedUser): Promise<{ deleted: number }> {
    return this.scanService.clearHistory(user.id);
  }

  @Get('result/:id')
  @ApiOperation({ summary: 'Get a single scan result by id' })
  @ApiResponse({ status: 200, description: 'Scan result' })
  public async getResult(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ScanResponse> {
    return this.scanService.getResult(user.id, id);
  }
}
