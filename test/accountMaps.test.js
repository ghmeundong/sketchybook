import { afterEach, describe, expect, it, vi } from "vitest";
import backend from "../backend/src/index.js";

function createAccountMapsDatabase() {
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
          if (sql.includes("INSERT INTO account_maps")) {
            const [ownerSub, sourceId, name, mapJson, updatedAt] = bindings;
            rows.set(`${ownerSub}:${sourceId}`, {
              owner_sub: ownerSub,
              source_id: sourceId,
              name,
              map_json: mapJson,
              updated_at: updatedAt,
            });
          }
          return { success: true };
        },
        async all() {
          if (sql.includes("FROM account_maps")) {
            return {
              results: [...rows.values()].filter((row) => row.owner_sub === bindings[0]),
            };
          }
          return { results: [] };
        },
      };
      return statement;
    },
  };
}

const map = {
  name: "Private map",
  objects: [
    { type: "ball", x: 0.2, y: 0.3, radius: 0.03 },
    { type: "star", x: 0.8, y: 0.7, radius: 0.03 },
  ],
};

function authenticatedRequest(userSub, method, body) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ sub: userSub, aud: "test-client" }))
  );
  return new Request("https://api.example/api/user/maps", {
    method,
    headers: {
      Authorization: "Bearer valid-token",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("account maps API", () => {
  it("requires sign-in", async () => {
    const response = await backend.fetch(new Request("https://api.example/api/user/maps"), {
      DB: createAccountMapsDatabase(),
    });

    expect(response.status).toBe(401);
  });

  it("saves maps privately and lists them only for their account", async () => {
    const database = createAccountMapsDatabase();
    const env = { DB: database, GOOGLE_CLIENT_ID: "test-client" };
    const saveResponse = await backend.fetch(
      authenticatedRequest("user-a", "POST", { sourceId: "map-1", map }),
      env
    );

    expect(saveResponse.status).toBe(200);
    await expect(saveResponse.json()).resolves.toMatchObject({ ok: true, id: "map-1" });

    const ownerResponse = await backend.fetch(authenticatedRequest("user-a", "GET"), env);
    await expect(ownerResponse.json()).resolves.toMatchObject({
      maps: [{ id: "map-1", name: "Private map", objects: map.objects }],
    });

    const otherResponse = await backend.fetch(authenticatedRequest("user-b", "GET"), env);
    await expect(otherResponse.json()).resolves.toMatchObject({ maps: [] });
    expect(database.rows).toHaveProperty("size", 1);
  });
});
