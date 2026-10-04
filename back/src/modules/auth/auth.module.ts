import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthCookiesService } from './auth-cookies.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { PasswordResetService } from './password-reset.service';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';
import { TokenService } from './token.service';
import { VerificationService } from './verification.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookiesService,
    GoogleOAuthService,
    PasswordResetService,
    PasswordService,
    SessionsService,
    TokenService,
    VerificationService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [PasswordService, SessionsService, AuthService],
})
export class AuthModule {}
