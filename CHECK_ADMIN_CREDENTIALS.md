# How to Check Admin User Credentials from PostgreSQL

## Database Connection

Based on your `env.example`, the database connection details are:
- **Database**: `nefol`
- **User**: `nofol_users`
- **Password**: `Anupnefoldb` (or `Anoopnefoldb` based on reset script)
- **Host**: `localhost`
- **Port**: `5432`

## Connect to PostgreSQL

```bash
# Connect using psql
psql -h localhost -U nofol_users -d nefol

# Or with password prompt
psql -h localhost -U nofol_users -d nefol -W
```

## SQL Queries to Check Admin Users

### 1. List All Admin/Staff Users

```sql
SELECT 
    id,
    name,
    email,
    is_active,
    last_login_at,
    failed_login_attempts,
    created_at
FROM staff_users
ORDER BY created_at DESC;
```

### 2. Get Specific Admin User by Email

```sql
SELECT 
    id,
    name,
    email,
    password,
    is_active,
    last_login_at,
    last_logout_at,
    password_changed_at,
    failed_login_attempts,
    last_failed_login_at,
    created_at,
    updated_at
FROM staff_users
WHERE email = 'Info@nefol.in';
```

### 3. Get Admin User by ID

```sql
SELECT 
    id,
    name,
    email,
    password,
    is_active,
    last_login_at,
    created_at
FROM staff_users
WHERE id = 1;
```

### 4. Check Active Admin Users Only

```sql
SELECT 
    id,
    name,
    email,
    is_active,
    last_login_at,
    created_at
FROM staff_users
WHERE is_active = true
ORDER BY name;
```

### 5. View Password Hash Format

**Note**: Passwords are stored in hashed format (`salt:hash`). You cannot retrieve the plain text password, but you can see the hash:

```sql
SELECT 
    id,
    name,
    email,
    SUBSTRING(password, 1, 20) || '...' as password_preview,
    LENGTH(password) as password_length,
    is_active
FROM staff_users
WHERE email = 'Info@nefol.in';
```

### 6. Check Admin User with Roles

```sql
SELECT 
    su.id,
    su.name,
    su.email,
    su.is_active,
    COALESCE(json_agg(r.name) FILTER (WHERE r.id IS NOT NULL), '[]'::json) as roles
FROM staff_users su
LEFT JOIN staff_roles sr ON sr.staff_id = su.id
LEFT JOIN roles r ON r.id = sr.role_id
WHERE su.email = 'Info@nefol.in'
GROUP BY su.id;
```

### 7. Check Recent Login Activity

```sql
SELECT 
    su.id,
    su.name,
    su.email,
    su.last_login_at,
    su.last_logout_at,
    su.failed_login_attempts,
    su.last_failed_login_at
FROM staff_users su
WHERE su.email = 'Info@nefol.in';
```

## Important Notes

1. **Password Storage**: Passwords are hashed using `scrypt` with a salt. The format is `salt:hash`. You cannot retrieve the plain text password from the database.

2. **Reset Password**: If you need to reset an admin password, use the reset script:
   ```bash
   cd backend
   node reset-admin-credentials.js --email Info@nefol.in --password NewPassword123
   ```

3. **Default Admin Credentials** (from env.example):
   - Email: `Info@nefol.in`
   - Password: `Anoop@2025`

4. **Check if Admin Exists**: If the query returns no rows, the admin user doesn't exist and needs to be created.

## Quick Check Command

Run this single command to see all admin users:

```sql
SELECT id, name, email, is_active, last_login_at FROM staff_users ORDER BY id;
```

