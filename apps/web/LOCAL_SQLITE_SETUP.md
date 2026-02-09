# Hybrid Database Setup: Local SQLite + Turso Production

This project uses a hybrid database configuration:
- **Development**: Local SQLite database
- **Production**: Turso cloud database

## How It Works

The database connection automatically detects the environment:

1. **Local Development** (default):
   - Uses libsql file database at `tmp/local.db`
   - No environment variables needed
   - Fast, offline development

2. **Production**:
   - Uses Turso when `NODE_ENV=production` and Turso credentials are provided
   - Requires `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN`

## Environment Configuration

### Development (.env.local)
```bash
# No database config needed - uses SQLite automatically
NODE_ENV=development
```

### Production (.env.production)
```bash
NODE_ENV=production
TURSO_CONNECTION_URL=your-turso-database-url
TURSO_AUTH_TOKEN=your-turso-auth-token
```

## Usage

### Local Development
```bash
# Install dependencies
pnpm install

# Setup local database schema
pnpm drizzle:push

# Fresh-start schema note
# If you already have a local database file or an older schema, delete apps/web/tmp/local.db
# and rerun the command above.

# Start development server
pnpm dev
```

### Production Deployment
```bash
# Setup production database schema (requires Turso credentials)
pnpm drizzle:push:prod

# Build for production
pnpm build

# Start production server
pnpm start
```

## Database Operations

### Development (SQLite)
```bash
pnpm drizzle:push          # Apply schema to local SQLite
pnpm drizzle:generate      # Generate migrations
```

The schema is treated as a fresh-start setup. If you have an existing local database from an older schema, delete `apps/web/tmp/local.db` before running `pnpm drizzle:push`.

### Production (Turso)
```bash
pnpm drizzle:push:prod     # Apply schema to Turso database
pnpm drizzle:generate:prod # Generate migrations for Turso
```

## Dependencies

- **`@libsql/client`**: Libsql client for local file and Turso
- **`drizzle-orm`**: ORM with dual driver support

## Files Modified

- `app/core/common.db.ts` - Hybrid database connection logic
- `app/db/common.ts` - Legacy hybrid connection
- `drizzle.config.ts` - Environment-aware configuration
- `package.json` - Added production scripts

## Benefits

✅ **Fast Development**: Local SQLite with no network latency  
✅ **Production Ready**: Turso cloud database for scalability  
✅ **Automatic Detection**: Environment-based connection switching  
✅ **No Manual Setup**: Local SQLite created automatically  
✅ **Flexible Deployment**: Same codebase works in both environments  

## Database Locations

- **Development**: `apps/web/tmp/local.db`
- **Production**: Turso cloud database
- **Tests**: In-memory SQLite (`:memory:`)

The setup provides the best of both worlds: fast local development with local SQLite and scalable production deployment with Turso.
