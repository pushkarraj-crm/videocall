import { Body, Controller, Get, Headers, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuthService } from './auth.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { DevLoginDto } from './dto/dev-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { NativeAuthService } from './native-auth.service';
import { EmailDto, LoginDto, PhoneRequestDto, PhoneVerifyDto, RecoveryTokenDto, RegisterDto, ResetPasswordDto } from './dto/password-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly nativeAuth: NativeAuthService) {}

  @Public()
  @Get('methods')
  methods() { return this.nativeAuth.methods(); }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) { return this.nativeAuth.register(dto); }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) { return this.nativeAuth.login(dto); }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  forgot(@Body() dto: EmailDto) { return this.nativeAuth.forgotPassword(dto.email); }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  reset(@Body() dto: ResetPasswordDto) { return this.nativeAuth.resetPassword(dto.token, dto.password); }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  verifyEmail(@Body() dto: RecoveryTokenDto) { return this.nativeAuth.verifyEmail(dto.token); }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-verification')
  resendVerification(@CurrentUser() user: AuthenticatedUser) { return this.nativeAuth.resendVerification(user.id); }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('phone/request')
  requestOtp(@Body() dto: PhoneRequestDto) { return this.nativeAuth.requestOtp(dto); }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('phone/verify')
  verifyOtp(@Body() dto: PhoneVerifyDto) { return this.nativeAuth.verifyOtp(dto.challengeId, dto.code); }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google/exchange')
  exchangeGoogle(@Body() dto: RecoveryTokenDto) { return this.nativeAuth.exchangeGoogle(dto.token); }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('dev-login')
  devLogin(@Body() dto: DevLoginDto) {
    return this.authService.devLogin(dto);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshSession(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  logout(@Body() body: { refreshToken?: string }) {
    return this.authService.logout(body.refreshToken);
  }

  @Post('complete-onboarding')
  completeOnboarding(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteOnboardingDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.completeOnboarding(user.id, dto, ip, userAgent);
  }

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }
}
