import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/server/index";

describe("Worker Auth API", () => {
  it("should successfully create a password for a new user and return 400 when creating again", async () => {
    const ctx = createExecutionContext();

    // 1. First, create a user and password
    const req1 = new Request("http://example.com/api/user/test_user/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "my_first_password" })
    });

    const res1 = await worker.fetch(req1, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res1.status).toBe(200);

    const body1 = await res1.json();
    expect(body1).toEqual({ token: expect.any(String) });

    // 2. Then try to create another password for the same user
    const ctx2 = createExecutionContext();
    const req2 = new Request("http://example.com/api/user/test_user/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "my_second_password" })
    });

    const res2 = await worker.fetch(req2, env, ctx2);
    await waitOnExecutionContext(ctx2);

    // 3. Verify that we get the 400 error
    expect(res2.status).toBe(400);
    const body2 = await res2.json();
    expect(body2).toEqual({ error: "User already has a password" });
  });
});
