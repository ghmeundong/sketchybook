import { describe, expect, it } from "vitest";
import backend from "../backend/src/index.js";

describe("backend CORS handling", () => {
  it("allows the Authorization header on progress preflight requests", async () => {
    const request = new Request("http://example.com/api/progress", {
      method: "OPTIONS",
    });

    const response = await backend.fetch(request, {});

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers") || "").toContain("Authorization");
  });
});
