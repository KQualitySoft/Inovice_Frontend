import React from 'react';
import DocumentDashboard from '../../components/documents/DocumentDashboard';
import { proformasApi } from '../../services/api';

export default function ProformaDashboardPage() {
  const config = {
    docType: 'proforma_invoice',
    docTitle: 'Proforma Invoice',
    recipientLabel: 'Billed To',
    apiService: proformasApi,
    localStorageKey: 'invox_proformas',
    fullDataStorageKey: 'invox_proforma_fulldata',
    createRoute: '/proforma/new',
  };

  return <DocumentDashboard config={config} />;
}
