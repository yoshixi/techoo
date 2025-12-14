# Shuchu API Specification

## Overview
This document describes the REST API for the Shuchu task management application. The API provides endpoints for managing tasks and their associated focus timers. The API is built using Hono with OpenAPI integration and includes automatic schema validation using Zod schemas.

## Base URL
```
/api
```

## OpenAPI Documentation
Interactive API documentation is available at `/api/doc` when the server is running. This provides:
- Complete API schema definitions
- Interactive testing interface
- Request/response examples
- Schema validation details

## Architecture Overview

### Technology Stack
- **Framework**: Hono with OpenAPI extension
- **Schema Validation**: Zod with OpenAPI integration (@hono/zod-openapi)
- **Database**: LibSQL (Turso) with Drizzle ORM
- **UUID Generation**: UUID v7 for better performance and ordering

### Code Organization
```
apps/web/app/
├── api/[[...route]]/
│   ├── route.ts              # Main API router with OpenAPIHono
│   ├── handlers/             # Request handlers (business logic)
│   │   ├── health.ts         # Health check handler
│   │   ├── tasks.ts          # Task CRUD handlers
│   │   └── timers.ts         # Timer CRUD handlers
│   └── routes/               # Route definitions with OpenAPI schemas
│       ├── health.ts         # Health route definitions
│       ├── tasks.ts          # Task route definitions
│       └── timers.ts         # Timer route definitions
├── core/                     # Core business logic and database access
│   ├── common.core.ts        # Shared utility functions
│   ├── common.db.ts          # Database connection and helpers.
│   ├── $resource.core.ts(such as users.core.ts)         #  Resource-related business logic and core models defined by Zod/openapi.
│   ├── $resource.db.ts (such as users.db.ts)             # Resource database operations
```

## Data Models

### Task
```typescript
interface Task {
  id: string              // Unique identifier (UUID v7)
  title: string           // Task title (required, 1-200 characters)
  description: string     // Task description (defaults to empty string)
  status: TaskStatus      // Current status (auto-derived)
  dueDate?: string        // Due date in ISO 8601 format (optional)
  createdAt: string       // ISO 8601 timestamp
  updatedAt: string       // ISO 8601 timestamp
}
```

### TaskStatus
```typescript
type TaskStatus = 'To Do' | 'In Progress' | 'Done'
```
*Note: Status is automatically derived based on task completion state and active timers.*

### TaskTimer
```typescript
interface TaskTimer {
  id: string              // Unique identifier (UUID v7)
  taskId: string          // Associated task ID (foreign key)
  startTime: string       // ISO 8601 timestamp when timer started
  endTime?: string        // ISO 8601 timestamp when timer ended (null for active timers)
  createdAt: string       // ISO 8601 timestamp
  updatedAt: string       // ISO 8601 timestamp
}
```

## API Endpoints

### Health Check

#### GET /health
Check API health status.

