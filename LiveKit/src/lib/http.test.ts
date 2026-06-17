import { describe, expect, it } from "vitest";
import { jsonError, jsonOk } from "./http";

describe("http helpers", () => {
  it("adds baseline security headers to JSON success responses", () => {
    const response = jsonOk({ value: 1 });

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Referrer-Policy")).toBe("same-origin");
  });

  it("adds baseline security headers to JSON error responses", () => {
    const response = jsonError(new Error("NOPE"), 403);

    expect(response.status).toBe(403);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Referrer-Policy")).toBe("same-origin");
  });
});
