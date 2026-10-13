import React from 'react';
import DocumentEditor from '../../components/documents/DocumentEditor';
import { invoicesApi } from '../../services/api';

export default function InvoiceEditorPage() {
  const config = {
    docType: 'invoice',
    docTitle: 'Invoice',
    defaultPrefix: 'KQSPL-',
    apiService: invoicesApi,
    fullDataStorageKey: 'invox_invoice_fulldata',
    draftType: 'invoice',
    supportsRefPo: true,
    supportsRefDc: true,
    supportsRefPi: true,
    supportsRefQuotation: false,
    convertSourceKey: 'invox_convert_to_invoice'
  };

  return <DocumentEditor config={config} />;
}
