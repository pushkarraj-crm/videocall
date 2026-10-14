import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

export class EmailDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
export class LoginDto extends EmailDto {
  @IsString()
  @Length(1, 128)
  password!: string;

  @IsOptional()
  @IsIn(['user', 'host', 'admin'])
  intent?: 'user' | 'host' | 'admin';
}
export class RegisterDto extends EmailDto {
  @IsString()
  @Length(12, 128)
  password!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 50)
  displayName!: string;
}
export class RecoveryTokenDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  token!: string;
}
export class ResetPasswordDto extends RecoveryTokenDto {
  @IsString()
  @Length(12, 128)
  password!: string;
}

export class PhoneRequestDto {
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone!: string;
  @IsOptional()
  @IsIn(['user', 'host', 'admin'])
  intent?: 'user' | 'host' | 'admin';
}
export class PhoneVerifyDto {
  @IsUUID()
  challengeId!: string;
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
