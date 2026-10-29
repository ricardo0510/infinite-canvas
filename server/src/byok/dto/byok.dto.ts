import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsOptional, IsString, Length, ValidateNested } from "class-validator";

export class CreateCredentialDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  label?: string;

  @IsString()
  @Length(1, 512)
  apiKey!: string;
}

export class UpdateCredentialDto {
  @IsOptional()
  @IsString()
  @Length(1, 40)
  label?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class UserModelItemDto {
  @IsString()
  providerModelId!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class PutUserModelsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserModelItemDto)
  models!: UserModelItemDto[];
}
