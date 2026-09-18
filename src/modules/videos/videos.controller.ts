import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateVideoDto, CommentVideoDto } from './dto/create-video.dto';
import { VideosService, VideoPostView, VideoCommentView } from './videos.service';

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

@ApiTags('videos')
@Controller('videos')
export class VideosController {
  public constructor(private readonly videosService: VideosService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get the vertical video feed, paginated' })
  @ApiResponse({ status: 200, description: 'Video feed page' })
  public async getFeed(@Query('page') page?: string): Promise<PaginatedResult<VideoPostView>> {
    return this.videosService.getFeed(page ? parseInt(page, 10) : 1);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Publish a short video (standard or Pro account)' })
  @ApiResponse({ status: 201, description: 'Video published' })
  public async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVideoDto): Promise<VideoPostView> {
    return this.videosService.create(user.id, dto);
  }

  @ApiBearerAuth()
  @Post(':id/like')
  @ApiOperation({ summary: 'Toggle a like on a video' })
  @ApiResponse({ status: 201, description: 'Video updated' })
  public async like(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<VideoPostView> {
    return this.videosService.like(user.id, id);
  }

  @ApiBearerAuth()
  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a video' })
  @ApiResponse({ status: 201, description: 'Video updated' })
  public async comment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CommentVideoDto,
  ): Promise<VideoPostView> {
    return this.videosService.comment(user.id, id, dto);
  }

  @Public()
  @Get(':id/comments')
  @ApiOperation({ summary: 'List a video comments' })
  @ApiResponse({ status: 200, description: 'Comments' })
  public async getComments(@Param('id') id: string): Promise<VideoCommentView[]> {
    return this.videosService.getComments(id);
  }

  @Public()
  @Post(':id/view')
  @ApiOperation({ summary: 'Register a view on a video' })
  @ApiResponse({ status: 201, description: 'View counted' })
  public async registerView(@Param('id') id: string): Promise<{ viewsCount: number }> {
    return this.videosService.registerView(id);
  }
}
