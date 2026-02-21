---
title: "Shuchu API Specification"
brief_description: "Shuchu API Specification"
created_at: "2025-12-28"
update_at: "2026-02-08"
---

# Shuchu API Specification

## Overview
This document describes the REST API for the Shuchu task management application. The API provides endpoints for tasks, timers, comments, tags, calendar sync, and activity feeds. The API is built with Hono + OpenAPI integration and uses Zod schemas for validation.

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
- **Database**: LibSQL (local file by default; Turso when env vars are set) with Drizzle ORM
- **ID Strategy**: SQLite integer IDs with auto-increment

### Code Organization
```
apps/backend/src/app/
├── api/[[...route]]/
│   ├── route.ts              # Main API router with OpenAPIHono
│   ├── handlers/             # Request handlers (business logic)
│   └── routes/               # Route definitions with OpenAPI schemas
├── core/                     # Core business logic and database access
│   ├── common.core.ts        # Shared utility functions
│   ├── common.db.ts          # Database connection and helpers
│   ├── *.core.ts             # Zod/OpenAPI models
│   └── *.db.ts               # Resource database operations
└── db/
    └── schema/               # Drizzle schema
```



## Common HTTP Status Codes
- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data (validation failed)
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

### Validation Errors
The API uses Zod schemas for comprehensive request validation:
- **ID validation**: All IDs must be positive integers
- **Required fields**: Missing required fields return 400 with specific error messages
- **String length**: Title field must be 1-200 characters
- **Date format**: All timestamps must be valid ISO 8601 format

## CORS Support

The API supports Cross-Origin Resource Sharing (CORS) for all routes:
- **Allowed Origins**: `*` (all origins)
- **Allowed Methods**: `GET, POST, PUT, DELETE, OPTIONS`
- **Allowed Headers**: `Content-Type, Authorization`

## Implementation Notes

1. **Integer IDs**: SQLite auto-incremented IDs for simpler storage and queries
2. **JWT Auth**: Clients exchange a session token for a short-lived JWT (`POST /api/token`)
3. **Cascade Deletion**: Deleting a task automatically deletes all associated timers/comments
4. **Timestamp Handling**:
   - Database stores Unix timestamps for efficiency
   - API returns ISO 8601 strings for client compatibility
5. **Schema Validation**: All requests are validated using Zod schemas before processing
6. **Error Handling**: Descriptive JSON errors with appropriate HTTP status codes
7. **OpenAPI Integration**: Full OpenAPI 3.0 specification with interactive documentation

## Core Endpoints (High Level)

- **Tasks**: `/api/tasks`, `/api/tasks/{id}`
- **Timers**: `/api/timers`, `/api/tasks/{taskId}/timers`, `/api/timers/{id}`
- **Comments**: `/api/tasks/{taskId}/comments`, `/api/tasks/{taskId}/comments/{commentId}`
- **Activities**: `/api/tasks/{id}/activities`
- **Tags**: `/api/tags`, `/api/tags/{id}`
- **Calendars & Events**: `/api/calendars`, `/api/calendars/available`, `/api/events`
- **OAuth/Calendar**: `/api/oauth/google/*`, `/api/webhooks/google-calendar`

## Development & Testing

### Running Tests with devenv

This project uses [devenv](https://devenv.sh/) for development environment management. To run tests:

1. **Enter the development environment:**
   ```bash
   devenv shell
   ```

2. **Run backend tests:**
   ```bash
   pnpm --filter backend test
   ```

3. **Run tests in watch mode:**
   ```bash
   pnpm --filter backend test:watch
   ```


### Test Structure

The test suite includes:

- **Unit Tests**: Core business logic and database operations
- **Integration Tests**: API endpoint testing with Hono's testing utilities  
- **Handler Tests**: Complete request/response cycle testing

**Test Files Location:**
```
apps/backend/src/app/
├── api/[[...route]]/handlers/
│   ├── health.test.ts           # Health endpoint tests
│   ├── tasks-simple.test.ts     # Task handler tests
│   └── timers-simple.test.ts    # Timer handler tests
├── core/
│   └── *.test.ts               # Database operation tests
└── db/
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

## API Documentation

Please see the actual code or in the electron application, there is a script to generate the API documentation. Please run the script to generate the API documentation.
