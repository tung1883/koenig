import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { SOCKET_BASE_URL } from "../api";

function useGameRealtime({
  me,
  game,
  setGame,
  setStatus,
  setDrawOffer,
  setChatMessages,
  openResultModal,
  playMoveSound
}) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!me) return undefined;
    const socket = io(SOCKET_BASE_URL, {
      withCredentials: true,
      path: "/socket.io",
      transports: ["websocket", "polling"],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000
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
  }, [me?.userID, setGame, setStatus]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !me || !game?.gameID) return undefined;
    const gameID = Number(game.gameID);

    const onMove = (payload) => {
      if (Number(payload?.gameID) !== gameID) return;
      setGame((prev) => {
        if (!prev || Number(prev.gameID) !== gameID) return prev;
        const nextRecord = String(payload?.record || "");
        if (nextRecord && nextRecord !== String(prev.record || "")) {
          playMoveSound();
        }
        return {
          ...prev,
          i1: payload?.i1 ?? prev.i1,
          i2: payload?.i2 ?? prev.i2,
          time_spent: payload?.timeSpent ?? prev.time_spent,
          move_number: payload?.moveNumber ?? prev.move_number,
          record: payload?.record ?? prev.record,
          turn: payload?.turn ?? prev.turn,
          timer: payload?.timer ?? prev.timer,
          started_time: payload?.started_time ?? prev.started_time
        };
      });
    };
    const onState = (payload) => {
      if (Number(payload?.gameID) !== gameID) return;
      if (payload?.game) {
        setGame((prev) => {
          if (!prev || Number(prev.gameID) !== gameID) return payload.game;
          return { ...prev, ...payload.game };
        });
      }
      setDrawOffer(Number(payload?.drawOffer || 0));
      setChatMessages(Array.isArray(payload?.messages) ? payload.messages : []);
    };
    const onEnd = (payload) => {
      if (Number(payload?.gameID) !== gameID) return;
      openResultModal(payload?.result, {
        gameID,
        wp: game?.wp,
        bp: game?.bp
      });
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
    socket.on("game:state", onState);
    socket.on("game:end", onEnd);
    socket.on("game:draw", onDraw);
    socket.on("message:new", onMessage);
    socket.on("connect", onConnect);

    return () => {
      socket.emit("leave_game", { gameID });
      socket.off("game:move", onMove);
      socket.off("game:state", onState);
      socket.off("game:end", onEnd);
      socket.off("game:draw", onDraw);
      socket.off("message:new", onMessage);
      socket.off("connect", onConnect);
    };
  }, [
    me?.userID,
    game?.gameID,
    game?.wp,
    game?.bp,
    openResultModal,
    playMoveSound,
    setChatMessages,
    setDrawOffer,
    setGame,
    setStatus
  ]);

  return socketRef;
}

export default useGameRealtime;
