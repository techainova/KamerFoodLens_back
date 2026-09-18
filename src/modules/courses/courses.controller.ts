import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Course, Enrollment, LessonProgress } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseDetailView, CourseView, CoursesService, MyCourseView } from './courses.service';

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
}

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  public constructor(private readonly coursesService: CoursesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List paginated courses' })
  @ApiResponse({ status: 200, description: 'Paginated courses' })
  public async findAll(@Query('page') page?: string): Promise<PaginatedResult<CourseView>> {
    return this.coursesService.findAll(page ? parseInt(page, 10) : 1);
  }

  @ApiBearerAuth()
  @Get('my')
  @ApiOperation({ summary: 'List the courses the current user is enrolled in, with progress' })
  @ApiResponse({ status: 200, description: 'Enrolled courses with progress' })
  public async getMyCourses(@CurrentUser() user: AuthenticatedUser): Promise<MyCourseView[]> {
    return this.coursesService.getMyCourses(user.id);
  }

  @Roles('pro', 'admin')
  @ApiBearerAuth()
  @Get('managed')
  @ApiOperation({ summary: 'List courses created by the current Pro account' })
  @ApiResponse({ status: 200, description: 'Managed courses' })
  public async getManaged(@CurrentUser() user: AuthenticatedUser): Promise<CourseView[]> {
    return this.coursesService.getManagedByInstructor(user.id);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get course details with lessons grouped by section' })
  @ApiResponse({ status: 200, description: 'Course details' })
  public async findById(@Param('id') id: string): Promise<CourseDetailView> {
    return this.coursesService.findById(id);
  }

  @ApiBearerAuth()
  @Post(':id/enroll')
  @ApiOperation({ summary: 'Enroll the current user in a course' })
  @ApiResponse({ status: 201, description: 'Enrollment created' })
  public async enroll(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Enrollment> {
    return this.coursesService.enroll(user.id, id);
  }

  @ApiBearerAuth()
  @Get(':id/progress')
  @ApiOperation({ summary: 'Get completed lesson ids for the current user' })
  @ApiResponse({ status: 200, description: 'Completed lesson ids' })
  public async getProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ completedLessonIds: string[] }> {
    return this.coursesService.getProgress(user.id, id);
  }

  @ApiBearerAuth()
  @Patch(':id/lessons/:lessonId/complete')
  @ApiOperation({ summary: 'Mark a lesson as completed' })
  @ApiResponse({ status: 200, description: 'Lesson marked as completed' })
  public async completeLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ): Promise<LessonProgress> {
    return this.coursesService.completeLesson(user.id, id, lessonId);
  }

  @Roles('pro', 'admin')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a course (Pro only)' })
  @ApiResponse({ status: 201, description: 'Course created' })
  public async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCourseDto): Promise<Course> {
    return this.coursesService.create(user.id, dto);
  }

  @Roles('pro', 'admin')
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update a course (Pro only)' })
  @ApiResponse({ status: 200, description: 'Course updated' })
  public async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ): Promise<Course> {
    return this.coursesService.update(user.id, id, dto);
  }
}
