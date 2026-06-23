import { describe, it, expect } from "vitest";
import {
  AssetMetadataSchema,
  CreateAssetInputSchema,
  PaginationSchema,
  PaginatedAssetsSchema,
} from "./schema.js";

const validMetadata = {
  width: 800,
  height: 600,
  frameRate: 24,
  durationSeconds: 2.5,
  layerCount: 3,
  fileSizeBytes: 1024,
  contentHash: "a".repeat(64),
};

const validInput = {
  name: "My Animation",
  originalFilename: "anim.json",
  fileType: "json" as const,
  rawJson: '{"v":"5.7","layers":[]}',
  metadata: validMetadata,
};

describe("AssetMetadataSchema", () => {
  it("accepts valid metadata", () => {
    expect(() => AssetMetadataSchema.parse(validMetadata)).not.toThrow();
  });

  it("rejects contentHash shorter than 64 chars", () => {
    expect(() =>
      AssetMetadataSchema.parse({ ...validMetadata, contentHash: "abc123" }),
    ).toThrow();
  });

  it("rejects contentHash with non-hex characters", () => {
    expect(() =>
      AssetMetadataSchema.parse({ ...validMetadata, contentHash: "z".repeat(64) }),
    ).toThrow();
  });

  it("rejects negative width", () => {
    expect(() =>
      AssetMetadataSchema.parse({ ...validMetadata, width: -1 }),
    ).toThrow();
  });

  it("rejects zero fileSizeBytes", () => {
    expect(() =>
      AssetMetadataSchema.parse({ ...validMetadata, fileSizeBytes: 0 }),
    ).toThrow();
  });

  it("rejects zero frameRate", () => {
    expect(() =>
      AssetMetadataSchema.parse({ ...validMetadata, frameRate: 0 }),
    ).toThrow();
  });
});

describe("CreateAssetInputSchema", () => {
  it("accepts valid input", () => {
    expect(() => CreateAssetInputSchema.parse(validInput)).not.toThrow();
  });

  it("accepts fileType lottie", () => {
    expect(() =>
      CreateAssetInputSchema.parse({ ...validInput, fileType: "lottie" }),
    ).not.toThrow();
  });

  it("rejects unknown fileType", () => {
    expect(() =>
      CreateAssetInputSchema.parse({ ...validInput, fileType: "gif" }),
    ).toThrow();
  });

  it("rejects empty name", () => {
    expect(() =>
      CreateAssetInputSchema.parse({ ...validInput, name: "" }),
    ).toThrow();
  });

  it("rejects name over 255 characters", () => {
    expect(() =>
      CreateAssetInputSchema.parse({ ...validInput, name: "x".repeat(256) }),
    ).toThrow();
  });

  it("rejects rawJson shorter than 2 characters", () => {
    expect(() =>
      CreateAssetInputSchema.parse({ ...validInput, rawJson: "{" }),
    ).toThrow();
  });
});

describe("PaginationSchema", () => {
  it("defaults page to 1 and pageSize to 20", () => {
    const result = PaginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it("coerces string values from query params", () => {
    const result = PaginationSchema.parse({ page: "3", pageSize: "50" });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it("rejects page 0", () => {
    expect(() => PaginationSchema.parse({ page: 0 })).toThrow();
  });

  it("rejects pageSize over 100", () => {
    expect(() => PaginationSchema.parse({ pageSize: 101 })).toThrow();
  });

  it("rejects pageSize 0", () => {
    expect(() => PaginationSchema.parse({ pageSize: 0 })).toThrow();
  });
});

describe("PaginatedAssetsSchema", () => {
  it("accepts a valid paginated response", () => {
    expect(() =>
      PaginatedAssetsSchema.parse({
        assets: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      }),
    ).not.toThrow();
  });
});
