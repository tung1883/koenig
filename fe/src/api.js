import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL;
if (!API_BASE_URL) {
  throw new Error("Missing VITE_API_URL. Create fe/.env from fe/.env.example.");
}

const isAbsoluteApiUrl = /^https?:\/\//i.test(API_BASE_URL);
export const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_URL || (isAbsoluteApiUrl ? API_BASE_URL : window.location.origin);

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

export const authApi = {
  async signIn(user, pwd) {
    const res = await api.post("/users/sign_in", { user, pwd });
    return res.data;
  },
  async signUp(user, pwd) {
    const res = await api.post("/users/sign_up", { user, pwd });
    return res.data;
  },
  async requestResetToken(user) {
    const res = await api.post("/users/reset_pwd/request", { user });
    return res.data;
  },
  async resetPassword(user, pwd, token) {
    const res = await api.post("/users/reset_pwd", { user, pwd, token });
    return res.data;
  }
};

export const usersApi = {
  async getUsers() {
    const res = await api.get("/users");
    return res.data;
  },
  async getMyProfile() {
    const res = await api.get("/users/me/profile");
    return res.data;
  },
  async updateMyProfile(payload) {
    const res = await api.put("/users/me/profile", payload);
    return res.data;
  },
  async uploadMyAvatar(imageData) {
    const res = await api.post("/users/me/avatar", { imageData });
    return res.data;
  },
  async getProfile(userID) {
    const res = await api.get(`/users/profile/${userID}`);
    return res.data;
  },
  async getUsername(userID) {
    const res = await api.post("/users", { userID });
    return res.data;
  }
};

export const activeGameApi = {
  async getActiveGame() {
    const res = await api.get("/game/new/active");
    return res.data;
  },
  async createActiveGame(payload) {
    const res = await api.post("/game/new/active", payload);
    return res.data;
  },
  async getLastMove(gameID) {
    const res = await api.get(`/game/new/active/${gameID}`);
    return res.data;
  },
  async updateActiveGame(gameID, payload) {
    const res = await api.post(`/game/new/active/${gameID}`, payload);
    return res.data;
  },
  async getDrawOffer(gameID) {
    const res = await api.get(`/game/new/active/draw/${gameID}`);
    return res.data;
  },
  async updateDrawOffer(gameID, payload) {
    const res = await api.post(`/game/new/active/draw/${gameID}`, payload);
    return res.data;
  }
};

export const inviteApi = {
  async createInvite(payload) {
    const res = await api.post("/game/request", payload);
    return res.data;
  },
  async getIncomingInvites() {
    const res = await api.get("/game/request/receive");
    return res.data;
  },
  async getOutgoingInvite() {
    const res = await api.get("/game/request/send");
    return res.data;
  },
  async getInviteState(reqID) {
    const res = await api.get(`/game/request/${reqID}`);
    return res.data;
  },
  async respondInvite(reqID, action, gameID) {
    const res = await api.post("/game/request/res", { reqID, action, gameID });
    return res.data;
  },
  async acceptInvite(reqID) {
    const res = await api.post(`/game/request/${reqID}/accept`);
    return res.data;
  }
};

export const messageApi = {
  async getMessages(gameID) {
    const res = await api.get(`/game/message/${gameID}`);
    return res.data;
  },
  async sendMessage(gameID, message) {
    const res = await api.post(`/game/message/${gameID}`, { message });
    return res.data;
  }
};
