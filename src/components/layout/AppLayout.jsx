import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ErrorBoundary from '../common/ErrorBoundary';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  const toggleSidebar = () => {
    setCollapsed((prev) => !prev);
  };

  return (
    <div className="db-app-wrapper db-body">
      <Sidebar collapsed={collapsed} />
      <div className={`db-main ${collapsed ? 'expanded' : ''}`} id="dbMain">
        <Header onToggleSidebar={toggleSidebar} />
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  );
}

