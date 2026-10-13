import {
  createFullPrivileges,
  createStandardUserPrivileges
} from './permissionService.js';
import { usersApi } from './api.js';

const USERS_STORAGE_KEY = 'invox_users_v2';
const ACTIVITY_STORAGE_KEY = 'invox_user_activity';

// ── Initial Default Seed Accounts (Main Admin Only) ──
const INITIAL_USERS = [
  {
    id: 1,
    employeeId: 'EMP-0001',
    username: 'admin',
    email: 'admin@qualitysalespro.com',
    password: 'Admin@123',
    fullName: 'Main Administrator',
    role: 'MainAdmin',
    isActive: true,
    privileges: createFullPrivileges(),
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: new Date().toISOString()
  }
];

export function formatNameFromEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const prefix = email.split('@')[0] || '';
  const parts = prefix.split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) return prefix;
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function sanitizeUser(u) {
  if (!u) return u;
  const emailName = formatNameFromEmail(u.email);
  const raw = (u.fullName || '').trim();
  const isEmpPlaceholder = !raw || /^EMP-\d+/i.test(raw) || (u.employeeId && raw.toLowerCase() === String(u.employeeId).toLowerCase());
  return {
    ...u,
    fullName: isEmpPlaceholder ? (emailName || raw || u.employeeId || 'User') : raw
  };
}

