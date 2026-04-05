const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export const BOARD_THEMES = {
  classic: { label: "Classic", light: "#edeed1", dark: "#7a9d58" },
  blue: { label: "Blue", light: "#dce7f4", dark: "#7e97b6" },
  slate: { label: "Slate", light: "#d9dde4", dark: "#7a828f" }
};

export function getInitialBoard() {
  return [
    "br", "bn", "bb", "bq", "bk", "bb", "bn", "br",
    "bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp",
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    "wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp",
    "wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"
  ];
}

export function toRowCol(i) {
  return [Math.floor(i / 8), i % 8];
}

function toIndex(r, c) {
  return r * 8 + c;
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function parseRecord(record) {
  if (!record || typeof record !== "string") return [];
  return record
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [fromRaw, toRaw, promotionRaw] = token.split(",");
      const from = Number(fromRaw);
      const to = Number(toRaw);
      const promotion = String(promotionRaw || "").trim().toLowerCase();
      return [from, to, ["q", "r", "b", "n"].includes(promotion) ? promotion : undefined];
    })
    .filter(([from, to]) => Number.isInteger(from) && Number.isInteger(to));
}

function isEnPassantCapture(board, from, to) {
  const moving = board[from];
  if (!moving || moving[1] !== "p") return false;
  const [fromRow, fromCol] = toRowCol(from);
  const [toRow, toCol] = toRowCol(to);
  if (Math.abs(toCol - fromCol) !== 1) return false;
  if (Math.abs(toRow - fromRow) !== 1) return false;
  if (board[to]) return false;
  const captured = board[toIndex(fromRow, toCol)];
  return Boolean(captured && captured[1] === "p" && captured[0] !== moving[0]);
}

export function applyMove(board, from, to, historyMoves = [], promotionChoice) {
  const next = [...board];
  const moving = next[from];
  if (!moving) return next;
  if (isEnPassantCapture(next, from, to)) {
    const [fromRow, toCol] = [toRowCol(from)[0], toRowCol(to)[1]];
    next[toIndex(fromRow, toCol)] = null;
  }
  next[to] = moving;
  next[from] = null;
  if (moving[1] === "p") {
    const [toRow] = toRowCol(to);
    if ((moving[0] === "w" && toRow === 0) || (moving[0] === "b" && toRow === 7)) {
      const promotion = String(promotionChoice || "").toLowerCase();
      const promoteTo = ["q", "r", "b", "n"].includes(promotion) ? promotion : "q";
      next[to] = `${moving[0]}${promoteTo}`;
    }
  }
  if (moving && moving[1] === "k" && Math.abs(to - from) === 2) {
    if (to > from) {
      const rookFrom = from + 3;
      const rookTo = from + 1;
      next[rookTo] = next[rookFrom];
      next[rookFrom] = null;
    } else {
      const rookFrom = from - 4;
      const rookTo = from - 1;
      next[rookTo] = next[rookFrom];
      next[rookFrom] = null;
    }
  }
  return next;
}

export function sameSide(a, b) {
  if (!a || !b) return false;
  return a[0] === b[0];
}

function getPseudoMoves(board, index) {
  const piece = board[index];
  if (!piece) return [];
  const color = piece[0];
  const type = piece[1];
  const [r, c] = toRowCol(index);
  const moves = [];

  const pushSlide = (dr, dc) => {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc)) {
      const ni = toIndex(nr, nc);
      const target = board[ni];
      if (!target) {
        moves.push(ni);
      } else {
        if (target[0] !== color) moves.push(ni);
        break;
      }
      nr += dr;
      nc += dc;
    }
  };

  if (type === "p") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const one = toIndex(r + dir, c);
    if (inBounds(r + dir, c) && !board[one]) {
      moves.push(one);
      if (r === startRow) {
        const two = toIndex(r + dir * 2, c);
        if (inBounds(r + dir * 2, c) && !board[two]) moves.push(two);
      }
    }
    [-1, 1].forEach((dc) => {
      const nr = r + dir;
      const nc = c + dc;
      if (!inBounds(nr, nc)) return;
      const ni = toIndex(nr, nc);
      if (board[ni] && board[ni][0] !== color) moves.push(ni);
    });
    return moves;
  }

  if (type === "n") {
    const jumps = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    jumps.forEach(([dr, dc]) => {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc)) return;
      const ni = toIndex(nr, nc);
      if (!board[ni] || board[ni][0] !== color) moves.push(ni);
    });
    return moves;
  }

  if (type === "b" || type === "q") {
    pushSlide(1, 1);
    pushSlide(1, -1);
    pushSlide(-1, 1);
    pushSlide(-1, -1);
  }

  if (type === "r" || type === "q") {
    pushSlide(1, 0);
    pushSlide(-1, 0);
    pushSlide(0, 1);
    pushSlide(0, -1);
  }

  if (type === "k") {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const ni = toIndex(nr, nc);
        if (!board[ni] || board[ni][0] !== color) moves.push(ni);
      }
    }
  }

  return moves;
}

