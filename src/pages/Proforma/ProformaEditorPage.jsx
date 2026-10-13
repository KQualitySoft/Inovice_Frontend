import React from 'react';
import DocumentEditor from '../../components/documents/DocumentEditor';
import { proformasApi } from '../../services/api';

export default function ProformaEditorPage() {
  const config = {
    docType: 'proforma_invoice',
    docTitle: 'Proforma Invoice',
    defaultPrefix: 'PI-KQSPL-',
    apiService: proformasApi,
    fullDataStorageKey: 'invox_proforma_fulldata',
    draftType: 'proforma_invoice',
    supportsRefPo: true,
    supportsRefDc: true,
    supportsRefPi: false,
    supportsRefQuotation: false,
    convertTarget: null,
    convertSourceKey: 'invox_convert_to_proforma'
  };

  return <DocumentEditor config={config} />;
}
