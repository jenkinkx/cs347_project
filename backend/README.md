# Backend (Django)

Minimal Django backend for image uploads and simple group/post data.

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

## Frontend integration (Angular)

This backend can serve either your root `index.html` (prototype) or the Angular build output, so your site is available from the same origin as the API.

How it works:
- The catch‑all route (anything not under `/api/` or `/admin/`) serves the root `index.html` and its assets (`app.js`, `styles.css`) if it exists.
- If no root `index.html` exists, the server serves the Angular `dist/` build if present.
- A small script is injected into the served HTML at runtime to set `window.API_BASE = '/api'` (and `window.DG_API_BASE`), so the frontend talks to the backend on the same origin.

Build the frontend and run the backend:

```bash
# In a separate terminal
cd ../frontend
npm run build    # produces dist/ (e.g., dist/frontend/browser)

# Back in the backend
cd ../backend
python manage.py runserver
```

If no root `index.html` is present, the server looks for the Angular build `index.html` under these paths (first one found is used):

- `../frontend/dist/frontend/browser`
- `../frontend/dist/browser`
- `../frontend/dist`

You can override the location with an environment variable:

```bash
export FRONTEND_DIST=/absolute/path/to/angular/dist/folder
```

If neither the root `index.html` nor an Angular build is found, Django returns 404.

Force which frontend to serve regardless of what exists:

```bash
# Always use root prototype
USE_ROOT_INDEX=1 python manage.py runserver
# or
FRONTEND_MODE=prototype python manage.py runserver

# Always use Angular dist (if available)
USE_ANGULAR_DIST=1 python manage.py runserver
# or
FRONTEND_MODE=angular python manage.py runserver
```

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

4. Test group creation and upload with curl (replace `<GROUP_ID>` with the actual group id):

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
- This prototype uses `@csrf_exempt` on the upload endpoint for convenience. For production, wire up CSRF tokens or use a token-based auth scheme.
- `django-cors-headers` is included in requirements if you want to allow cross-origin requests (e.g., Angular dev server). Enable it in `INSTALLED_APPS` and middleware as needed.
- Database is SQLite for local development.
