const { Chess } = require("chess.js");

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function indexToSquare(index) {
  const safe = Number(index);
  if (!Number.isInteger(safe) || safe < 0 || safe > 63) return null;
  const row = Math.floor(safe / 8);
  const col = safe % 8;
  return `${FILES[col]}${8 - row}`;
}

function parseRecord(record) {
  if (!record || typeof record !== "string") return [];
  return record
    .trim()
    .split(/\s+/)
    .map((token) => token.split(",").map((n) => Number(n)))
    .filter(([from, to]) => Number.isInteger(from) && Number.isInteger(to));
}

function promotionForMove(chess, from, to) {
  const piece = chess.get(from);
  if (!piece || piece.type !== "p") return undefined;
  const rank = to[1];
  if ((piece.color === "w" && rank === "8") || (piece.color === "b" && rank === "1")) {
    return "q";
  }
  return undefined;
}

function replayRecord(record) {
  const chess = new Chess();
  const moves = parseRecord(record);
  for (const [fromIdx, toIdx] of moves) {
    const from = indexToSquare(fromIdx);
    const to = indexToSquare(toIdx);
    if (!from || !to) return { ok: false, reason: "Invalid move index in record", chess: null };
    let move = null;
    try {
      move = chess.move({ from, to, promotion: promotionForMove(chess, from, to) });
    } catch (_) {
      move = null;
    }
    if (!move) return { ok: false, reason: "Illegal historical move", chess: null };
  }
  return { ok: true, chess };
}

function validateAndApplyMove(record, i1, i2) {
  const replay = replayRecord(record);
  if (!replay.ok) return replay;
  const chess = replay.chess;
  const from = indexToSquare(i1);
  const to = indexToSquare(i2);
  if (!from || !to) return { ok: false, reason: "Invalid move index", chess: null };
  let move = null;
  try {
    move = chess.move({ from, to, promotion: promotionForMove(chess, from, to) });
  } catch (_) {
    move = null;
  }
  if (!move) return { ok: false, reason: "Illegal move", chess: null };

  let result = null;
  if (chess.isCheckmate()) {
    result = `${move.color === "w" ? 1 : 0},0`;
  } else if (chess.isStalemate()) {
    result = "0,2";
  }

  return { ok: true, chess, move, result };
}

module.exports = {
  indexToSquare,
  parseRecord,
  replayRecord,
  validateAndApplyMove
};
