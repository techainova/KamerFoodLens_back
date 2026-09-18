import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ForumReply, ForumThread, User } from '@prisma/client';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma/prisma.service';
import { S3UploadService } from '../../common/services/s3-upload.service';
import { CommunityGateway } from './community.gateway';
import { Post, PostComment, PostDocument } from './schemas/post.schema';
import { Story, StoryDocument } from './schemas/story.schema';
import { StoryHighlight, StoryHighlightDocument } from './schemas/story-highlight.schema';
import { CreatePostDto, CreateCommentDto, PostType } from './dto/create-post.dto';
import { CreateThreadDto, CreateReplyDto } from './dto/create-thread.dto';
import { CreateStoryStickersDto } from './dto/create-story-sticker.dto';
import { CreateStoryDto } from './dto/create-story.dto';
import { CreateHighlightDto } from './dto/highlight.dto';
import { NotificationsService } from '../notifications/notifications.service';

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

export interface AuthorInfo {
  authorId: string;
  authorName: string;
  authorRole: 'standard' | 'pro' | 'admin';
  initials: string;
  avatarColor: string;
}

export interface PostCommentView extends AuthorInfo {
  text: string;
  createdAt: string;
}

export interface PostMediaView {
  url: string;
  type: 'image' | 'video';
}

export interface PostView extends AuthorInfo {
  id: string;
  content: string;
  /** @deprecated use `media` — kept for API consumers built before the carousel feature. */
  imageUrl?: string;
  media: PostMediaView[];
  type: string;
  likes: string[];
  comments: PostCommentView[];
  createdAt: string;
}

export interface StoryPollOptionView {
  label: string;
  votes: number;
}

export interface StoryPollView {
  question: string;
  options: StoryPollOptionView[];
  totalVotes: number;
  myVoteIndex?: number;
  x?: number;
  y?: number;
}

export interface StoryQuizOptionView {
  label: string;
}

export interface StoryQuizView {
  question: string;
  options: StoryQuizOptionView[];
  totalAnswers: number;
  correctCount: number;
  myAnswerIndex?: number;
  // Only present once the current user has answered — avoids spoiling the quiz.
  correctIndex?: number;
  x?: number;
  y?: number;
}

export interface StorySliderView {
  question: string;
  emoji: string;
  votesCount: number;
  average?: number;
  myValue?: number;
  x?: number;
  y?: number;
}

export interface StoryViewerView {
  userId: string;
  name: string;
  viewedAt: string;
}

export interface StoryReplyView {
  userId: string;
  name: string;
  text: string;
  createdAt: string;
}

export interface StoryHighlightSummaryView {
  id: string;
  title: string;
  coverImageUrl?: string;
  storiesCount: number;
}

export interface StoryTextOverlayView {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontWeight: string;
  align: string;
  backgroundColor?: string;
}

export interface StoryView extends AuthorInfo {
  id: string;
  mediaType: 'image' | 'text';
  imageUrl?: string;
  filter?: string;
  backgroundColor?: string;
  gradient?: string[];
  textOverlays: StoryTextOverlayView[];
  caption?: string;
  createdAt: string;
  reactionsCount: number;
  myReactionEmoji?: string;
  repliesCount: number;
  viewsCount: number;
  poll?: StoryPollView;
  quiz?: StoryQuizView;
  slider?: StorySliderView;
}

export interface StoryHighlightDetailView {
  id: string;
  title: string;
  coverImageUrl?: string;
  stories: StoryView[];
}

export interface ForumThreadView extends AuthorInfo {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  likes: string[];
  views: number;
  replyCount: number;
  createdAt: string;
}

export interface ForumThreadDetailView extends ForumThreadView {
  replies: ForumReplyView[];
}

export interface ForumReplyView extends AuthorInfo {
  id: string;
  content: string;
  likes: string[];
  createdAt: string;
}

const PAGE_SIZE = 20;
const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const AVATAR_COLORS = ['#E8591A', '#2E7D32', '#1A237E', '#9C27B0', '#E91E63', '#F9A825'];

