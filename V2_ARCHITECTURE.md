# Chess Web V2 Architecture

## 1) Objectives
- Make backend the single source of truth for legality and results.
- Eliminate trust in client-controlled identity/room joins.
- Reduce live update latency and backend load.
- Improve maintainability with clearer domain boundaries.

## 2) Problems in V1
- Frontend validates legality; backend accepts index moves.
- Socket rooms can be joined using client-provided identifiers.
- Invite acceptance is split into multiple client calls.
- Some data paths still rely on polling.
- Password reset mechanism is insecure for production.
- Broad CORS/cookie configuration increases attack surface.

## 3) Target System Design

### 3.1 Backend layers
- API Layer:
- Input validation, auth, authorization, error normalization.

- Domain Layer:
- `InviteService`
- `GameService`
- `ClockService`
- `ResultService`
- `ChatService`

- Engine Layer:
- Chess rules and legality (`validateMove`, `isCheck`, `isMate`, `isStalemate`, castling/en-passant/promotion).

- Realtime Layer:
- Socket gateway + room authorization + event fanout.

- Persistence Layer:
- Repositories for game/invite/chat/audit.

### 3.2 Frontend layers
- `useAuthSession`
- `useSocketConnection`
- `useInviteFeed`
- `useGameSession`
- `useBoardState`
- `useChatFeed`
- Presentation components consume hook state only.

## 4) Security Model

### 4.1 Websocket authentication
- Authenticate at handshake using secure session/JWT cookie.
- Store trusted `socket.userID` server-side.
- Reject room joins when `userID` is not authorized.

### 4.2 HTTP security
- Explicit CORS allowlist (dev/staging/prod).
- CSRF protection for cookie-auth mutation endpoints.
- Request validation schemas for all routes.
- Per-route rate limiting and abuse throttling.

### 4.3 Identity/session
- Short access lifetime + refresh rotation (recommended).
- Tokenized reset-password flow with one-time expiry.
- Audit logs for auth-sensitive events.

## 5) Authoritative Gameplay Design

### 5.1 Move command contract
- Endpoint: `POST /game/:gameID/commands/move`
- Body: `{ from, to, promotion? }`
- Server validates:
- player turn
- move legality
- king safety
- terminal state
- clock impact

### 5.2 Result authority
- Server finalizes:
- checkmate/stalemate
- timeout
- resignation
- draw agreement
- disconnect timeout outcomes

### 5.3 Time authority
- Server calculates elapsed time from server timestamps only.
- Frontend clock is presentation-only and reconciles on authoritative events.

## 6) Invite and Match Start Design

### 6.1 Atomic invite acceptance
- Endpoint: `POST /game/request/:reqID/accept`
- Single DB transaction:
- lock request row
- validate permission + not expired/processed
- create game + active_game + drawOffers
- mark request accepted/consumed
- commit

### 6.2 Realtime invite events
- `invite:new`
- `invite:accepted`
- `invite:declined`
- `invite:expired`
- `game:started`

All payloads should include:
- ids (`reqID`, `gameID`, players)
- timer config
- timestamps
- event version field (`v`)

## 7) Realtime Event Contract (V2)

### 7.1 Game events
- `game:state` full snapshot on join/reconnect.
- `game:move` incremental authoritative update.
- `game:result` terminal event.
- `game:draw` offer state transitions.

### 7.2 Chat events
- `chat:new` with stable ordering fields (`id`, `created_at`).

### 7.3 Reliability pattern
- Add monotonic `seq` per game event stream.
- Client drops duplicate/out-of-order events and requests `game:state` resync when gap detected.

## 8) Data Model Evolution

### 8.1 Game result
- Replace compact string with explicit fields:
- `winner` enum (`white|black|draw`)
- `end_method` enum (`mate|time|stalemate|resign|draw|disconnect`)

### 8.2 Chat
- Add `message_id` PK + `created_at`.
- Query by `(created_at, message_id)` for deterministic ordering.

### 8.3 Audit/event log (recommended)
- Append-only event table for key domain events.
- Useful for debugging, reconciliation, and analytics.

## 9) API Design Guidelines
- Commands mutate state; queries fetch snapshots.
- Stable envelope:
- success: `{ ok: true, data }`
- error: `{ ok: false, code, message }`
- Version API (`/v2/...`) to avoid breaking current clients.

## 10) Performance Plan
- Event-driven updates first; avoid fetch-after-event when payload is authoritative.
- Fallback resync only on reconnect/desync.
- DB index tuning for hot paths:
- active game by player
- request by receiver/status
- message by game and timestamp

## 11) Testing Strategy
- Engine unit tests for legality edge cases.
- Integration tests for invite lifecycle and transactional acceptance.
- Contract tests for websocket payload schemas.
- Load tests:
- concurrent games
- event fanout latency
- reconnect storms

## 12) Observability
- Correlation IDs across REST + websocket.
- Metrics:
- command latency
- websocket delivery lag
- room size/fanout
- DB query latency
- Alerts:
- auth failures
- move reject spikes
- event backlog growth

## 13) Migration Plan
- Step 1: websocket auth + room authorization + strict CORS + validation.
- Step 2: backend move legality engine + authoritative result flow.
- Step 3: atomic invite acceptance endpoint + unified event schema.
- Step 4: frontend modular hooks and event-driven stores.
- Step 5: load testing + dashboards + gradual rollout.

---
Last updated: 2026-04-02
