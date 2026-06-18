import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { AiChatTurn, CopilotChatDto } from '@lyra/shared';

export class CopilotTurnBody implements AiChatTurn {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(8000)
  content!: string;
}

export class CopilotChatBody implements CopilotChatDto {
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => CopilotTurnBody)
  messages!: CopilotTurnBody[];
}
