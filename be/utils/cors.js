const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5200",
  "http://127.0.0.1:5200",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
];

function getAllowedOrigins() {
  const raw = process.env.CORS_ORIGINS || "";
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin);
}

function buildCorsOptions() {
  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    },
    optionsSuccessStatus: 200,
    credentials: true
  };
}

module.exports = {
  getAllowedOrigins,
  isOriginAllowed,
  buildCorsOptions
};
