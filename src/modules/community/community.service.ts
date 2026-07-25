import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ForumReply, ForumThread, User } from '@prisma/client';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma/prisma.service';
import { S3UploadService } from '../../common/services/s3-upload.service';
import { Post, PostComment, PostDocument } from './schemas/post.schema';
import { Story, StoryDocument } from './schemas/story.schema';
import { CreatePostDto, CreateCommentDto } from './dto/create-post.dto';
import { CreateThreadDto, CreateReplyDto } from './dto/create-thread.dto';

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

export interface PostView extends AuthorInfo {
  id: string;
  content: string;
  imageUrl?: string;
  type: string;
  likes: string[];
  comments: PostCommentView[];
  createdAt: string;
}

export interface StoryView extends AuthorInfo {
  id: string;
  imageUrl: string;
  caption?: string;
  createdAt: string;
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
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Story.name) private readonly storyModel: Model<StoryDocument>,
  ) {}

  public async getPosts(page: number): Promise<PaginatedResult<PostView>> {
    const skip = (page - 1) * PAGE_SIZE;

    const [docs, total] = await Promise.all([
      this.postModel.find().sort({ createdAt: -1 }).skip(skip).limit(PAGE_SIZE).exec(),
      this.postModel.countDocuments().exec(),
    ]);

    const usersById = await this.loadAuthors(docs.map((doc) => doc.userId));
    return { items: docs.map((doc) => this.toPostView(doc, usersById)), total, page };
  }

  public async createPost(userId: string, dto: CreatePostDto): Promise<PostView> {
    const imageUrl = dto.imageBase64
      ? await this.s3UploadService.uploadBase64Image(dto.imageBase64, dto.mimeType ?? 'image/jpeg', 'community')
      : undefined;

    const doc = await this.postModel.create({
      userId,
      content: dto.content,
      imageUrl,
      type: dto.type,
      likes: [],
      comments: [],
    });

    const usersById = await this.loadAuthors([userId]);
    return this.toPostView(doc, usersById);
  }

  public async likePost(userId: string, postId: string): Promise<PostView> {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.likes.includes(userId)) {
      post.likes = post.likes.filter((id) => id !== userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();
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

    const usersById = await this.loadAuthors([post.userId, ...post.comments.map((c) => c.userId)]);
    return this.toPostView(post, usersById);
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

  public async getStories(page: number): Promise<PaginatedResult<StoryView>> {
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
    return { items: docs.map((doc) => this.toStoryView(doc, usersById)), total, page };
  }

  public async createStory(
    userId: string,
    imageBase64: string,
    mimeType: string | undefined,
    caption: string | undefined,
  ): Promise<StoryView> {
    const imageUrl = await this.s3UploadService.uploadBase64Image(imageBase64, mimeType ?? 'image/jpeg', 'stories');

    const doc = await this.storyModel.create({
      userId,
      imageUrl,
      caption,
      expiresAt: new Date(Date.now() + STORY_TTL_MS),
    });

    const usersById = await this.loadAuthors([userId]);
    return this.toStoryView(doc, usersById);
  }

  public async removeStory(userId: string, storyId: string): Promise<{ message: string }> {
    const story = await this.storyModel.findById(storyId).exec();
    if (!story || story.userId !== userId) {
      throw new ForbiddenException('You cannot remove this story');
    }

    await this.storyModel.findByIdAndDelete(storyId).exec();
    return { message: 'Story removed' };
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
    return {
      id: String(doc._id),
      ...this.authorInfo(doc.userId, usersById),
      content: doc.content,
      imageUrl: doc.imageUrl,
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

  private toStoryView(doc: StoryDocument, usersById: Map<string, User>): StoryView {
    return {
      id: String(doc._id),
      ...this.authorInfo(doc.userId, usersById),
      imageUrl: doc.imageUrl,
      caption: doc.caption,
      createdAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
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
