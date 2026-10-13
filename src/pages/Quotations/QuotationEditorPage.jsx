import React from 'react';
import DocumentEditor from '../../components/documents/DocumentEditor';
import { quotationsApi } from '../../services/api';

export default function QuotationEditorPage() {
  const config = {
    docType: 'quotation',
    docTitle: 'Quotation',
    defaultPrefix: 'QUOT-',
    apiService: quotationsApi,
    fullDataStorageKey: 'invox_quotation_fulldata',
    draftType: 'quotation',
    supportsRefPo: false,
    supportsRefDc: false,
    supportsRefPi: false,
    supportsRefQuotation: false
  };

  return <DocumentEditor config={config} />;
}
