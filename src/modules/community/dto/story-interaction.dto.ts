import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, Max, Min } from 'class-validator';

export class ReactToStoryDto {
  @ApiProperty({ example: '🔥' })
  @IsString()
  public emoji!: string;
}

export class ReplyToStoryDto {
  @ApiProperty({ example: 'Ça a l\'air délicieux !' })
  @IsString()
  public text!: string;
}

export class VoteStoryPollDto {
  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  public optionIndex!: number;
}

export class AnswerStoryQuizDto {
  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  public optionIndex!: number;
}

export class RateStorySliderDto {
  @ApiProperty({ example: 0.8, minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  public value!: number;
}
