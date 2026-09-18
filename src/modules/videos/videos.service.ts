import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '@prisma/client';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma/prisma.service';
import { S3UploadService } from '../../common/services/s3-upload.service';
import { VideoPost, VideoPostDocument } from './schemas/video-post.schema';
import { CreateVideoDto, CommentVideoDto } from './dto/create-video.dto';

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

export interface VideoCommentView extends AuthorInfo {
  text: string;
  createdAt: string;
}

export interface LinkedCourseView {
  id: string;
  title: string;
  priceXAF: number;
}

export interface LinkedEventView {
  id: string;
  title: string;
  priceXAF: number;
  startAt: string;
}

export interface VideoPostView extends AuthorInfo {
  id: string;
  caption: string;
  videoUrl: string;
  thumbnailUrl?: string;
  durationSec: number;
  likes: string[];
  commentsCount: number;
  viewsCount: number;
  restaurantId?: string;
  linkedCourse?: LinkedCourseView;
  linkedEvent?: LinkedEventView;
  createdAt: string;
}

const PAGE_SIZE = 10;
const AVATAR_COLORS = ['#E8591A', '#2E7D32', '#1A237E', '#9C27B0', '#E91E63', '#F9A825'];

@Injectable()
export class VideosService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly s3UploadService: S3UploadService,
    @InjectModel(VideoPost.name) private readonly videoModel: Model<VideoPostDocument>,
  ) {}

  public async getFeed(page: number): Promise<PaginatedResult<VideoPostView>> {
    const skip = (page - 1) * PAGE_SIZE;

    const [docs, total] = await Promise.all([
      this.videoModel.find().sort({ createdAt: -1 }).skip(skip).limit(PAGE_SIZE).exec(),
      this.videoModel.countDocuments().exec(),
    ]);

    const usersById = await this.loadAuthors(docs.map((doc) => doc.userId));
    const coursesById = await this.loadCourses(docs.map((doc) => doc.linkedCourseId).filter((id): id is string => !!id));
    const eventsById = await this.loadEvents(docs.map((doc) => doc.linkedEventId).filter((id): id is string => !!id));
    return { items: await Promise.all(docs.map((doc) => this.toVideoView(doc, usersById, coursesById, eventsById))), total, page };
  }

  public async create(userId: string, dto: CreateVideoDto): Promise<VideoPostView> {
    const usersById = await this.loadAuthors([userId]);
    const user = usersById.get(userId);

    if (dto.linkedCourseId) {
      const course = await this.prisma.course.findUnique({ where: { id: dto.linkedCourseId } });
      if (!course || (user?.role !== 'admin' && course.instructorId !== userId)) {
        throw new ForbiddenException("Vous ne pouvez lier qu'une de vos propres formations");
      }
    }

    if (dto.linkedEventId) {
      const event = await this.prisma.event.findUnique({ where: { id: dto.linkedEventId } });
      if (!event || (user?.role !== 'admin' && event.organizerId !== userId)) {
        throw new ForbiddenException("Vous ne pouvez lier qu'un de vos propres événements");
      }
    }

    const videoUrl = await this.s3UploadService.uploadBase64Image(dto.videoBase64, dto.mimeType ?? 'video/mp4', 'videos');

    const doc = await this.videoModel.create({
      userId,
      restaurantId: dto.restaurantId,
      caption: dto.caption,
      videoUrl,
      durationSec: dto.durationSec ?? 0,
      linkedCourseId: dto.linkedCourseId,
      linkedEventId: dto.linkedEventId,
      likes: [],
      comments: [],
      viewsCount: 0,
    });

    const coursesById = await this.loadCourses(dto.linkedCourseId ? [dto.linkedCourseId] : []);
    const eventsById = await this.loadEvents(dto.linkedEventId ? [dto.linkedEventId] : []);
    return this.toVideoView(doc, usersById, coursesById, eventsById);
  }

  public async like(userId: string, videoId: string): Promise<VideoPostView> {
    const doc = await this.videoModel.findById(videoId).exec();
    if (!doc) {
      throw new NotFoundException('Video not found');
    }

    if (doc.likes.includes(userId)) {
      doc.likes = doc.likes.filter((id) => id !== userId);
    } else {
      doc.likes.push(userId);
    }

    await doc.save();
    const usersById = await this.loadAuthors([doc.userId]);
    const coursesById = await this.loadCourses(doc.linkedCourseId ? [doc.linkedCourseId] : []);
    const eventsById = await this.loadEvents(doc.linkedEventId ? [doc.linkedEventId] : []);
    return this.toVideoView(doc, usersById, coursesById, eventsById);
  }

  public async comment(userId: string, videoId: string, dto: CommentVideoDto): Promise<VideoPostView> {
    const doc = await this.videoModel.findById(videoId).exec();
    if (!doc) {
      throw new NotFoundException('Video not found');
    }

    doc.comments.push({ userId, text: dto.text, createdAt: new Date() });
    await doc.save();

    const usersById = await this.loadAuthors([doc.userId, ...doc.comments.map((c) => c.userId)]);
    const coursesById = await this.loadCourses(doc.linkedCourseId ? [doc.linkedCourseId] : []);
    const eventsById = await this.loadEvents(doc.linkedEventId ? [doc.linkedEventId] : []);
    return this.toVideoView(doc, usersById, coursesById, eventsById);
  }

  public async getComments(videoId: string): Promise<VideoCommentView[]> {
    const doc = await this.videoModel.findById(videoId).exec();
    if (!doc) {
      throw new NotFoundException('Video not found');
    }
    const usersById = await this.loadAuthors(doc.comments.map((c) => c.userId));
    return doc.comments.map((c) => ({
      ...this.authorInfo(c.userId, usersById),
      text: c.text,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  public async registerView(videoId: string): Promise<{ viewsCount: number }> {
    const doc = await this.videoModel.findByIdAndUpdate(videoId, { $inc: { viewsCount: 1 } }, { new: true }).exec();
    if (!doc) {
      throw new NotFoundException('Video not found');
    }
    return { viewsCount: doc.viewsCount };
  }

  private async loadAuthors(userIds: string[]): Promise<Map<string, User>> {
    const uniqueIds = [...new Set(userIds)];
    const users = await this.prisma.user.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(users.map((user) => [user.id, user]));
  }

  private async loadCourses(courseIds: string[]): Promise<Map<string, LinkedCourseView>> {
    const uniqueIds = [...new Set(courseIds)];
    if (uniqueIds.length === 0) return new Map();
    const courses = await this.prisma.course.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(courses.map((c) => [c.id, { id: c.id, title: c.title, priceXAF: c.priceXAF }]));
  }

  private async loadEvents(eventIds: string[]): Promise<Map<string, LinkedEventView>> {
    const uniqueIds = [...new Set(eventIds)];
    if (uniqueIds.length === 0) return new Map();
    const events = await this.prisma.event.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(events.map((e) => [e.id, { id: e.id, title: e.title, priceXAF: e.priceXAF, startAt: e.startAt.toISOString() }]));
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

  private hashCode(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private async toVideoView(
    doc: VideoPostDocument,
    usersById: Map<string, User>,
    coursesById: Map<string, LinkedCourseView>,
    eventsById: Map<string, LinkedEventView>,
  ): Promise<VideoPostView> {
    return {
      ...this.authorInfo(doc.userId, usersById),
      id: String(doc._id),
      caption: doc.caption,
      videoUrl: doc.videoUrl,
      thumbnailUrl: doc.thumbnailUrl,
      durationSec: doc.durationSec,
      likes: doc.likes,
      commentsCount: doc.comments.length,
      viewsCount: doc.viewsCount,
      restaurantId: doc.restaurantId,
      linkedCourse: doc.linkedCourseId ? coursesById.get(doc.linkedCourseId) : undefined,
      linkedEvent: doc.linkedEventId ? eventsById.get(doc.linkedEventId) : undefined,
      createdAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
    };
  }
}
