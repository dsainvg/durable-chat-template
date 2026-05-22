# Developer API Guide (API Key Accessible Endpoints)

This guide documents the subset of SyncDuo REST endpoints designed for external integrations, automated scripts, and third-party developer access. 

---

## 🔑 Authentication

All developer requests must authenticate using a persistent **API Key** passed in the HTTP request headers. 

Pass your key using either of the following headers:

```http
x-api-key: sdk_key_d9229f315264a92c42289f
```

OR

```http
Authorization: Bearer sdk_key_d9229f315264a92c42289f
```

---

## 📁 Spaces API

Spaces represent structural dashboards. A space defines custom fields, views, standard columns, and email alert settings.

### 1. List Available Spaces
Retrieve all spaces accessible to your account.

* **Method**: `GET`
* **Path**: `/api/spaces`

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

### 2. Create a Space
Instantiate a new workspace with standard task column configurations and custom fields.

* **Method**: `POST`
* **Path**: `/api/spaces`
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
> - `columns` specifies standard toggled fields: `description`, `priority`, `assignee`, `startDate`, `dueDate`.
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

### 3. Update a Space
Modify details, toggle standard columns, or add custom fields to an existing space.

* **Method**: `PUT`
* **Path**: `/api/spaces/:space_id`
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

### 4. Delete a Space
Permanently delete a space, all its space views, and its underlying task table.

* **Method**: `DELETE`
* **Path**: `/api/spaces/:space_id`

#### Response (200 OK)
```json
{
  "ok": true
}
```

---

## 📝 Tasks API

### 1. List Tasks in a Space
Fetch task items matching a specific space identifier.

* **Method**: `GET`
* **Path**: `/api/tasks?space_id=:space_id`

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

### 2. Create or Update a Task
Installs or replaces task properties.

* **Method**: `POST`
* **Path**: `/api/tasks`
* **Content-Type**: `application/json`

> [!NOTE]
> - To **create** a task, omit the `id` property. A unique ID will be auto-generated.
> - To **update** a task, pass its existing `id` in the request body.
> - Custom properties (like `custom_lead_source`) matching space-level configurations are parsed and stored in the database automatically.

#### Request Payload
```json
{
  "space_id": "marketing",
  "title": "Draft Press Release",
  "description": "Announce the Q3 launch schedule.",
  "status": "todo",
  "priority": "medium",
  "custom": {
    "custom_lead_source": "Organic"
  }
}
```

#### Response (200 OK)
```json
{
  "id": "task_q3_press_release",
  "space_id": "marketing",
  "title": "Draft Press Release",
  "description": "Announce the Q3 launch schedule.",
  "status": "todo",
  "assignee": "",
  "dueDate": null,
  "startDate": null,
  "priority": "medium",
  "custom": {
    "custom_lead_source": "Organic"
  }
}
```

---

### 3. Fetch Task Details
Fetch data for a specific task.

* **Method**: `GET`
* **Path**: `/api/tasks/:task_id?space_id=:space_id`

#### Response (200 OK)
```json
{
  "id": "task_q3_press_release",
  "space_id": "marketing",
  "title": "Draft Press Release",
  "description": "Announce the Q3 launch schedule.",
  "status": "todo",
  "assignee": "",
  "dueDate": null,
  "startDate": null,
  "priority": "medium",
  "custom": {
    "custom_lead_source": "Organic"
  }
}
```

---

### 4. Delete a Task
Remove a task from the designated space.

* **Method**: `DELETE`
* **Path**: `/api/tasks/:task_id?space_id=:space_id`

#### Response (200 OK)
```json
{
  "ok": true
}
```

---

### 5. Bulk Task Import
Upload multiple task objects in a single batch statement.

* **Method**: `POST`
* **Path**: `/api/tasks/bulk`
* **Content-Type**: `application/json`

#### Request Payload
```json
{
  "space_id": "marketing",
  "tasks": [
    {
      "title": "Design Banner Ads",
      "status": "todo",
      "priority": "medium"
    },
    {
      "title": "Setup Marketing Tracker",
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

Define and manage rules evaluated asynchronously by SyncDuo's background workers.

### 1. List Space Automation Rules
Retrieve automations applied to a specific space.

* **Method**: `GET`
* **Path**: `/api/spaces/:space_id/automations`

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

### 2. List All Automation Rules
List all global automation configurations.

* **Method**: `GET`
* **Path**: `/api/automations`

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

### 3. Create an Automation Rule
Configure background alert logic or state modifications.

* **Method**: `POST`
* **Path**: `/api/automations`
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

### 4. Delete an Automation Rule
* **Method**: `DELETE`
* **Path**: `/api/automations/:automation_id`

#### Response (200 OK)
```json
{
  "ok": true
}
```
