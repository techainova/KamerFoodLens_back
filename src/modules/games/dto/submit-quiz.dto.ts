import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

export class QuizAnswerDto {
  @ApiProperty({ example: 'question-uuid' })
  @IsString()
  public questionId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  public selectedIndex!: number;

  @ApiProperty({ example: 4500 })
  @IsInt()
  @Min(0)
  public timeMs!: number;
}

export class SubmitQuizDto {
  @ApiProperty({ example: 'session-uuid' })
  @IsString()
  public sessionId!: string;

  @ApiProperty({ type: [QuizAnswerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  public answers!: QuizAnswerDto[];
}
