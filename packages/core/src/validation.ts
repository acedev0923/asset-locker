import { z } from "zod";
import { AssetMetadataSchema, type AssetMetadata } from "./schema.js";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateAssetName(name: string): void {
  if (!name.trim()) throw new ValidationError("Asset name cannot be empty", "name");
  if (name.length > 255) throw new ValidationError("Asset name too long (max 255 chars)", "name");
}

export function validateFileSize(bytes: number): void {
  if (bytes > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(
      `File too large: ${(bytes / 1024 / 1024).toFixed(1)} MB (max 50 MB)`,
      "fileSizeBytes",
    );
  }
  if (bytes === 0) throw new ValidationError("File is empty", "fileSizeBytes");
}

export function validateMetadata(raw: unknown): AssetMetadata {
  const result = AssetMetadataSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.errors[0];
    throw new ValidationError(
      first?.message ?? "Invalid metadata",
      first?.path.join("."),
    );
  }
  return result.data;
}

export function validateLottieJson(json: unknown): void {
  if (typeof json !== "object" || json === null) {
    throw new ValidationError("Not a valid JSON object", "rawJson");
  }
  const obj = json as Record<string, unknown>;
  // Lottie files must have a version field and layers array
  if (typeof obj["v"] === "undefined") {
    throw new ValidationError("Missing Lottie version field ('v')", "rawJson");
  }
  if (!Array.isArray(obj["layers"])) {
    throw new ValidationError("Missing or invalid 'layers' array", "rawJson");
  }
}

const FileTypeSchema = z.enum(["json", "lottie"]);
export type FileType = z.infer<typeof FileTypeSchema>;

export function inferFileType(filename: string): FileType {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "lottie") return "lottie";
  if (ext === "json") return "json";
  throw new ValidationError(`Unsupported file extension: .${ext ?? "unknown"}`);
}
