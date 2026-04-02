const { randomUUID } = require("crypto");

const state = {
  httpRequestsTotal: new Map(),
  httpDurationMsTotal: new Map(),
  socketConnections: 0,
  socketEventsTotal: new Map()
};

function incMap(map, key, by = 1) {
  map.set(key, (map.get(key) || 0) + by);
}

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  req.requestID = req.headers["x-request-id"] || randomUUID();
  res.setHeader("x-request-id", req.requestID);

  res.on("finish", () => {
    const durMs = Number(process.hrtime.bigint() - start) / 1e6;
    const route = req.route?.path || req.path || "unknown";
    const key = `${req.method}|${route}|${res.statusCode}`;
    incMap(state.httpRequestsTotal, key, 1);
    incMap(state.httpDurationMsTotal, key, durMs);
  });

  next();
}

function recordSocketConnection(delta) {
  state.socketConnections += delta;
  if (state.socketConnections < 0) state.socketConnections = 0;
}

function recordSocketEvent(name) {
  incMap(state.socketEventsTotal, name, 1);
}

function formatMetrics() {
  const lines = [];
  lines.push("# HELP koenig_http_requests_total Total HTTP requests by method|route|status");
  lines.push("# TYPE koenig_http_requests_total counter");
  for (const [k, v] of state.httpRequestsTotal.entries()) {
    lines.push(`koenig_http_requests_total{key="${k}"} ${v}`);
  }

  lines.push("# HELP koenig_http_duration_ms_total Total accumulated HTTP duration in ms by method|route|status");
  lines.push("# TYPE koenig_http_duration_ms_total counter");
  for (const [k, v] of state.httpDurationMsTotal.entries()) {
    lines.push(`koenig_http_duration_ms_total{key="${k}"} ${v.toFixed(3)}`);
  }

  lines.push("# HELP koenig_socket_connections Current socket connection count");
  lines.push("# TYPE koenig_socket_connections gauge");
  lines.push(`koenig_socket_connections ${state.socketConnections}`);

  lines.push("# HELP koenig_socket_events_total Total socket events observed");
  lines.push("# TYPE koenig_socket_events_total counter");
  for (const [k, v] of state.socketEventsTotal.entries()) {
    lines.push(`koenig_socket_events_total{event="${k}"} ${v}`);
  }

  return `${lines.join("\n")}\n`;
}

module.exports = {
  metricsMiddleware,
  recordSocketConnection,
  recordSocketEvent,
  formatMetrics
};