function buildCastleRights(historyMoves) {
  const rights = { wk: true, wq: true, bk: true, bq: true };
  historyMoves.forEach(([from, to]) => {
    if (from === 60) {
      rights.wk = false;
      rights.wq = false;
    }
    if (from === 4) {
      rights.bk = false;
      rights.bq = false;
    }
    if (from === 63 || to === 63) rights.wk = false;
    if (from === 56 || to === 56) rights.wq = false;
    if (from === 7 || to === 7) rights.bk = false;
    if (from === 0 || to === 0) rights.bq = false;
  });
  return rights;
}

function findKingIndex(board, color) {
  return board.findIndex((piece) => piece === `${color}k`);
}

function isPathClear(board, from, to, dr, dc) {
  let [r, c] = toRowCol(from);
  const [tr, tc] = toRowCol(to);
  r += dr;
  c += dc;
  while (r !== tr || c !== tc) {
    if (!inBounds(r, c)) return false;
    if (board[toIndex(r, c)]) return false;
    r += dr;
    c += dc;
  }
  return true;
}

function attacksSquare(board, from, to) {
  const piece = board[from];
  if (!piece) return false;
  const color = piece[0];
  const type = piece[1];
  const [fr, fc] = toRowCol(from);
  const [tr, tc] = toRowCol(to);
  const dr = tr - fr;
  const dc = tc - fc;
  const absR = Math.abs(dr);
  const absC = Math.abs(dc);

  if (type === "p") {
    const dir = color === "w" ? -1 : 1;
    return dr === dir && absC === 1;
  }
  if (type === "n") return (absR === 2 && absC === 1) || (absR === 1 && absC === 2);
  if (type === "k") return absR <= 1 && absC <= 1;
  if (type === "b") {
    if (absR !== absC) return false;
    return isPathClear(board, from, to, dr > 0 ? 1 : -1, dc > 0 ? 1 : -1);
  }
  if (type === "r") {
    if (dr !== 0 && dc !== 0) return false;
    const stepR = dr === 0 ? 0 : dr > 0 ? 1 : -1;
    const stepC = dc === 0 ? 0 : dc > 0 ? 1 : -1;
    return isPathClear(board, from, to, stepR, stepC);
  }
  if (type === "q") {
    if (absR === absC) return isPathClear(board, from, to, dr > 0 ? 1 : -1, dc > 0 ? 1 : -1);
    if (dr === 0 || dc === 0) {
      const stepR = dr === 0 ? 0 : dr > 0 ? 1 : -1;
      const stepC = dc === 0 ? 0 : dc > 0 ? 1 : -1;
      return isPathClear(board, from, to, stepR, stepC);
    }
  }
  return false;
}

function isSquareAttacked(board, square, attackerColor) {
  for (let i = 0; i < 64; i += 1) {
    const piece = board[i];
    if (!piece || piece[0] !== attackerColor) continue;
    if (attacksSquare(board, i, square)) return true;
  }
  return false;
}

function isInCheck(board, color) {
  const kingIndex = findKingIndex(board, color);
  if (kingIndex < 0) return true;
  const attacker = color === "w" ? "b" : "w";
  return isSquareAttacked(board, kingIndex, attacker);
}

export function getLegalMoves(board, index, historyMoves = []) {
  const piece = board[index];
  if (!piece) return [];
  const color = piece[0];
  const pseudo = getPseudoMoves(board, index);
  if (piece[1] === "p" && historyMoves.length > 0) {
    const [lastFrom, lastTo] = historyMoves[historyMoves.length - 1];
    const lastPiece = board[lastTo];
    if (Number.isInteger(lastFrom) && Number.isInteger(lastTo) && lastPiece?.[1] === "p" && lastPiece[0] !== color) {
      const [r, c] = toRowCol(index);
      const [lastFromRow, lastFromCol] = toRowCol(lastFrom);
      const [lastToRow, lastToCol] = toRowCol(lastTo);
      const dir = color === "w" ? -1 : 1;
      const requiredRow = color === "w" ? 3 : 4;
      if (
        r === requiredRow &&
        lastToRow === r &&
        Math.abs(lastToCol - c) === 1 &&
        Math.abs(lastToRow - lastFromRow) === 2 &&
        lastFromCol === lastToCol
      ) {
        const epTarget = toIndex(r + dir, lastToCol);
        if (!board[epTarget]) pseudo.push(epTarget);
      }
    }
  }
  const legal = pseudo.filter((to) => {
    const target = board[to];
    if (target && target[1] === "k") return false;
    const simulated = applyMove(board, index, to, historyMoves);
    return !isInCheck(simulated, color);
  });

  if (piece[1] === "k") {
    const rights = buildCastleRights(historyMoves);
    const isWhite = color === "w";
    const kingStart = isWhite ? 60 : 4;
    if (index === kingStart && !isInCheck(board, color)) {
      const enemy = isWhite ? "b" : "w";
      const rookK = isWhite ? 63 : 7;
      const rookQ = isWhite ? 56 : 0;
      const f = isWhite ? 61 : 5;
      const g = isWhite ? 62 : 6;
      const d = isWhite ? 59 : 3;
      const c = isWhite ? 58 : 2;
      const b = isWhite ? 57 : 1;

      if ((isWhite ? rights.wk : rights.bk) && board[rookK] === `${color}r` && !board[f] && !board[g]) {
        if (!isSquareAttacked(board, f, enemy) && !isSquareAttacked(board, g, enemy)) legal.push(g);
      }
      if ((isWhite ? rights.wq : rights.bq) && board[rookQ] === `${color}r` && !board[d] && !board[c] && !board[b]) {
        if (!isSquareAttacked(board, d, enemy) && !isSquareAttacked(board, c, enemy)) legal.push(c);
      }
    }
  }
  return legal;
}

