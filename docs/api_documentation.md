# SyncDuo REST API Documentation

This document provides a comprehensive specification of all HTTP REST API endpoints available in SyncDuo, including authentication headers, request schemas, response formats, and interactive JSON examples.

---

## 🔒 Authentication & Authorization

All endpoints starting with `/api/` (except registration and login) require one of the following authentication headers:

### 1. Session Token (Authorization Bearer)
Used primarily by frontend sessions. Session tokens expire after **24 hours** of inactivity.
```http
Authorization: Bearer 5eb63bbbe01eeed093cb22bb8f5acdc3
```

### 2. Custom API Key (x-api-key Header)
Used for automated scripting and webhook integrations. Persistent unless deleted.
```http
x-api-key: sdk_key_d9229f315264a92c42289f
```

---

## 👥 User Management & Auth

### Register User
* **Method**: `POST`
* **Path**: `/api/users`
* **Authentication**: `None`
* **Content-Type**: `application/json`

#### Request Payload
```json
{
  "email": "user@example.com",
  "name": "Jane Doe",
  "password": "securepassword123"
}
```

#### Response (201 Created)
```json
{
  "id": "abc123xyz",
  "email": "user@example.com",
  "name": "Jane Doe"
}
```

---

### Authenticate Login
* **Method**: `POST`
* **Path**: `/api/login`
* **Authentication**: `None`
* **Content-Type**: `application/json`

#### Request Payload
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

#### Response (200 OK)
```json
{
  "token": "session_id_f691b0114aee7cbb1"
}
```

---

### Fetch Registered Users
* **Method**: `GET`
* **Path**: `/api/users`
* **Authentication**: `Required`

#### Response (200 OK)
```json
[
  {
    "id": "abc123xyz",
    "email": "user@example.com",
    "name": "Jane Doe"
  }
]
```

---

### Fetch Online/Status Users
* **Method**: `GET`
* **Path**: `/api/users/status`
* **Authentication**: `Required`

#### Response (200 OK)
```json
[
  {
    "user_id": "abc123xyz",
    "online": true,
    "last_seen": 1716382025114
  }
]
```

---

## 🔑 API Keys

### Generate API Key
* **Method**: `POST`
* **Path**: `/api/apikeys`
* **Authentication**: `Required`

#### Response (201 Created)
```json
{
  "key": "sdk_key_d9229f315264a92c42289f"
}
```

---

### List Active API Keys
* **Method**: `GET`
* **Path**: `/api/apikeys`
* **Authentication**: `Required`

#### Response (200 OK)
```json
[
  {
    "id": "key_uuid_12345",
    "key": "sdk_key_d9229f315264a92c42289f",
    "created_at": 1716382100000
  }
]
```

---

## 📁 Spaces API

Spaces represent lists or dashboards containing tasks, custom fields, views, and automation routines.

### List Spaces
* **Method**: `GET`
* **Path**: `/api/spaces`
* **Authentication**: `Required`

#### Response (200 OK)
```json
[
  {
    "id": "marketing",
    "name": "Marketing Strategy",
    "emoji": "📢",
    "columns": ["description", "priority", "assignee", "dueDate"],
    "customFields": [
      {
        "id": "custom_lead_source",
        "name": "Lead Source",
        "type": "select",
        "options": ["AdWords", "Organic", "Referral", "Other"],
        "required": false
      }
    ],
    "emailReminders": true,
    "emailDigestTime": "09:00"
  }
]
```

---

### Create Space
* **Method**: `POST`
* **Path**: `/api/spaces`
* **Authentication**: `Required`
* **Content-Type**: `application/json`

#### Request Payload
```json
{
  "name": "Software Development",
  "emoji": "💻",
  "columns": ["description", "priority", "assignee", "startDate", "dueDate"],
  "customFields": [
    {
      "id": "custom_estimate",
      "name": "Story Points",
      "type": "number",
      "required": false
    }
  ],
  "emailReminders": true,
  "emailDigestTime": "09:30"
}
```

> [!IMPORTANT]
> - `columns` represents standard toggled fields: `description`, `priority`, `assignee`, `startDate`, `dueDate`.
> - `emailDigestTime` is restricted via server-side verification to a range between `07:00` and `23:30`. Non-compliant inputs default to `09:00`.

#### Response (200 OK)
```json
{
  "ok": true,
  "space": {
    "id": "software_development",
    "name": "Software Development",
    "emoji": "💻",
    "columns": ["description", "priority", "assignee", "startDate", "dueDate"],
    "customFields": [
      {
        "id": "custom_estimate",
        "name": "Story Points",
        "type": "number",
        "required": false
      }
    ],
    "emailReminders": true,
    "emailDigestTime": "09:30"
  }
}
```

---

### Update Space
* **Method**: `PUT`
* **Path**: `/api/spaces/:space_id`
* **Authentication**: `Required`
* **Content-Type**: `application/json`

#### Request Payload
```json
{
  "name": "Development Lifecycle",
  "emoji": "🚀",
  "columns": ["description", "priority", "assignee", "dueDate"],
  "customFields": [
    {
      "id": "custom_estimate",
      "name": "Story Points",
      "type": "number",
      "required": false
    }
  ],
  "emailReminders": true,
  "emailDigestTime": "10:00"
}
```

#### Response (200 OK)
```json
{
  "ok": true
}
```

---

### Delete Space
* **Method**: `DELETE`
* **Path**: `/api/spaces/:space_id`
* **Authentication**: `Required`

#### Response (200 OK)
```json
{
  "ok": true
}
```

---

