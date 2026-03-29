import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export const assistantRoles = [
  'endocrinologist',
  'nutritionist',
  'coach',
] as const;

export type AssistantRole = (typeof assistantRoles)[number];

export class AssistantMessageDto {
  @IsString()
  @MinLength(2)
  message!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  @IsIn(assistantRoles)
  assistantRole?: AssistantRole;
}
