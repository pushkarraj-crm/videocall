import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyFirebaseTokenDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}