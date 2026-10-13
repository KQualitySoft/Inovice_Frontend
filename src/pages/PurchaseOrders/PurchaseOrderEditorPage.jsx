import React from 'react';
import DocumentEditor from '../../components/documents/DocumentEditor';
import { purchaseOrdersApi } from '../../services/api';

export default function PurchaseOrderEditorPage() {
  const config = {
    docType: 'purchase_order',
    docTitle: 'Purchase Order',
    defaultPrefix: 'PO-',
    apiService: purchaseOrdersApi,
    fullDataStorageKey: 'invox_po_fulldata',
    draftType: 'purchase_order',
    supportsRefPo: false,
    supportsRefDc: false,
    supportsRefPi: false,
    supportsRefQuotation: true
  };

  return <DocumentEditor config={config} />;
}
