import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LeaderboardPeriod, TombolaTicket } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { BuyTicketDto } from './dto/buy-ticket.dto';
import { GamesService, LeaderboardEntryView, PublicQuizQuestion, QuizSubmitResult, TombolaView } from './games.service';

@ApiTags('games')
@Controller('games')
export class GamesController {
  public constructor(private readonly gamesService: GamesService) {}

  @Public()
  @Get('leaderboard')
  @ApiOperation({ summary: 'Get the XP leaderboard for a period' })
  @ApiResponse({ status: 200, description: 'Leaderboard entries' })
  public async getLeaderboard(
    @Query('period') period: LeaderboardPeriod = LeaderboardPeriod.week,
  ): Promise<LeaderboardEntryView[]> {
    return this.gamesService.getLeaderboard(period);
  }

  @Public()
  @Get('quiz/questions')
  @ApiOperation({ summary: 'Get randomized quiz questions' })
  @ApiResponse({ status: 200, description: 'Quiz questions' })
  public async getQuizQuestions(
    @Query('category') category?: string,
    @Query('count') count?: string,
  ): Promise<PublicQuizQuestion[]> {
    return this.gamesService.getQuizQuestions(category, count ? parseInt(count, 10) : 10);
  }

  @ApiBearerAuth()
  @Post('quiz/submit')
  @ApiOperation({ summary: 'Submit quiz answers and earn XP' })
  @ApiResponse({ status: 201, description: 'Quiz result with XP earned' })
  public async submitQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitQuizDto,
  ): Promise<QuizSubmitResult> {
    return this.gamesService.submitQuiz(user.id, dto);
  }

  @Public()
  @Get('tombola')
  @ApiOperation({ summary: 'Get the currently active tombola' })
  @ApiResponse({ status: 200, description: 'Active tombola info' })
  public async getActiveTombola(): Promise<TombolaView | null> {
    return this.gamesService.getActiveTombola();
  }

  @ApiBearerAuth()
  @Get('tombola/tickets')
  @ApiOperation({ summary: 'Get the current user tickets for a tombola' })
  @ApiResponse({ status: 200, description: 'User tombola tickets' })
  public async getMyTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Query('tombolaId') tombolaId: string,
  ): Promise<TombolaTicket[]> {
    return this.gamesService.getMyTickets(user.id, tombolaId);
  }

  @ApiBearerAuth()
  @Post('tombola/buy')
  @ApiOperation({ summary: 'Buy tombola tickets using wallet balance' })
  @ApiResponse({ status: 201, description: 'Tickets purchased' })
  public async buyTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BuyTicketDto,
  ): Promise<TombolaTicket[]> {
    return this.gamesService.buyTickets(user.id, dto);
  }
}
