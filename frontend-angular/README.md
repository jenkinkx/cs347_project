# Angular Frontend (scaffold plan)

This folder contains drop-in files (service + component) to wire image uploads to the Django backend.

Recommended setup (Angular 18+):

1. Create a new Angular workspace (or use an existing one):

   ```bash
   npm i -g @angular/cli
   ng new daily-groups --routing --style=css
   cd daily-groups
   ng add @angular/material  # optional
   ```

2. Add an environment key for the API base (edit `src/environments/environment.ts`):

   ```ts
   export const environment = {
     production: false,
     apiBase: 'http://127.0.0.1:8000/api',
   };
   ```

3. Copy the provided files into your Angular app:

   - `src/app/services/upload.service.ts`
   - `src/app/components/upload/upload.component.ts`
   - `src/app/components/upload/upload.component.html`
   - `src/app/components/upload/upload.component.css`

   Then declare the component in your `AppModule` (or a feature module), and ensure `HttpClientModule` is imported in the root module.

4. Serve the Angular app:

   ```bash
   ng serve --open
   ```

The component posts to the Django endpoint at `/api/posts/upload/` and shows the uploaded image URL from the response. CORS is enabled in the Django backend for development.

