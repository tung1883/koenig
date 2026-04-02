const test = require("node:test");
const assert = require("node:assert/strict");
const { createRateLimiter } = require("../middleware/rateLimit");

test("rate limiter blocks after max requests in window", () => {
  const limiter = createRateLimiter({ windowMs: 60 * 1000, max: 2, keyPrefix: "test" });
  const req = { headers: {}, ip: "127.0.0.1", connection: { remoteAddress: "127.0.0.1" } };
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    send(payload) { this.payload = payload; return this; }
  };
  let nextCount = 0;
  const next = () => { nextCount += 1; };

  limiter(req, res, next);
  limiter(req, res, next);
  limiter(req, res, next);

  assert.equal(nextCount, 2);
  assert.equal(res.statusCode, 429);
  assert.equal(typeof res.payload?.error, "string");
});
