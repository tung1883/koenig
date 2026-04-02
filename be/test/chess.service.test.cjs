const test = require("node:test");
const assert = require("node:assert/strict");
const {
  indexToSquare,
  parseRecord,
  replayRecord,
  validateAndApplyMove
} = require("../services/chess.service");

test("indexToSquare maps board indices correctly", () => {
  assert.equal(indexToSquare(0), "a8");
  assert.equal(indexToSquare(7), "h8");
  assert.equal(indexToSquare(56), "a1");
  assert.equal(indexToSquare(63), "h1");
  assert.equal(indexToSquare(64), null);
});

test("parseRecord parses move token string", () => {
  const parsed = parseRecord("52,36 12,28");
  assert.deepEqual(parsed, [[52, 36], [12, 28]]);
});

test("replayRecord accepts legal history", () => {
  const replay = replayRecord("52,36 12,28");
  assert.equal(replay.ok, true);
  assert.ok(replay.chess);
});

test("validateAndApplyMove rejects illegal move", () => {
  const result = validateAndApplyMove("", 52, 20); // e2 -> e6 illegal
  assert.equal(result.ok, false);
});

test("validateAndApplyMove accepts legal opening move", () => {
  const result = validateAndApplyMove("", 52, 36); // e2 -> e4
  assert.equal(result.ok, true);
  assert.ok(result.move);
});
