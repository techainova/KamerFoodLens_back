import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreatePostDto, CreateCommentDto } from './dto/create-post.dto';
import { CreateThreadDto, CreateReplyDto } from './dto/create-thread.dto';
import { CreateStoryDto } from './dto/create-story.dto';
import {
  ReactToStoryDto,
  ReplyToStoryDto,
  VoteStoryPollDto,
  AnswerStoryQuizDto,
  RateStorySliderDto,
} from './dto/story-interaction.dto';
import { CreateHighlightDto, AddToHighlightDto } from './dto/highlight.dto';
import {
  CommunityService,
  ForumReplyView,
  ForumThreadDetailView,
  ForumThreadView,
  PostView,
  StoryView,
  StoryViewerView,
  StoryReplyView,
  StoryHighlightSummaryView,
  StoryHighlightDetailView,
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
  @ApiOperation({ summary: 'Get paginated community feed posts, optionally filtered by author' })
  @ApiResponse({ status: 200, description: 'Paginated posts' })
  public async getPosts(
    @Query('page') page?: string,
    @Query('authorId') authorId?: string,
  ): Promise<PaginatedResult<PostView>> {
    return this.communityService.getPosts(page ? parseInt(page, 10) : 1, authorId);
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

  @ApiBearerAuth()
  @Get('stories')
  @ApiOperation({ summary: 'Get paginated active (non-expired) stories' })
  @ApiResponse({ status: 200, description: 'Paginated stories' })
  public async getStories(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
  ): Promise<PaginatedResult<StoryView>> {
    return this.communityService.getStories(page ? parseInt(page, 10) : 1, user.id);
  }

  @ApiBearerAuth()
  @Post('stories')
  @ApiOperation({ summary: 'Create an ephemeral story (expires after 24h)' })
  @ApiResponse({ status: 201, description: 'Story created' })
  public async createStory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStoryDto,
  ): Promise<StoryView> {
    return this.communityService.createStory(user.id, dto);
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

  @ApiBearerAuth()
  @Post('stories/:id/view')
  @ApiOperation({ summary: 'Mark a story as viewed by the current user' })
  @ApiResponse({ status: 201, description: 'Marked as viewed' })
  public async viewStory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.communityService.markStoryViewed(user.id, id);
  }

  @ApiBearerAuth()
  @Post('stories/:id/react')
  @ApiOperation({ summary: 'Send an emoji reaction to a story' })
  @ApiResponse({ status: 201, description: 'Reaction sent' })
  public async reactToStory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReactToStoryDto,
  ): Promise<StoryView> {
    return this.communityService.reactToStory(user.id, id, dto.emoji);
  }

  @ApiBearerAuth()
  @Post('stories/:id/reply')
  @ApiOperation({ summary: 'Reply to a story' })
  @ApiResponse({ status: 201, description: 'Reply sent' })
  public async replyToStory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReplyToStoryDto,
  ): Promise<{ message: string }> {
    return this.communityService.replyToStory(user.id, id, dto.text);
  }

  @ApiBearerAuth()
  @Post('stories/:id/poll/vote')
  @ApiOperation({ summary: 'Vote on a story poll sticker' })
  @ApiResponse({ status: 201, description: 'Updated story with vote tallies' })
  public async voteStoryPoll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VoteStoryPollDto,
  ): Promise<StoryView> {
    return this.communityService.voteStoryPoll(user.id, id, dto.optionIndex);
  }

  @ApiBearerAuth()
  @Post('stories/:id/quiz/answer')
  @ApiOperation({ summary: 'Answer a story quiz sticker' })
  @ApiResponse({ status: 201, description: 'Updated story with the correct answer revealed' })
  public async answerStoryQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AnswerStoryQuizDto,
  ): Promise<StoryView> {
    return this.communityService.answerStoryQuiz(user.id, id, dto.optionIndex);
  }

  @ApiBearerAuth()
  @Post('stories/:id/slider/rate')
  @ApiOperation({ summary: 'Rate a story slider sticker' })
  @ApiResponse({ status: 201, description: 'Updated story with the slider average' })
  public async rateStorySlider(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RateStorySliderDto,
  ): Promise<StoryView> {
    return this.communityService.rateStorySlider(user.id, id, dto.value);
  }

  @ApiBearerAuth()
  @Get('stories/:id/viewers')
  @ApiOperation({ summary: 'List who viewed one of your own stories' })
  @ApiResponse({ status: 200, description: 'Viewers list, most recent first' })
  public async getStoryViewers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<StoryViewerView[]> {
    return this.communityService.getStoryViewers(user.id, id);
  }

  @ApiBearerAuth()
  @Get('stories/:id/replies')
  @ApiOperation({ summary: 'Read the replies received on one of your own stories' })
  @ApiResponse({ status: 200, description: 'Replies list, most recent first' })
  public async getStoryReplies(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<StoryReplyView[]> {
    return this.communityService.getStoryReplies(user.id, id);
  }

  @ApiBearerAuth()
  @Post('highlights')
  @ApiOperation({ summary: 'Create a highlight from one of your own stories (makes it permanent)' })
  @ApiResponse({ status: 201, description: 'Highlight created' })
  public async createHighlight(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateHighlightDto,
  ): Promise<StoryHighlightSummaryView> {
    return this.communityService.createHighlight(user.id, dto);
  }

  @ApiBearerAuth()
  @Post('highlights/:id/stories')
  @ApiOperation({ summary: 'Add another of your stories to an existing highlight' })
  @ApiResponse({ status: 201, description: 'Story added to the highlight' })
  public async addStoryToHighlight(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddToHighlightDto,
  ): Promise<StoryHighlightSummaryView> {
    return this.communityService.addStoryToHighlight(user.id, id, dto.storyId);
  }

  @ApiBearerAuth()
  @Delete('highlights/:id/stories/:storyId')
  @ApiOperation({ summary: 'Remove a story from a highlight' })
  @ApiResponse({ status: 200, description: 'Story removed from the highlight' })
  public async removeStoryFromHighlight(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('storyId') storyId: string,
  ): Promise<StoryHighlightSummaryView> {
    return this.communityService.removeStoryFromHighlight(user.id, id, storyId);
  }

  @ApiBearerAuth()
  @Get('highlights/user/:userId')
  @ApiOperation({ summary: "List a user's highlights (visible on their profile)" })
  @ApiResponse({ status: 200, description: 'Highlights list' })
  public async getUserHighlights(@Param('userId') userId: string): Promise<StoryHighlightSummaryView[]> {
    return this.communityService.getUserHighlights(userId);
  }

  @ApiBearerAuth()
  @Get('highlights/:id')
  @ApiOperation({ summary: 'Get a highlight with all of its stories' })
  @ApiResponse({ status: 200, description: 'Highlight detail' })
  public async getHighlightDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<StoryHighlightDetailView> {
    return this.communityService.getHighlightDetail(id, user.id);
  }

  @ApiBearerAuth()
  @Delete('highlights/:id')
  @ApiOperation({ summary: 'Delete a highlight (the underlying stories are kept)' })
  @ApiResponse({ status: 200, description: 'Highlight removed' })
  public async deleteHighlight(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.communityService.deleteHighlight(user.id, id);
  }
}
