import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hasAnyApproveOrRejectPrivilege } from '../../services/permissionService';

export default function ProtectedRoute({
  children,
  moduleKey,
  adminOnly = false,
  requireApprovalPrivilege = false
}) {
  const { isAuthenticated, isMainAdmin, currentUser, hasModuleAccess } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isMainAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireApprovalPrivilege) {
    const canApprove = isMainAdmin || hasAnyApproveOrRejectPrivilege(currentUser);
    if (!canApprove) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  if (moduleKey && !isMainAdmin && !hasModuleAccess(moduleKey)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
