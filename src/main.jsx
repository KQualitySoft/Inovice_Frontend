import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import App from './App.jsx';

// Core Styles
import './index.css';
import './styles/style.css';
import './styles/Dashboard.css';
import './styles/invoice.css';
import './styles/Purchaseorder.css';
import './styles/payment-voucher.css';
import './styles/document-dashboard.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
