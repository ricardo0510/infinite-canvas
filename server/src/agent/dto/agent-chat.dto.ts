import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from "class-validator";

const MAX_MESSAGES = 20;
const MAX_NODES = 200;
const MAX_EDGES = 500;
const MAX_GROUPS = 200;

export class AgentChatMessageDto {
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @IsString()
  @Length(1, 4000)
  content!: string;
}

export class AgentContextNodeDto {
  @IsString()
  @Length(1, 128)
  id!: string;

  @IsString()
  @Length(1, 32)
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  parentId?: string | null;

  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;
}

export class AgentContextEdgeDto {
  @IsString()
  @Length(1, 128)
  id!: string;

  @IsString()
  @Length(1, 128)
  source!: string;

  @IsString()
  @Length(1, 128)
  target!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}

export class AgentContextGroupDto {
  @IsString()
  @Length(1, 128)
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  parentId?: string | null;
}

export class AgentViewportDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsNumber()
  zoom!: number;
}

export class AgentContextDto {
  @IsArray()
  @ArrayMaxSize(MAX_NODES)
  @IsString({ each: true })
  selectedNodeIds!: string[];

  @IsArray()
  @ArrayMaxSize(MAX_NODES)
  @ValidateNested({ each: true })
  @Type(() => AgentContextNodeDto)
  nodes!: AgentContextNodeDto[];

  @IsArray()
  @ArrayMaxSize(MAX_EDGES)
  @ValidateNested({ each: true })
  @Type(() => AgentContextEdgeDto)
  edges!: AgentContextEdgeDto[];

  @IsArray()
  @ArrayMaxSize(MAX_GROUPS)
  @ValidateNested({ each: true })
  @Type(() => AgentContextGroupDto)
  groups!: AgentContextGroupDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AgentViewportDto)
  viewport?: AgentViewportDto;

  @IsOptional()
  @IsNumber()
  totalNodes?: number;

  @IsOptional()
  @IsBoolean()
  truncated?: boolean;
}

export class AgentChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  modelId!: string;

  @IsArray()
  @ArrayMaxSize(MAX_MESSAGES)
  @ValidateNested({ each: true })
  @Type(() => AgentChatMessageDto)
  messages!: AgentChatMessageDto[];

  @ValidateNested()
  @Type(() => AgentContextDto)
  context!: AgentContextDto;
}