@Injectable()
export class CommunityService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly s3UploadService: S3UploadService,
    private readonly communityGateway: CommunityGateway,
    private readonly notificationsService: NotificationsService,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Story.name) private readonly storyModel: Model<StoryDocument>,
    @InjectModel(StoryHighlight.name) private readonly highlightModel: Model<StoryHighlightDocument>,
  ) {}

  public async getPosts(page: number, authorId?: string): Promise<PaginatedResult<PostView>> {
    const skip = (page - 1) * PAGE_SIZE;
    const filter = authorId ? { userId: authorId } : {};

    const [docs, total] = await Promise.all([
      this.postModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(PAGE_SIZE).exec(),
      this.postModel.countDocuments(filter).exec(),
    ]);

    const usersById = await this.loadAuthors(docs.map((doc) => doc.userId));
    return { items: docs.map((doc) => this.toPostView(doc, usersById)), total, page };
  }

  public async createPost(userId: string, dto: CreatePostDto): Promise<PostView> {
    const usersById = await this.loadAuthors([userId]);
    if (dto.type === PostType.event && usersById.get(userId)?.role !== 'pro') {
      throw new ForbiddenException('Only Pro accounts can publish an event post');
    }

    const media = dto.media
      ? await Promise.all(
          dto.media.map(async (item) => ({
            url: await this.s3UploadService.uploadBase64Image(item.base64, item.mimeType, 'community'),
            type: item.mimeType.startsWith('video/') ? 'video' : 'image',
          })),
        )
      : [];

    const doc = await this.postModel.create({
      userId,
      content: dto.content,
      media,
      type: dto.type,
      likes: [],
      comments: [],
    });

    const post = this.toPostView(doc, usersById);
    this.communityGateway.broadcastNewPost(post);
    return post;
  }

  public async likePost(userId: string, postId: string): Promise<PostView> {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const wasLiked = post.likes.includes(userId);
    if (wasLiked) {
      post.likes = post.likes.filter((id) => id !== userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();

    if (!wasLiked && post.userId !== userId) {
      await this.notifyPostOwner(post.userId, userId, 'a aimé votre publication', postId);
    }

    const usersById = await this.loadAuthors([post.userId]);
    return this.toPostView(post, usersById);
  }

  public async commentOnPost(userId: string, postId: string, dto: CreateCommentDto): Promise<PostView> {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    post.comments.push({ userId, text: dto.text, createdAt: new Date() });
    await post.save();

    if (post.userId !== userId) {
      await this.notifyPostOwner(post.userId, userId, 'a commenté votre publication', postId);
    }

    const usersById = await this.loadAuthors([post.userId, ...post.comments.map((c) => c.userId)]);
    return this.toPostView(post, usersById);
  }

  // Notification en base pour le propriétaire de la publication — la home
  // feed (broadcast global via CommunityGateway) ne cible personne en
  // particulier, donc sans ceci l'auteur n'apprend jamais qu'on a interagi
  // avec son post s'il n'est pas connecté au moment de l'action.
  private async notifyPostOwner(ownerId: string, actorId: string, action: string, postId: string): Promise<void> {
    const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
    const actorName = actor ? `${actor.firstName} ${actor.lastName}`.trim() : 'Quelqu\'un';
    await this.notificationsService.create(
      ownerId,
      'community',
      'Nouvelle interaction',
      `${actorName} ${action}.`,
      { postId },
    );
  }

  public async getForumThreads(page: number): Promise<PaginatedResult<ForumThreadView>> {
    const skip = (page - 1) * PAGE_SIZE;

    const [threads, total] = await Promise.all([
      this.prisma.forumThread.findMany({
        skip,
        take: PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
        include: { user: true, _count: { select: { replies: true } } },
      }),
      this.prisma.forumThread.count(),
    ]);

    return { items: threads.map((thread) => this.toForumThreadView(thread, thread._count.replies)), total, page };
  }

  public async getForumThread(id: string): Promise<ForumThreadDetailView> {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id },
      include: {
        user: true,
        replies: { orderBy: { createdAt: 'asc' }, include: { user: true } },
      },
    });

    if (!thread) {
      throw new NotFoundException('Forum thread not found');
    }

    await this.prisma.forumThread.update({ where: { id }, data: { views: { increment: 1 } } });

    return {
      ...this.toForumThreadView(thread, thread.replies.length),
      replies: thread.replies.map((reply) => this.toForumReplyView(reply)),
    };
  }

  public async createForumThread(userId: string, dto: CreateThreadDto): Promise<ForumThreadView> {
    const thread = await this.prisma.forumThread.create({
      data: { userId, title: dto.title, content: dto.content, tags: dto.tags },
      include: { user: true },
    });

    return this.toForumThreadView(thread, 0);
  }

  public async replyToThread(userId: string, threadId: string, dto: CreateReplyDto): Promise<ForumReplyView> {
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread) {
      throw new NotFoundException('Forum thread not found');
    }

    const reply = await this.prisma.forumReply.create({
      data: { threadId, userId, content: dto.content },
      include: { user: true },
    });

    if (thread.userId !== userId) {
      const author = await this.prisma.user.findUnique({ where: { id: userId } });
      const authorName = author ? `${author.firstName} ${author.lastName}`.trim() : 'Quelqu\'un';
      await this.notificationsService.create(
        thread.userId,
        'community',
        'Nouvelle réponse',
        `${authorName} a répondu à votre discussion "${thread.title}".`,
        { threadId: thread.id },
      );
    }

    return this.toForumReplyView(reply);
  }

  public async likeThread(userId: string, threadId: string): Promise<ForumThreadView> {
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId }, include: { user: true } });
    if (!thread) {
      throw new NotFoundException('Forum thread not found');
    }

    const likes = thread.likes.includes(userId)
      ? thread.likes.filter((id) => id !== userId)
      : [...thread.likes, userId];

    const updated = await this.prisma.forumThread.update({
      where: { id: threadId },
      data: { likes },
      include: { user: true, _count: { select: { replies: true } } },
    });

    return this.toForumThreadView(updated, updated._count.replies);
  }

  public async likeReply(userId: string, threadId: string, replyId: string): Promise<ForumReplyView> {
    const reply = await this.prisma.forumReply.findUnique({ where: { id: replyId }, include: { user: true } });
    if (!reply || reply.threadId !== threadId) {
      throw new NotFoundException('Reply not found');
    }

    const likes = reply.likes.includes(userId)
      ? reply.likes.filter((id) => id !== userId)
      : [...reply.likes, userId];

    const updated = await this.prisma.forumReply.update({
      where: { id: replyId },
      data: { likes },
      include: { user: true },
    });

    return this.toForumReplyView(updated);
  }

  public async getStories(page: number, viewerId: string): Promise<PaginatedResult<StoryView>> {
    const skip = (page - 1) * PAGE_SIZE;

    const [docs, total] = await Promise.all([
      this.storyModel
        .find({ expiresAt: { $gt: new Date() } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .exec(),
      this.storyModel.countDocuments({ expiresAt: { $gt: new Date() } }).exec(),
    ]);

    const usersById = await this.loadAuthors(docs.map((doc) => doc.userId));
    return { items: docs.map((doc) => this.toStoryView(doc, usersById, viewerId)), total, page };
  }

  public async createStory(userId: string, dto: CreateStoryDto): Promise<StoryView> {
    const stickers = dto.stickers;
    const setCount = [stickers?.poll, stickers?.quiz, stickers?.slider].filter(Boolean).length;
    if (setCount > 1) {
      throw new BadRequestException('Only one of poll, quiz, or slider can be attached to a story');
    }

    const mediaType = dto.mediaType ?? 'image';
    if (mediaType === 'image' && !dto.imageBase64) {
      throw new BadRequestException('imageBase64 is required for image stories');
    }
    if (mediaType === 'text' && !dto.backgroundColor && !dto.gradient?.length) {
      throw new BadRequestException('backgroundColor or gradient is required for text stories');
    }

    const imageUrl = dto.imageBase64
      ? await this.s3UploadService.uploadBase64Image(dto.imageBase64, dto.mimeType ?? 'image/jpeg', 'stories')
      : undefined;

    const doc = await this.storyModel.create({
      userId,
      mediaType,
      imageUrl,
      filter: dto.filter,
      backgroundColor: dto.backgroundColor,
      gradient: dto.gradient,
      textOverlays: dto.textOverlays ?? [],
      caption: dto.caption,
      expiresAt: new Date(Date.now() + STORY_TTL_MS),
      poll: stickers?.poll
        ? {
            question: stickers.poll.question,
            options: stickers.poll.options.map((label) => ({ label, voterIds: [] })),
            x: stickers.poll.x,
            y: stickers.poll.y,
          }
        : undefined,
      quiz: stickers?.quiz
        ? {
            question: stickers.quiz.question,
            options: stickers.quiz.options.map((label) => ({ label, pickedByIds: [] })),
            correctIndex: stickers.quiz.correctIndex,
            x: stickers.quiz.x,
            y: stickers.quiz.y,
          }
        : undefined,
      slider: stickers?.slider
        ? {
            question: stickers.slider.question,
            emoji: stickers.slider.emoji,
            votes: [],
            x: stickers.slider.x,
            y: stickers.slider.y,
          }
        : undefined,
    });

    const usersById = await this.loadAuthors([userId]);
    const story = this.toStoryView(doc, usersById, userId);
    // Diffusion instantanée à tous les comptes connectés — sans ça, une story
    // créée sur un appareil n'apparaît ailleurs qu'au prochain fetch manuel.
    this.communityGateway.broadcastNewStory(story);
    return story;
  }

  public async removeStory(userId: string, storyId: string): Promise<{ message: string }> {
    const story = await this.storyModel.findById(storyId).exec();
    if (!story || story.userId !== userId) {
      throw new ForbiddenException('You cannot remove this story');
    }

    await this.storyModel.findByIdAndDelete(storyId).exec();
    return { message: 'Story removed' };
  }

  public async markStoryViewed(userId: string, storyId: string): Promise<{ message: string }> {
    const story = await this.storyModel.findById(storyId).exec();
    if (!story) {
      throw new NotFoundException('Story not found');
    }
    if (story.userId !== userId && !story.views.some((v) => v.userId === userId)) {
      story.views.push({ userId, viewedAt: new Date() });
      await story.save();
    }
    return { message: 'Marked as viewed' };
  }

  public async reactToStory(userId: string, storyId: string, emoji: string): Promise<StoryView> {
    const story = await this.storyModel.findById(storyId).exec();
    if (!story) {
      throw new NotFoundException('Story not found');
    }
    story.reactions.push({ userId, emoji, createdAt: new Date() });
    await story.save();

    const usersById = await this.loadAuthors([story.userId]);
    return this.toStoryView(story, usersById, userId);
  }

  public async replyToStory(userId: string, storyId: string, text: string): Promise<{ message: string }> {
    const story = await this.storyModel.findById(storyId).exec();
    if (!story) {
      throw new NotFoundException('Story not found');
    }
    story.replies.push({ userId, text, createdAt: new Date() });
    await story.save();
    return { message: 'Reply sent' };
  }

  public async voteStoryPoll(userId: string, storyId: string, optionIndex: number): Promise<StoryView> {
    const story = await this.storyModel.findById(storyId).exec();
    if (!story?.poll) {
      throw new NotFoundException('Poll not found on this story');
    }
    if (optionIndex < 0 || optionIndex >= story.poll.options.length) {
      throw new BadRequestException('Invalid poll option');
    }

    for (const option of story.poll.options) {
      option.voterIds = option.voterIds.filter((id) => id !== userId);
    }
    story.poll.options[optionIndex].voterIds.push(userId);
    await story.save();

    const usersById = await this.loadAuthors([story.userId]);
    return this.toStoryView(story, usersById, userId);
  }

  public async answerStoryQuiz(userId: string, storyId: string, optionIndex: number): Promise<StoryView> {
    const story = await this.storyModel.findById(storyId).exec();
    if (!story?.quiz) {
      throw new NotFoundException('Quiz not found on this story');
    }
    if (optionIndex < 0 || optionIndex >= story.quiz.options.length) {
      throw new BadRequestException('Invalid quiz option');
    }

    const alreadyAnswered = story.quiz.options.some((o) => o.pickedByIds.includes(userId));
    if (!alreadyAnswered) {
      story.quiz.options[optionIndex].pickedByIds.push(userId);
      await story.save();
    }

    const usersById = await this.loadAuthors([story.userId]);
    return this.toStoryView(story, usersById, userId);
  }

  public async rateStorySlider(userId: string, storyId: string, value: number): Promise<StoryView> {
    const story = await this.storyModel.findById(storyId).exec();
    if (!story?.slider) {
      throw new NotFoundException('Slider not found on this story');
    }

    story.slider.votes = story.slider.votes.filter((v) => v.userId !== userId);
    story.slider.votes.push({ userId, value });
    await story.save();

    const usersById = await this.loadAuthors([story.userId]);
    return this.toStoryView(story, usersById, userId);
  }

  public async getStoryViewers(userId: string, storyId: string): Promise<StoryViewerView[]> {
    const story = await this.storyModel.findById(storyId).exec();
    if (!story || story.userId !== userId) {
      throw new ForbiddenException('You can only see viewers of your own stories');
    }

    const usersById = await this.loadAuthors(story.views.map((v) => v.userId));
    return [...story.views]
      .sort((a, b) => b.viewedAt.getTime() - a.viewedAt.getTime())
      .map((v) => ({
        userId: v.userId,
        name: this.authorInfo(v.userId, usersById).authorName,
        viewedAt: v.viewedAt.toISOString(),
      }));
  }

  public async getStoryReplies(userId: string, storyId: string): Promise<StoryReplyView[]> {
    const story = await this.storyModel.findById(storyId).exec();
    if (!story || story.userId !== userId) {
      throw new ForbiddenException('You can only read replies on your own stories');
    }

    const usersById = await this.loadAuthors(story.replies.map((r) => r.userId));
    return [...story.replies]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => ({
        userId: r.userId,
        name: this.authorInfo(r.userId, usersById).authorName,
        text: r.text,
        createdAt: r.createdAt.toISOString(),
      }));
  }

  public async createHighlight(userId: string, dto: CreateHighlightDto): Promise<StoryHighlightSummaryView> {
    const story = await this.storyModel.findById(dto.storyId).exec();
    if (!story || story.userId !== userId) {
      throw new ForbiddenException('You can only save your own stories to a highlight');
    }

    this.archiveStory(story);
    await story.save();

    const highlight = await this.highlightModel.create({
      userId,
      title: dto.title,
      coverImageUrl: dto.coverImageUrl ?? story.imageUrl,
      storyIds: [String(story._id)],
    });

    return this.toHighlightSummaryView(highlight);
  }

  public async addStoryToHighlight(userId: string, highlightId: string, storyId: string): Promise<StoryHighlightSummaryView> {
    const highlight = await this.highlightModel.findById(highlightId).exec();
    if (!highlight || highlight.userId !== userId) {
      throw new ForbiddenException('You can only edit your own highlights');
    }
    const story = await this.storyModel.findById(storyId).exec();
    if (!story || story.userId !== userId) {
      throw new ForbiddenException('You can only save your own stories to a highlight');
    }

    this.archiveStory(story);
    await story.save();

    if (!highlight.storyIds.includes(storyId)) {
      highlight.storyIds.push(storyId);
      await highlight.save();
    }

    return this.toHighlightSummaryView(highlight);
  }

  public async removeStoryFromHighlight(userId: string, highlightId: string, storyId: string): Promise<StoryHighlightSummaryView> {
    const highlight = await this.highlightModel.findById(highlightId).exec();
    if (!highlight || highlight.userId !== userId) {
      throw new ForbiddenException('You can only edit your own highlights');
    }
    highlight.storyIds = highlight.storyIds.filter((id) => id !== storyId);
    await highlight.save();
    return this.toHighlightSummaryView(highlight);
  }

  public async getUserHighlights(userId: string): Promise<StoryHighlightSummaryView[]> {
    const highlights = await this.highlightModel.find({ userId }).sort({ createdAt: -1 }).exec();
    return highlights.map((h) => this.toHighlightSummaryView(h));
  }

  public async getHighlightDetail(highlightId: string, viewerId: string): Promise<StoryHighlightDetailView> {
    const highlight = await this.highlightModel.findById(highlightId).exec();
    if (!highlight) {
      throw new NotFoundException('Highlight not found');
    }

    const stories = await this.storyModel.find({ _id: { $in: highlight.storyIds } }).exec();
    const usersById = await this.loadAuthors(stories.map((s) => s.userId));
    const byId = new Map(stories.map((s) => [String(s._id), s]));
    const ordered: StoryDocument[] = [];
    for (const id of highlight.storyIds) {
      const doc = byId.get(id);
      if (doc) ordered.push(doc);
    }

    return {
      id: String(highlight._id),
      title: highlight.title,
      coverImageUrl: highlight.coverImageUrl,
      stories: ordered.map((doc) => this.toStoryView(doc, usersById, viewerId)),
    };
  }

  public async deleteHighlight(userId: string, highlightId: string): Promise<{ message: string }> {
    const highlight = await this.highlightModel.findById(highlightId).exec();
    if (!highlight || highlight.userId !== userId) {
      throw new ForbiddenException('You can only delete your own highlights');
    }
    await this.highlightModel.findByIdAndDelete(highlightId).exec();
    return { message: 'Highlight removed' };
  }

  private archiveStory(story: StoryDocument): void {
    story.isArchived = true;
    story.expiresAt = undefined;
  }

  private toHighlightSummaryView(highlight: StoryHighlightDocument): StoryHighlightSummaryView {
    return {
      id: String(highlight._id),
      title: highlight.title,
      coverImageUrl: highlight.coverImageUrl,
      storiesCount: highlight.storyIds.length,
    };
  }

  private async loadAuthors(userIds: string[]): Promise<Map<string, User>> {
    const uniqueIds = [...new Set(userIds)];
    const users = await this.prisma.user.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(users.map((user) => [user.id, user]));
  }

  private authorInfo(userId: string, usersById: Map<string, User>): AuthorInfo {
    const user = usersById.get(userId);
    const firstName = user?.firstName ?? '';
    const lastName = user?.lastName ?? '';
    const initials = ((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase() || '?';

    return {
      authorId: userId,
      authorName: user ? `${firstName} ${lastName}`.trim() : 'Utilisateur KFL',
      authorRole: user?.role ?? 'standard',
      initials,
      avatarColor: AVATAR_COLORS[this.hashCode(userId) % AVATAR_COLORS.length],
    };
  }

  private authorInfoFromUser(userId: string, user: User): AuthorInfo {
    return this.authorInfo(userId, new Map([[userId, user]]));
  }

  private hashCode(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  private toPostView(doc: PostDocument, usersById: Map<string, User>): PostView {
    // Posts created before the carousel feature only have `imageUrl` — surface
    // that as a single-item `media` array so old and new posts render the same way.
    const media: PostMediaView[] = doc.media?.length
      ? doc.media.map((m) => ({ url: m.url, type: m.type as 'image' | 'video' }))
      : doc.imageUrl
        ? [{ url: doc.imageUrl, type: 'image' }]
        : [];

    return {
      id: String(doc._id),
      ...this.authorInfo(doc.userId, usersById),
      content: doc.content,
      imageUrl: media[0]?.url,
      media,
      type: doc.type,
      likes: doc.likes,
      comments: doc.comments.map((comment: PostComment) => ({
        ...this.authorInfo(comment.userId, usersById),
        text: comment.text,
        createdAt: comment.createdAt.toISOString(),
      })),
      createdAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
    };
  }

  private toStoryView(doc: StoryDocument, usersById: Map<string, User>, viewerId: string): StoryView {
    const myReaction = [...doc.reactions].reverse().find((r) => r.userId === viewerId);

    return {
      id: String(doc._id),
      ...this.authorInfo(doc.userId, usersById),
      mediaType: doc.mediaType,
      imageUrl: doc.imageUrl,
      filter: doc.filter,
      backgroundColor: doc.backgroundColor,
      gradient: doc.gradient,
      textOverlays: doc.textOverlays.map((overlay) => ({
        text: overlay.text,
        x: overlay.x,
        y: overlay.y,
        fontSize: overlay.fontSize,
        color: overlay.color,
        fontWeight: overlay.fontWeight,
        align: overlay.align,
        backgroundColor: overlay.backgroundColor,
      })),
      caption: doc.caption,
      createdAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
      reactionsCount: doc.reactions.length,
      myReactionEmoji: myReaction?.emoji,
      repliesCount: doc.replies.length,
      viewsCount: doc.views.length,
      poll: doc.poll ? this.toStoryPollView(doc.poll, viewerId) : undefined,
      quiz: doc.quiz ? this.toStoryQuizView(doc.quiz, viewerId) : undefined,
      slider: doc.slider ? this.toStorySliderView(doc.slider, viewerId) : undefined,
    };
  }

  private toStoryPollView(poll: NonNullable<StoryDocument['poll']>, viewerId: string): StoryPollView {
    const options = poll.options.map((o) => ({ label: o.label, votes: o.voterIds.length }));
    const myVoteIndex = poll.options.findIndex((o) => o.voterIds.includes(viewerId));
    return {
      question: poll.question,
      options,
      totalVotes: options.reduce((sum, o) => sum + o.votes, 0),
      myVoteIndex: myVoteIndex >= 0 ? myVoteIndex : undefined,
      x: poll.x,
      y: poll.y,
    };
  }

  private toStoryQuizView(quiz: NonNullable<StoryDocument['quiz']>, viewerId: string): StoryQuizView {
    const myAnswerIndex = quiz.options.findIndex((o) => o.pickedByIds.includes(viewerId));
    const hasAnswered = myAnswerIndex >= 0;
    return {
      question: quiz.question,
      options: quiz.options.map((o) => ({ label: o.label })),
      totalAnswers: quiz.options.reduce((sum, o) => sum + o.pickedByIds.length, 0),
      correctCount: quiz.options[quiz.correctIndex]?.pickedByIds.length ?? 0,
      myAnswerIndex: hasAnswered ? myAnswerIndex : undefined,
      correctIndex: hasAnswered ? quiz.correctIndex : undefined,
      x: quiz.x,
      y: quiz.y,
    };
  }

  private toStorySliderView(slider: NonNullable<StoryDocument['slider']>, viewerId: string): StorySliderView {
    const myVote = slider.votes.find((v) => v.userId === viewerId);
    const average = slider.votes.length > 0
      ? slider.votes.reduce((sum, v) => sum + v.value, 0) / slider.votes.length
      : undefined;
    return {
      question: slider.question,
      emoji: slider.emoji,
      votesCount: slider.votes.length,
      average,
      myValue: myVote?.value,
      x: slider.x,
      y: slider.y,
    };
  }

  private toForumThreadView(
    thread: ForumThread & { user: User },
    replyCount: number,
  ): ForumThreadView {
    return {
      id: thread.id,
      ...this.authorInfoFromUser(thread.userId, thread.user),
      title: thread.title,
      content: thread.content,
      category: thread.tags[0] ?? 'Général',
      tags: thread.tags,
      likes: thread.likes,
      views: thread.views,
      replyCount,
      createdAt: thread.createdAt.toISOString(),
    };
  }

  private toForumReplyView(reply: ForumReply & { user: User }): ForumReplyView {
    return {
      id: reply.id,
      ...this.authorInfoFromUser(reply.userId, reply.user),
      content: reply.content,
      likes: reply.likes,
      createdAt: reply.createdAt.toISOString(),
    };
  }
}
