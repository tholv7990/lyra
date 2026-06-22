import { IsString, IsIn } from 'class-validator';

export class RenderImageDto {
  @IsString()
  imageUrl!: string;

  @IsString()
  logoUrl!: string;

  @IsIn(['tl', 'tr', 'bl', 'br', 'center'])
  position!: string;

  @IsIn(['sm', 'md', 'lg'])
  size!: string;
}
