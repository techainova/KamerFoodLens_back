import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LeaderboardPeriod, QuizQuestion, Tombola, TombolaTicket, TransactionType } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { BuyTicketDto } from './dto/buy-ticket.dto';

export interface LeaderboardEntryView {
  userId: string;
  firstName: string;
  lastName: string;
  points: number;
  rank: number;
}

export interface QuizSubmitResult {
  score: number;
  total: number;
  xpEarned: number;
  correctAnswers: number;
}

export interface PublicQuizQuestion {
  id: string;
  question: string;
  options: unknown;
  category: string | null;
  difficulty: string | null;
}

export interface TombolaView extends Tombola {
  soldCount: number;
}

const XP_PER_CORRECT_ANSWER = 10;
const XP_PER_SCAN = 5;
const XP_PER_ORDER = 15;
const XP_PER_REVIEW = 8;
const XP_PER_LEVEL = 100;

@Injectable()
export class GamesService {
  public constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  public async getLeaderboard(period: LeaderboardPeriod): Promise<LeaderboardEntryView[]> {
    const redisKey = this.leaderboardKey(period);
    const raw = await this.redis.zrevrange(redisKey, 0, 49, 'WITHSCORES');

    const userIds: string[] = [];
    const scores = new Map<string, number>();
    for (let i = 0; i < raw.length; i += 2) {
      userIds.push(raw[i]);
      scores.set(raw[i], Number(raw[i + 1]));
    }

    if (userIds.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = new Map(users.map((user) => [user.id, user]));

    return userIds.map((userId, index) => {
      const user = userMap.get(userId);
      return {
        userId,
        firstName: user?.firstName ?? 'Utilisateur',
        lastName: user?.lastName ?? '',
        points: scores.get(userId) ?? 0,
        rank: index + 1,
      };
    });
  }

  public async getQuizQuestions(category: string | undefined, count: number): Promise<PublicQuizQuestion[]> {
    const where = category ? { category } : {};
    const questions = await this.prisma.quizQuestion.findMany({ where });
    return this.shuffle(questions)
      .slice(0, count)
      .map(({ id, question, options, category: cat, difficulty }) => ({
        id,
        question,
        options,
        category: cat,
        difficulty,
      }));
  }

  public async submitQuiz(userId: string, dto: SubmitQuizDto): Promise<QuizSubmitResult> {
    const questionIds = dto.answers.map((answer) => answer.questionId);
    const questions = await this.prisma.quizQuestion.findMany({ where: { id: { in: questionIds } } });
    const questionMap = new Map(questions.map((question) => [question.id, question]));

    let correctAnswers = 0;
    for (const answer of dto.answers) {
      const question = questionMap.get(answer.questionId);
      if (question && question.correctIndex === answer.selectedIndex) {
        correctAnswers += 1;
      }
    }

    const xpEarned = correctAnswers * XP_PER_CORRECT_ANSWER;
    await this.awardXp(userId, xpEarned);

    return {
      score: correctAnswers,
      total: dto.answers.length,
      xpEarned,
      correctAnswers,
    };
  }

  public async getActiveTombola(): Promise<TombolaView | null> {
    const tombola = await this.prisma.tombola.findFirst({ where: { isActive: true }, orderBy: { drawAt: 'asc' } });
    if (!tombola) {
      return null;
    }

    const soldCount = await this.prisma.tombolaTicket.count({ where: { tombolaId: tombola.id } });
    return { ...tombola, soldCount };
  }

  public async getMyTickets(userId: string, tombolaId: string): Promise<TombolaTicket[]> {
    return this.prisma.tombolaTicket.findMany({ where: { userId, tombolaId } });
  }

  public async buyTickets(userId: string, dto: BuyTicketDto): Promise<TombolaTicket[]> {
    const tombola = await this.prisma.tombola.findUnique({ where: { id: dto.tombolaId } });
    if (!tombola || !tombola.isActive) {
      throw new NotFoundException('Tombola not found or inactive');
    }

    const soldCount = await this.prisma.tombolaTicket.count({ where: { tombolaId: dto.tombolaId } });
    if (soldCount + dto.qty > tombola.maxTickets) {
      throw new BadRequestException('Not enough tickets remaining');
    }

    const totalCost = tombola.pricePerTicketXAF * dto.qty;
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });

    if (!wallet || wallet.balanceXAF < totalCost) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const tickets = await this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({ where: { userId }, data: { balanceXAF: { decrement: totalCost } } });
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.debit,
          amountXAF: totalCost,
          description: `Achat de ${dto.qty} ticket(s) de tombola`,
        },
      });

      const createdTickets: TombolaTicket[] = [];
      for (let i = 0; i < dto.qty; i += 1) {
        const ticket = await tx.tombolaTicket.create({
          data: { tombolaId: dto.tombolaId, userId, ticketNumber: soldCount + i + 1 },
        });
        createdTickets.push(ticket);
      }
      return createdTickets;
    });

    return tickets;
  }

  public async awardXp(userId: string, points: number): Promise<void> {
    if (points <= 0) {
      return;
    }

    const userXp = await this.prisma.userXP.upsert({
      where: { userId },
      update: { points: { increment: points } },
      create: { userId, points, level: 1 },
    });

    const newLevel = Math.floor(userXp.points / XP_PER_LEVEL) + 1;
    if (newLevel !== userXp.level) {
      await this.prisma.userXP.update({ where: { userId }, data: { level: newLevel } });
    }

    await Promise.all([
      this.redis.zincrby(this.leaderboardKey(LeaderboardPeriod.week), points, userId),
      this.redis.zincrby(this.leaderboardKey(LeaderboardPeriod.month), points, userId),
      this.redis.zincrby(this.leaderboardKey(LeaderboardPeriod.all), points, userId),
    ]);
  }

  public async awardScanXp(userId: string): Promise<void> {
    await this.awardXp(userId, XP_PER_SCAN);
  }

  public async awardOrderXp(userId: string): Promise<void> {
    await this.awardXp(userId, XP_PER_ORDER);
  }

  public async awardReviewXp(userId: string): Promise<void> {
    await this.awardXp(userId, XP_PER_REVIEW);
  }

  private leaderboardKey(period: LeaderboardPeriod): string {
    return `leaderboard:${period}`;
  }

  private shuffle<T>(items: T[]): T[] {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
