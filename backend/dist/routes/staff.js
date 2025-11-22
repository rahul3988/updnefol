"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRole = createRole;
exports.listRoles = listRoles;
exports.createPermission = createPermission;
exports.assignPermissionToRole = assignPermissionToRole;
exports.createStaff = createStaff;
exports.assignRoleToStaff = assignRoleToStaff;
exports.listStaff = listStaff;
exports.listPermissions = listPermissions;
exports.getRolePermissions = getRolePermissions;
exports.setRolePermissions = setRolePermissions;
exports.listStaffActivity = listStaffActivity;
exports.resetPassword = resetPassword;
exports.disableStaff = disableStaff;
exports.seedStandardRolesAndPermissions = seedStandardRolesAndPermissions;
const apiHelpers_1 = require("../utils/apiHelpers");
const crypto_1 = __importDefault(require("crypto"));
function hashPassword(plain) {
    const salt = crypto_1.default.randomBytes(16).toString('hex');
    const hash = crypto_1.default.scryptSync(plain, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}
async function logStaff(pool, staffId, action, details) {
    try {
        await pool.query(`insert into staff_activity_logs (staff_id, action, details, created_at) values ($1, $2, $3, now())`, [staffId, action, details ? JSON.stringify(details) : null]);
    }
    catch { }
}
async function createRole(pool, req, res) {
    try {
        const { name, description } = req.body || {};
        const validationError = (0, apiHelpers_1.validateRequired)({ name }, ['name']);
        if (validationError)
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        const { rows } = await pool.query(`insert into roles (name, description, created_at, updated_at) values ($1, $2, now(), now()) returning *`, [name, description || null]);
        (0, apiHelpers_1.sendSuccess)(res, rows[0], 201);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to create role', err);
    }
}
async function listRoles(pool, req, res) {
    try {
        const { rows } = await pool.query('select * from roles order by name asc');
        (0, apiHelpers_1.sendSuccess)(res, rows);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to list roles', err);
    }
}
async function createPermission(pool, req, res) {
    try {
        const { code, description } = req.body || {};
        const validationError = (0, apiHelpers_1.validateRequired)({ code }, ['code']);
        if (validationError)
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        const { rows } = await pool.query(`insert into permissions (code, description) values ($1, $2) returning *`, [code, description || null]);
        (0, apiHelpers_1.sendSuccess)(res, rows[0], 201);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to create permission', err);
    }
}
async function assignPermissionToRole(pool, req, res) {
    try {
        const { roleId, permissionId } = req.body || {};
        const validationError = (0, apiHelpers_1.validateRequired)({ roleId, permissionId }, ['roleId', 'permissionId']);
        if (validationError)
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        await pool.query(`insert into role_permissions (role_id, permission_id) values ($1, $2) on conflict do nothing`, [roleId, permissionId]);
        (0, apiHelpers_1.sendSuccess)(res, { roleId, permissionId }, 201);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to assign permission', err);
    }
}
async function createStaff(pool, req, res) {
    try {
        const { name, email, password } = req.body || {};
        const validationError = (0, apiHelpers_1.validateRequired)({ name, email, password }, ['name', 'email', 'password']);
        if (validationError)
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        const hashed = hashPassword(password);
        const { rows } = await pool.query(`insert into staff_users (name, email, password, is_active, created_at, updated_at) values ($1, $2, $3, true, now(), now()) returning *`, [name, email, hashed]);
        await logStaff(pool, rows[0]?.id || null, 'staff_create', { email });
        (0, apiHelpers_1.sendSuccess)(res, rows[0], 201);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to create staff user', err);
    }
}
async function assignRoleToStaff(pool, req, res) {
    try {
        const { staffId, roleId } = req.body || {};
        const validationError = (0, apiHelpers_1.validateRequired)({ staffId, roleId }, ['staffId', 'roleId']);
        if (validationError)
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        await pool.query(`insert into staff_roles (staff_id, role_id) values ($1, $2) on conflict do nothing`, [staffId, roleId]);
        await logStaff(pool, staffId, 'assign_role', { roleId });
        (0, apiHelpers_1.sendSuccess)(res, { staffId, roleId }, 201);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to assign role to staff', err);
    }
}
async function listStaff(pool, req, res) {
    try {
        const { rows } = await pool.query(`select su.*, coalesce(json_agg(r.*) filter (where r.id is not null), '[]'::json) as roles
       from staff_users su
       left join staff_roles sr on sr.staff_id = su.id
       left join roles r on r.id = sr.role_id
       group by su.id
       order by su.created_at desc`);
        (0, apiHelpers_1.sendSuccess)(res, rows);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to list staff users', err);
    }
}
async function listPermissions(pool, req, res) {
    try {
        const { rows } = await pool.query('select * from permissions order by code asc');
        (0, apiHelpers_1.sendSuccess)(res, rows);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to list permissions', err);
    }
}
async function getRolePermissions(pool, req, res) {
    try {
        const { rows } = await pool.query(`
      select r.id as role_id, r.name as role_name, p.id as permission_id, p.code as permission_code
      from roles r
      left join role_permissions rp on rp.role_id = r.id
      left join permissions p on p.id = rp.permission_id
    `);
        (0, apiHelpers_1.sendSuccess)(res, rows);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to fetch role-permission matrix', err);
    }
}
async function setRolePermissions(pool, req, res) {
    try {
        // Body shape: { roleId: number, permissionIds: number[] }
        const { roleId, permissionIds } = req.body || {};
        const validationError = (0, apiHelpers_1.validateRequired)({ roleId }, ['roleId']);
        if (validationError)
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        const ids = Array.isArray(permissionIds) ? permissionIds : [];
        await pool.query('begin');
        await pool.query('delete from role_permissions where role_id = $1', [roleId]);
        for (const pid of ids) {
            await pool.query('insert into role_permissions (role_id, permission_id) values ($1, $2) on conflict do nothing', [roleId, pid]);
        }
        await pool.query('commit');
        (0, apiHelpers_1.sendSuccess)(res, { roleId, permissionIds: ids });
    }
    catch (err) {
        await pool.query('rollback');
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to set role permissions', err);
    }
}
async function listStaffActivity(pool, req, res) {
    try {
        const { staff_id, action, from, to } = (req.query || {});
        const where = [];
        const params = [];
        if (staff_id) {
            where.push(`staff_id = $${params.length + 1}`);
            params.push(staff_id);
        }
        if (action) {
            where.push(`action ilike $${params.length + 1}`);
            params.push(`%${action}%`);
        }
        if (from) {
            where.push(`created_at >= $${params.length + 1}`);
            params.push(from);
        }
        if (to) {
            where.push(`created_at <= $${params.length + 1}`);
            params.push(to);
        }
        const sql = `select * from staff_activity_logs ${where.length ? 'where ' + where.join(' and ') : ''} order by created_at desc limit 500`;
        const { rows } = await pool.query(sql, params);
        (0, apiHelpers_1.sendSuccess)(res, rows);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to fetch staff activity logs', err);
    }
}
async function resetPassword(pool, req, res) {
    try {
        const { staffId, newPassword } = req.body || {};
        const validationError = (0, apiHelpers_1.validateRequired)({ staffId, newPassword }, ['staffId', 'newPassword']);
        if (validationError)
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        const hashed = hashPassword(newPassword);
        const { rows } = await pool.query(`update staff_users set password = $2, updated_at = now() where id = $1 returning id`, [staffId, hashed]);
        if (rows.length === 0)
            return (0, apiHelpers_1.sendError)(res, 404, 'Staff not found');
        await logStaff(pool, staffId, 'reset_password');
        (0, apiHelpers_1.sendSuccess)(res, { staffId });
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to reset password', err);
    }
}
async function disableStaff(pool, req, res) {
    try {
        const { staffId } = req.body || {};
        const validationError = (0, apiHelpers_1.validateRequired)({ staffId }, ['staffId']);
        if (validationError)
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        const { rows } = await pool.query(`update staff_users set is_active = false, updated_at = now() where id = $1 returning id`, [staffId]);
        if (rows.length === 0)
            return (0, apiHelpers_1.sendError)(res, 404, 'Staff not found');
        await logStaff(pool, staffId, 'disable_account');
        (0, apiHelpers_1.sendSuccess)(res, { staffId, is_active: false });
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to disable staff', err);
    }
}
async function seedStandardRolesAndPermissions(pool, req, res) {
    try {
        const standardPerms = [
            'products:read', 'products:update', 'orders:read', 'orders:update', 'shipping:read', 'shipping:update', 'invoices:read', 'returns:read', 'returns:update', 'returns:create', 'analytics:read', 'marketing:read', 'users:read', 'users:update', 'cms:read', 'payments:read', 'pos:read', 'pos:update'
        ];
        const standardRoles = {
            'admin': standardPerms,
            'manager': ['products:read', 'products:update', 'orders:read', 'orders:update', 'shipping:read', 'shipping:update', 'invoices:read', 'returns:read', 'returns:update', 'analytics:read', 'marketing:read', 'users:read'],
            'staff': ['orders:read', 'orders:update', 'shipping:read', 'shipping:update', 'invoices:read', 'returns:read', 'returns:update'],
            'viewer': ['products:read', 'orders:read', 'analytics:read']
        };
        await pool.query('begin');
        // Ensure permissions
        const permIdByCode = {};
        for (const code of standardPerms) {
            const pr = await pool.query(`insert into permissions (code) values ($1) on conflict (code) do nothing returning id`, [code]);
            if (pr.rows[0]?.id)
                permIdByCode[code] = pr.rows[0].id;
            else {
                const sel = await pool.query('select id from permissions where code = $1', [code]);
                if (sel.rows[0]?.id)
                    permIdByCode[code] = sel.rows[0].id;
            }
        }
        // Ensure roles and assignments
        for (const [roleName, codes] of Object.entries(standardRoles)) {
            const rr = await pool.query(`insert into roles (name) values ($1) on conflict (name) do nothing returning id`, [roleName]);
            const roleId = rr.rows[0]?.id || (await pool.query('select id from roles where name = $1', [roleName])).rows[0]?.id;
            if (!roleId)
                continue;
            await pool.query('delete from role_permissions where role_id = $1', [roleId]);
            for (const code of codes) {
                const pid = permIdByCode[code];
                if (pid)
                    await pool.query('insert into role_permissions (role_id, permission_id) values ($1, $2) on conflict do nothing', [roleId, pid]);
            }
        }
        await pool.query('commit');
        (0, apiHelpers_1.sendSuccess)(res, { ok: true });
    }
    catch (err) {
        await pool.query('rollback');
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to seed roles/permissions', err);
    }
}
