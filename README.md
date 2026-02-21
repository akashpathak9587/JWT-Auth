# Syno LMS - Example Login

This workspace contains a minimal Node (Express) API and a Vite + React frontend with a login page.

Quick start:

1. Install dependencies for server and client:

```bash
npm run install-all
```

2. Start both servers (concurrently):

```bash
npm start
```

- Express API runs on http://localhost:4000
- Vite dev server runs on http://localhost:5173 and proxies `/api` to the Express API

Demo credentials: `admin` / `password`

To build the client for production and serve from Express:

```bash
# build client
npm --prefix client run build
# start server which will serve client/dist
npm --prefix server start
```
