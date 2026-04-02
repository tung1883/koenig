# Chess Web Project Spec

## 1) Overview
- Monorepo with:
- `fe/`: React + Vite frontend.
- `be/`: Express + MySQL backend.
- Main domain features:
- Auth (sign in/up/reset password).
- Player invites/challenges.
- Live game (moves, draw, resign, timeout).
- In-game chat.
- Move history + notation UI.
- Realtime architecture:
- Socket.IO for live updates (invites, game state, chat, draw).
- REST for initial fetches and mutations.

## 2) Tech Stack
- Frontend:
- React 18
- Vite
- Axios
- Socket.IO client
- Backend:
- Express
- MySQL / mysql2
- JWT
- bcrypt
- Socket.IO

## 3) Repository Layout
- Frontend:
- `C:\Users\Tung\Documents\work\chess_web\fe\src\App.jsx`
- `C:\Users\Tung\Documents\work\chess_web\fe\src\api.js`
- `C:\Users\Tung\Documents\work\chess_web\fe\src\main.jsx`
- `C:\Users\Tung\Documents\work\chess_web\fe\src\styles.css`
- Backend:
- `C:\Users\Tung\Documents\work\chess_web\be\app.js`
- `C:\Users\Tung\Documents\work\chess_web\be\bin\www`
- `C:\Users\Tung\Documents\work\chess_web\be\routes\game.js`
- `C:\Users\Tung\Documents\work\chess_web\be\routes\users.js`
- `C:\Users\Tung\Documents\work\chess_web\be\controller\*.controller.js`
- `C:\Users\Tung\Documents\work\chess_web\be\schema.sql`

## 4) Runtime Flow
- User signs in via REST, receives JWT split across cookies.
- Frontend opens Socket.IO connection.
- Frontend joins:
- `user:<userID>` room for invite/noti/game-start events.
- `game:<gameID>` room only when an active game exists.
- Live game updates are pushed via websocket events.
- REST is still used for:
- write actions (move, draw update, invite actions, chat send).
- one-time snapshots (active game, chat history, draw state) when entering a game/session.

## 5) Database Schema (Summary)
Defined in: `be/schema.sql`

- `user`
- `userID` PK, `user` unique, `pwd` hashed.

- `game`
- Finished/persisted games.
- `result`: format `"winner,method"`.
- `record`: move list like `"i1,i2 i1,i2 ..."`
- `timer`: base/increment and time-spent entries.

- `active_game`
- Current live game state:
- `wp`, `bp`, `turn`
- `timer`, `started_time`
- `record`, `move_number`, `time_spent`
- `i1`, `i2` (last move indices)
- `result` when ended

- `drawOffers`
- Draw state bitfield per game.

- `request`
- Invite/challenge requests.
- Includes requester/opponent identity + timer.
- `gameID` set when accepted.

- `message`
- In-game chat rows: `(gameID, userID, message)`.

## 6) Auth Model
- JWT secret from `JWT_SECRET` (fallback `API_KEY`).
- Cookies set on sign-in:
- `token_payload`
- `token_signature`
- `user`
- `userID`
- Protected game routes use `verifyToken` middleware and trust `res.locals.userID`.

## 7) WebSocket Spec
Server setup in `be/bin/www`.

### Client -> Server events
- `join_user` `{ userID }`
- `leave_user` `{ userID }`
- `join_game` `{ gameID }`
- `leave_game` `{ gameID }`

### Server -> Client events
- Invite lifecycle:
- `invite:new`
- `invite:accepted`
- `invite:declined`
- `invite:expired`

- Game lifecycle:
- `game:started`
- `game:move`
- `game:draw`
- `game:end`

- Chat:
- `message:new`

### Room model
- User room: `user:<userID>`
- Game room: `game:<gameID>`

## 8) REST API Spec

Base URL:
- FE uses `VITE_API_URL`, fallback `http://localhost:8000`.

### 8.1 User/Auth routes (`/users`)
- `POST /users/sign_in`
- Body: `{ user, pwd }`
- 200: login payload + cookies set.

- `POST /users/sign_up`
- Body: `{ user, pwd }`
- 200: success message.

- `POST /users/reset_pwd`
- Body: `{ user, pwd }`
- 200: success message.

- `GET /users`
- 200: array of `{ userID, user }`.

- `POST /users`
- Body: `{ userID }`
- 200: `{ user }`.

### 8.2 Game routes (`/game`)

- `POST /game`
- Body: `{ gameID }` or `{ p1, p2 }`
- Returns finished game records.

- `POST /game/new`
- Body: `{ wp, bp, date?, result?, record, timer? }`
- Inserts a finished game.

### 8.3 Active game routes (`/game/new/active`) [auth required]

- `GET /game/new/active`
- Returns current active game for authenticated user.

- `POST /game/new/active`
- Body: `{ wp, bp, timer }`
- Creates new game + active game.
- Emits `game:started`.

- `GET /game/new/active/:gameID`
- Returns last move fields (`i1`, `i2`, `move_number`, `time_spent`, `result`).

