koenig

Koenig is a real-time chess web app.
You can register, log in, invite other players, play live games, chat in-game, offer draw, resign, and review move history.

Tech stack:
- Frontend: React + Vite
- Backend: Express + MySQL
- Realtime: Socket.IO

Project structure:
- fe/ -> frontend app
- be/ -> backend API + websocket server

Environment setup:
1) Backend env
   copy be/.env.example be/.env

2) Frontend env (required)
   copy fe/.env.example fe/.env

How to run:
1) Install dependencies
   npm run install:all

2) Start both backend and frontend from root
   npm run dev

3) Open frontend in browser (usually Vite URL shown in terminal)

Notes:
- Backend needs MySQL.
- Use your own secret values in be/.env (do not commit real secrets).
