import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Layout
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/common/ProtectedRoute';

// Auth & Public Pages
import MainPage from './pages/MainPage';
import Login from './pages/Login';
import UpdateCredentials from './pages/UpdateCredentials';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';


// Dashboard & Core Pages
import Dashboard from './pages/Dashboard';
import InvoiceDashboardPage from './pages/Invoices/InvoiceDashboardPage';
import InvoiceEditorPage from './pages/Invoices/InvoiceEditorPage';
import QuotationDashboardPage from './pages/Quotations/QuotationDashboardPage';
import QuotationEditorPage from './pages/Quotations/QuotationEditorPage';
import ProformaDashboardPage from './pages/Proforma/ProformaDashboardPage';
import ProformaEditorPage from './pages/Proforma/ProformaEditorPage';
import DeliveryChallanDashboardPage from './pages/DeliveryChallan/DeliveryChallanDashboardPage';
import DeliveryChallanEditorPage from './pages/DeliveryChallan/DeliveryChallanEditorPage';
import PurchaseOrderDashboardPage from './pages/PurchaseOrders/PurchaseOrderDashboardPage';
import PurchaseOrderEditorPage from './pages/PurchaseOrders/PurchaseOrderEditorPage';
import PaymentVoucherDashboardPage from './pages/PaymentVouchers/PaymentVoucherDashboardPage';
import PaymentVoucherEditorPage from './pages/PaymentVouchers/PaymentVoucherEditorPage';
import ClientsPage from './pages/Clients/ClientsPage';
import ClientInvoicesPage from './pages/Clients/ClientInvoicesPage';
import DraftsPage from './pages/Drafts/DraftsPage';

// Admin & Privilege-Protected Pages
import UserManagementPage from './pages/Users/UserManagementPage';
import PendingApprovalsPage from './pages/Approvals/PendingApprovalsPage';
import ReportsPage from './pages/Reports/ReportsPage';

import { purgeLegacyMockData } from './utils/cleanupStorage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  useEffect(() => {
    purgeLegacyMockData();
  }, []);

  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Public Pages */}
        <Route path="/" element={<MainPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/update-credentials" element={<UpdateCredentials />} />


        {/* Authenticated Layout Routes */}
        <Route element={<AppLayout />}>
          {/* Main Admin Dedicated Modules */}
          <Route
            path="/user-management"
            element={
              <ProtectedRoute adminOnly>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pending-approvals"
            element={
              <ProtectedRoute requireApprovalPrivilege>
                <PendingApprovalsPage />
              </ProtectedRoute>
            }
          />

          {/* Business Modules guarded by permissions */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute moduleKey="dashboard">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          
          {/* Invoices */}
          <Route
            path="/invoices"
            element={
              <ProtectedRoute moduleKey="invoices">
                <InvoiceDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices/new"
            element={
              <ProtectedRoute moduleKey="invoices">
                <InvoiceEditorPage />
              </ProtectedRoute>
            }
          />

          {/* Quotations */}
          <Route
            path="/quotations"
            element={
              <ProtectedRoute moduleKey="quotations">
                <QuotationDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotations/new"
            element={
              <ProtectedRoute moduleKey="quotations">
                <QuotationEditorPage />
              </ProtectedRoute>
            }
          />

          {/* Proforma Invoices */}
          <Route
            path="/proforma"
            element={
              <ProtectedRoute moduleKey="proforma_invoices">
                <ProformaDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/proforma/new"
            element={
              <ProtectedRoute moduleKey="proforma_invoices">
                <ProformaEditorPage />
              </ProtectedRoute>
            }
          />

          {/* Delivery Challans */}
          <Route
            path="/delivery-challan"
            element={
              <ProtectedRoute moduleKey="delivery_challans">
                <DeliveryChallanDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delivery-challan/new"
            element={
              <ProtectedRoute moduleKey="delivery_challans">
                <DeliveryChallanEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delivery-challans"
            element={
              <ProtectedRoute moduleKey="delivery_challans">
                <DeliveryChallanDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delivery-challans/new"
            element={
              <ProtectedRoute moduleKey="delivery_challans">
                <DeliveryChallanEditorPage />
              </ProtectedRoute>
            }
          />

          {/* Purchase Orders */}
          <Route
            path="/purchase-orders"
            element={
              <ProtectedRoute moduleKey="purchase_orders">
                <PurchaseOrderDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchase-orders/new"
            element={
              <ProtectedRoute moduleKey="purchase_orders">
                <PurchaseOrderEditorPage />
              </ProtectedRoute>
            }
          />

          {/* Payment Vouchers */}
          <Route
            path="/payment-vouchers"
            element={
              <ProtectedRoute moduleKey="payment_vouchers">
                <PaymentVoucherDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment-vouchers/new"
            element={
              <ProtectedRoute moduleKey="payment_vouchers">
                <PaymentVoucherEditorPage />
              </ProtectedRoute>
            }
          />

          {/* Clients */}
          <Route
            path="/clients"
            element={
              <ProtectedRoute moduleKey="clients">
                <ClientsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-invoices"
            element={
              <ProtectedRoute moduleKey="clients">
                <ClientInvoicesPage />
              </ProtectedRoute>
            }
          />

          {/* Reports */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute moduleKey="reports">
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          {/* Drafts */}
          <Route path="/drafts" element={<DraftsPage />} />
        </Route>

        {/* Legacy HTML Compatibility Redirects */}
        <Route path="/mainpage.html" element={<Navigate to="/" replace />} />
        <Route path="/login.html" element={<Navigate to="/login" replace />} />

        <Route path="/update-credentials.html" element={<Navigate to="/update-credentials" replace />} />
        <Route path="/Dashboard.html" element={<Navigate to="/dashboard" replace />} />
        <Route path="/InvoiceDashboard.html" element={<Navigate to="/invoices" replace />} />
        <Route path="/invoice.html" element={<Navigate to="/invoices/new" replace />} />
        <Route path="/quotationDashboard.html" element={<Navigate to="/quotations" replace />} />
        <Route path="/Quotation.html" element={<Navigate to="/quotations/new" replace />} />
        <Route path="/ProformaDashboard.html" element={<Navigate to="/proforma" replace />} />
        <Route path="/Proforma.html" element={<Navigate to="/proforma/new" replace />} />
        <Route path="/deliverychallanDashboard.html" element={<Navigate to="/delivery-challan" replace />} />
        <Route path="/Delivery_challan.html" element={<Navigate to="/delivery-challan/new" replace />} />
        <Route path="/Purchaseorderdashboard.html" element={<Navigate to="/purchase-orders" replace />} />
        <Route path="/Purchaseorder.html" element={<Navigate to="/purchase-orders/new" replace />} />
        <Route path="/paymentvoucherDashboard.html" element={<Navigate to="/payment-vouchers" replace />} />
        <Route path="/Payment.html" element={<Navigate to="/payment-vouchers/new" replace />} />
        <Route path="/Clients.html" element={<Navigate to="/clients" replace />} />
        <Route path="/ClientInvoices.html" element={<Navigate to="/client-invoices" replace />} />
        <Route path="/Draft.html" element={<Navigate to="/drafts" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
