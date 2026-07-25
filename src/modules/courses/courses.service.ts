import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Course, CourseLevel, Enrollment, Lesson, LessonProgress, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

export interface LessonView {
  id: string;
  title: string;
  videoUrl: string | null;
  duration: number | null;
  order: number;
}

export interface CourseSection {
  sectionTitle: string;
  lessons: LessonView[];
}

export interface CourseView {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  instructorId: string;
  instructorName: string;
  instructorAvatar: string | null;
  instructorBio: string | null;
  level: CourseLevel;
  isCertified: boolean;
  priceXAF: number;
  isFree: boolean;
  lessonsCount: number;
  durationMin: number;
  studentsCount: number;
  createdAt: string;
}

export interface CourseDetailView extends CourseView {
  sections: CourseSection[];
}

export interface MyCourseView extends CourseView {
  progressPct: number;
  completedLessons: number;
}

type CourseWithRelations = Course & { lessons: Lesson[]; _count: { enrollments: number } };

const PAGE_SIZE = 20;

@Injectable()
export class CoursesService {
  public constructor(private readonly prisma: PrismaService) {}

  public async findAll(page: number): Promise<PaginatedResult<CourseView>> {
    const skip = (page - 1) * PAGE_SIZE;

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        skip,
        take: PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
        include: { lessons: true, _count: { select: { enrollments: true } } },
      }),
      this.prisma.course.count(),
    ]);

    const instructorsById = await this.loadInstructors(courses.map((c) => c.instructorId));
    return { items: courses.map((c) => this.toCourseView(c, instructorsById)), total, page };
  }

  public async findById(id: string): Promise<CourseDetailView> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { lessons: { orderBy: { order: 'asc' } }, _count: { select: { enrollments: true } } },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const instructorsById = await this.loadInstructors([course.instructorId]);
    return {
      ...this.toCourseView(course, instructorsById),
      sections: this.toSections(course.lessons),
    };
  }

  public async getMyCourses(userId: string): Promise<MyCourseView[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      orderBy: { paidAt: 'desc' },
      include: {
        course: { include: { lessons: true, _count: { select: { enrollments: true } } } },
        progress: true,
      },
    });

    const instructorsById = await this.loadInstructors(enrollments.map((e) => e.course.instructorId));

    return enrollments.map((enrollment) => {
      const totalLessons = enrollment.course.lessons.length;
      const completedLessons = enrollment.progress.length;
      return {
        ...this.toCourseView(enrollment.course, instructorsById),
        completedLessons,
        progressPct: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      };
    });
  }

  public async enroll(userId: string, courseId: string): Promise<Enrollment> {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const existing = await this.prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId, userId } },
    });

    if (existing) {
      throw new ConflictException('You are already enrolled in this course');
    }

    return this.prisma.enrollment.create({
      data: { courseId, userId, paidAt: new Date() },
    });
  }

  public async getProgress(userId: string, courseId: string): Promise<{ completedLessonIds: string[] }> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId, userId } },
    });

    if (!enrollment) {
      throw new NotFoundException('You are not enrolled in this course');
    }

    const progress = await this.prisma.lessonProgress.findMany({ where: { enrollmentId: enrollment.id } });
    return { completedLessonIds: progress.map((p) => p.lessonId) };
  }

  public async completeLesson(userId: string, courseId: string, lessonId: string): Promise<LessonProgress> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_userId: { courseId, userId } },
    });

    if (!enrollment) {
      throw new NotFoundException('You are not enrolled in this course');
    }

    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson || lesson.courseId !== courseId) {
      throw new NotFoundException('Lesson not found in this course');
    }

    return this.prisma.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
      update: {},
      create: { enrollmentId: enrollment.id, lessonId },
    });
  }

  public async create(instructorId: string, dto: CreateCourseDto): Promise<Course> {
    return this.prisma.course.create({
      data: {
        instructorId,
        title: dto.title,
        description: dto.description,
        priceXAF: dto.priceXAF ?? 0,
        imageUrl: dto.imageUrl,
        level: dto.level,
        isCertified: dto.isCertified ?? false,
        lessons: dto.lessons
          ? {
              create: dto.lessons.map((lesson) => ({
                title: lesson.title,
                videoUrl: lesson.videoUrl,
                duration: lesson.duration,
                order: lesson.order,
                sectionTitle: lesson.sectionTitle,
              })),
            }
          : undefined,
      },
    });
  }

  public async update(instructorId: string, courseId: string, dto: UpdateCourseDto): Promise<Course> {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    if (course.instructorId !== instructorId) {
      throw new ForbiddenException('You do not own this course');
    }

    return this.prisma.course.update({ where: { id: courseId }, data: dto });
  }

  private async loadInstructors(instructorIds: string[]): Promise<Map<string, { user: User; businessName: string | null }>> {
    const uniqueIds = [...new Set(instructorIds)];
    const [users, proProfiles] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: uniqueIds } } }),
      this.prisma.proProfile.findMany({ where: { userId: { in: uniqueIds } } }),
    ]);

    const businessNameByUserId = new Map(proProfiles.map((p) => [p.userId, p.businessName]));
    return new Map(users.map((user) => [user.id, { user, businessName: businessNameByUserId.get(user.id) ?? null }]));
  }

  private toCourseView(
    course: CourseWithRelations,
    instructorsById: Map<string, { user: User; businessName: string | null }>,
  ): CourseView {
    const instructor = instructorsById.get(course.instructorId);
    const durationSec = course.lessons.reduce((sum, lesson) => sum + (lesson.duration ?? 0), 0);
    const durationMin = Math.round(durationSec / 60);

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      imageUrl: course.imageUrl,
      instructorId: course.instructorId,
      instructorName: instructor?.businessName ?? (instructor ? `${instructor.user.firstName} ${instructor.user.lastName}`.trim() : 'Instructeur KFL'),
      instructorAvatar: instructor?.user.avatar ?? null,
      instructorBio: instructor?.user.bio ?? null,
      level: course.level,
      isCertified: course.isCertified,
      priceXAF: course.priceXAF,
      isFree: course.priceXAF === 0,
      lessonsCount: course.lessons.length,
      durationMin,
      studentsCount: course._count.enrollments,
      createdAt: course.createdAt.toISOString(),
    };
  }

  private toSections(lessons: Lesson[]): CourseSection[] {
    const order: string[] = [];
    const bySection = new Map<string, LessonView[]>();

    for (const lesson of lessons) {
      const key = lesson.sectionTitle ?? 'Général';
      if (!bySection.has(key)) {
        bySection.set(key, []);
        order.push(key);
      }
      bySection.get(key)!.push({
        id: lesson.id,
        title: lesson.title,
        videoUrl: lesson.videoUrl,
        duration: lesson.duration,
        order: lesson.order,
      });
    }

    return order.map((sectionTitle) => ({ sectionTitle, lessons: bySection.get(sectionTitle)! }));
  }
}
