import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';
import userService, { formatNameFromEmail, sanitizeUser } from '../services/userService';
import { canUserPerform, normalizeModuleKey, createFullPrivileges, createStandardUserPrivileges } from '../services/permissionService';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const token = localStorage.getItem('invox_token');
      const saved = localStorage.getItem('invox_current_user');
      if (token && saved) {
        return sanitizeUser(JSON.parse(saved));
      }
      // If there is no active token, clear stale saved data
      localStorage.removeItem('invox_current_user');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
      return null;
    } catch (e) {
      return null;
    }
  });

  // Verify that logged in user actually exists in the database
  useEffect(() => {
    if (currentUser?.email) {
      userService.getUsersAsync().then((serverUsers) => {
        if (Array.isArray(serverUsers) && serverUsers.length > 0) {
          const existsInDb = serverUsers.some(
            (u) =>
              (u.email && u.email.toLowerCase() === currentUser.email.toLowerCase()) ||
              String(u.id) === String(currentUser.id)
          );
          if (!existsInDb) {
            console.warn(`User ${currentUser.email} does not exist in database. Logging out.`);
            logout();
          }
        }
      }).catch((err) => {
        console.warn('Could not verify user against database:', err.message);
      });
    }
  }, [currentUser?.email]);

  useEffect(() => {
    if (currentUser) {
      const sanitized = sanitizeUser(currentUser);
      localStorage.setItem('invox_current_user', JSON.stringify(sanitized));
      localStorage.setItem('userEmail', sanitized.email);
      localStorage.setItem('userId', sanitized.id);
      localStorage.setItem('userRole', sanitized.role);
    } else {
      localStorage.removeItem('invox_current_user');
      localStorage.removeItem('invox_token');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
    }
  }, [currentUser]);

  // Login handler strictly requiring authentic backend database credentials
  const login = async (identifier, password) => {
    if (!identifier || !identifier.trim()) {
      throw new Error('Email or Username is required.');
    }
    if (!password) {
      throw new Error('Password is required.');
    }

    const cleanId = identifier.trim();

    // Authenticate with Backend API
    const data = await authApi.login(cleanId, password);
    if (!data || !data.token) {
      throw new Error('Authentication failed: No token received from server.');
    }

    localStorage.setItem('invox_token', data.token);

    let parsedPrivileges = null;
    if (data.privilegesJson) {
      try {
        parsedPrivileges = typeof data.privilegesJson === 'string' ? JSON.parse(data.privilegesJson) : data.privilegesJson;
      } catch (e) {}
    }

    const rawFullName = (data.fullName || '').trim();
    const derivedName = formatNameFromEmail(data.email || cleanId);
    const isEmpName = !rawFullName || /^EMP-\d+/i.test(rawFullName) || (data.employeeId && rawFullName.toLowerCase() === String(data.employeeId).toLowerCase());
    const finalFullName = isEmpName ? (derivedName || data.username || cleanId.split('@')[0]) : rawFullName;

    const userObj = {
      id: data.userId || data.id,
      email: data.email || cleanId,
      username: data.username || cleanId.split('@')[0],
      fullName: finalFullName,
      role: data.role || (cleanId.toLowerCase().includes('admin') ? 'MainAdmin' : 'User'),
      isActive: true,
      privileges: parsedPrivileges || (data.role === 'MainAdmin' ? createFullPrivileges() : createStandardUserPrivileges()),
      lastLoginAt: new Date().toISOString()
    };

    // Refresh user cache from backend
    try {
      await userService.getUsersAsync();
    } catch (e) {}

    userService.logActivity({
      userEmail: userObj.email,
      userName: userObj.fullName,
      action: 'Login',
      details: `${userObj.fullName} logged in successfully via API`
    });

    setCurrentUser(userObj);
    return { success: true, user: userObj };
  };

  const signup = async (email, password) => {
    // Strictly register user via backend API
    const res = await authApi.signup(email, password);
    try {
      await userService.getUsersAsync();
    } catch (e) {}
    return res;
  };

  const updateCredentials = async (newEmail, newPassword) => {
    if (!currentUser) throw new Error('You must be logged in to update credentials.');

    // 1. Call backend API
    await authApi.update(currentUser.email, newEmail, newPassword);

    // 2. Update local state
    const updated = {
      ...currentUser,
      email: newEmail || currentUser.email
    };
    if (newPassword) {
      updated.password = newPassword;
    }

    try {
      userService.updateUser(currentUser.id, updated);
    } catch (e) {}

    setCurrentUser(updated);
    return { success: true };
  };

  const logout = () => {
    if (currentUser) {
      userService.logActivity({
        userEmail: currentUser.email,
        userName: currentUser.fullName,
        action: 'Logout',
        details: `${currentUser.fullName} logged out`
      });
    }
    localStorage.removeItem('invox_token');
    setCurrentUser(null);
  };

  const refreshCurrentUser = () => {
    if (!currentUser) return;
    const fresh = userService.getUserById(currentUser.id);
    if (fresh) {
      setCurrentUser(fresh);
    }
  };

  // Privilege helper functions
  const hasModuleAccess = (moduleKey) => {
    if (!currentUser) return false;
    return canUserPerform(currentUser, moduleKey, 'view');
  };

  const hasActionAccess = (moduleKey, action = 'view') => {
    if (!currentUser) return false;
    return canUserPerform(currentUser, moduleKey, action);
  };

  const isMainAdmin = currentUser?.role === 'MainAdmin';
  const isAuthenticated = Boolean(currentUser && currentUser.isActive);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userEmail: currentUser?.email || '',
        userId: currentUser?.id || '',
        userRole: currentUser?.role || 'User',
        fullName: currentUser?.fullName || '',
        isMainAdmin,
        isAuthenticated,
        login,
        signup,
        updateCredentials,
        logout,
        refreshCurrentUser,
        hasModuleAccess,
        hasActionAccess
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