export function indexToCoord(i) {
  const [r, c] = toRowCol(i);
  return `${FILES[c]}${8 - r}`;
}

export function buildNotationEntries(recordMoves) {
  const entries = [];
  let board = getInitialBoard();

  for (let i = 0; i < recordMoves.length; i += 1) {
    const [from, to, promotion] = recordMoves[i];
    const piece = board[from];
    if (!piece) continue;
    const target = board[to];
    const type = piece[1];
    const color = piece[0];
    const toSq = indexToCoord(to);
    const [fromRow, fromCol] = toRowCol(from);
    const [toRow, toCol] = toRowCol(to);

    let pieceCode = null;
    let notation = "";

    if (type === "k" && fromRow === toRow && Math.abs(toCol - fromCol) === 2) {
      pieceCode = `${color}k`;
      notation = toCol > fromCol ? "O-O" : "O-O-O";
    } else if (type === "p") {
      const isEp = !target && fromCol !== toCol;
      notation = target || isEp ? `${FILES[fromCol]}x${toSq}` : toSq;
      if (promotion) notation += `=${String(promotion).toUpperCase()}`;
    } else {
      pieceCode = `${color}${type}`;
      notation = `${target ? "x" : ""}${toSq}`;
    }

    entries.push({ pieceCode, notation });
    board = applyMove(board, from, to, recordMoves.slice(0, i), promotion);
  }
  return entries;
}

export function needsPromotionChoice(board, from, to) {
  const piece = board[from];
  if (!piece || piece[1] !== "p") return false;
  const [toRow] = toRowCol(to);
  return (piece[0] === "w" && toRow === 0) || (piece[0] === "b" && toRow === 7);
}

function parseTimerMeta(timerRaw) {
  const tokens = (timerRaw || "").trim().split(/\s+/).filter(Boolean);
  const [baseInc, ...spentRaw] = tokens;
  const [baseSec, incSec] = (baseInc || "600+0").split("+").map((n) => Number(n || 0));
  return {
    baseMs: Math.max(0, baseSec) * 1000,
    incMs: Math.max(0, incSec) * 1000,
    spentMs: spentRaw.map((n) => Number(n) || 0)
  };
}

function formatClock(ms) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function parseGameResult(resultRaw) {
  const [winnerRaw, methodRaw] = String(resultRaw || "").split(",");
  const winner = Number(String(winnerRaw || "").trim());
  const method = Number(String(methodRaw || "").trim());
  return { winner, method };
}

export function computeClocks(game, nowMs) {
  if (!game) return { white: "--:--", black: "--:--" };
  const meta = parseTimerMeta(game.timer);
  let whiteSpent = 0;
  let blackSpent = 0;
  let whiteMoves = 0;
  let blackMoves = 0;
  meta.spentMs.forEach((t, idx) => {
    if (idx % 2 === 0) {
      whiteSpent += t;
      whiteMoves += 1;
    } else {
      blackSpent += t;
      blackMoves += 1;
    }
  });
  let whiteMs = meta.baseMs - whiteSpent + whiteMoves * meta.incMs;
  let blackMs = meta.baseMs - blackSpent + blackMoves * meta.incMs;

  const turnStartedAt = Number(game.started_time || nowMs);
  const runningElapsed = Math.max(0, nowMs - turnStartedAt);
  if (!game.result && Number(game.turn) === Number(game.wp)) {
    whiteMs -= runningElapsed;
  } else if (!game.result && Number(game.turn) === Number(game.bp)) {
    blackMs -= runningElapsed;
  }
  return {
    white: formatClock(whiteMs),
    black: formatClock(blackMs),
    whiteMs,
    blackMs
  };
}
