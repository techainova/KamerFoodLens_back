import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreatePostDto, CreateCommentDto } from './dto/create-post.dto';
import { CreateThreadDto, CreateReplyDto } from './dto/create-thread.dto';
import { CreateStoryDto } from './dto/create-story.dto';
import {
  CommunityService,
  ForumReplyView,
  ForumThreadDetailView,
  ForumThreadView,
  PostView,
  StoryView,
} from './community.service';

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

@ApiTags('community')
@Controller('community')
export class CommunityController {
  public constructor(private readonly communityService: CommunityService) {}

  @Public()
  @Get('posts')
  @ApiOperation({ summary: 'Get paginated community feed posts' })
  @ApiResponse({ status: 200, description: 'Paginated posts' })
  public async getPosts(@Query('page') page?: string): Promise<PaginatedResult<PostView>> {
    return this.communityService.getPosts(page ? parseInt(page, 10) : 1);
  }

  @ApiBearerAuth()
  @Post('posts')
  @ApiOperation({ summary: 'Create a community post' })
  @ApiResponse({ status: 201, description: 'Post created' })
  public async createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostDto,
  ): Promise<PostView> {
    return this.communityService.createPost(user.id, dto);
  }

  @ApiBearerAuth()
  @Post('posts/:id/like')
  @ApiOperation({ summary: 'Toggle a like on a post' })
  @ApiResponse({ status: 201, description: 'Post like toggled' })
  public async likePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PostView> {
    return this.communityService.likePost(user.id, id);
  }

  @ApiBearerAuth()
  @Post('posts/:id/comments')
  @ApiOperation({ summary: 'Comment on a post' })
  @ApiResponse({ status: 201, description: 'Comment added' })
  public async commentOnPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ): Promise<PostView> {
    return this.communityService.commentOnPost(user.id, id, dto);
  }

  @Public()
  @Get('forum')
  @ApiOperation({ summary: 'Get paginated forum threads' })
  @ApiResponse({ status: 200, description: 'Paginated forum threads' })
  public async getForumThreads(@Query('page') page?: string): Promise<PaginatedResult<ForumThreadView>> {
    return this.communityService.getForumThreads(page ? parseInt(page, 10) : 1);
  }

  @Public()
  @Get('forum/:id')
  @ApiOperation({ summary: 'Get a forum thread with replies' })
  @ApiResponse({ status: 200, description: 'Forum thread with replies' })
  public async getForumThread(@Param('id') id: string): Promise<ForumThreadDetailView> {
    return this.communityService.getForumThread(id);
  }

  @ApiBearerAuth()
  @Post('forum')
  @ApiOperation({ summary: 'Create a forum thread' })
  @ApiResponse({ status: 201, description: 'Forum thread created' })
  public async createForumThread(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateThreadDto,
  ): Promise<ForumThreadView> {
    return this.communityService.createForumThread(user.id, dto);
  }

  @ApiBearerAuth()
  @Post('forum/:id/reply')
  @ApiOperation({ summary: 'Reply to a forum thread' })
  @ApiResponse({ status: 201, description: 'Reply created' })
  public async replyToThread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateReplyDto,
  ): Promise<ForumReplyView> {
    return this.communityService.replyToThread(user.id, id, dto);
  }

  @ApiBearerAuth()
  @Post('forum/:id/like')
  @ApiOperation({ summary: 'Toggle a like on a forum thread' })
  @ApiResponse({ status: 201, description: 'Thread like toggled' })
  public async likeThread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ForumThreadView> {
    return this.communityService.likeThread(user.id, id);
  }

  @ApiBearerAuth()
  @Post('forum/:id/reply/:replyId/like')
  @ApiOperation({ summary: 'Toggle a like on a forum reply' })
  @ApiResponse({ status: 201, description: 'Reply like toggled' })
  public async likeReply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('replyId') replyId: string,
  ): Promise<ForumReplyView> {
    return this.communityService.likeReply(user.id, id, replyId);
  }

  @Public()
  @Get('stories')
  @ApiOperation({ summary: 'Get paginated active (non-expired) stories' })
  @ApiResponse({ status: 200, description: 'Paginated stories' })
  public async getStories(@Query('page') page?: string): Promise<PaginatedResult<StoryView>> {
    return this.communityService.getStories(page ? parseInt(page, 10) : 1);
  }

  @ApiBearerAuth()
  @Post('stories')
  @ApiOperation({ summary: 'Create an ephemeral story (expires after 24h)' })
  @ApiResponse({ status: 201, description: 'Story created' })
  public async createStory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStoryDto,
  ): Promise<StoryView> {
    return this.communityService.createStory(user.id, dto.imageBase64, dto.mimeType, dto.caption);
  }

  @ApiBearerAuth()
  @Delete('stories/:id')
  @ApiOperation({ summary: 'Remove a story' })
  @ApiResponse({ status: 200, description: 'Story removed' })
  public async removeStory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.communityService.removeStory(user.id, id);
  }
}
