import { describe, it, expect } from "vitest";
import {
  validateAssetName,
  validateFileSize,
  validateMetadata,
  validateLottieJson,
  inferFileType,
  ValidationError,
} from "./validation.js";

describe("validateAssetName", () => {
  it("passes for valid names", () => {
    expect(() => validateAssetName("My Animation")).not.toThrow();
    expect(() => validateAssetName("a")).not.toThrow();
  });

  it("throws for empty name", () => {
    expect(() => validateAssetName("")).toThrow(ValidationError);
    expect(() => validateAssetName("   ")).toThrow(ValidationError);
  });

  it("throws for names over 255 chars", () => {
    expect(() => validateAssetName("a".repeat(256))).toThrow(ValidationError);
  });
});

describe("validateFileSize", () => {
  it("passes valid sizes", () => {
    expect(() => validateFileSize(1024)).not.toThrow();
    expect(() => validateFileSize(49 * 1024 * 1024)).not.toThrow();
  });

  it("throws for 0 bytes", () => {
    expect(() => validateFileSize(0)).toThrow(ValidationError);
  });

  it("throws for over 50 MB", () => {
    expect(() => validateFileSize(51 * 1024 * 1024)).toThrow(ValidationError);
  });
});

describe("validateMetadata", () => {
  const valid = {
    width: 100,
    height: 100,
    frameRate: 24,
    durationSeconds: 2.5,
    layerCount: 3,
    fileSizeBytes: 1024,
    contentHash: "a".repeat(64),
  };

  it("passes valid metadata", () => {
    expect(() => validateMetadata(valid)).not.toThrow();
  });

  it("throws for invalid contentHash", () => {
    expect(() => validateMetadata({ ...valid, contentHash: "short" })).toThrow(ValidationError);
  });

  it("throws for non-hex contentHash", () => {
    expect(() => validateMetadata({ ...valid, contentHash: "z".repeat(64) })).toThrow(ValidationError);
  });

  it("throws for negative width", () => {
    expect(() => validateMetadata({ ...valid, width: -1 })).toThrow(ValidationError);
  });
});

describe("validateLottieJson", () => {
  it("passes a valid lottie object", () => {
    expect(() =>
      validateLottieJson({ v: "5.7.0", layers: [], w: 100, h: 100, fr: 24 }),
    ).not.toThrow();
  });

  it("throws when 'v' is missing", () => {
    expect(() => validateLottieJson({ layers: [] })).toThrow(ValidationError);
  });

  it("throws when 'layers' is not an array", () => {
    expect(() => validateLottieJson({ v: "5.7.0", layers: "bad" })).toThrow(ValidationError);
  });

  it("throws for null", () => {
    expect(() => validateLottieJson(null)).toThrow(ValidationError);
  });
});

describe("inferFileType", () => {
  it("returns json for .json extension", () => {
    expect(inferFileType("animation.json")).toBe("json");
  });

  it("returns lottie for .lottie extension", () => {
    expect(inferFileType("animation.lottie")).toBe("lottie");
  });

  it("throws for unknown extensions", () => {
    expect(() => inferFileType("animation.gif")).toThrow(ValidationError);
  });
});
