import { getUserPrefix, getStorageKey, getJSON, setJSON } from '../services/storage.js';
import { clientsApi } from '../services/api.js';

const getClientsKey = () => getStorageKey('invox_clients');

const getDocStores = () => [
  { key: getStorageKey('invox_invoices'), rawKey: 'invox_invoices', nameField: 'billedTo', fullKey: 'invox_invoice_fulldata' },
  { key: getStorageKey('invox_quotations'), rawKey: 'invox_quotations', nameField: 'billedTo', fullKey: 'invox_quotation_fulldata' },
  { key: getStorageKey('invox_purchase_orders'), rawKey: 'invox_purchase_orders', nameField: 'billedTo', fullKey: 'invox_po_fulldata' },
  { key: getStorageKey('invox_delivery_challans'), rawKey: 'invox_delivery_challans', nameField: 'billedTo', fullKey: 'invox_challan_fulldata' },
  { key: getStorageKey('invox_challans'), rawKey: 'invox_challans', nameField: 'consignee', fullKey: 'invox_challan_fulldata' },
  { key: getStorageKey('invox_proforma_invoices'), rawKey: 'invox_proforma_invoices', nameField: 'billedTo', fullKey: 'invox_proforma_fulldata' },
  { key: getStorageKey('invox_proformas'), rawKey: 'invox_proformas', nameField: 'consignee', fullKey: 'invox_proforma_fulldata' }
];

export function loadClients() {
  const userKey = getClientsKey();
  let list = getJSON(userKey, null);
  if (!Array.isArray(list) || list.length === 0) {
    list = getJSON('invox_clients', []);
  }
  if (!Array.isArray(list)) return [];
  const deduped = [];
  list
    .filter((c) => {
      const n = (c.bizName || c.name || '').trim();
      return n && n !== '—' && n.length > 1;
    })
    .forEach((c) => mergeClientIntoList(deduped, c));
  return deduped;
}

export function persistClients(clients) {
  const deduped = [];
  (clients || []).forEach((c) => mergeClientIntoList(deduped, c));
  setJSON(getClientsKey(), deduped);
  setJSON('invox_clients', deduped);
}

export function extractPanFromGstin(gstin) {
  if (!gstin) return '';
  const str = String(gstin).trim().toUpperCase();
  if (!str) return '';
  if (str.length === 15) {
    return str.substring(2, 12);
  }
  if (/^[0-9]{2}[A-Z0-9]{10}/.test(str)) {
    return str.substring(2, 12);
  }
  if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(str)) {
    return str;
  }
  return str;
}

/**
 * Merges a client into the client list with strict de-duplication:
 * One client is saved once only based on name AND/OR GSTIN.
 * If matched, details are updated and any existing duplicate records are pruned.
 */
