import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllClientsAggregated, mergeClientIntoList } from '../../utils/clientHelper';
import { fmtDate } from '../../utils/dateUtils';
import { invoicesApi, clientsApi } from '../../services/api';
import '../../styles/clients.css';

export default function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [dueMap, setDueMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadClientData() {
      try {
        const serverClients = await clientsApi.getAll();
        if (Array.isArray(serverClients)) {
          const mapped = serverClients.map((c) => ({
            id: c.id,
            bizName: c.name,
            gstin: c.gstin || '',
            email: c.email || '',
            phone: c.phone || '',
            address: c.address || '',
            city: c.city || '',
            state: c.state || '',
            postal: c.postal || '',
            country: c.country || 'India',
            createdAt: c.createdAt
          }));
          const dedupedServer = [];
          mapped.forEach((c) => mergeClientIntoList(dedupedServer, c));
          setClients(dedupedServer);
          return;
        }
      } catch (err) {
        console.warn('API clients error, using aggregated local store:', err);
      }
      const all = getAllClientsAggregated();
      const dedupedLocal = [];
      all.forEach((c) => mergeClientIntoList(dedupedLocal, c));
      setClients(dedupedLocal);
    }
    loadClientData();

    // Fetch live due amounts from API
    async function fetchDueAmounts() {
      const map = {};
      try {
        const invoices = await invoicesApi.getAll();
        if (Array.isArray(invoices)) {
          invoices.forEach((inv) => {
            if ((inv.status || '').toLowerCase() === 'paid') return;
            const clientName = inv.client ? inv.client.name || '' : inv.billedTo || '';
            const name = clientName.trim().toLowerCase();
            if (!name || name === '—') return;
            const amt = parseFloat(inv.totalAmount ?? inv.amount) || 0;
            map[name] = (map[name] || 0) + amt;
          });
        }
      } catch (err) {
        console.warn('Backend API unavailable for due amounts, checking localStorage:', err);
        try {
          const storedInvoices = JSON.parse(localStorage.getItem('invox_invoices') || '[]');
          storedInvoices.forEach((inv) => {
            if ((inv.status || '').toLowerCase() === 'paid') return;
            const name = (inv.billedTo || '').trim().toLowerCase();
            if (!name || name === '—') return;
            const amt = parseFloat(inv.amount) || 0;
            map[name] = (map[name] || 0) + amt;
          });
        } catch (e) {}
      }
      setDueMap(map);
    }

    fetchDueAmounts();
  }, []);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [clients]);

  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return sortedClients;
    return sortedClients.filter((c) => {
      const name = (c.bizName || '').toLowerCase();
      const gstin = (c.gstin || '').toLowerCase();
      return name.includes(q) || gstin.includes(q);
    });
  }, [sortedClients, searchQuery]);

  const latestClientName = sortedClients[0]?.bizName || '—';

  return (
    <div className="db-content clients-page" style={{ padding: '28px 32px', maxWidth: '1100px' }}>
      <div className="clients-header">
        <div>
          <div className="clients-title">Clients</div>
          <div className="clients-subtitle">
            Clients are automatically saved when you fill Billed To in any document.
          </div>
        </div>
        <div className="clients-search-wrap">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            type="text"
            id="clientSearch"
            className="clients-search"
            placeholder="Search clients…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="clients-stats">
        <div className="clients-stat-chip">
          <i className="fa-solid fa-user-tie" style={{ color: '#6366f1' }}></i>
          Total Clients: <strong id="statTotal">{clients.length}</strong>
        </div>
        <div className="clients-stat-chip">
          <i className="fa-regular fa-calendar" style={{ color: '#f97316' }}></i>
          Latest Added: <strong id="statLatest">{latestClientName}</strong>
        </div>
      </div>

      {/* Table */}
      <div className="clients-table-wrap">
        <table className="clients-table" id="clientsTable">
          <thead>
            <tr>
              <th>Client</th>
              <th>GSTIN</th>
              <th>City / State</th>
              <th>Added On</th>
              <th>Total Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="clientsTbody">
            {filteredClients.map((c) => {
              const cityState = [c.city, c.state].filter(Boolean).join(', ') || '—';
              const clientKey = (c.bizName || '').trim().toLowerCase();
              const dueAmt = dueMap[clientKey] || 0;
              const dueClass = dueAmt > 0 ? 'due-positive' : 'due-zero';
              const dueLabel = '₹' + dueAmt.toFixed(2);
              const initial = (c.bizName || '?').trim().charAt(0).toUpperCase();

              return (
                <tr
                  key={c.id || c.bizName}
                  onClick={() =>
                    navigate(`/client-invoices?client=${encodeURIComponent(c.bizName || '')}`)
                  }
                >
                  <td>
                    <div className="client-name-cell">
                      <div className="client-avatar">{initial}</div>
                      <div>
                        <div className="client-name-text">{c.bizName || '—'}</div>
                        {c.address && <div className="client-gstin-text">{c.address}</div>}
                      </div>
                    </div>
                  </td>
                  <td>{c.gstin || '—'}</td>
                  <td>{cityState}</td>
                  <td className="client-date-badge">{fmtDate(c.createdAt)}</td>
                  <td>
                    <span className={`due-amount-chip ${dueClass}`}>{dueLabel}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <i className="fa-solid fa-chevron-right ci-chevron"></i>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredClients.length === 0 && (
          <div className="clients-empty" style={{ display: 'block' }}>
            <i className="fa-solid fa-user-slash"></i>
            <p>
              No clients saved yet.
              <br />
              <strong>Fill the "Billed To" section</strong> in any Quotation, Purchase Order,
              Delivery Challan, Proforma Invoice or Invoice and click
              <strong>Save Draft</strong> — the client will appear here automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
