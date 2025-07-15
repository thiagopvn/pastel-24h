# IPv6 Connectivity Fix for Render + Supabase

## Problem
The application was experiencing `502 ENETUNREACH` errors when trying to connect to Supabase from Render's free tier. This is caused by IPv6 connectivity issues between Render and Supabase.

## Solution
The fix involves forcing IPv4 connections and using Supabase's IPv4 pooler instead of the direct database connection.

## Key Changes Made

### 1. Updated `render.yaml`
- Added `NODE_OPTIONS="--dns-result-order=ipv4first"` to force IPv4 DNS resolution
- Changed `DATABASE_URL` to use IPv4 pooler: `aws-0-sa-east-1.pooler.supabase.com:5432`
- Set consistent Node.js version (20.9.0)

### 2. Database Configuration (`server/db.ts`)
- Added connection pooling configuration with timeouts
- Added SSL configuration for production
- Added database pool error handling

### 3. Error Handling (`server/index.ts` and `server/auth.ts`)
- Added unhandled rejection and uncaught exception handlers
- Improved login endpoint error handling with proper 503 responses
- Added detailed error logging for debugging

### 4. Build Configuration (`package.json`)
- Updated build script to include TypeScript compilation
- Added Node.js engine requirement (>=20)

## How to Get IPv4 Pooler URL from Supabase

1. Go to your Supabase dashboard
2. Navigate to **Project Settings** → **Database**
3. Scroll down to **Connection Pooling**
4. Find the **Connection string** section
5. Look for the pooler URL ending with `.pooler.supabase.com:5432`
6. Use this URL in your `DATABASE_URL` environment variable

**Example:**
```
OLD (IPv6 issues): db.axmbupauzyommvlxabop.supabase.co:6543
NEW (IPv4 compatible): aws-0-sa-east-1.pooler.supabase.com:5432
```

## Why `--dns-result-order=ipv4first` Works

Render's free tier doesn't support IPv6 outbound connections. By default, Node.js may prefer IPv6 addresses when they're available in DNS records. The `--dns-result-order=ipv4first` flag forces Node.js to prioritize IPv4 addresses, ensuring compatibility with Render's network configuration.

## Environment Variables Required

```bash
NODE_VERSION=20.9.0
NODE_OPTIONS="--dns-result-order=ipv4first"
DATABASE_URL="postgresql://postgres:PASSWORD@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
NEXT_PUBLIC_SUPABASE_URL="https://axmbupauzyommvlxabop.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key"
SESSION_SECRET="your_session_secret"
```

## Post-Deploy Testing Checklist

### 1. Test Health Endpoint
```bash
curl https://your-app.onrender.com/api/health
```
Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Test Database Connection
Check the deployment logs for:
- ✅ No "ENETUNREACH" errors
- ✅ Successful database pool initialization
- ✅ No SSL/TLS connection errors

### 3. Test Login Endpoint
```bash
curl -X POST https://your-app.onrender.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

Expected responses:
- **Success (200)**: User object with authentication data
- **Invalid credentials (401)**: `{"message":"Invalid credentials"}`
- **Service issues (503)**: `{"message":"Authentication service unavailable"}`

### 4. Monitor Logs
Watch for:
- Database connection pool errors
- Authentication service errors
- Unhandled promise rejections
- DNS resolution issues

## Troubleshooting

### If you still see connection errors:
1. Verify the pooler URL is correct in Supabase dashboard
2. Check that `NODE_OPTIONS` is set correctly in Render
3. Ensure password is URL-encoded in `DATABASE_URL`
4. Verify SSL mode is set to `require` in connection string

### If authentication fails:
1. Check that user exists in database
2. Verify password hash format (bcrypt vs scrypt)
3. Check session store configuration
4. Verify `SESSION_SECRET` is set

## Additional Notes

- The application uses direct PostgreSQL connections to Supabase, not the Supabase SDK
- SSL is enforced in production with `sslmode=require`
- Connection pooling is configured with 20 max connections and 30s idle timeout
- All authentication errors are logged for debugging