# Frontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli).

## Development server

To start a local development server, ensure the Django backend is running on `http://127.0.0.1:8000` (see `backend/README.md`), then run:

```bash
npm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/upload`. The app includes an Upload page: enter a valid Group ID (e.g., 1 if you created the sample group), set your name and caption, and select an image to upload to the Django API.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
