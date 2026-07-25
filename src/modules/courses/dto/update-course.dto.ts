import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCourseDto } from './create-course.dto';

export class UpdateCourseDto extends PartialType(OmitType(CreateCourseDto, ['lessons'] as const)) {}