export const userService = {
  // 1. Get all users from Database with LocalStorage cache fallback
  getUsersAsync: async () => {
    try {
      const serverUsers = await usersApi.getAll();
      if (Array.isArray(serverUsers) && serverUsers.length > 0) {
        const mapped = serverUsers.map((u) => {
          let privs = null;
          if (u.privilegesJson) {
            try {
              privs = typeof u.privilegesJson === 'string' ? JSON.parse(u.privilegesJson) : u.privilegesJson;
            } catch (e) {}
          }
          const emailName = formatNameFromEmail(u.email);
          const rawFullName = (u.fullName || '').trim();
          const isEmpName = !rawFullName || /^EMP-\d+/i.test(rawFullName) || (u.employeeId && rawFullName.toLowerCase() === String(u.employeeId).toLowerCase());
          const finalFullName = isEmpName ? (emailName || u.username || rawFullName || 'User') : rawFullName;

          return {
            id: u.id,
            employeeId: u.employeeId || ('EMP-' + String(u.id).padStart(4, '0')),
            username: u.username || u.email.split('@')[0],
            email: u.email,
            password: '',
            fullName: finalFullName,
            role: u.role || 'User',
            isActive: u.isActive !== undefined ? u.isActive : true,
            privileges: privs || (u.role === 'MainAdmin' ? createFullPrivileges() : createStandardUserPrivileges()),
            createdAt: u.createdAt || new Date().toISOString(),
            lastLoginAt: u.lastLoginAt
          };
        });
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(mapped));
        return mapped.map(sanitizeUser);
      }
    } catch (e) {
      console.warn('API error fetching users, using local cache:', e.message);
    }
    return userService.getUsers();
  },

  getUsers: () => {
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      let list = raw ? JSON.parse(raw) : INITIAL_USERS;
      if (!Array.isArray(list) || list.length === 0) {
        list = INITIAL_USERS;
      }
      return list.map(sanitizeUser);
    } catch (e) {
      return INITIAL_USERS.map(sanitizeUser);
    }
  },

  // 2. Find user by email, username, or employee ID
  findUserByLogin: (identifier) => {
    if (!identifier) return null;
    const users = userService.getUsers();
    const cleanId = String(identifier).trim().toLowerCase();
    const found = users.find(
      (u) =>
        (u.email && u.email.toLowerCase() === cleanId) ||
        (u.username && u.username.toLowerCase() === cleanId) ||
        (u.employeeId && u.employeeId.toLowerCase() === cleanId)
    ) || null;
    return found ? sanitizeUser(found) : null;
  },

  // 3. Find user by ID
  getUserById: (id) => {
    const users = userService.getUsers();
    const found = users.find((u) => String(u.id) === String(id)) || null;
    return found ? sanitizeUser(found) : null;
  },

  // 4. Create new user in Database
  createUser: async (userData) => {
    const users = userService.getUsers();
    const email = (userData.email || '').trim().toLowerCase();
    const employeeId = (userData.employeeId || '').trim();
    const username = (userData.username || '').trim().toLowerCase();
    const password = (userData.temporaryPassword || userData.password || '').trim();

    if (!email) throw new Error('Email is required.');
    if (!password) throw new Error('Temporary password is required.');

    const derivedName = formatNameFromEmail(email);
    const assignedEmpId = employeeId || ('EMP-' + Math.floor(1000 + Math.random() * 9000));
    const assignedUsername = username || assignedEmpId.toLowerCase() || email.split('@')[0];
    const privileges = userData.privileges || (userData.role === 'MainAdmin' ? createFullPrivileges() : createStandardUserPrivileges());
    const finalFullName = (userData.fullName || '').trim() && !/^EMP-\d+/i.test(userData.fullName)
      ? userData.fullName.trim()
      : (derivedName || assignedEmpId);

    // Create user directly in the database
    const createdDbUser = await usersApi.create({
      email: email,
      username: assignedUsername,
      fullName: finalFullName,
      password: password,
      role: userData.role || 'User',
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      privilegesJson: JSON.stringify(privileges)
    });

    const newUser = {
      id: createdDbUser?.id || ('usr_' + Date.now()),
      employeeId: assignedEmpId,
      username: assignedUsername,
      email: email,
      password: password,
      fullName: finalFullName,
      role: userData.role || 'User',
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      privileges: privileges,
      createdAt: createdDbUser?.createdAt || new Date().toISOString(),
      lastLoginAt: null
    };

    users.push(newUser);
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

    userService.logActivity({
      userEmail: 'admin@qualitysalespro.com',
      userName: 'Main Administrator',
      action: 'Create User',
      details: `Created user account for ${newUser.fullName} (Emp ID: ${newUser.employeeId}, Email: ${newUser.email}) with role ${newUser.role}`
    });

    return newUser;
  },

  // 5. Update user in Database
  updateUser: async (id, updates) => {
    const users = userService.getUsers();
    const idx = users.findIndex((u) => String(u.id) === String(id));
    if (idx === -1) throw new Error('User not found.');

    const current = users[idx];

    if (String(current.id) === '1' && updates.role && updates.role !== 'MainAdmin') {
      throw new Error('Cannot downgrade primary Main Admin account.');
    }

    const updated = {
      ...current,
      ...updates,
      id: current.id,
      createdAt: current.createdAt
    };

    if (updates.role === 'MainAdmin' && current.role !== 'MainAdmin') {
      updated.privileges = createFullPrivileges();
    }

    users[idx] = updated;
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

    const numericId = parseInt(id, 10);
    if (!isNaN(numericId)) {
      try {
        await usersApi.update(numericId, {
          fullName: updated.fullName,
          role: updated.role,
          isActive: updated.isActive,
          privilegesJson: JSON.stringify(updated.privileges)
        });
      } catch (e) {
        console.warn('Backend user update sync error:', e.message);
      }
    }

    userService.logActivity({
      userEmail: 'admin@qualitysalespro.com',
      userName: 'Main Administrator',
      action: 'Update User',
      details: `Updated details and privileges for ${updated.fullName} (${updated.email})`
    });

    return updated;
  },

  // 6. Toggle Active / Inactive Status in Database
  toggleUserStatus: async (id) => {
    const users = userService.getUsers();
    const idx = users.findIndex((u) => String(u.id) === String(id));
    if (idx === -1) throw new Error('User not found.');

    if (String(users[idx].id) === '1') {
      throw new Error('Cannot deactivate primary Main Admin account.');
    }

    users[idx].isActive = !users[idx].isActive;
    const newStatus = users[idx].isActive ? 'Active' : 'Inactive';
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

    const numericToggleId = parseInt(id, 10);
    if (!isNaN(numericToggleId)) {
      try {
        await usersApi.toggleStatus(numericToggleId);
      } catch (e) {
        console.warn('Backend toggleStatus sync error:', e.message);
      }
    }

    userService.logActivity({
      userEmail: 'admin@qualitysalespro.com',
      userName: 'Main Administrator',
      action: 'Change Status',
      details: `Set status of ${users[idx].fullName} (${users[idx].email}) to ${newStatus}`
    });

    return users[idx];
  },

  // 7. Reset User Password in Database
  resetPassword: async (id, newPassword) => {
    if (!newPassword || newPassword.length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }
    const users = userService.getUsers();
    const idx = users.findIndex((u) => String(u.id) === String(id));
    if (idx === -1) throw new Error('User not found.');

    users[idx].password = newPassword;
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));

    const numericResetId = parseInt(id, 10);
    if (!isNaN(numericResetId)) {
      try {
        await usersApi.resetPassword(numericResetId, newPassword);
      } catch (e) {
        console.warn('Backend resetPassword sync error:', e.message);
      }
    }

    userService.logActivity({
      userEmail: 'admin@qualitysalespro.com',
      userName: 'Main Administrator',
      action: 'Reset Password',
      details: `Reset password for ${users[idx].fullName} (${users[idx].email})`
    });

    return true;
  },

  // 8. Record Last Login
  recordLogin: (id) => {
    const users = userService.getUsers();
    const idx = users.findIndex((u) => String(u.id) === String(id));
    if (idx !== -1) {
      users[idx].lastLoginAt = new Date().toISOString();
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }
  },

  // ── Activity Log Management ──
  getActivityLogs: () => {
    try {
      const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
      let list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  },

  logActivity: (logData) => {
    try {
      const logs = userService.getActivityLogs();
      const newEntry = {
        id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        ...logData
      };
      logs.unshift(newEntry);
      const trimmed = logs.slice(0, 200);
      localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(trimmed));
      return newEntry;
    } catch (e) {
      return null;
    }
  }
};

export default userService;
