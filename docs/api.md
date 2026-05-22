# API Documentation

This document describes the REST API endpoints available in the application. All endpoints under `/api/` require authentication via a session UUID (`Authorization: Bearer <UUID>`) or an API key (`x-api-key: <KEY>`).

## Authentication

- **POST /api/login**: Authenticate a user and receive a session token.
- **POST /api/users**: Register a new user.

## Users

- **GET /api/users**: Retrieve a list of users.
- **GET /api/users/status**: Retrieve active status of users.
- **PUT /api/user/:id**: Update user profile (own profile only).
- **PUT /api/user/:id/password**: Update user password.
- **POST /api/user/test-email**: Send a test email.

## API Keys

- **GET /api/apikeys**: Retrieve API keys for the current user.
- **POST /api/apikeys**: Create a new API key.
- **DELETE /api/apikeys/:key**: Delete an API key.

## Spaces

- **GET /api/spaces**: Retrieve all spaces.
- **GET /api/spaces/:id**: Retrieve all information about a specific space, including space details, views, columns, custom fields, and all associated tasks.
- **POST /api/spaces**: Create a new space.
- **PUT /api/spaces/:id**: Update an existing space.
- **DELETE /api/spaces/:id**: Delete a space.

## Tasks

- **GET /api/tasks?space_id=<id>**: Retrieve all tasks for a specific space.
- **GET /api/tasks/:id?space_id=<id>**: Retrieve all information for a specific task.
- **POST /api/tasks**: Create or update a task.
  - Mandatory fields: `space_id`, `title`.
  - Allowed optional fields: `id`, `description`, `status`, `assignee`, `dueDate`, `startDate`, `priority`, `custom`, `userEmail`.
  - Rejects request with 400 Bad Request if validation fails or unknown fields are provided.
- **POST /api/tasks/bulk**: Create or update multiple tasks at once.
  - Body structure: `{ tasks: Array<Task>, space_id: string }`.
  - Allowed body fields: `tasks`, `space_id`.
  - Each task must have a `title`.
  - Allowed task fields: `id`, `title`, `description`, `status`, `assignee`, `dueDate`, `startDate`, `priority`, `custom`.
  - Rejects request with 400 Bad Request if validation fails or unknown fields are provided.
- **DELETE /api/tasks/:id?space_id=<id>**: Delete a task.

## Automations

- **GET /api/automations**: Retrieve all global automation rules.
- **GET /api/spaces/:id/automations**: Retrieve all automation rules targeting a specific space.
- **POST /api/automations**: Create a new automation rule.
- **DELETE /api/automations/:id**: Delete an automation rule.

## Miscellaneous

- **POST /api/heartbeat**: Update user's last seen status.