- `POST /game/new/active/:gameID`
- Move update body: `{ move, time, i1, i2, wp, bp, result? }`
- Or result-only body: `{ wp, bp, result }`
- Emits:
- `game:move` on move.
- `game:end` when finalized.

### 8.4 Draw routes (`/game/new/active/draw/:gameID`) [auth required]
- `GET /game/new/active/draw/:gameID`
- Returns `{ drawOffer }`.

- `POST /game/new/active/draw/:gameID`
- Body: `{ offeringDraw, wp, bp }`
- Updates draw state.
- Emits `game:draw`.
- On accept finalization emits `game:end`.

### 8.5 Invite routes (`/game/request`) [auth required]
- `GET /game/request/receive`
- Incoming requests for current user.

- `GET /game/request/send`
- Latest outgoing request for current user.

- `GET /game/request/:reqID`
- Invite state lookup (legacy polling endpoint).

- `POST /game/request`
- Body: `{ wp, wu, bp, bu, timer }`
- Creates invite.
- Emits `invite:new`.

- `POST /game/request/res`
- Body: `{ reqID, action, gameID? }`
- `action=1`: accept (requires `gameID`) -> emits `invite:accepted`.
- `action=0`: decline -> emits `invite:declined`.

- Invite timeout cleanup:
- On timeout, request is deleted and emits `invite:expired`.

### 8.6 Message routes (`/game/message/:gameID`) [auth required]
- `GET /game/message/:gameID`
- Returns message list.

- `POST /game/message/:gameID`
- Body: `{ message }`
- Persists message and emits `message:new`.

- `DELETE /game/message/:gameID`
- Deletes all game messages.

## 9) Backend Function Map

### 9.1 `auth.controller.js`
- `signin(req,res)`
- `signup(req,res)`
- `resetPassword(req,res)`
- `verifyToken(req,res,next)`

### 9.2 `user.controller.js`
- `getUserList(req,res)`
- `getUsername(req,res)`

### 9.3 `finishedGame.controller.js`
- `getUserGames(req,res)`
- `createGame(req,res)`

### 9.4 `activeGame.controller.js`
- `createActiveGame(req,res)`
- `updateActiveGame(req,res)`
- `getDrawOffer(req,res)`
- `updateDrawOffer(req,res)`
- `getActiveGame(req,res)`
- `getLastMove(req,res)`

### 9.5 `request.controller.js`
- `getRequest(req,res)`
- `createRequest(req,res)`
- `requestResponse(req,res)`
- `getReceiverRequestList(req,res)`
- `getUserRequest(req,res)`
- Internal helpers:
- `clearRequest`
- `acceptRequest`
- `declineRequest`
- `emitUsersEvent`

### 9.6 `message.controller.js`
- `sendMessage(req,res)`
- `getMessages(req,res)`
- `deleteMessages(req,res)`

### 9.7 `error.controller.js`
- `errorHandler(err,res,status?)`
- `getErrorMessage(err)`

## 10) Frontend Function Map
Defined in `fe/src/App.jsx`.

### 10.1 Chess/state helpers
- `getInitialBoard`
- `toRowCol`
- `toIndex`
- `inBounds`
- `parseRecord`
- `applyMove`
- `sameSide`
- `getPseudoMoves`
- `buildCastleRights`
- `findKingIndex`
- `isPathClear`
- `attacksSquare`
- `isSquareAttacked`
- `isInCheck`
- `getLegalMoves`
- `indexToCoord`
- `buildBoardFromRecord`
- `buildNotationEntries`
- `parseTimerMeta`
- `formatClock`
- `parseGameResult`
- `computeClocks`

### 10.2 Components
- `AuthCard`
- `InviteHub`
- `App`

### 10.3 Frontend service functions
Defined in `fe/src/api.js`:
- `signIn`
- `signUp`
- `resetPassword`
- `getUsers`
- `getActiveGame`
- `createActiveGame`
- `getLastMove`
- `updateActiveGame`
- `createInvite`
- `getIncomingInvites`
- `getOutgoingInvite`
- `getInviteState` (legacy)
- `respondInvite`
- `getDrawOffer`
- `updateDrawOffer`
- `getMessages`
- `sendMessage`

## 11) Current Live Update Strategy
- No polling for invite/game/chat/draw updates.
- Socket-driven transitions:
- Invite arrives instantly.
- Invite accept/decline/expire updates instantly.
- Game board loads instantly on `game:started` or `invite:accepted`.
- In-game moves/chat/draw/end update via room events.
- Only remaining interval is local clock tick for countdown rendering.

## 12) Known Design Notes
- Move legality is validated in FE board logic (including castling/check constraints).
- Backend stores moves as from/to indices and timer deltas; server computes authoritative elapsed move time.
- Result encoding used by backend:
- Winner field + method field in a compact string (`"winner,method"`).
- Method mapping used in FE:
- `0` checkmate
- `1` time
- `2` stalemate
- `3` resignation
- `4` draw agreement

## 13) Environment / Run

