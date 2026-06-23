import { describe, it, expect, vi } from "vitest";
import { createAsset, getAssetById, deleteAsset, listAssets } from "./repository.js";
import type { DB } from "./repository.js";

const mockRow = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  userId: "hardcoded-user",
  name: "Test Animation",
  originalFilename: "test.json",
  fileType: "json" as const,
  rawJson: '{"v":"5.7","layers":[]}',
  metadata: {},
  width: 800,
  height: 600,
  frameRate: 24,
  durationSeconds: 2.5,
  layerCount: 3,
  fileSizeBytes: 1024,
  contentHash: "a".repeat(64),
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockInput = {
  name: "Test Animation",
  originalFilename: "test.json",
  fileType: "json" as const,
  rawJson: '{"v":"5.7","layers":[]}',
  metadata: {
    width: 800,
    height: 600,
    frameRate: 24,
    durationSeconds: 2.5,
    layerCount: 3,
    fileSizeBytes: 1024,
    contentHash: "a".repeat(64),
  },
};

describe("createAsset", () => {
  it("returns an Asset mapped from the inserted row", async () => {
    const db = {
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([mockRow]) }) }),
    } as unknown as DB;

    const result = await createAsset(db, mockInput);

    expect(result.id).toBe(mockRow.id);
    expect(result.name).toBe("Test Animation");
    expect(result.metadata.width).toBe(800);
    expect(result.metadata.contentHash).toBe("a".repeat(64));
  });

  it("throws if the insert returns no row", async () => {
    const db = {
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
    } as unknown as DB;

    await expect(createAsset(db, mockInput)).rejects.toThrow("Insert returned no row");
  });
});

describe("getAssetById", () => {
  it("returns an Asset when a row is found", async () => {
    const db = {
      select: () => ({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([mockRow]) }) }),
      }),
    } as unknown as DB;

    const result = await getAssetById(db, mockRow.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(mockRow.id);
  });

  it("returns null when no row is found", async () => {
    const db = {
      select: () => ({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      }),
    } as unknown as DB;

    const result = await getAssetById(db, "nonexistent-id");

    expect(result).toBeNull();
  });
});

describe("deleteAsset", () => {
  it("returns true when the asset existed and was deleted", async () => {
    const db = {
      delete: () => ({
        where: () => ({ returning: () => Promise.resolve([{ id: mockRow.id }]) }),
      }),
    } as unknown as DB;

    const result = await deleteAsset(db, mockRow.id);

    expect(result).toBe(true);
  });

  it("returns false when no asset matched the id", async () => {
    const db = {
      delete: () => ({
        where: () => ({ returning: () => Promise.resolve([]) }),
      }),
    } as unknown as DB;

    const result = await deleteAsset(db, "nonexistent-id");

    expect(result).toBe(false);
  });
});

describe("listAssets", () => {
  function makeListDb(rows: typeof mockRow[], total: number) {
    const rowsChain = {
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({ offset: () => Promise.resolve(rows) }),
          }),
        }),
      }),
    };
    const countChain = {
      from: () => ({
        where: () => Promise.resolve([{ total }]),
      }),
    };
    return {
      select: vi.fn().mockReturnValueOnce(rowsChain).mockReturnValueOnce(countChain),
    } as unknown as DB;
  }

  it("returns assets and correct pagination metadata", async () => {
    const db = makeListDb([mockRow], 1);
    const result = await listAssets(db, 1, 20);

    expect(result.assets).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(1);
  });

  it("computes totalPages correctly across pages", async () => {
    const db = makeListDb([mockRow, mockRow], 45);
    const result = await listAssets(db, 2, 20);

    expect(result.total).toBe(45);
    expect(result.totalPages).toBe(3); // ceil(45/20) = 3
    expect(result.page).toBe(2);
  });

  it("returns empty assets and zero totalPages when no assets exist", async () => {
    const db = makeListDb([], 0);
    const result = await listAssets(db, 1, 20);

    expect(result.assets).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });
});
