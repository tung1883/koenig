import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL;
if (!API_BASE_URL) {
  throw new Error("Missing VITE_API_URL. Create fe/.env from fe/.env.example.");
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

export async function signIn(user, pwd) {
  const res = await api.post("/users/sign_in", { user, pwd });
  return res.data;
}

export async function signUp(user, pwd) {
  const res = await api.post("/users/sign_up", { user, pwd });
  return res.data;
}

export async function resetPassword(user, pwd) {
  const res = await api.post("/users/reset_pwd", { user, pwd });
  return res.data;
}

export async function getUsers() {
  const res = await api.get("/users");
  return res.data;
}

export async function getActiveGame() {
  const res = await api.get("/game/new/active");
  return res.data;
}

export async function createActiveGame(payload) {
  const res = await api.post("/game/new/active", payload);
  return res.data;
}

export async function getLastMove(gameID) {
  const res = await api.get(`/game/new/active/${gameID}`);
  return res.data;
}

export async function updateActiveGame(gameID, payload) {
  const res = await api.post(`/game/new/active/${gameID}`, payload);
  return res.data;
}

export async function createInvite(payload) {
  const res = await api.post("/game/request", payload);
  return res.data;
}

export async function getIncomingInvites() {
  const res = await api.get("/game/request/receive");
  return res.data;
}

export async function getOutgoingInvite() {
  const res = await api.get("/game/request/send");
  return res.data;
}

export async function getInviteState(reqID) {
  const res = await api.get(`/game/request/${reqID}`);
  return res.data;
}

export async function respondInvite(reqID, action, gameID) {
  const res = await api.post("/game/request/res", {
    reqID,
    action,
    gameID
  });
  return res.data;
}

export async function getDrawOffer(gameID) {
  const res = await api.get(`/game/new/active/draw/${gameID}`);
  return res.data;
}

export async function updateDrawOffer(gameID, payload) {
  const res = await api.post(`/game/new/active/draw/${gameID}`, payload);
  return res.data;
}

export async function getMessages(gameID) {
  const res = await api.get(`/game/message/${gameID}`);
  return res.data;
}

export async function sendMessage(gameID, message) {
  const res = await api.post(`/game/message/${gameID}`, { message });
  return res.data;
}