### Backend
- Uses `.env` values:
- `DB_HOST`
- `DB_USER`
- `DB_PWD`
- `JWT_SECRET` (or `API_KEY` fallback)

- Run:
- `cd be`
- `npm start`

### Frontend
- Optional `.env`:
- `VITE_API_URL=http://<backend-host>:8000`

- Run:
- `cd fe`
- `npm run dev`

---
Last updated: 2026-04-02

## 14) V2 Architecture Proposal (Roadmap)

### 14.1 Primary goals
- Server-authoritative game correctness.
- Stronger auth/security for REST and websocket.
- Lower latency with fewer redundant round trips.
- Cleaner module boundaries and testability.

### 14.2 Current anti-patterns to address
- Move legality currently trusted to frontend.
- Socket room join currently trusts client-provided IDs.
- Invite acceptance is split across two client-driven calls.
- Some live updates still rely on periodic fetch patterns.
- Password reset flow is unsafe (username-only reset).
- CORS/cookie policy is broad and should be tightened.

### 14.3 V2 target architecture (high level)
- Frontend:
- Domain hooks (`useAuth`, `useGameSession`, `useInvites`, `useChat`, `useBoardState`).
- Event-driven state updates from websocket.
- REST used for bootstrap and command submission only.

- Backend:
- Command API + authoritative game engine service.
- Websocket gateway with authenticated handshake.
- Transactional invite acceptance/finalization.
- Strict schema validation and centralized error mapping.

- Data:
- Explicit columns for game result semantics.
- Ordered chat model (`id`, `created_at`).
- Append-only game event/audit table (optional but recommended).

### 14.4 Security hardening plan
- AuthN/AuthZ:
- Authenticate websocket handshake using JWT cookie/session.
- Resolve `socket.userID` server-side; ignore client user IDs.
- Room joins validated by ownership checks (`user room == self`, `game room == participant`).

- API protection:
- Add request validation (Joi/Zod) for every endpoint.
- Add rate limits for auth/invite/chat endpoints.
- Introduce CSRF token for state-changing cookie-auth requests.
- Restrict CORS to explicit trusted origins per environment.

- Credentials/session:
- Keep short-lived access token, add refresh rotation (recommended).
- Rework reset-password into tokenized email/OTP flow with expiry and one-time use.

### 14.5 Correctness and consistency plan
- Game legality:
- Move validation and check/checkmate/stalemate enforcement in backend engine.
- Backend rejects illegal commands with normalized error codes.
- Frontend legal move highlighting remains UX-only.

- Atomic invite accept:
- Replace client 2-step flow with one endpoint:
- `POST /game/request/:reqID/accept`
- Inside one DB transaction:
- verify request + auth
- create game
- create active_game + drawOffers
- mark request accepted
- commit
- emit `invite:accepted` + `game:started`

- Timeout/result authority:
- Backend authoritative clocks using server time.
- Backend finalizes timeout/disconnect outcomes.
- Frontend can notify suspected timeout, backend verifies before final result.

### 14.6 Performance/latency plan
- Websocket-first live updates:
- Push authoritative move payloads (`fen/board hash`, clocks, move number, last move, result if any).
- Avoid immediate full-state fetch after each move event.

- Polling reduction:
- Remove periodic polling for invite/chat/draw/game where websocket events exist.
- Keep short fallback reconcilers only on reconnect and explicit desync detection.

- Database/query optimization:
- Add/verify indexes for active lookup paths.
- Avoid repeated full-row scans in invite/history endpoints.
- Add pagination for message and historical game listing.

### 14.7 Suggested API/event contracts (v2)
- REST command endpoints:
- `POST /game/:gameID/commands/move` body `{from,to,promotion?}`
- `POST /game/:gameID/commands/resign`
- `POST /game/:gameID/commands/draw-offer`
- `POST /game/:gameID/commands/draw-respond` body `{accept:boolean}`

- Websocket events:
- `game:state` full authoritative snapshot (on join/reconnect).
- `game:move` incremental authoritative move update.
- `game:result` final result payload.
- `invite:new|accepted|declined|expired` with consistent shape + timestamps.
- `chat:new` with `id`, `created_at`, `userID`, `message`.

### 14.8 Testing and observability plan
- Tests:
- Unit tests for chess engine legality and terminal states.
- Integration tests for invite race/accept/expire paths.
- Contract tests for websocket payload schemas.

- Observability:
- Structured logs with request/event correlation IDs.
- Metrics: endpoint latency, socket fanout, delivery lag, DB latency.
- Alerts for auth failures, command rejection spikes, reconnect storms.

### 14.9 Migration strategy
- Phase 1: security baseline
- websocket auth, CORS restriction, rate limits, validation.

- Phase 2: correctness
- backend move validator + authoritative result/timeouts.

- Phase 3: data/API refactor
- atomic invite accept endpoint, richer event payloads, chat ordering fields.

- Phase 4: frontend modularization
- split monolith `App.jsx` into hooks/components and remove fetch-after-event patterns.

- Phase 5: reliability
- integration/load tests + dashboards + alerting.