export function mergeClientIntoList(clients, rawClient) {
  if (!rawClient) return clients;
  const rawName = (rawClient.bizName || rawClient.name || '').trim();
  if (!rawName || rawName === '—' || rawName.length <= 1) return clients;

  const gstinKey = (rawClient.gstin || '').toUpperCase().trim();
  const nameKey = rawName.toLowerCase();
  const now = new Date().toISOString();

  // Find all matches: match by GSTIN (if present) OR match by Name (case-insensitive)
  const matchIndices = [];
  clients.forEach((c, idx) => {
    const cName = (c.bizName || c.name || '').toLowerCase().trim();
    const cGstin = (c.gstin || '').toUpperCase().trim();

    const isGstMatch = Boolean(gstinKey && cGstin && cGstin === gstinKey);
    const isNameMatch = Boolean(nameKey && cName && cName === nameKey);

    if (isGstMatch || isNameMatch) {
      matchIndices.push(idx);
    }
  });

  if (matchIndices.length > 0) {
    // Primary matched entry to update
    const primaryIdx = matchIndices[0];
    const existing = clients[primaryIdx];

    clients[primaryIdx] = {
      ...existing,
      id: existing.id || rawClient.id || ('cli_' + Date.now()),
      bizName: rawName || existing.bizName,
      gstin: rawClient.gstin ? rawClient.gstin.trim() : (existing.gstin || ''),
      country: rawClient.country || existing.country || 'India',
      address: rawClient.address || existing.address || '',
      city: rawClient.city || existing.city || '',
      postal: rawClient.postal || existing.postal || '',
      state: rawClient.state || existing.state || '',
      email: rawClient.email || existing.email || '',
      phone: rawClient.phone || existing.phone || '',
      pan: rawClient.pan ? rawClient.pan.trim() : (existing.pan || extractPanFromGstin(rawClient.gstin) || ''),
      telephoneNumber: rawClient.telephoneNumber || rawClient.telephone || existing.telephoneNumber || existing.telephone || '',
      createdAt: existing.createdAt || rawClient.createdAt || now,
      updatedAt: now
    };

    const allNames = new Set([
      rawName.toLowerCase(),
      (existing.bizName || '').toLowerCase().trim()
    ].filter(Boolean));
    const allGstins = new Set([
      gstinKey,
      (existing.gstin || '').toUpperCase().trim()
    ].filter(Boolean));

    // If there were other duplicates in clients array from pass 1, merge their data into primary and remove them
    for (let i = matchIndices.length - 1; i >= 1; i--) {
      const dupIdx = matchIndices[i];
      const dup = clients[dupIdx];
      if (dup) {
        if (dup.bizName) allNames.add(dup.bizName.toLowerCase().trim());
        if (dup.gstin) allGstins.add(dup.gstin.toUpperCase().trim());
        if (!clients[primaryIdx].gstin && dup.gstin) clients[primaryIdx].gstin = dup.gstin;
        if (!clients[primaryIdx].address && dup.address) clients[primaryIdx].address = dup.address;
        if (!clients[primaryIdx].city && dup.city) clients[primaryIdx].city = dup.city;
        if (!clients[primaryIdx].postal && dup.postal) clients[primaryIdx].postal = dup.postal;
        if (!clients[primaryIdx].state && dup.state) clients[primaryIdx].state = dup.state;
        if (!clients[primaryIdx].pan && dup.pan) clients[primaryIdx].pan = dup.pan;
        if (!clients[primaryIdx].email && dup.email) clients[primaryIdx].email = dup.email;
        if (!clients[primaryIdx].phone && dup.phone) clients[primaryIdx].phone = dup.phone;
        if (!clients[primaryIdx].telephoneNumber && (dup.telephoneNumber || dup.telephone)) {
          clients[primaryIdx].telephoneNumber = dup.telephoneNumber || dup.telephone;
        }
        clients.splice(dupIdx, 1);
      }
    }

    // Secondary pass: prune any remaining connected duplicates in clients
    for (let i = clients.length - 1; i >= 0; i--) {
      if (i === primaryIdx) continue;
      const c = clients[i];
      const cName = (c.bizName || c.name || '').toLowerCase().trim();
      const cGst = (c.gstin || '').toUpperCase().trim();
      const isNameMatch = Boolean(cName && allNames.has(cName));
      const isGstMatch = Boolean(cGst && allGstins.has(cGst));

      if (isNameMatch || isGstMatch) {
        if (!clients[primaryIdx].gstin && c.gstin) clients[primaryIdx].gstin = c.gstin;
        if (!clients[primaryIdx].address && c.address) clients[primaryIdx].address = c.address;
        if (!clients[primaryIdx].city && c.city) clients[primaryIdx].city = c.city;
        if (!clients[primaryIdx].postal && c.postal) clients[primaryIdx].postal = c.postal;
        if (!clients[primaryIdx].state && c.state) clients[primaryIdx].state = c.state;
        if (!clients[primaryIdx].pan && c.pan) clients[primaryIdx].pan = c.pan;
        if (!clients[primaryIdx].email && c.email) clients[primaryIdx].email = c.email;
        if (!clients[primaryIdx].phone && c.phone) clients[primaryIdx].phone = c.phone;
        if (!clients[primaryIdx].telephoneNumber && (c.telephoneNumber || c.telephone)) {
          clients[primaryIdx].telephoneNumber = c.telephoneNumber || c.telephone;
        }
        clients.splice(i, 1);
      }
    }
  } else {
    // New entry
    clients.push({
      id: rawClient.id || ('cli_' + Date.now() + '_' + Math.random().toString(36).slice(2)),
      bizName: rawName,
      gstin: rawClient.gstin ? rawClient.gstin.trim() : '',
      country: rawClient.country || 'India',
      address: rawClient.address || '',
      city: rawClient.city || '',
      postal: rawClient.postal || '',
      state: rawClient.state || '',
      pan: rawClient.pan || '',
      email: rawClient.email || '',
      phone: rawClient.phone || '',
      telephoneNumber: rawClient.telephoneNumber || rawClient.telephone || '',
      createdAt: rawClient.createdAt || now,
      updatedAt: now
    });
  }

  return clients;
}

