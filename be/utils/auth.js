const jwt = require("jsonwebtoken");

function getJwtSecret() {
  return process.env.JWT_SECRET || process.env.API_KEY || "";
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx <= 0) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (!key) return;
    out[key] = decodeURIComponent(value);
  });
  return out;
}

function extractUserIdFromCookieHeader(cookieHeader) {
  const cookies = parseCookies(cookieHeader);
  const payload = cookies.token_payload;
  const signature = cookies.token_signature;
  if (!payload || !signature) return null;
  const token = `${payload}${signature}`;
  const secret = getJwtSecret();
  if (!secret) return null;
  const decoded = jwt.verify(token, secret);
  return Number(decoded?.userID) || null;
}

module.exports = {
  getJwtSecret,
  parseCookies,
  extractUserIdFromCookieHeader
};
