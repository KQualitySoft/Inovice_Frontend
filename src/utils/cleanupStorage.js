/**
 * Purges legacy mock/offline data from localStorage so only authentic
 * database records are displayed in the application.
 */
export function purgeLegacyMockData() {
  const legacyKeys = [
    'invox_invoices',
    'invox_invoice_fulldata',
    'invox_quotations',
    'invox_quotation_fulldata',
    'invox_purchase_orders',
    'invox_po_fulldata',
    'invox_purchase_order_fulldata',
    'invox_challans',
    'invox_delivery_challans',
    'invox_challan_fulldata',
    'invox_delivery_challan_fulldata',
    'invox_proformas',
    'invox_proforma_invoices',
    'invox_proforma_fulldata',
    'invox_payment_vouchers',
    'invox_payment_voucher_fulldata',
    'invox_approval_history',
    'invox_inapp_notifications',
    'invoiceDrafts',
    'invox_approval_seeded_v2',
    'invox_clients'
  ];

  legacyKeys.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  });

  // Also clean any user-prefixed variants (e.g. admin@qualitysalespro.com_invox_invoices)
  try {
    const allStorageKeys = Object.keys(localStorage);
    allStorageKeys.forEach((k) => {
      if (
        legacyKeys.some((baseKey) => k.endsWith(`_${baseKey}`)) ||
        k.startsWith('invox_mock_') ||
        k.includes('_seed_')
      ) {
        localStorage.removeItem(k);
      }
    });
  } catch (_) {}
}
