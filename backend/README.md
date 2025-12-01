# Backend (Django)

Minimal Django backend for image uploads and simple group/post data, now with a server-rendered UI for coursework claims (CRUD, auth, templates, search, pagination, import/export, etc.).

Endpoints (prefixed by `/api/`):
- `GET /api/groups/` — list groups (auth)
- `POST /api/groups/` — create group `{ name, color?, description? }` (auth)
- `PATCH /api/groups/<id>/` — update group fields (auth)
- `DELETE /api/groups/<id>/` — delete group (auth)
- `GET /api/posts/?group_id=<id>` — list posts (optional group filter) (auth)
- `POST /api/posts/upload/` — multipart upload (`image`, `caption`, `group_id`, `user_name`)

Auth endpoints (session-based, prototype):
- `GET /api/auth/me/` — current user (401 if not signed in)
- `POST /api/auth/signup/` — `{ name?, username, password }`
- `POST /api/auth/login/` — `{ username, password }`
- `POST /api/auth/logout/`

Uploaded files are served in development at `/media/`.

## Server‑rendered UI (Django templates)

Use these pages to exercise the rubric claims:

- `/` — Home/landing page
- `/groups/` — List groups (create/edit/delete)
- `/posts/` — List posts (search, filter, paginate, bulk delete, export, import)
- `/posts/create/` — Create post (image upload)
- `/reports/` — Simple chart of recent activity
- `/help/` — In‑app help
- `/accounts/login/`, `/accounts/register/`, `/accounts/logout/` — Auth
- `/profile/` — Edit profile (bio)

Some pages require login. The Django admin remains available at `/admin/`.

## Frontend integration (Prototype only)

This backend serves your root `index.html` (prototype) and its assets (`app.js`, `styles.css`) from the repo root so the app runs from the same origin as the API.

How it works:
- The catch‑all route (anything not under `/api/` or `/admin/`) serves `index.html` and static files from the repo root.
- A small script is injected at runtime to set `window.API_BASE = '/api'` (and `window.DG_API_BASE`), so the frontend calls the backend on the same origin.

No Angular build is used. Place or edit `index.html`, `app.js`, and `styles.css` in the repo root.

## Quick start

1. Create a virtual environment and install deps:

   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Run migrations and create a sample group (via admin or shell):

   ```bash
   python manage.py migrate
   python manage.py createsuperuser  # optional
   python manage.py shell -c "from posts.models import Group; Group.objects.get_or_create(name='Running Group', color='#2e6bff')"
   ```

3. Start the dev server:

   ```bash
   python manage.py runserver
   ```

4. Open the server‑rendered UI at http://127.0.0.1:8000/ and log in or register. Create a group and add posts with images. Use Posts page to search, paginate, bulk delete, and import/export CSV.

5. (Optional) Test group creation and upload with curl (replace `<GROUP_ID>`):

```bash
# In a new session, create a user and sign in (session cookie)
curl -i -c cookies.txt -b cookies.txt -X POST http://127.0.0.1:8000/api/auth/signup/ \
  -H 'Content-Type: application/json' \
  -d '{"name":"Runner One","username":"runner1","password":"pass1234"}'

# Create a group (requires auth cookie)
curl -i -c cookies.txt -b cookies.txt -X POST http://127.0.0.1:8000/api/groups/ \
  -H 'Content-Type: application/json' \
  -d '{"name":"Running Group","color":"#2e6bff","description":"We run daily"}'

# List groups
curl http://127.0.0.1:8000/api/groups/

# Upload a post
curl -X POST http://127.0.0.1:8000/api/posts/upload/ \
  -F group_id=<GROUP_ID> \
  -F user_name="Kendall" \
  -F caption="Morning miles" \
  -F image=@/path/to/local.jpg
```

The response includes `image_url` which is fetchable while the dev server runs.

## Notes
- The server‑rendered forms include CSRF tokens. DRF endpoints remain available for the SPA.
- CORS is not required for same‑origin prototype.
- Database is SQLite for local development.