**Response:**
```json
{
  "status": "ok",
  "message": "Shuchu API is running",
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: API is healthy

---

## Tasks API

### GET /tasks
Retrieve all tasks with optional filtering.

**Query Parameters:**
- `status` (optional): Filter by task status. 
  - Values: `all`, `To Do`, `In Progress`, `Done`
  - Default: `all`

**Response:**
```json
{
  "tasks": [
    {
      "id": "01HF7G8X9Y0Z1A2B3C4D5E6F7G",
      "title": "Task title",
      "description": "Task description",
      "status": "To Do",
      "dueDate": "2024-12-31T23:59:59.000Z",
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

**Status Codes:**
- `200 OK`: Successfully retrieved tasks
- `500 Internal Server Error`: Server error

### GET /tasks/{id}
Retrieve a specific task by ID.

**Path Parameters:**
- `id`: Task ID (UUID v7)

**Response:**
```json
{
  "task": {
    "id": "01HF7G8X9Y0Z1A2B3C4D5E6F7G",
    "title": "Task title",
    "description": "Task description",
    "status": "To Do",
    "dueDate": "2024-12-31T23:59:59.000Z",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  }
}
```

**Status Codes:**
- `200 OK`: Task found and returned
- `404 Not Found`: Task not found
- `500 Internal Server Error`: Server error

### POST /tasks
Create a new task.

**Request Body:**
```json
{
  "title": "New task title",           // required (1-200 chars)
  "description": "Task description",   // optional
  "dueDate": "2024-12-31T23:59:59.000Z" // optional (ISO 8601 format)
}
```

**Response:**
```json
{
  "task": {
    "id": "01HF7G8X9Y0Z1A2B3C4D5E6F7G",
    "title": "New task title",
    "description": "Task description",
    "status": "To Do",
    "dueDate": "2024-12-31T23:59:59.000Z",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  }
}
```

**Status Codes:**
- `201 Created`: Task successfully created
- `400 Bad Request`: Invalid request data
- `500 Internal Server Error`: Server error

### PUT /tasks/{id}
Update an existing task.

**Path Parameters:**
- `id`: Task ID (UUID v7)

**Request Body:**
```json
{
  "title": "Updated title",           // optional (1-200 chars)
  "description": "Updated description", // optional
  "status": "In Progress",            // optional
  "dueDate": "2024-01-20T23:59:59.000Z" // optional (null to remove)
}
```

**Response:**
```json
{
  "task": {
    "id": "01HF7G8X9Y0Z1A2B3C4D5E6F7G",
    "title": "Updated title",
    "description": "Updated description",
    "status": "In Progress",
    "dueDate": "2024-01-20T23:59:59.000Z",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T15:30:00.000Z"
  }
}
```

**Status Codes:**
- `200 OK`: Task successfully updated
- `400 Bad Request`: Invalid request data
- `404 Not Found`: Task not found
- `500 Internal Server Error`: Server error

### DELETE /tasks/{id}
Delete a task and all associated timers.

**Path Parameters:**
- `id`: Task ID (UUID v7)

**Response:**
```json
{
  "task": {
    "id": "01HF7G8X9Y0Z1A2B3C4D5E6F7G",
    "title": "Deleted task",
    "description": "Task description",
    "status": "To Do",
    "dueDate": "2024-12-31T23:59:59.000Z",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  }
}
```

**Status Codes:**
- `200 OK`: Task successfully deleted
- `404 Not Found`: Task not found
- `500 Internal Server Error`: Server error

---

## Timers API

### GET /timers
Retrieve all timers across all tasks.

**Response:**
```json
{
  "timers": [
    {
      "id": "01HF7G8X9Y0Z1A2B3C4D5E6F7H",
      "taskId": "01HF7G8X9Y0Z1A2B3C4D5E6F7G",
      "startTime": "2024-01-01T10:00:00.000Z",
      "endTime": "2024-01-01T10:25:00.000Z",
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:25:00.000Z"
    }
  ],
  "total": 1
}
```

**Status Codes:**
- `200 OK`: Successfully retrieved timers
- `500 Internal Server Error`: Server error

### GET /tasks/{taskId}/timers
Retrieve all timers for a specific task.

**Path Parameters:**
- `taskId`: Task ID (UUID v7)

**Response:**
```json
{
  "timers": [
    {
      "id": "01HF7G8X9Y0Z1A2B3C4D5E6F7H",
      "taskId": "01HF7G8X9Y0Z1A2B3C4D5E6F7G",
      "startTime": "2024-01-01T10:00:00.000Z",
      "endTime": "2024-01-01T10:25:00.000Z",
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:25:00.000Z"
    }
  ],
  "total": 1
}
```

**Status Codes:**
- `200 OK`: Successfully retrieved timers
- `404 Not Found`: Task not found
- `500 Internal Server Error`: Server error

### GET /timers/{id}
Retrieve a specific timer by ID.

**Path Parameters:**
- `id`: Timer ID (UUID v7)

**Response:**
```json
{
  "timer": {
    "id": "01HF7G8X9Y0Z1A2B3C4D5E6F7H",
    "taskId": "01HF7G8X9Y0Z1A2B3C4D5E6F7G",
    "startTime": "2024-01-01T10:00:00.000Z",
    "endTime": "2024-01-01T10:25:00.000Z",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:25:00.000Z"
  }
}
```

**Status Codes:**
- `200 OK`: Timer found and returned
- `404 Not Found`: Timer not found
- `500 Internal Server Error`: Server error

### POST /timers
Start a new timer for a task.

**Request Body:**
```json
{
  "taskId": "01HF7G8X9Y0Z1A2B3C4D5E6F7G",    // required (UUID v7)
  "startTime": "2024-01-01T10:00:00.000Z"    // required (ISO 8601)
}
```

**Response:**
```json
{
  "timer": {
    "id": "01HF7G8X9Y0Z1A2B3C4D5E6F7H",
    "taskId": "01HF7G8X9Y0Z1A2B3C4D5E6F7G",
    "startTime": "2024-01-01T10:00:00.000Z",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  }
}
```

**Status Codes:**
- `201 Created`: Timer successfully created
- `400 Bad Request`: Invalid request data
- `404 Not Found`: Task not found
- `500 Internal Server Error`: Server error

### PUT /timers/{id}
Update a timer (typically to set end time).

**Path Parameters:**
- `id`: Timer ID (UUID v7)

**Request Body:**
```json
{
  "endTime": "2024-01-01T10:25:00.000Z"  // optional (ISO 8601, null to remove)
}
```

**Response:**
```json
{
  "timer": {
    "id": "01HF7G8X9Y0Z1A2B3C4D5E6F7H",
    "taskId": "01HF7G8X9Y0Z1A2B3C4D5E6F7G",
    "startTime": "2024-01-01T10:00:00.000Z",
    "endTime": "2024-01-01T10:25:00.000Z",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:25:00.000Z"
  }
}
```

**Status Codes:**
- `200 OK`: Timer successfully updated
- `404 Not Found`: Timer not found
- `500 Internal Server Error`: Server error

### DELETE /timers/{id}
Delete a timer.

**Path Parameters:**
- `id`: Timer ID (UUID v7)

**Response:**
```json
{
  "timer": {
    "id": "01HF7G8X9Y0Z1A2B3C4D5E6F7H",
    "taskId": "01HF7G8X9Y0Z1A2B3C4D5E6F7G",
    "startTime": "2024-01-01T10:00:00.000Z",
    "endTime": "2024-01-01T10:25:00.000Z",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:25:00.000Z"
  }
}
```

**Status Codes:**
- `200 OK`: Timer successfully deleted
- `404 Not Found`: Timer not found
- `500 Internal Server Error`: Server error

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message describing what went wrong",
  "message": "Additional context about the error",
  "code": "OPTIONAL_ERROR_CODE"
}
```

### Common HTTP Status Codes
- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data (validation failed)
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

### Validation Errors
The API uses Zod schemas for comprehensive request validation:
- **UUID validation**: All IDs must be valid UUID v7 format
- **Required fields**: Missing required fields return 400 with specific error messages
- **String length**: Title field must be 1-200 characters
- **Date format**: All timestamps must be valid ISO 8601 format

## CORS Support

The API supports Cross-Origin Resource Sharing (CORS) for all routes:
- **Allowed Origins**: `*` (all origins)
- **Allowed Methods**: `GET, POST, PUT, DELETE, OPTIONS`
- **Allowed Headers**: `Content-Type, Authorization`

## Database Schema

### Users Table
- `id`: blob (UUID v7, primary key)
- `name`: text (not null)

### Tasks Table
- `id`: blob (UUID v7, primary key)
- `user_id`: blob (foreign key to users.id, cascade delete)
- `title`: text (not null)
- `description`: text (nullable)
- `due_at`: integer (Unix timestamp, nullable)
- `completed_at`: integer (Unix timestamp, nullable)
- `created_at`: integer (Unix timestamp, default: current time)
- `updated_at`: integer (Unix timestamp, default: current time)

### Task Timers Table
- `id`: blob (UUID v7, primary key)
- `task_id`: blob (foreign key to tasks.id, cascade delete)
- `start_time`: integer (Unix timestamp, not null)
- `end_time`: integer (Unix timestamp, nullable)
- `created_at`: integer (Unix timestamp, default: current time)
- `updated_at`: integer (Unix timestamp, default: current time)

### Indexes
- `tasks_due_at_idx`: Index on `tasks.due_at`
- `task_timers_task_id_idx`: Index on `task_timers.task_id`

## Implementation Notes

1. **UUID v7**: Used for better performance and natural ordering
2. **Automatic User Management**: A default user is automatically created and used for all operations
3. **Status Derivation**: Task status is derived from completion state and active timers
4. **Cascade Deletion**: Deleting a task automatically deletes all associated timers
5. **Timestamp Handling**: 
   - Database stores Unix timestamps for efficiency
   - API returns ISO 8601 strings for client compatibility
   - Due dates are stored as Unix timestamps but accept ISO 8601 input
6. **Schema Validation**: All requests are validated using Zod schemas before processing
7. **Error Handling**: Comprehensive error handling with descriptive messages
8. **OpenAPI Integration**: Full OpenAPI 3.0 specification with interactive documentation

## Development & Testing

### Running Tests with devenv

This project uses [devenv](https://devenv.sh/) for development environment management. To run tests:

1. **Enter the development environment:**
   ```bash
   devenv shell
   ```

2. **Navigate to the web application:**
   ```bash
   cd apps/web
   ```

3. **Run all tests:**
   ```bash
   pnpm test
   ```

4. **Run tests in watch mode:**
   ```bash
   pnpm test --watch
   ```

5. **Run tests with coverage:**
   ```bash
   pnpm test --coverage
   ```

### Current Test Status ✅

**All 19 tests are currently passing**, covering:

- **Health endpoint**: 5 tests
- **Task management**: 5 tests (CRUD operations)
- **Timer management**: 7 tests (including task association)
- **Database operations**: 2 tests

### Test Structure

The test suite includes:

- **Unit Tests**: Core business logic and database operations
- **Integration Tests**: API endpoint testing with Hono's testing utilities  
- **Handler Tests**: Complete request/response cycle testing

**Test Files Location:**
```
apps/web/app/
├── api/[[...route]]/handlers/
│   ├── health.test.ts           # Health endpoint tests (5 tests)
│   ├── tasks-simple.test.ts     # Task handler tests (5 tests) 
│   └── timers-simple.test.ts    # Timer handler tests (7 tests)
├── core/
│   └── *.test.ts               # Database operation tests
└── db/
    ├── createUser.test.ts      # User creation tests (2 tests)
    └── tests/                  # Database test utilities
```

### Test Environment

- **Test Framework**: Vitest
- **Database**: In-memory SQLite for testing
- **Mocking**: Database operations use test contexts
- **Assertions**: Comprehensive request/response validation

## Client Integration

### Frontend Applications
The API is designed for easy integration with frontend applications:
- Consistent JSON responses
- Descriptive error messages
- OpenAPI documentation for code generation
- CORS support for browser applications

### Examples
See the interactive documentation at `/api/doc` for:
- Live API testing
- Request/response examples
- Schema definitions
- Authentication requirements (if any)