export function saveClientFromBilledTo(client) {
  if (!client) return;
  const name = (client.bizName || client.name || '').trim();
  if (!name || name === '—') return;
  const gstinVal = (client.gstin || '').trim();
  const panVal = (client.pan || '').trim() || extractPanFromGstin(gstinVal);
  const enrichedClient = {
    ...client,
    pan: panVal
  };
  const clients = loadClients();
  mergeClientIntoList(clients, enrichedClient);
  persistClients(clients);

  // Background sync to backend DB (fire-and-forget, non-blocking)
  try {
    const userId = (() => {
      try { return parseInt(localStorage.getItem('userId')) || null; } catch(e) { return null; }
    })();
    clientsApi.create({
      name,
      gstin: gstinVal || undefined,
      email: (client.email || '').trim() || undefined,
      phone: (client.phone || '').trim() || undefined,
      address: (client.address || '').trim() || undefined,
      city: (client.city || '').trim() || undefined,
      state: (client.state || '').trim() || undefined,
      postal: (client.postal || '').trim() || undefined,
      country: (client.country || 'India').trim(),
      userId
    }).catch(() => {/* backend offline – localStorage already saved */});
  } catch(e) {}
}


export function saveClientFromName(name) {
  if (!name || name === '—') return;
  const clients = loadClients();
  mergeClientIntoList(clients, { bizName: name.trim() });
  persistClients(clients);
}

