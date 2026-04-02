# koenig

Koenig is a real-time chess web app.
You can register, log in, invite other players, play live games, chat in-game, offer draw, resign, and review move history.

## Tech stack
- Frontend: React
- Backend: Express
- DB: MySQL
- Realtime: Socket.IO

## Environment setup
1. Backend env
```bash
copy be/.env.example be/.env
```

2. Frontend env (required)
```bash
copy fe/.env.example fe/.env
```

## How to run
1. Install dependencies
```bash
npm run install:all
```

2. Start backend and frontend from root
```bash
npm run dev
```

## Security and realtime notes
- Move legality is validated on backend.
- Websocket is authenticated by cookie token.
- User/game room joins are authorization-checked.
- Invite acceptance is atomic on backend (`POST /game/request/:reqID/accept`).
- Password reset uses token flow: request token first, then confirm reset with token.

## Backend tests and benchmark
```bash
npm --prefix be test
npm --prefix be run bench:chess -- 10000
```

Metrics endpoint:
```text
GET /metrics
```
