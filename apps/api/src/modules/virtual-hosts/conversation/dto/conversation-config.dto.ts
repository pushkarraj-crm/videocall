import { IsArray, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ConversationConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  conversationPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  personalityPrompt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  creativity?: number;

  @IsOptional()
  @IsIn(['strict', 'moderate', 'relaxed'])
  safetyLevel?: 'strict' | 'moderate' | 'relaxed';

  @IsOptional()
  @IsString()
  @MaxLength(32)
  defaultEmotion?: string;

  @IsOptional()
  @IsArray()
  emotionPresets?: string[];

  @IsOptional()
  @IsArray()
  supportedLanguages?: string[];

  @IsOptional()
  memoryEnabled?: boolean;

  @IsOptional()
  relationshipEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  personalityStrength?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  humorLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  romanticLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  emojiLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  memoryDepth?: number;

  @IsOptional()
  @IsArray()
  personalityTraits?: string[];
}