## 📝 Tasks API

### List Tasks in Space
* **Method**: `GET`
* **Path**: `/api/tasks?space_id=:space_id`
* **Authentication**: `Required`

#### Response (200 OK)
```json
[
  {
    "id": "task_xyz789",
    "space_id": "marketing",
    "title": "Launch Brand Campaign",
    "description": "Prepare creatives and allocate budgets.",
    "status": "todo",
    "assignee": "abc123xyz",
    "dueDate": "2026-06-30",
    "startDate": "2026-06-01",
    "priority": "high",
    "custom": {
      "custom_lead_source": "AdWords"
    }
  }
]
```

---

### Create or Update Task
* **Method**: `POST`
* **Path**: `/api/tasks`
* **Authentication**: `Required`
* **Content-Type**: `application/json`

> [!NOTE]
> If a task ID (`id`) is supplied in the request body, the backend updates the matching task record. If omitted, a unique random task ID is generated.
> Custom settings properties that match custom fields defined on the Space settings are structured into the `custom` dictionary automatically.

#### Request Payload
```json
{
  "id": "task_xyz789",
  "space_id": "marketing",
  "title": "Launch Brand Campaign",
  "description": "Prepare creatives and allocate budgets.",
  "status": "doing",
  "assignee": "abc123xyz",
  "dueDate": "2026-06-30",
  "startDate": "2026-06-01",
  "priority": "high",
  "custom": {
    "custom_lead_source": "Organic"
  },
  "userEmail": "collaborator@example.com"
}
```

#### Response (200 OK)
```json
{
  "id": "task_xyz789",
  "space_id": "marketing",
  "title": "Launch Brand Campaign",
  "description": "Prepare creatives and allocate budgets.",
  "status": "doing",
  "assignee": "abc123xyz",
  "dueDate": "2026-06-30",
  "startDate": "2026-06-01",
  "priority": "high",
  "custom": {
    "custom_lead_source": "Organic"
  }
}
```

---

### Fetch Task Details
* **Method**: `GET`
* **Path**: `/api/tasks/:task_id?space_id=:space_id`
* **Authentication**: `Required`

#### Response (200 OK)
```json
{
  "id": "task_xyz789",
  "space_id": "marketing",
  "title": "Launch Brand Campaign",
  "description": "Prepare creatives and allocate budgets.",
  "status": "doing",
  "assignee": "abc123xyz",
  "dueDate": "2026-06-30",
  "startDate": "2026-06-01",
  "priority": "high",
  "custom": {
    "custom_lead_source": "Organic"
  }
}
```

---

### Delete Task
* **Method**: `DELETE`
* **Path**: `/api/tasks/:task_id?space_id=:space_id`
* **Authentication**: `Required`

#### Response (200 OK)
```json
{
  "ok": true
}
```

---

### Bulk Task Import
* **Method**: `POST`
* **Path**: `/api/tasks/bulk`
* **Authentication**: `Required`
* **Content-Type**: `application/json`

#### Request Payload
```json
{
  "space_id": "marketing",
  "tasks": [
    {
      "title": "Draft Press Release",
      "status": "todo",
      "priority": "medium"
    },
    {
      "title": "Secure Sponsorships",
      "status": "todo",
      "priority": "high"
    }
  ]
}
```

#### Response (200 OK)
```json
{
  "ok": true,
  "count": 2
}
```

---

## ⚙️ Automations API

Automations are triggered rules configured to evaluate tasks and run designated background actions (e.g. sending alert emails or changing statuses).

### List Automation Rules
* **Method**: `GET`
* **Path**: `/api/automations`
* **Authentication**: `Required`

#### Response (200 OK)
```json
[
  {
    "id": "auto_rule_998877",
    "targetSpaces": ["marketing"],
    "conditions": [
      {
        "type": "due_today"
      }
    ],
    "action_type": "send_email",
    "config": {
      "target_user_id": "abc123xyz",
      "run_time": "15:30"
    },
    "isRecurring": true
  }
]
```

---

### Create Automation Rule
* **Method**: `POST`
* **Path**: `/api/automations`
* **Authentication**: `Required`
* **Content-Type**: `application/json`

#### Request Payload
```json
{
  "targetSpaces": ["marketing"],
  "conditions": [
    {
      "type": "status_equals",
      "config": {
        "status": "todo"
      }
    }
  ],
  "action_type": "change_status",
  "config": {
    "new_status": "doing"
  },
  "isRecurring": false
}
```

#### Response (201 Created)
```json
{
  "id": "auto_rule_554433",
  "targetSpaces": ["marketing"],
  "conditions": [
    {
      "type": "status_equals",
      "config": {
        "status": "todo"
      }
    }
  ],
  "action_type": "change_status",
  "config": {
    "new_status": "doing"
  },
  "isRecurring": false
}
```

---

### Delete Automation Rule
* **Method**: `DELETE`
* **Path**: `/api/automations/:automation_id`
* **Authentication**: `Required`

#### Response (200 OK)
```json
{
  "ok": true
}
```

---

## ⚡ System Diagnostics

### Server Heartbeat
* **Method**: `POST`
* **Path**: `/api/heartbeat`
* **Authentication**: `Required`

#### Response (200 OK)
```json
{
  "ok": true
}
```

---

### SMTP Test Email Alert
* **Method**: `POST`
* **Path**: `/api/user/test-email`
* **Authentication**: `Required`
* **Content-Type**: `application/json`

#### Request Payload
```json
{
  "email": "user@example.com"
}
```

#### Response (200 OK)
```json
{
  "ok": true
}
```
