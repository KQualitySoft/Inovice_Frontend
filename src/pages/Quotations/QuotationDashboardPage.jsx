import React from 'react';
import DocumentDashboard from '../../components/documents/DocumentDashboard';
import { quotationsApi } from '../../services/api';

export default function QuotationDashboardPage() {
  const config = {
    docType: 'quotation',
    docTitle: 'Quotation',
    recipientLabel: 'Quoted To',
    apiService: quotationsApi,
    localStorageKey: 'invox_quotations',
    fullDataStorageKey: 'invox_quotation_fulldata',
    createRoute: '/quotations/new',
  };

  return <DocumentDashboard config={config} />;
}
