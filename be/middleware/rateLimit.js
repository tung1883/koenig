const buckets = new Map();

function nowMs() {
  return Date.now();
}

function getClientIP(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || "unknown";
}

function createRateLimiter({ windowMs, max, keyPrefix }) {
  const safeWindow = Math.max(1000, Number(windowMs) || 60000);
  const safeMax = Math.max(1, Number(max) || 60);
  const prefix = keyPrefix || "global";

  return (req, res, next) => {
    const ip = getClientIP(req);
    const key = `${prefix}:${ip}`;
    const ts = nowMs();
    const existing = buckets.get(key);

    if (!existing || ts - existing.windowStart >= safeWindow) {
      buckets.set(key, { windowStart: ts, count: 1 });
      return next();
    }

    if (existing.count >= safeMax) {
      const retryAfterSec = Math.ceil((safeWindow - (ts - existing.windowStart)) / 1000);
      res.setHeader("retry-after", String(Math.max(1, retryAfterSec)));
      return res.status(429).send({ error: "Too many requests. Please slow down." });
    }

    existing.count += 1;
    buckets.set(key, existing);
    return next();
  };
}

module.exports = {
  createRateLimiter
};
