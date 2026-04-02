import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL, activeGameApi } from "../api";

function useGameRealtime({
  me,
  game,
  setGame,
  setStatus,
  setDrawOffer,
  setChatMessages,
  setMe,
  clearSession,
  openResultModal,
  playMoveSound
}) {
  const socketRef = useRef(null);

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
  }, [me?.userID, setGame, setStatus]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !me || !game?.gameID) return undefined;
    const gameID = Number(game.gameID);

    const syncActiveGame = async () => {
      try {
        const active = await activeGameApi.getActiveGame();
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
          clearSession();
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
  }, [
    me?.userID,
    game?.gameID,
    game,
    clearSession,
    openResultModal,
    playMoveSound,
    setChatMessages,
    setDrawOffer,
    setGame,
    setMe,
    setStatus
  ]);

  return socketRef;
}

export default useGameRealtime;
