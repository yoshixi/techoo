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



## Common HTTP Status Codes
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

## API Documentation

Please see the actual code or in the electron application, there is a script to generate the API documentation. Please run the script to generate the API documentation.