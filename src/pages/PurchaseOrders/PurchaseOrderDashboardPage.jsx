import React from 'react';
import DocumentDashboard from '../../components/documents/DocumentDashboard';
import { purchaseOrdersApi } from '../../services/api';

export default function PurchaseOrderDashboardPage() {
  const config = {
    docType: 'purchase_order',
    docTitle: 'Purchase Order',
    recipientLabel: 'Billed To',
    apiService: purchaseOrdersApi,
    localStorageKey: 'invox_purchase_orders',
    fullDataStorageKey: 'invox_po_fulldata',
    createRoute: '/purchase-orders/new',
  };

  return <DocumentDashboard config={config} />;
}
