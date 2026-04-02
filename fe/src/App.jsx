import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  API_BASE_URL,
  createInvite,
  createActiveGame,
  getActiveGame,
  getDrawOffer,
  getIncomingInvites,
  getMessages,
  getOutgoingInvite,
  getUsers,
  resetPassword,
  respondInvite,
  sendMessage,
  signIn,
  signUp,
  updateDrawOffer,
  updateActiveGame
} from "./api";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const AUTH_STORAGE_KEY = "chess_web_auth_user";
const BOARD_THEMES = {
  classic: { label: "Classic", light: "#edeed1", dark: "#7a9d58" },
  blue: { label: "Blue", light: "#dce7f4", dark: "#7e97b6" },
  slate: { label: "Slate", light: "#d9dde4", dark: "#7a828f" }
};

function getInitialBoard() {
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

function toRowCol(i) {
  return [Math.floor(i / 8), i % 8];
}

function toIndex(r, c) {
  return r * 8 + c;
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function parseRecord(record) {
  if (!record || typeof record !== "string") return [];
  return record
    .trim()
    .split(/\s+/)
    .map((token) => token.split(",").map((n) => Number(n)))
    .filter(([from, to]) => Number.isInteger(from) && Number.isInteger(to));
}

function applyMove(board, from, to) {
  const next = [...board];
  const moving = next[from];
  next[to] = moving;
  next[from] = null;
  if (moving && moving[1] === "k" && Math.abs(to - from) === 2) {
    // Handle castling rook movement on board replay and local moves.
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

function sameSide(a, b) {
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
  const rights = {
    wk: true,
    wq: true,
    bk: true,
    bq: true
  };
  historyMoves.forEach(([from, to]) => {
    // King moved
    if (from === 60) {
      rights.wk = false;
      rights.wq = false;
    }
    if (from === 4) {
      rights.bk = false;
      rights.bq = false;
    }
    // Rooks moved or got captured on original squares
    if (from === 63 || to === 63) rights.wk = false; // h1
    if (from === 56 || to === 56) rights.wq = false; // a1
    if (from === 7 || to === 7) rights.bk = false;   // h8
    if (from === 0 || to === 0) rights.bq = false;   // a8
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
  if (type === "n") {
    return (absR === 2 && absC === 1) || (absR === 1 && absC === 2);
  }
  if (type === "k") {
    return absR <= 1 && absC <= 1;
  }
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
    if (absR === absC) {
      return isPathClear(board, from, to, dr > 0 ? 1 : -1, dc > 0 ? 1 : -1);
    }
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

function getLegalMoves(board, index, historyMoves = []) {
  const piece = board[index];
  if (!piece) return [];
  const color = piece[0];
  const pseudo = getPseudoMoves(board, index);
  const legal = pseudo.filter((to) => {
    const target = board[to];
    if (target && target[1] === "k") return false;
    const simulated = applyMove(board, index, to);
    return !isInCheck(simulated, color);
  });

  // Castling
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

      // King-side castle
      if ((isWhite ? rights.wk : rights.bk) && board[rookK] === `${color}r` && !board[f] && !board[g]) {
        if (!isSquareAttacked(board, f, enemy) && !isSquareAttacked(board, g, enemy)) {
          legal.push(g);
        }
      }
      // Queen-side castle
      if ((isWhite ? rights.wq : rights.bq) && board[rookQ] === `${color}r` && !board[d] && !board[c] && !board[b]) {
        if (!isSquareAttacked(board, d, enemy) && !isSquareAttacked(board, c, enemy)) {
          legal.push(c);
        }
      }
    }
  }

  return legal;
}

function indexToCoord(i) {
  const [r, c] = toRowCol(i);
  return `${FILES[c]}${8 - r}`;
}

function buildBoardFromRecord(record) {
  return parseRecord(record).reduce((acc, [from, to]) => applyMove(acc, from, to), getInitialBoard());
}

function buildNotationEntries(recordMoves) {
  const entries = [];
  let board = getInitialBoard();

  for (const [from, to] of recordMoves) {
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
      if (target) {
        notation = `${FILES[fromCol]}x${toSq}`;
      } else {
        notation = toSq;
      }
    } else {
      pieceCode = `${color}${type}`;
      notation = `${target ? "x" : ""}${toSq}`;
    }

    entries.push({ pieceCode, notation });
    board = applyMove(board, from, to);
  }

  return entries;
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

function parseGameResult(resultRaw) {
  const [winnerRaw, methodRaw] = String(resultRaw || "").split(",");
  const winner = Number(String(winnerRaw || "").trim());
  const method = Number(String(methodRaw || "").trim());
  return { winner, method };
}

function computeClocks(game, nowMs) {
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

function AuthCard({ onSuccess }) {
  const [mode, setMode] = useState("signin");
  const [user, setUser] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    if ((mode === "signup" || mode === "forgot") && pwd !== pwd2) {
      setErr("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        const data = await signIn(user.trim(), pwd);
        onSuccess({
          user: data.user,
          userID: Number(data.userID)
        });
      } else if (mode === "signup") {
        await signUp(user.trim(), pwd);
        setMsg("Registration successful. You can sign in now.");
        setMode("signin");
        setPwd("");
        setPwd2("");
      } else {
        await resetPassword(user.trim(), pwd);
        setMsg("Password updated. Please sign in.");
        setMode("signin");
        setPwd("");
        setPwd2("");
      }
    } catch (error) {
      setErr(error?.response?.data || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <img src="/assets/logo.png" alt="Logo" className="logo" />
        <h1>{mode === "signin" ? "Play Chess" : mode === "signup" ? "Create Account" : "Reset Password"}</h1>
        <p>Minimal frontend for your backend game API.</p>
        <div className="auth-mode">
          <button
            type="button"
            className={`btn btn-quiet ${mode === "signin" ? "is-active" : ""}`}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`btn btn-quiet ${mode === "signup" ? "is-active" : ""}`}
            onClick={() => setMode("signup")}
          >
            Register
          </button>
          <button
            type="button"
            className={`btn btn-quiet ${mode === "forgot" ? "is-active" : ""}`}
            onClick={() => setMode("forgot")}
          >
            Forgot Password
          </button>
        </div>
        <label>
          Username
          <input value={user} onChange={(e) => setUser(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required />
        </label>
        {mode !== "signin" ? (
          <label>
            Confirm Password
            <input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} required />
          </label>
        ) : null}
        {msg ? <div className="success-box">{msg}</div> : null}
        {err ? <div className="error-box">{String(err)}</div> : null}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Please wait..." : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
        </button>
      </form>
    </div>
  );
}

function InviteHub({ me, onGameCreated, socketRef }) {
  const [users, setUsers] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState(null);
  const [opp, setOpp] = useState("");
  const [baseHours, setBaseHours] = useState(0);
  const [baseMinutes, setBaseMinutes] = useState(10);
  const [baseSeconds, setBaseSeconds] = useState(0);
  const [inc, setInc] = useState(5);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingReq, setPendingReq] = useState(null);
  const [timeMode, setTimeMode] = useState("blitz");

  const presetGroups = {
    bullet: [
      { label: "1 | 0", base: 60, inc: 0 },
      { label: "1 | 1", base: 60, inc: 1 },
      { label: "2 | 1", base: 120, inc: 1 }
    ],
    blitz: [
      { label: "3 | 0", base: 180, inc: 0 },
      { label: "3 | 2", base: 180, inc: 2 },
      { label: "5 | 0", base: 300, inc: 0 },
      { label: "5 | 3", base: 300, inc: 3 }
    ],
    rapid: [
      { label: "10 | 0", base: 600, inc: 0 },
      { label: "10 | 5", base: 600, inc: 5 },
      { label: "15 | 10", base: 900, inc: 10 }
    ],
    classical: [
      { label: "30 | 0", base: 1800, inc: 0 },
      { label: "30 | 20", base: 1800, inc: 20 },
      { label: "60 | 30", base: 3600, inc: 30 }
    ]
  };
  const modeOptions = [
    { id: "bullet", label: "Bullet" },
    { id: "blitz", label: "Blitz" },
    { id: "rapid", label: "Rapid" },
    { id: "classical", label: "Classical" }
  ];
  const activePresets = presetGroups[timeMode] || [];
  const baseTotalSeconds = Math.max(0, Number(baseHours || 0) * 3600 + Number(baseMinutes || 0) * 60 + Number(baseSeconds || 0));

  const applyBaseSeconds = (totalSeconds) => {
    const safe = Math.max(0, Number(totalSeconds || 0));
    const h = Math.floor(safe / 3600);
    const rem = safe % 3600;
    const m = Math.floor(rem / 60);
    const s = rem % 60;
    setBaseHours(h);
    setBaseMinutes(m);
    setBaseSeconds(s);
  };

  const refresh = async () => {
    try {
      const [userList, inData, outData] = await Promise.all([
        getUsers(),
        getIncomingInvites(),
        getOutgoingInvite()
      ]);
      setUsers(Array.isArray(userList) ? userList : []);
      setIncoming(Array.isArray(inData?.requestList) ? inData.requestList : []);
      setOutgoing(outData?.request || null);
    } catch (error) {
      // silently retry from polling
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const available = users.filter((u) => Number(u.userID) !== Number(me.userID));
  const outgoingIsLive = outgoing && !outgoing.gameID;

  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket || !me) return undefined;

    const onInviteNew = (payload) => {
      if (Number(payload?.receiver) !== Number(me.userID)) return;
      setIncoming((prev) => {
        if (prev.some((item) => Number(item.reqID) === Number(payload.reqID))) return prev;
        return [...prev, payload];
      });
    };

    const onInviteAccepted = (payload) => {
      const myId = Number(me.userID);
      if (Number(payload?.wp) !== myId && Number(payload?.bp) !== myId) return;
      const gamePayload = {
        gameID: Number(payload.gameID),
        wp: Number(payload.wp),
        bp: Number(payload.bp),
        turn: Number(payload.wp),
        timer: payload.timer,
        started_time: Number(payload.startedTime),
        record: null,
        move_number: null
      };
      setIncoming((prev) => prev.filter((item) => Number(item.reqID) !== Number(payload.reqID)));
      setOutgoing((prev) => (Number(prev?.reqID) === Number(payload.reqID) ? null : prev));
      onGameCreated(gamePayload);
      setMsg("Invite accepted. Game started.");
    };

    const onInviteDeclined = (payload) => {
      const myId = Number(me.userID);
      if (Number(payload?.wp) !== myId && Number(payload?.bp) !== myId) return;
      setIncoming((prev) => prev.filter((item) => Number(item.reqID) !== Number(payload.reqID)));
      const wasOutgoing = Number(outgoingIsLive?.reqID) === Number(payload?.reqID);
      if (wasOutgoing) {
        setOutgoing(null);
        setMsg("Invite declined.");
      }
    };

    const onInviteExpired = (payload) => {
      const myId = Number(me.userID);
      if (Number(payload?.wp) !== myId && Number(payload?.bp) !== myId) return;
      setIncoming((prev) => prev.filter((item) => Number(item.reqID) !== Number(payload.reqID)));
      const wasOutgoing = Number(outgoingIsLive?.reqID) === Number(payload?.reqID);
      if (wasOutgoing) {
        setOutgoing(null);
        setMsg("Invite expired.");
      }
    };

    socket.on("invite:new", onInviteNew);
    socket.on("invite:accepted", onInviteAccepted);
    socket.on("invite:declined", onInviteDeclined);
    socket.on("invite:expired", onInviteExpired);
    return () => {
      socket.off("invite:new", onInviteNew);
      socket.off("invite:accepted", onInviteAccepted);
      socket.off("invite:declined", onInviteDeclined);
      socket.off("invite:expired", onInviteExpired);
    };
  }, [me?.userID, onGameCreated, socketRef, outgoingIsLive?.reqID]);

  const sendInvite = async () => {
    if (!opp) {
      setErr("Choose an opponent first.");
      return;
    }
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const target = available.find((u) => Number(u.userID) === Number(opp));
      if (!target) {
        throw new Error("Selected opponent not found.");
      }
      const payload = {
        wp: Number(me.userID),
        wu: me.user,
        bp: Number(target.userID),
        bu: target.user,
        timer: `${baseTotalSeconds}+${inc}`
      };
      const res = await createInvite(payload);
      setOutgoing({ ...payload, reqID: Number(res.reqID) });
      setMsg("Invite sent.");
    } catch (error) {
      setErr(error?.response?.data?.error || error?.response?.data?.message || error.message || "Cannot send invite");
    } finally {
      setLoading(false);
    }
  };

  const answerInvite = async (reqItem, accept) => {
    setPendingReq(reqItem.reqID);
    setErr("");
    setMsg("");
    try {
      if (!accept) {
        await respondInvite(reqItem.reqID, 0);
        setMsg("Invite declined.");
        setIncoming((prev) => prev.filter((item) => Number(item.reqID) !== Number(reqItem.reqID)));
        return;
      }

      const game = await createActiveGame({
        wp: Number(reqItem.wp),
        bp: Number(reqItem.bp),
        timer: reqItem.timer,
        startedTime: Date.now()
      });
      await respondInvite(reqItem.reqID, 1, Number(game.gameID));
      onGameCreated({
        gameID: Number(game.gameID),
        wp: Number(reqItem.wp),
        bp: Number(reqItem.bp),
        turn: Number(reqItem.wp),
        timer: reqItem.timer,
        started_time: Date.now(),
        record: null,
        move_number: null
      });
      setMsg("Invite accepted. Game started.");
    } catch (error) {
      setErr(error?.response?.data?.error || error?.response?.data?.message || "Cannot process invite");
    } finally {
      setPendingReq(null);
    }
  };

  return (
    <>
      <div className="new-game">
        <div className="panel-head">
          <h2>Invite Player</h2>
          <p>Create a live game invitation.</p>
        </div>
        <div className="field">
          <span className="field-label">Opponent</span>
          <select value={opp} onChange={(e) => setOpp(e.target.value)}>
            <option value="">{available.length ? "Select player" : "No players found"}</option>
            {available.map((u) => (
              <option key={u.userID} value={u.userID}>
                {u.user}
              </option>
            ))}
          </select>
        </div>
        <div className="time-mode-row">
          {modeOptions.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`btn btn-mode ${timeMode === m.id ? "is-active" : ""}`}
              onClick={() => setTimeMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className={`preset-row presets-${activePresets.length}`}>
          {activePresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={`btn btn-time ${baseTotalSeconds === preset.base && inc === preset.inc ? "is-active" : ""}`}
              onClick={() => {
                applyBaseSeconds(preset.base);
                setInc(preset.inc);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="timer-grid timer-grid-challenge">
          <label>
            Hours
            <input type="number" min="0" max="23" value={baseHours} onChange={(e) => setBaseHours(Number(e.target.value))} />
          </label>
          <label>
            Minutes
            <input type="number" min="0" max="59" value={baseMinutes} onChange={(e) => setBaseMinutes(Number(e.target.value))} />
          </label>
          <label>
            Seconds
            <input type="number" min="0" max="59" value={baseSeconds} onChange={(e) => setBaseSeconds(Number(e.target.value))} />
          </label>
          <label>
            Increment
            <input type="number" min="0" value={inc} onChange={(e) => setInc(Number(e.target.value))} />
          </label>
        </div>
        {msg ? <div className="success-box">{msg}</div> : null}
        {err ? <div className="error-box">{String(err)}</div> : null}
        <button className="btn btn-primary" onClick={sendInvite} disabled={loading || !available.length}>
          {loading ? "Sending..." : "Send Invite"}
        </button>
      </div>

      {outgoingIsLive ? (
        <div className="card">
          <h3>Outgoing Invite</h3>
          <p className="muted">Waiting for response</p>
          <div className="kv"><span>Req ID</span><strong>{outgoingIsLive.reqID}</strong></div>
          <div className="kv"><span>Timer</span><strong>{outgoingIsLive.timer}</strong></div>
        </div>
      ) : null}

      <div className="card">
        <h3>Incoming Invites</h3>
        <div className="invite-list">
          {incoming.length === 0 ? <div className="muted">No incoming invites.</div> : null}
          {incoming.map((reqItem) => {
            const isMineWhite = Number(reqItem.wp) === Number(me.userID);
            const oppName = isMineWhite ? reqItem.bu : reqItem.wu;
            return (
              <div key={reqItem.reqID} className="invite-item">
                <div className="invite-main">
                  <strong>{oppName}</strong>
                  <span>{reqItem.timer}</span>
                </div>
                <div className="invite-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => answerInvite(reqItem, true)}
                    disabled={pendingReq === reqItem.reqID}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => answerInvite(reqItem, false)}
                    disabled={pendingReq === reqItem.reqID}
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function App() {
  const [me, setMe] = useState(null);
  const [bootstrappingAuth, setBootstrappingAuth] = useState(true);
  const [userMap, setUserMap] = useState({});
  const [game, setGame] = useState(null);
  const [board, setBoard] = useState(getInitialBoard());
  const [selected, setSelected] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [dragPieceSize, setDragPieceSize] = useState(44);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [resigning, setResigning] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [drawOffer, setDrawOffer] = useState(0);
  const [confirmAction, setConfirmAction] = useState(null);
  const [boardScale, setBoardScale] = useState(70);
  const [boardTheme, setBoardTheme] = useState("classic");
  const [boardDirection, setBoardDirection] = useState("auto");
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);
  const [resizeState, setResizeState] = useState(null);
  const [localMoves, setLocalMoves] = useState([]);
  const [moveNumber, setMoveNumber] = useState(-1);
  const [tickNow, setTickNow] = useState(Date.now());
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [viewPly, setViewPly] = useState(0);
  const [timeoutSubmitting, setTimeoutSubmitting] = useState(false);
  const [resultModal, setResultModal] = useState(null);
  const prevRecordLenRef = useRef(0);
  const prevGameIdRef = useRef(null);
  const timeoutSentRef = useRef("");
  const audioCtxRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!saved) {
      setBootstrappingAuth(false);
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.user && parsed?.userID) {
        setMe(parsed);
      }
    } catch (error) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setBootstrappingAuth(false);
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(me));
    getActiveGame()
      .then((res) => {
        if (res?.game && !res.game.result) {
          setGame(res.game);
        } else {
          if (res?.game?.result) {
            openResultModal(res.game.result, res.game);
          }
          setGame(null);
          setStatus("");
        }
      })
      .catch((error) => {
        if (error?.response?.status === 403) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setMe(null);
          setGame(null);
          return;
        }
      });
  }, [me]);

  useEffect(() => {
    if (!me) return undefined;
    const syncUsers = async () => {
      try {
        const list = await getUsers();
        const map = {};
        (Array.isArray(list) ? list : []).forEach((u) => {
          map[Number(u.userID)] = u.user;
        });
        setUserMap(map);
      } catch (error) {
        // ignore
      }
    };
    syncUsers();
  }, [me]);

  useEffect(() => {
    if (!game) {
      setMoveNumber(-1);
      setChatMessages([]);
      return;
    }
    setMoveNumber(Number(game.move_number ?? -1));
  }, [game]);

  useEffect(() => {
    if (!me) return undefined;
    const socket = io(API_BASE_URL, {
      withCredentials: true,
      transports: ["websocket"]
    });
    const joinUser = () => socket.emit("join_user", { userID: Number(me.userID) });
    socketRef.current = socket;
    joinUser();
    socket.on("connect", joinUser);
    return () => {
      socket.emit("leave_user", { userID: Number(me.userID) });
      socket.off("connect", joinUser);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [me?.userID]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !me) return undefined;
    const onGameStarted = (payload) => {
      const myId = Number(me.userID);
      if (Number(payload?.wp) !== myId && Number(payload?.bp) !== myId) return;
      setGame({
        gameID: Number(payload.gameID),
        wp: Number(payload.wp),
        bp: Number(payload.bp),
        turn: Number(payload.turn ?? payload.wp),
        timer: payload.timer,
        started_time: Number(payload.started_time ?? Date.now()),
        record: payload.record || null,
        move_number: payload.move_number ?? null
      });
      setStatus("");
    };
    socket.on("game:started", onGameStarted);
    return () => {
      socket.off("game:started", onGameStarted);
    };
  }, [me?.userID]);

  useEffect(() => {
    if (!game || !me) {
      setDrawOffer(0);
      return;
    }
    getMessages(game.gameID)
      .then((res) => setChatMessages(Array.isArray(res?.messageList) ? res.messageList : []))
      .catch(() => {});
    getDrawOffer(game.gameID)
      .then((res) => setDrawOffer(Number(res?.drawOffer || 0)))
      .catch(() => setDrawOffer(0));
  }, [game?.gameID, me?.userID]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !me || !game?.gameID) return undefined;
    const gameID = Number(game.gameID);

    const syncActiveGame = async () => {
      try {
        const active = await getActiveGame();
        if (active?.game && Number(active.game.gameID) === gameID && !active.game.result) {
          setGame((prev) => {
            if ((prev?.record || "") !== (active.game.record || "")) {
              playMoveSound();
            }
            return active.game;
          });
          return;
        }
        if (active?.game?.result) {
          openResultModal(active.game.result, active.game);
        }
        setGame(null);
        setStatus("");
      } catch (error) {
        if (error?.response?.status === 403) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setMe(null);
          setGame(null);
        }
      }
    };

    const onMove = (payload) => {
      if (Number(payload?.gameID) !== gameID) return;
      syncActiveGame();
    };
    const onEnd = (payload) => {
      if (Number(payload?.gameID) !== gameID) return;
      openResultModal(payload?.result, game);
      setGame(null);
      setStatus("");
    };
    const onDraw = (payload) => {
      if (Number(payload?.gameID) !== gameID) return;
      const nextDraw = Number(payload?.drawOffer || 0);
      setDrawOffer(nextDraw);
      if (nextDraw === 3) {
        openResultModal("0,4", game);
        setGame(null);
        setStatus("");
      }
    };
    const onMessage = (payload) => {
      if (Number(payload?.gameID) !== gameID) return;
      setChatMessages((prev) => {
        const last = prev[prev.length - 1];
        if (
          last &&
          Number(last.userID) === Number(payload.userID) &&
          String(last.message || "") === String(payload.message || "")
        ) {
          return prev;
        }
        return [...prev, { userID: Number(payload.userID), message: payload.message }];
      });
    };

    const onConnect = () => socket.emit("join_game", { gameID });
    socket.emit("join_game", { gameID });
    socket.on("game:move", onMove);
    socket.on("game:end", onEnd);
    socket.on("game:draw", onDraw);
    socket.on("message:new", onMessage);
    socket.on("connect", onConnect);

    return () => {
      socket.emit("leave_game", { gameID });
      socket.off("game:move", onMove);
      socket.off("game:end", onEnd);
      socket.off("game:draw", onDraw);
      socket.off("message:new", onMessage);
      socket.off("connect", onConnect);
    };
  }, [me?.userID, game?.gameID]);

  useEffect(() => {
    const t = setInterval(() => setTickNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!resizeState) return undefined;
    const onMove = (e) => {
      const delta = e.clientX - resizeState.startX;
      const next = resizeState.startScale + delta * 0.08;
      setBoardScale(Math.max(55, Math.min(95, next)));
    };
    const onUp = () => setResizeState(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizeState]);

  const isWhite = useMemo(() => {
    if (!game || !me) return true;
    return Number(game.wp) === Number(me.userID);
  }, [game, me]);
  const recordMoves = useMemo(() => parseRecord(game?.record), [game?.record]);
  const activeMoves = game ? recordMoves : localMoves;
  const notationEntries = useMemo(() => buildNotationEntries(recordMoves), [recordMoves]);

  useEffect(() => {
    if (!game) return;
    const gameChanged = prevGameIdRef.current !== game.gameID;
    const prevLen = prevRecordLenRef.current;
    const nextLen = recordMoves.length;
    if (gameChanged) {
      setViewPly(nextLen);
    } else if (viewPly === prevLen) {
      setViewPly(nextLen);
    }
    prevGameIdRef.current = game.gameID;
    prevRecordLenRef.current = nextLen;
  }, [game?.gameID, recordMoves.length, viewPly]);

  useEffect(() => {
    if (game) return;
    setViewPly(localMoves.length);
  }, [game, localMoves.length]);

  useEffect(() => {
    const limit = activeMoves.length;
    const clamped = Math.max(0, Math.min(limit, viewPly));
    let next = getInitialBoard();
    for (let i = 0; i < clamped; i += 1) {
      const [from, to] = activeMoves[i];
      next = applyMove(next, from, to);
    }
    setBoard(next);
  }, [game?.gameID, activeMoves, viewPly]);

  const playMoveSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(410, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.045);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch (error) {
      // ignore audio failures
    }
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      const target = e.target;
      const tag = target?.tagName?.toLowerCase?.() || "";
      const isTyping = tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
      if (isTyping) return;
      const maxPly = activeMoves.length;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setViewPly((prev) => {
          const next = Math.max(0, prev - 1);
          if (next !== prev) playMoveSound();
          return next;
        });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setViewPly((prev) => {
          const next = Math.min(maxPly, prev + 1);
          if (next !== prev) playMoveSound();
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setViewPly((prev) => {
          const next = 0;
          if (next !== prev) playMoveSound();
          return next;
        });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setViewPly((prev) => {
          const next = maxPly;
          if (next !== prev) playMoveSound();
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [game?.gameID, activeMoves.length]);

  const legalTargets = useMemo(() => {
    const source = dragFrom !== null ? dragFrom : selected;
    if (source === null) return [];
    const currentHistory = activeMoves.slice(0, viewPly);
    return getLegalMoves(board, source, currentHistory);
  }, [board, selected, dragFrom, activeMoves, viewPly]);

  const orientedSquares = useMemo(() => {
    const arr = [];
    const autoPerspective =
      boardDirection === "white"
        ? "white"
        : boardDirection === "black"
          ? "black"
          : game && me && Number(game.bp) === Number(me.userID)
            ? "black"
            : "white";
    if (autoPerspective === "white") {
      for (let i = 0; i < 64; i += 1) arr.push(i);
      return arr;
    }
    for (let i = 63; i >= 0; i -= 1) arr.push(i);
    return arr;
  }, [boardDirection, game, me, isWhite]);

  const myTurn = game && me && Number(game.turn) === Number(me.userID);
  const sandboxMode = !game;
  const sandboxTurn = viewPly % 2 === 0 ? "w" : "b";
  const currentTurnColor = sandboxMode ? sandboxTurn : isWhite ? "w" : "b";
  const iAmWhite = game && me && Number(game.wp) === Number(me.userID);
  const iAmBlack = game && me && Number(game.bp) === Number(me.userID);
  const incomingDraw = (iAmWhite && drawOffer === 2) || (iAmBlack && drawOffer === 1);
  const outgoingDraw = (iAmWhite && drawOffer === 1) || (iAmBlack && drawOffer === 2);
  const theme = BOARD_THEMES[boardTheme] || BOARD_THEMES.classic;
  const whiteLabel = game
    ? Number(game.wp) === Number(me.userID)
      ? `${me.user} (You)`
      : userMap[Number(game.wp)] || `Player ${game.wp}`
    : "White";
  const blackLabel = game
    ? Number(game.bp) === Number(me.userID)
      ? `${me.user} (You)`
      : userMap[Number(game.bp)] || `Player ${game.bp}`
    : "Black";
  const clocks = computeClocks(game, tickNow);

  const openResultModal = (resultRaw, snapshot = game) => {
    const { winner, method } = parseGameResult(resultRaw);
    const methodLabel = {
      0: "checkmate",
      1: "time",
      2: "stalemate",
      3: "resignation",
      4: "draw agreement"
    }[method] || "game result";

    if (method === 4) {
      setResultModal({
        tone: "draw",
        title: "Draw",
        detail: "Game ended by draw agreement."
      });
      return;
    }

    const whiteWins = winner === 1;
    const winnerId = whiteWins ? Number(snapshot?.wp) : Number(snapshot?.bp);
    const winnerColor = whiteWins ? "White" : "Black";
    const winnerName = winnerId === Number(me?.userID) ? "You" : (userMap[winnerId] || winnerColor);
    const title = winnerId === Number(me?.userID) ? "You Won" : "You Lost";
    setResultModal({
      tone: winnerId === Number(me?.userID) ? "win" : "loss",
      title,
      detail: `${winnerName} won by ${methodLabel}.`
    });
  };

  useEffect(() => {
    if (!game || game.result || timeoutSubmitting) return;
    const currentTurn = Number(game.turn);
    const whiteToMove = currentTurn === Number(game.wp);
    const blackToMove = currentTurn === Number(game.bp);
    const timedOut = (whiteToMove && clocks.whiteMs <= 0) || (blackToMove && clocks.blackMs <= 0);
    if (!timedOut) return;

    const marker = `${game.gameID}:${Number(game.move_number ?? -1)}:${currentTurn}`;
    if (timeoutSentRef.current === marker) return;
    timeoutSentRef.current = marker;

    const winner = whiteToMove ? 0 : 1;
    const result = `${winner},1`;
    setTimeoutSubmitting(true);
    updateActiveGame(game.gameID, {
      wp: Number(game.wp),
      bp: Number(game.bp),
      result
    })
      .then(() => {
        openResultModal(result, game);
        setGame(null);
      })
      .catch(() => {
        // Another client/server may have finalized already; polling will reconcile.
      })
      .finally(() => setTimeoutSubmitting(false));
  }, [game?.gameID, game?.turn, game?.move_number, game?.result, clocks.whiteMs, clocks.blackMs, timeoutSubmitting]);

  const submitMove = async (from, to) => {
    if (sandboxMode) {
      setLocalMoves((prev) => {
        const base = viewPly < prev.length ? prev.slice(0, viewPly) : prev;
        const next = [...base, [from, to]];
        setViewPly(next.length);
        return next;
      });
      setBoard((prev) => applyMove(prev, from, to));
      setMoveNumber((prev) => prev + 1);
      playMoveSound();
      setStatus(`Sandbox move: ${indexToCoord(from)} -> ${indexToCoord(to)}`);
      return;
    }
    if (viewPly !== activeMoves.length) {
      setStatus("Return to latest position with Right Arrow before making moves.");
      return;
    }
    if (!game || !me || pending || resigning || game.result) return;
    setPending(true);
    const prevBoard = board;
    const prevGame = game;
    const prevMoveNum = moveNumber;
    try {
      const now = Date.now();
      const elapsed = Math.max(1, now - Number(game.started_time || now));

      setBoard((prev) => applyMove(prev, from, to));
      setMoveNumber((prev) => prev + 1);
      setGame((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          turn: Number(prev.turn) === Number(prev.wp) ? prev.bp : prev.wp,
          record: prev.record ? `${prev.record} ${from},${to}` : `${from},${to}`,
          timer: prev.timer ? `${prev.timer} ${elapsed}` : `${elapsed}`,
          started_time: now,
          i1: from,
          i2: to
        };
      });
      playMoveSound();
      setStatus(`Last move: ${indexToCoord(from)} -> ${indexToCoord(to)}`);

      await updateActiveGame(game.gameID, {
        wp: Number(game.wp),
        bp: Number(game.bp),
        result: null,
        move: `${from},${to}`,
        time: elapsed,
        i1: from,
        i2: to
      });
    } catch (error) {
      setBoard(prevBoard);
      setGame(prevGame);
      setMoveNumber(prevMoveNum);
      setStatus(error?.response?.data?.error || error?.response?.data?.message || "Move rejected");
    } finally {
      setPending(false);
    }
  };

  const onSquareClick = (index) => {
    if (!me || (game && game.result)) return;
    const piece = board[index];

    if (selected === null) {
      if (!piece) return;
      const mine = piece[0] === currentTurnColor;
      if (!mine || (!sandboxMode && !myTurn)) return;
      setSelected(index);
      return;
    }

    if (selected === index) {
      setSelected(null);
      return;
    }

    if (piece && sameSide(board[selected], piece)) {
      setSelected(index);
      return;
    }

    if (!legalTargets.includes(index)) {
      setSelected(null);
      return;
    }

    submitMove(selected, index);
    setSelected(null);
  };

  const onDragStartSquare = (index) => {
    if (!me || (game && game.result) || pending || resigning) return;
    const piece = board[index];
    if (!piece) return;
    const mine = piece[0] === currentTurnColor;
    if (!mine) return;
    if (!sandboxMode && !myTurn) return;
    setSelected(index);
    setDragFrom(index);
  };

  const onPieceMouseDown = (e, index) => {
    e.preventDefault();
    onDragStartSquare(index);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragPieceSize(Math.max(24, Math.round(rect.width)));
    setDragPos({ x: e.clientX, y: e.clientY });
  };

  const startResize = (e) => {
    e.preventDefault();
    setResizeState({
      startX: e.clientX,
      startScale: boardScale
    });
  };

  const onDropSquare = (index) => {
    if (dragFrom === null) return;
    if (index === dragFrom) {
      setDragFrom(null);
      return;
    }
    if (legalTargets.includes(index)) {
      submitMove(dragFrom, index);
    }
    setDragFrom(null);
    setSelected(null);
    setDragPos(null);
  };

  useEffect(() => {
    if (dragFrom === null) return undefined;
    const onMove = (e) => {
      setDragPos({ x: e.clientX, y: e.clientY });
    };
    const onUp = (e) => {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const squareEl = target?.closest?.("[data-square-index]");
      if (squareEl) {
        const idx = Number(squareEl.getAttribute("data-square-index"));
        if (Number.isInteger(idx)) onDropSquare(idx);
        else {
          setDragFrom(null);
          setSelected(null);
          setDragPos(null);
        }
      } else {
        setDragFrom(null);
        setSelected(null);
        setDragPos(null);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragFrom, legalTargets, viewPly, activeMoves.length, game, me, pending, resigning, sandboxMode, myTurn]);

  const resign = async () => {
    if (!game || !me || game.result || resigning || pending) return;
    setResigning(true);
    try {
      const winner = isWhite ? 0 : 1;
      const result = `${winner},3`;
      await updateActiveGame(game.gameID, {
        wp: Number(game.wp),
        bp: Number(game.bp),
        result
      });
      openResultModal(result, game);
      setGame(null);
    } catch (error) {
      setGame((prev) => (prev ? { ...prev, result: null } : prev));
      setStatus("Cannot resign now.");
    } finally {
      setResigning(false);
    }
  };

  const requestOrAcceptDraw = async () => {
    if (!game || !me || game.result || drawing || pending) return;
    setDrawing(true);
    try {
      const isWhiteSide = Number(game.wp) === Number(me.userID);
      const offeringDraw = isWhiteSide ? 1 : 2;
      await updateDrawOffer(game.gameID, {
        offeringDraw,
        wp: Number(game.wp),
        bp: Number(game.bp)
      });
      setStatus(incomingDraw ? "Draw accepted." : "Draw offered.");
      if (incomingDraw) {
        openResultModal("0,4", game);
        setGame(null);
      }
    } catch (error) {
      setStatus(error?.response?.data?.msg || "Cannot update draw offer.");
    } finally {
      setDrawing(false);
    }
  };

  const openConfirm = (kind) => {
    if (!game || !me || pending || resigning || drawing || game.result) return;
    setConfirmAction(kind);
  };

  const handleConfirmAction = async () => {
    if (confirmAction === "resign") {
      await resign();
    } else if (confirmAction === "draw") {
      await requestOrAcceptDraw();
    }
    setConfirmAction(null);
  };

  const submitChat = async (e) => {
    e.preventDefault();
    if (!game || !chatInput.trim() || chatLoading) return;
    setChatLoading(true);
    try {
      const text = chatInput.trim();
      await sendMessage(game.gameID, text);
      setChatInput("");
      setChatMessages((prev) => [...prev, { userID: Number(me.userID), message: text }]);
    } catch (error) {
      setStatus("Failed to send chat message.");
    } finally {
      setChatLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setMe(null);
    setGame(null);
    setStatus("");
  };

  if (bootstrappingAuth) return <div className="auth-shell"><div className="auth-card">Restoring session...</div></div>;
  if (!me) return <AuthCard onSuccess={setMe} />;

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <img src="/assets/logo.png" alt="Chess" />
          <span>könig</span>
        </div>
        <div className="me">
          Signed in as <strong>{me.user}</strong>
          <button className="btn btn-quiet logout-btn" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="layout">
        <section
          className="board-panel"
          style={{
            "--light-square": theme.light,
            "--dark-square": theme.dark
          }}
        >
          <div className="player-strip" style={{ "--board-scale": boardScale }}>
            <span className="dot black" />
            <span>{blackLabel}</span>
            <span className="clock-pill">{clocks.black}</span>
          </div>
          <div className="board-resize-wrap" style={{ "--board-scale": boardScale }}>
            <div className="board-wrap">
              <div className="board">
                {orientedSquares.map((index) => {
                  const [r, c] = toRowCol(index);
                  const dark = (r + c) % 2 === 1;
                  const piece = board[index];
                  const renderedPiece = dragFrom === index ? null : piece;
                  const isSelected = selected === index;
                  const isLegal = legalTargets.includes(index);
                  return (
                    <button
                      key={index}
                      data-square-index={index}
                      className={`square ${dark ? "dark" : "light"} ${isSelected ? "selected" : ""} ${isLegal ? "legal" : ""} ${isLegal && piece ? "capture" : ""}`}
                      onClick={() => onSquareClick(index)}
                    >
                      {renderedPiece ? (
                        <img
                          src={`/assets/pieces/${renderedPiece}.png`}
                          alt={renderedPiece}
                          draggable={false}
                          onMouseDown={(e) => onPieceMouseDown(e, index)}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              className={`board-settings-handle ${boardSettingsOpen ? "active" : ""}`}
              onClick={() => setBoardSettingsOpen((v) => !v)}
              title="Board settings"
              aria-label="Board settings"
            >
              {"\u2699"}
            </button>
            <button
              type="button"
              className={`board-resize-handle ${resizeState ? "active" : ""}`}
              onMouseDown={startResize}
              title="Drag to resize board"
              aria-label="Drag to resize board"
            >
              {"\u2194"}
            </button>
            {dragFrom !== null && dragPos && board[dragFrom] ? (
              <img
                className="drag-ghost"
                src={`/assets/pieces/${board[dragFrom]}.png`}
                alt=""
                style={{
                  width: `${dragPieceSize}px`,
                  height: `${dragPieceSize}px`,
                  left: `${dragPos.x - dragPieceSize / 2}px`,
                  top: `${dragPos.y - dragPieceSize / 2}px`
                }}
              />
            ) : null}
          </div>
          <div className="player-strip" style={{ "--board-scale": boardScale }}>
            <span className="dot white" />
            <span>{whiteLabel}</span>
            <span className="clock-pill">{clocks.white}</span>
          </div>
          {status ? (
            <div className="status" style={{ "--board-scale": boardScale }}>
              <span>{status}</span>
            </div>
          ) : null}
        </section>

        <aside className="side-panel">
          {game ? (
            <>
              <div className="card">
                <h3>Move Record</h3>
                <div className="moves">
                  {Array.from({ length: Math.ceil(notationEntries.length / 2) }, (_, rowIdx) => {
                    const w = notationEntries[rowIdx * 2];
                    const b = notationEntries[rowIdx * 2 + 1];
                    return (
                      <div key={`mrow-${rowIdx}`} className="move-row">
                        <span>{rowIdx + 1}.</span>
                        <span className="move-cell">
                          <span className="move-piece-slot">
                            {w?.pieceCode && !(w?.notation || "").startsWith("O-O")
                              ? <img src={`/assets/pieces/${w.pieceCode}.png`} alt={w.pieceCode} className="move-piece" />
                              : null}
                          </span>
                          <span className="move-notation">{w?.notation || "-"}</span>
                        </span>
                        <span className="move-cell">
                          <span className="move-piece-slot">
                            {b?.pieceCode && !(b?.notation || "").startsWith("O-O")
                              ? <img src={`/assets/pieces/${b.pieceCode}.png`} alt={b.pieceCode} className="move-piece" />
                              : null}
                          </span>
                          <span className="move-notation">{b?.notation || ""}</span>
                        </span>
                      </div>
                    );
                  })}
                  {!game.record ? <span className="muted">No moves yet.</span> : null}
                </div>
                <div className="kv"><span>Moves</span><strong>{Math.max(0, moveNumber + 1)}</strong></div>
                <div className="game-actions">
                  <button className="btn btn-action-draw" onClick={() => openConfirm("draw")} disabled={drawing || resigning || outgoingDraw}>
                    {drawing ? "Processing..." : incomingDraw ? "Accept Draw" : outgoingDraw ? "Draw Offered" : "Offer Draw"}
                  </button>
                  <button className="btn btn-action-resign" onClick={() => openConfirm("resign")} disabled={resigning || drawing}>
                    {resigning ? <span className="spinner" /> : null}
                    {resigning ? "Resigning..." : "Resign"}
                  </button>
                </div>
              </div>

              <div className="card">
                <h3>In-Game Chat</h3>
                <div className="chat-list">
                  {chatMessages.length === 0 ? <div className="muted">No messages yet.</div> : null}
                  {chatMessages.map((item, idx) => {
                    const mine = Number(item.userID) === Number(me.userID);
                    const name = mine ? "You" : userMap[Number(item.userID)] || `Player ${item.userID}`;
                    return (
                      <div key={`${item.userID}-${idx}`} className={`chat-item ${mine ? "mine" : ""}`}>
                        <div className="chat-meta">{name}</div>
                        <div>{item.message}</div>
                      </div>
                    );
                  })}
                </div>
                <form className="chat-form" onSubmit={submitChat}>
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                  />
                  <button className="btn btn-primary" type="submit" disabled={chatLoading || !chatInput.trim()}>
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <InviteHub me={me} onGameCreated={setGame} socketRef={socketRef} />
          )}
          </aside>
      </main>
      {boardSettingsOpen ? (
        <div className="board-settings-modal-backdrop" onClick={() => setBoardSettingsOpen(false)}>
          <div className="board-settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="board-settings-header">
              <h3>Board Settings</h3>
              <button
                type="button"
                className="btn btn-quiet board-settings-close"
                onClick={() => setBoardSettingsOpen(false)}
                aria-label="Close board settings"
              >
                X
              </button>
            </div>
            <div className="settings-row">
              <span className="field-label">Board Size</span>
              <div className="board-size-inline">
                <input
                  type="range"
                  min="55"
                  max="95"
                  value={Math.round(boardScale)}
                  onChange={(e) => setBoardScale(Math.max(55, Math.min(95, Number(e.target.value))))}
                />
                <span>{Math.round(boardScale)}%</span>
              </div>
            </div>
            <div className="settings-row">
              <span className="field-label">Direction</span>
              <div className="segmented">
                <button
                  type="button"
                  className={`btn btn-quiet ${boardDirection === "auto" ? "is-active" : ""}`}
                  onClick={() => setBoardDirection("auto")}
                >
                  Auto
                </button>
                <button
                  type="button"
                  className={`btn btn-quiet ${boardDirection === "white" ? "is-active" : ""}`}
                  onClick={() => setBoardDirection("white")}
                >
                  White
                </button>
                <button
                  type="button"
                  className={`btn btn-quiet ${boardDirection === "black" ? "is-active" : ""}`}
                  onClick={() => setBoardDirection("black")}
                >
                  Black
                </button>
              </div>
            </div>
            <div className="settings-row">
              <span className="field-label">Theme</span>
              <div className="segmented">
                {Object.entries(BOARD_THEMES).map(([id, item]) => (
                  <button
                    key={id}
                    type="button"
                    className={`btn btn-quiet ${boardTheme === id ? "is-active" : ""}`}
                    onClick={() => setBoardTheme(id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {confirmAction ? (
        <div className="board-settings-modal-backdrop" onClick={() => setConfirmAction(null)}>
          <div className="action-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmAction === "resign" ? "Confirm Resign" : incomingDraw ? "Accept Draw" : "Offer Draw"}</h3>
            <p className="muted">
              {confirmAction === "resign"
                ? "Are you sure you want to resign this game?"
                : incomingDraw
                  ? "Are you sure you want to accept this draw?"
                  : "Are you sure you want to offer a draw?"}
            </p>
            <div className="confirm-actions">
              <button className="btn btn-quiet" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className={`btn ${confirmAction === "resign" ? "btn-action-resign" : "btn-action-draw"}`} onClick={handleConfirmAction}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {resultModal ? (
        <div className="board-settings-modal-backdrop" onClick={() => setResultModal(null)}>
          <div className="action-confirm-modal game-result-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`result-chip ${resultModal.tone || "draw"}`}>
              {resultModal.tone === "win" ? "Victory" : resultModal.tone === "loss" ? "Defeat" : "Draw"}
            </div>
            <h3>{resultModal.title}</h3>
            <p className="result-detail">{resultModal.detail}</p>
            <div className="confirm-actions">
              <button className="btn btn-primary" onClick={() => setResultModal(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;


