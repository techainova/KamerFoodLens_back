import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply } from 'fastify';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuthResponse, AuthService, TokenPair } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GoogleTokenDto } from './dto/google-token.dto';
import { GoogleProfilePayload } from './strategies/google.strategy';

interface GoogleRequest {
  user: GoogleProfilePayload;
}

@ApiTags('auth')
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('auth')
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Start registration: caches the account and sends an OTP — no account is created until it is verified' })
  @ApiResponse({ status: 201, description: 'Verification code sent by email' })
  public async register(@Body() dto: RegisterDto): Promise<{ message: string; email: string }> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, description: 'Returns access/refresh tokens and the user profile' })
  public async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify the email OTP code and log the user in' })
  @ApiResponse({ status: 200, description: 'Email verified, returns access/refresh tokens and the user profile' })
  public async verifyOtp(@Body() dto: VerifyOtpDto): Promise<AuthResponse> {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('otp/resend')
  @ApiOperation({ summary: 'Resend the email OTP code' })
  @ApiResponse({ status: 200, description: 'OTP resent' })
  public async resendOtp(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.resendOtp(dto.email);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate access/refresh tokens' })
  @ApiResponse({ status: 200, description: 'New token pair issued' })
  public async refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke the refresh token' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  public async logout(@Body() dto: RefreshTokenDto): Promise<{ message: string }> {
    return this.authService.logout(dto.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  public async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using a reset token' })
  @ApiResponse({ status: 200, description: 'Password reset' })
  public async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.authService.resetPassword(dto.email, dto.otp, dto.newPassword);
  }

  @ApiBearerAuth()
  @Post('change-password')
  @ApiOperation({ summary: 'Change the current user password' })
  @ApiResponse({ status: 200, description: 'Password changed' })
  public async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Public()
  @Post('google/token')
  @ApiOperation({ summary: 'Log in or register using a Google Identity Services ID token (web Sign-In)' })
  @ApiResponse({ status: 200, description: 'Returns access/refresh tokens and the user profile' })
  public async googleToken(@Body() dto: GoogleTokenDto): Promise<AuthResponse> {
    return this.authService.loginWithGoogleIdToken(dto.idToken);
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth2 login' })
  public googleAuth(): void {
    // Redirect handled by passport-google-oauth20 strategy.
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  public async googleCallback(@Req() req: GoogleRequest, @Res() res: FastifyReply): Promise<void> {
    const result = await this.authService.loginWithGoogle(req.user);
    void res.code(200).send(result);
  }
}
