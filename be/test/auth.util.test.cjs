const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCookies } = require("../utils/auth");

test("parseCookies parses cookie header key-values", () => {
  const parsed = parseCookies("a=1; b=hello%20world; c=3");
  assert.equal(parsed.a, "1");
  assert.equal(parsed.b, "hello world");
  assert.equal(parsed.c, "3");
});
