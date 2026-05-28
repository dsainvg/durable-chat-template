# SyncDuo API Documentation

This document provides details on the core REST API endpoints available in the SyncDuo backend. All API requests should include the appropriate authentication (either session `Authorization: Bearer <UUID>` or API key `x-api-key: <KEY>`).

## Spaces

### `GET /api/spaces`
Retrieve all spaces accessible to the user, including their views, columns, and custom fields.

**Response:**
- `200 OK`: Array of Space objects.

---

### `POST /api/spaces`
Create a new space.

**Request Body:**
- **Mandatory Fields:** `name`
- **Optional Fields:** `id`, `color`, `emoji`, `columns`, `customFields`, `emailReminders`, `emailDigestTime`, `views`
*Any unknown fields (including undefined custom fields) will be rejected with a 400 Bad Request. Custom fields defined in the space can be passed as top-level fields.*

**Response:**
- `200 OK`: `{ "id": "..." }`
- `400 Bad Request`: Validation errors or missing mandatory fields.

---

### `PUT /api/spaces/:id`
Update an existing space.

**Path Parameters:**
- `id`: Space ID.

**Request Body:**
- **Mandatory Fields:** `name`
- **Optional Fields:** `color`, `emoji`, `columns`, `customFields`, `emailReminders`, `emailDigestTime`, `views`
*Any unknown fields (including undefined custom fields) will be rejected with a 400 Bad Request. Custom fields defined in the space can be passed as top-level fields.*

**Response:**
- `200 OK`: `{ "ok": true }`
- `400 Bad Request`: Validation errors or missing mandatory fields.

---

### `DELETE /api/spaces/:id`
Delete a space and all its associated views and tasks.

**Path Parameters:**
- `id`: Space ID.

**Response:**
- `200 OK`: `{ "ok": true }`

---

### `GET /api/spaces/:id/fields`
Retrieve the configured `columns` and `customFields` for a specific space.

**Path Parameters:**
- `id`: Space ID.

**Response:**
- `200 OK`: `{ "columns": [...], "customFields": [...] }`
- `404 Not Found`: Space does not exist.

---

### `GET /api/spaces/:id/automations`
Retrieve all automations targeting a specific space (or targeting all spaces).

**Path Parameters:**
- `id`: Space ID.

**Response:**
- `200 OK`: Array of Automation objects matching the space.

---

## Tasks

### `GET /api/tasks`
Retrieve all tasks for a specific space.

**Query Parameters:**
- `space_id` (required): The ID of the space.

**Response:**
- `200 OK`: Array of Task objects. Custom fields are returned as top-level properties.

---

### `POST /api/tasks`
Create or completely replace a task (if an ID is provided).

**Request Body:**
- **Mandatory Fields:** `space_id`, `title`
- **Optional Fields:** `id`, `description`, `status`, `assignee`, `dueDate`, `startDate`, `priority`, `custom`, `userEmail`
*Any unknown fields (including undefined custom fields) will be rejected with a 400 Bad Request. Custom fields defined in the space can be passed as top-level fields.*

**Response:**
- `200 OK`: The created/updated Task object.
- `400 Bad Request`: Validation errors or missing mandatory fields.

---

### `POST /api/tasks/bulk`
Create or replace multiple tasks efficiently.

**Request Body:**
- `space_id` (required): The space to add tasks to.
- `tasks` (required): Array of Task objects.

**Response:**
- `200 OK`: `{ "ok": true, "count": N }`

---

### `GET /api/tasks/:id`
Retrieve all information for a specific task.

**Path Parameters:**
- `id`: Task ID.

**Query Parameters:**
- `space_id` (required): The ID of the space containing the task.

**Response:**
- `200 OK`: The full Task object. Custom fields are returned as top-level properties.
- `404 Not Found`: Task or space not found.

---

### `PUT /api/tasks/:id`
Update an existing task in full.

**Path Parameters:**
- `id`: Task ID.

**Request Body:**
- **Mandatory Fields:** `space_id`, `title`, `status`
- **Optional Fields:** `description`, `assignee`, `dueDate`, `startDate`, `priority`, `custom`, `userEmail`
*Any unknown fields (including undefined custom fields) will be rejected with a 400 Bad Request. Custom fields defined in the space can be passed as top-level fields.*

**Response:**
- `200 OK`: The updated Task object.
- `400 Bad Request`: Validation errors or missing mandatory fields.
- `404 Not Found`: Task not found.

---

### `DELETE /api/tasks/:id`
Delete a specific task.

**Path Parameters:**
- `id`: Task ID.

**Query Parameters:**
- `space_id` (required): The ID of the space containing the task.

**Response:**
- `200 OK`: `{ "ok": true }`

---

## Automations (Global)

### `GET /api/automations`
Retrieve all automation rules defined in the system.

**Response:**
- `200 OK`: Array of Automation rules.

---

### `POST /api/automations`
Create a new automation rule.

**Request Body:**
- `targetSpaces` (array of space IDs, or empty for all spaces)
- `conditions` (array of conditions)
- `action_type`
- `config`
- `isRecurring`

**Response:**
- `201 Created`: The created Automation object.

---

### `DELETE /api/automations/:id`
Delete a specific automation rule.

**Path Parameters:**
- `id`: Automation ID.

**Response:**
- `200 OK`: `{ "ok": true }`

---

## Users

### `GET /api/users`
Retrieve all users.

**Response:**
- `200 OK`: Array of User objects (omitting sensitive information).

---

### `POST /api/users`
Create a new user.

**Request Body:**
- `name` (required)
- `email` (required)
- `password` (required)

**Response:**
- `200 OK`: The created User object.
- `400 Bad Request`: Missing fields or email already registered.
