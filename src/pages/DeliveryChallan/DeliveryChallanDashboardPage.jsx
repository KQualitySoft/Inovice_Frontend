import React from 'react';
import DocumentDashboard from '../../components/documents/DocumentDashboard';
import { deliveryChallansApi } from '../../services/api';

export default function DeliveryChallanDashboardPage() {
  const config = {
    docType: 'delivery_challan',
    docTitle: 'Delivery Challan',
    recipientLabel: 'Billed To',
    apiService: deliveryChallansApi,
    localStorageKey: 'invox_challans',
    fullDataStorageKey: 'invox_challan_fulldata',
    createRoute: '/delivery-challan/new',
  };

  return <DocumentDashboard config={config} />;
}
