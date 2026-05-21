# API Documentation

This document describes how to programmatically interact with the application using API Keys.

## Authentication

All API requests must include your API Key. You can pass it via headers in one of two ways:

1. **Custom Header (Recommended):**
   `x-api-key: sk_YOUR_API_KEY_HERE`

2. **Authorization Header:**
   `Authorization: Bearer sk_YOUR_API_KEY_HERE`

---

## Base URL

In a local development environment, the base URL is typically `http://localhost:8787`.
In production, use your deployed Cloudflare Workers domain (e.g., `https://your-app.workers.dev`).

---

## Endpoints

### Spaces

#### 1. List Spaces
Retrieves all spaces available to the authenticated user.

- **URL:** `/api/spaces`
- **Method:** `GET`
- **Headers:**
  - `x-api-key: <API_KEY>`

**Example Request (curl):**
```bash
curl -H "x-api-key: sk_123456" http://localhost:8787/api/spaces
```

#### 2. Create Space
Creates a new space.

- **URL:** `/api/spaces`
- **Method:** `POST`
- **Headers:**
  - `x-api-key: <API_KEY>`
  - `Content-Type: application/json`
- **Body:**
  ```json
  {
    "name": "My New Space"
  }
  ```

**Example Request (curl):**
```bash
curl -X POST -H "x-api-key: sk_123456" -H "Content-Type: application/json" -d '{"name":"My New Space"}' http://localhost:8787/api/spaces
```

#### 3. Update Space
Updates an existing space.

- **URL:** `/api/spaces/:space_id`
- **Method:** `PUT`
- **Headers:**
  - `x-api-key: <API_KEY>`
  - `Content-Type: application/json`
- **Body:**
  ```json
  {
    "name": "Updated Space Name",
    "color": "#ff0000",
    "emoji": "🚀"
  }
  ```

#### 4. Delete Space
Deletes a space and all associated tasks.

- **URL:** `/api/spaces/:space_id`
- **Method:** `DELETE`
- **Headers:**
  - `x-api-key: <API_KEY>`

---

### Tasks

#### 1. List Tasks in a Space
Retrieves all tasks for a specific space.

- **URL:** `/api/tasks?space_id=<space_id>`
- **Method:** `GET`
- **Headers:**
  - `x-api-key: <API_KEY>`

**Example Request (curl):**
```bash
curl -H "x-api-key: sk_123456" "http://localhost:8787/api/tasks?space_id=space_xyz"
```

#### 2. Create or Update a Task
Creates a new task or updates an existing one. If updating, provide the existing task `id`. If creating, generate a unique `id` (e.g., using UUID).

- **URL:** `/api/tasks`
- **Method:** `POST`
- **Headers:**
  - `x-api-key: <API_KEY>`
  - `Content-Type: application/json`
- **Body:**
  ```json
  {
    "id": "task_abc123",
    "space_id": "space_xyz",
    "title": "My API Task",
    "description": "Created via API",
    "status": "todo",
    "assignee": "user_id_1",
    "priority": "high",
    "dueDate": "2023-12-31T00:00:00Z"
  }
  ```

**Example Request (curl):**
```bash
curl -X POST -H "x-api-key: sk_123456" -H "Content-Type: application/json" -d '{"id":"task_abc123","space_id":"space_xyz","title":"My API Task","status":"todo"}' http://localhost:8787/api/tasks
```

#### 3. Bulk Create/Update Tasks
Create or update multiple tasks at once.

- **URL:** `/api/tasks/bulk`
- **Method:** `POST`
- **Headers:**
  - `x-api-key: <API_KEY>`
  - `Content-Type: application/json`
- **Body:**
  ```json
  {
    "space_id": "space_xyz",
    "tasks": [
      {
        "id": "task_1",
        "title": "Bulk Task 1",
        "status": "todo"
      },
      {
        "id": "task_2",
        "title": "Bulk Task 2",
        "status": "doing"
      }
    ]
  }
  ```

#### 4. Delete a Task
Deletes a specific task.

- **URL:** `/api/tasks/:task_id?space_id=<space_id>`
- **Method:** `DELETE`
- **Headers:**
  - `x-api-key: <API_KEY>`

---

### Users

#### 1. List Users
Retrieves all users in the system.

- **URL:** `/api/users`
- **Method:** `GET`
- **Headers:**
  - `x-api-key: <API_KEY>`

**Example Request (curl):**
```bash
curl -H "x-api-key: sk_123456" http://localhost:8787/api/users
```
