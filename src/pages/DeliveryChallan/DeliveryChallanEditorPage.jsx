import React from 'react';
import DocumentEditor from '../../components/documents/DocumentEditor';
import { deliveryChallansApi } from '../../services/api';

export default function DeliveryChallanEditorPage() {
  const config = {
    docType: 'delivery_challan',
    docTitle: 'Delivery Challan',
    defaultPrefix: 'DC-KQSPL-',
    apiService: deliveryChallansApi,
    fullDataStorageKey: 'invox_challan_fulldata',
    draftType: 'delivery_challan',
    supportsRefPo: true,
    supportsRefDc: false,
    supportsRefPi: false,
    supportsRefQuotation: false,
    convertTarget: {
      to: '/proforma/new',
      label: 'Convert to Proforma Invoice',
      storageKey: 'invox_convert_to_proforma'
    }
  };

  return <DocumentEditor config={config} />;
}
