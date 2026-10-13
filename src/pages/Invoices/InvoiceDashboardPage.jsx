import React from 'react';
import DocumentDashboard from '../../components/documents/DocumentDashboard';
import { invoicesApi } from '../../services/api';

export default function InvoiceDashboardPage() {
  const config = {
    docType: 'invoice',
    docTitle: 'Invoice',
    recipientLabel: 'Billed To',
    apiService: invoicesApi,
    localStorageKey: 'invox_invoices',
    fullDataStorageKey: 'invox_invoice_fulldata',
    createRoute: '/invoices/new',
  };

  return <DocumentDashboard config={config} />;
}
