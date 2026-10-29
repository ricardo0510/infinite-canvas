import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import type { ReferenceType } from "../task.types";

const REFERENCE_TYPES: ReferenceType[] = [
  "reference",
  "referenceImage",
  "firstFrame",
  "lastFrame",
  "referenceVideo",
];

export class GenerationParamsDto {
  @IsOptional()
  @IsString()
  aspectRatio?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  count?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsString()
  qualityTier?: string;

  @IsOptional()
  @IsString()
  background?: string;

  @IsOptional()
  @IsBoolean()
  generateAudio?: boolean;

  @IsOptional()
  @IsBoolean()
  watermark?: boolean;

  @IsOptional()
  @IsInt()
  seed?: number;

  @IsOptional()
  @IsString()
  negativePrompt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32768)
  maxOutputTokens?: number;

  @IsOptional()
  @IsObject()
  extra?: Record<string, string | number | boolean>;
}

export class ReferenceDto {
  @IsIn(REFERENCE_TYPES)
  type!: ReferenceType;

  @IsUrl({ require_protocol: true, require_tld: false })
  url!: string;

  @IsOptional()
  @IsString()
  assetId?: string;
}

export class CreateGenerationDto {
  @IsString()
  @IsNotEmpty()
  modelId!: string;

  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  negativePrompt?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GenerationParamsDto)
  params?: GenerationParamsDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceDto)
  references?: ReferenceDto[];

  @IsString()
  @Length(8, 128)
  clientRequestId!: string;
}
