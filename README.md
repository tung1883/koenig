# koenig

Koenig is a real-time chess web app.
You can register, log in, invite other players, play live games, chat in-game, offer draw, resign, and review move history.

## Tech stack
- Frontend: React + Vite
- Backend: Express + MySQL
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
