# Green Table Market

Full-stack vendor directory for a local farmers market.

**Stack:** Node.js, Express, SQLite (better-sqlite3), express-session, bcryptjs, plain HTML/CSS/JS.

## Features
- Login and authentication: session-based admin login, bcrypt-hashed password, login rate limiting
- Admin features: add, edit and delete vendors; edit market name and contact info
- Contact information section on the public page
- Public preview page at `/` (no login needed)
- Responsive layout with light and dark themes

## Run locally
```
npm install
npm start
```
Open http://localhost:3000 (public) and http://localhost:3000/admin.html (admin).
Default login if you set nothing: `admin` / `changeme123`. Always set your own before deploying.

## Environment variables
| Name | Purpose |
|---|---|
| `ADMIN_USER` | Admin username (used the first time the database is created) |
| `ADMIN_PASS` | Admin password (same) |
| `SESSION_SECRET` | Long random string for signing session cookies |
| `NODE_ENV` | Set to `production` when deployed |

## Deploy (GitHub + Render)
1. Push this folder to a new GitHub repository.
2. On render.com, choose New → Web Service and connect the repository.
3. Build command: `npm install`. Start command: `npm start`.
4. Add the environment variables above, then deploy.
5. Your live link is the `https://<name>.onrender.com` URL; admin is at `/admin.html`.

Note: on a free host the disk is not permanent, so added content may reset when the service redeploys or restarts. Starter content and the admin account are recreated automatically.