export function getAllClientsAggregated() {
  const clients = loadClients().map((c) => ({ ...c }));

  // 1. Scan summary and fulldata stores for all document types (excluding payment vouchers)
  const fullDataKeys = [
    'invox_invoice_fulldata',
    'invox_quotation_fulldata',
    'invox_po_fulldata',
    'invox_challan_fulldata',
    'invox_proforma_fulldata'
  ];

  fullDataKeys.forEach((k) => {
    try {
      const fullMap = getJSON(k, {}) || {};
      Object.values(fullMap).forEach((doc) => {
        if (!doc) return;
        const bt = doc.billedTo || doc.consignee;
        if (bt && (typeof bt === 'object') && (bt.bizName || bt.name)) {
          mergeClientIntoList(clients, {
            bizName: bt.bizName || bt.name,
            gstin: bt.gstin || '',
            country: bt.country || '',
            address: bt.address || '',
            city: bt.city || '',
            postal: bt.postal || '',
            state: bt.state || '',
            pan: bt.pan || extractPanFromGstin(bt.gstin) || '',
            email: bt.email || doc.clientEmail || doc.client?.email || doc.email || '',
            phone: bt.phone || doc.clientPhone || doc.client?.phone || doc.phone || '',
            telephoneNumber: bt.telephoneNumber || bt.telephone || doc.client?.telephoneNumber || doc.client?.telephone || doc.telephoneNumber || doc.telephone || '',
            createdAt: doc.date || doc.challanDate || doc.savedAt || ''
          });
        }
      });
    } catch (e) {}
  });

  // 2. Scan summary records
  getDocStores().forEach(({ key, rawKey, nameField, fullKey }) => {
    const records = [...getJSON(key, []), ...getJSON(rawKey, [])];
    const seenRecordIds = new Set();

    records.forEach((record) => {
      if (!record) return;
      const recId = record.id || record.invoiceNo || record.number || record.quotationNumber;
      if (recId && seenRecordIds.has(recId)) return;
      if (recId) seenRecordIds.add(recId);

      const rich = (record.fullData && (record.fullData.billedTo || record.fullData.consignee)) || (typeof record[nameField] === 'object' ? record[nameField] : null);
      if (rich && (rich.bizName || rich.name)) {
        mergeClientIntoList(clients, {
          bizName: rich.bizName || rich.name,
          gstin: rich.gstin || '',
          country: rich.country || '',
          address: rich.address || '',
          city: rich.city || '',
          postal: rich.postal || '',
          state: rich.state || '',
          pan: rich.pan || extractPanFromGstin(rich.gstin) || '',
          email: rich.email || record.fullData?.client?.email || record.fullData?.clientEmail || '',
          phone: rich.phone || record.fullData?.client?.phone || record.fullData?.clientPhone || '',
          telephoneNumber: rich.telephoneNumber || rich.telephone || record.fullData?.client?.telephoneNumber || record.fullData?.client?.telephone || '',
          createdAt: record.savedAt || record.date || ''
        });
        return;
      }

      const rawVal = record[nameField];
      const rawStr = typeof rawVal === 'string' ? rawVal : (rawVal?.bizName || rawVal?.name || record.client?.name || '');
      const name = String(rawStr || '').trim();
      if (name && name !== '—') {
        mergeClientIntoList(clients, {
          bizName: name,
          gstin: record.gstin || (typeof rawVal === 'object' ? rawVal?.gstin : '') || record.client?.gstin || '',
          pan: (typeof rawVal === 'object' ? rawVal?.pan : '') || record.client?.pan || extractPanFromGstin(record.gstin || (typeof rawVal === 'object' ? rawVal?.gstin : '') || record.client?.gstin) || '',
          email: (typeof rawVal === 'object' ? rawVal?.email : '') || record.client?.email || record.email || '',
          phone: (typeof rawVal === 'object' ? rawVal?.phone : '') || record.client?.phone || record.phone || '',
          telephoneNumber: (typeof rawVal === 'object' ? (rawVal?.telephoneNumber || rawVal?.telephone) : '') || record.client?.telephoneNumber || record.client?.telephone || record.telephoneNumber || record.telephone || '',
          createdAt: record.savedAt || record.date || ''
        });
      }
    });
  });

  // 3. Scan invoiceDrafts
  try {
    const drafts = getJSON('invoiceDrafts', []);
    drafts.forEach((d) => {
      const rawDraftName = typeof d.billedTo === 'string' ? d.billedTo : (d.billedTo?.bizName || d.billedTo?.name || '');
      const name = String(rawDraftName || '').trim();
      if (name && name !== '—') {
        mergeClientIntoList(clients, {
          bizName: name,
          createdAt: d.savedAt || ''
        });
      }
    });
  } catch (e) {}

  // 4. Ensure payment voucher payees are not retained in customers data
  const validClientNames = new Set();
  getDocStores().forEach(({ key, rawKey, nameField }) => {
    const records = [...getJSON(key, []), ...getJSON(rawKey, [])];
    records.forEach((r) => {
      const rawBilled = r?.billedTo;
      const rawCons = r?.consignee;
      const rawField = r?.[nameField];
      const rawVal = (typeof rawBilled === 'string' ? rawBilled : (rawBilled?.bizName || rawBilled?.name || '')) ||
        (typeof rawCons === 'string' ? rawCons : (rawCons?.bizName || rawCons?.name || '')) ||
        (typeof rawField === 'string' ? rawField : (rawField?.bizName || rawField?.name || '')) ||
        (r?.client?.name || '');
      const n = String(rawVal || '').trim().toLowerCase();
      if (n && n !== '—') validClientNames.add(n);
    });
  });
  try {
    const drafts = getJSON('invoiceDrafts', []);
    drafts.forEach((d) => {
      const rawD = d.billedTo;
      const rawDStr = typeof rawD === 'string' ? rawD : (rawD?.bizName || rawD?.name || '');
      const n = String(rawDStr || '').trim().toLowerCase();
      if (n && n !== '—') validClientNames.add(n);
    });
  } catch (e) {}

  const pvPayees = new Set();
  try {
    const pvList = [...getJSON(getStorageKey('invox_payment_vouchers'), []), ...getJSON('invox_payment_vouchers', [])];
    pvList.forEach((pv) => {
      if (pv?.paidTo) {
        const pt = typeof pv.paidTo === 'string' ? pv.paidTo : (pv.paidTo?.bizName || pv.paidTo?.name || '');
        if (pt) pvPayees.add(String(pt).trim().toLowerCase());
      }
      if (pv?.fullData?.items) {
        pv.fullData.items.forEach((it) => {
          if (it?.payee) {
            const py = typeof it.payee === 'string' ? it.payee : (it.payee?.bizName || it.payee?.name || '');
            if (py) pvPayees.add(String(py).trim().toLowerCase());
          }
        });
      }
    });
  } catch (e) {}

  const filteredClients = clients.filter((c) => {
    const cName = String(c.bizName || c.name || '').trim().toLowerCase();
    if (!cName) return false;
    if (pvPayees.has(cName) && !validClientNames.has(cName)) {
      return false;
    }
    return true;
  });

  filteredClients.sort((a, b) => (a.bizName || '').localeCompare(b.bizName || ''));
  persistClients(filteredClients);
  return filteredClients;
}

