import { afterEach, describe, expect, it, vi } from "vitest";
import backend from "../backend/src/index.js";

function createSharedMapsDatabase() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      let bindings = [];
      const statement = {
        bind(...values) {
          bindings = values;
          return statement;
        },
        async run() {
          if (sql.includes("INSERT INTO shared_maps")) {
            const [id, ownerSub, sourceId, authorName, name, mapJson, createdAt, updatedAt] =
              bindings;
            const existing = [...rows.values()].find(
              (row) => row.owner_sub === ownerSub && row.source_id === sourceId
            );
            rows.set(existing?.id || id, {
              id: existing?.id || id,
              owner_sub: ownerSub,
              source_id: sourceId,
              author_name: authorName,
              name,
              map_json: mapJson,
              created_at: existing?.created_at || createdAt,
              updated_at: updatedAt,
            });
          }
          return { success: true };
        },
        async all() {
          return {
            results: [...rows.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
          };
        },
        async first() {
          if (sql.includes("WHERE id = ?")) return rows.get(bindings[0]) || null;
          if (sql.includes("WHERE owner_sub = ? AND source_id = ?")) {
            return (
              [...rows.values()].find(
                (row) => row.owner_sub === bindings[0] && row.source_id === bindings[1]
              ) || null
            );
          }
          return null;
        },
      };
      return statement;
    },
  };
}

const validMap = {
  version: 1,
  name: "Community map",
  objects: [
    { type: "ball", x: 0.2, y: 0.3, radius: 0.03 },
    { type: "star", x: 0.8, y: 0.7, radius: 0.03 },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shared map API", () => {
  it("returns the public map board from D1", async () => {
    const database = createSharedMapsDatabase();
    const response = await backend.fetch(new Request("https://api.example/api/maps"), {
      DB: database,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, maps: [] });
  });

  it("requires authentication to upload a shared map", async () => {
    const database = createSharedMapsDatabase();
    const response = await backend.fetch(
      new Request("https://api.example/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: "local-map-1", map: validMap }),
      }),
      { DB: database }
    );

    expect(response.status).toBe(401);
    expect(database.rows.size).toBe(0);
  });

  it("stores valid maps for the public board and rejects maps without a ball or star", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ sub: "user-123", name: "Map Author", aud: "test-client" }))
    );
    const database = createSharedMapsDatabase();
    const env = { DB: database, GOOGLE_CLIENT_ID: "test-client" };
    const upload = (map, sourceId = "local-map-1") =>
      backend.fetch(
        new Request("https://api.example/api/maps", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
          },
          body: JSON.stringify({ sourceId, map }),
        }),
        env
      );

    const invalidResponse = await upload({ ...validMap, objects: [validMap.objects[0]] });
    expect(invalidResponse.status).toBe(400);
    expect(database.rows.size).toBe(0);

    const uploadResponse = await upload(validMap);
    expect(uploadResponse.status).toBe(200);
    const uploaded = await uploadResponse.json();
    expect(uploaded).toMatchObject({ ok: true, id: expect.any(String) });

    const boardResponse = await backend.fetch(new Request("https://api.example/api/maps"), env);
    const board = await boardResponse.json();
    expect(board.maps).toHaveLength(1);
    expect(board.maps[0]).toMatchObject({
      id: uploaded.id,
      name: "Community map",
      authorName: "Map Author",
      objects: validMap.objects,
    });

    const detailResponse = await backend.fetch(
      new Request(`https://api.example/api/maps/${uploaded.id}`),
      env
    );
    expect(detailResponse.status).toBe(200);
    await expect(detailResponse.json()).resolves.toMatchObject({
      map: { id: uploaded.id, name: "Community map", objects: validMap.objects },
    });
  });
});
