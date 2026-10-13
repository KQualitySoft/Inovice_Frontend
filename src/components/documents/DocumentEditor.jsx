import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import LineItemsTable from './LineItemsTable';
import BankUpiStep from './BankUpiStep';
import CustomiseShareStep from './CustomiseShareStep';
import { getFinancialYear, getDueDate, formatAppDate } from '../../utils/dateUtils';
import { saveClientFromBilledTo, getAllClientsAggregated, extractPanFromGstin } from '../../utils/clientHelper';
import Toast from '../common/Toast';
import defaultLogo from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';
import approvalService, {
  DOC_STATUS,
  normalizeStatus,
  approvalPermissions,
  STORAGE_KEYS,
  validateDocumentForSubmission
} from '../../services/approvalService';
import ApprovalBanner from '../approvals/ApprovalBanner';
import ApprovalStatusBadge from '../approvals/ApprovalStatusBadge';
import {
  ApproveConfirmModal,
  RejectReasonModal,
  ApprovalHistoryModal
} from '../approvals/ApprovalModals';
import userService from '../../services/userService';
import notificationService from '../../services/notificationService';
import { FIXED_BILLED_BY, FIXED_BANK_ACCOUNT, normalizeBankAccounts } from '../../constants/companyDetails';

export default function DocumentEditor({ config }) {
  const {
    docType = 'invoice',
    docTitle = 'Invoice',
    defaultPrefix = 'KQSPL-',
    apiService,
    fullDataStorageKey = 'invox_invoice_fulldata',
    draftType = 'invoice',
    supportsRefPo = true,
    supportsRefDc = true,
    supportsRefPi = false,
    supportsRefQuotation = false,
    convertTarget = null, // e.g. { to: '/proforma/new', label: 'Convert to Proforma Invoice', storageKey: 'invox_convert_to_proforma' }
    convertSourceKey = null // e.g. 'invox_convert_to_invoice'
  } = config;

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { userEmail, userId, userRole, isMainAdmin, hasActionAccess, currentUser } = useAuth();

  const editParam = searchParams.get('edit');
  const copyParam = searchParams.get('copy');
  const newNumParam = searchParams.get('newnum');
  const clientParam = searchParams.get('client');
  const stepParam = searchParams.get('step');
  const viewParam = searchParams.get('view');

  const [currentStep, setCurrentStep] = useState(() => (stepParam === '3' || viewParam === 'true' ? 3 : 1));

  // Approval Lifecycle State
  const [docStatus, setDocStatus] = useState(DOC_STATUS.DRAFT);
  const [submittedBy, setSubmittedBy] = useState('');
  const [submittedAt, setSubmittedAt] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [approvedAt, setApprovedAt] = useState('');
  const [rejectedBy, setRejectedBy] = useState('');
  const [rejectedAt, setRejectedAt] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [historyList, setHistoryList] = useState([]);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);

  // Form State
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [refPoNo, setRefPoNo] = useState('');
  const [refDcNo, setRefDcNo] = useState('');
  const [refPiNo, setRefPiNo] = useState('');
  const [refQuotationNo, setRefQuotationNo] = useState('');
  const [logoSrc, setLogoSrc] = useState(defaultLogo);

  // Billed By (Fixed for all modules)
  const [billedBy, setBilledBy] = useState(FIXED_BILLED_BY);

  // Billed To
  const [billedTo, setBilledTo] = useState({
    country: 'India',
    bizName: '',
    gstin: '',
    address: '',
    city: '',
    postal: '',
    state: '',
    pan: '',
    email: '',
    phone: '',
    telephoneNumber: ''
  });

  // Client Autocomplete State
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientMatches, setClientMatches] = useState([]);

  // Line items
  const [items, setItems] = useState([
    {
      itemName: '',
      desc: '',
      showDesc: false,
      hsn: '',
      gst: '',
      qty: '',
      uom: '',
      rate: '',
      baseUom: '',
      baseRate: '',
      amount: '₹0.00',
      cgst: '₹0.00',
      sgst: '₹0.00',
      total: '₹0.00',
    }
  ]);

  // Optional sections visibility
  const [showTerms, setShowTerms] = useState(false);
  const [terms, setTerms] = useState([]);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [showAttachments, setShowAttachments] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [showContact, setShowContact] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');

  // Bank & UPI accounts
  const [bankAccounts, setBankAccounts] = useState([FIXED_BANK_ACCOUNT]);
  const [upiAccounts, setUpiAccounts] = useState([]);

  // Toast
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState({});

  const fileInputRef = useRef(null);
  const notesEditorRef = useRef(null);

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  // Generate sequence number based on document type
  const generateDocNumber = async () => {
    if (docType === 'quotation' || docType === 'purchase_order') {
      // Date-based daily sequence: SSDDMMYYYY (e.g. 0116092026)
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const todayPart = dd + mm + yyyy; // "DDMMYYYY"
      const todayRegex = new RegExp('^(\\d{2})' + todayPart + '$');

      let allNums = [];
      try {
        if (apiService && apiService.getAll) {
          const all = await apiService.getAll();
          if (Array.isArray(all)) {
            all.forEach((item) => {
              const num = (item.quotationNumber || item.poNumber || item.number || item.invoiceNumber || '').trim();
              if (num) allNums.push(num);
            });
          }
        }
      } catch (e) {
        console.warn('API error for sequence numbering:', e);
      }

      try {
        const fullDataMap = JSON.parse(localStorage.getItem(fullDataStorageKey) || '{}');
        Object.keys(fullDataMap).forEach((k) => allNums.push(k));
        const drafts = JSON.parse(localStorage.getItem('invoiceDrafts') || '[]');
        drafts.forEach((d) => {
          if (d.invoiceNo) allNums.push(d.invoiceNo);
        });
        const storeKey = docType === 'quotation' ? 'invox_quotations' : 'invox_purchase_orders';
        const storeList = JSON.parse(localStorage.getItem(storeKey) || '[]');
        storeList.forEach((s) => {
          if (s.number) allNums.push(s.number);
        });
      } catch (e) {}

      let maxSeq = 0;
      allNums.forEach((num) => {
        const m = num.match(todayRegex);
        if (m) {
          const seq = parseInt(m[1], 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      });
      const nextSeq = String(maxSeq + 1).padStart(2, '0');
      setDocNumber(nextSeq + todayPart);
    } else {
      // Financial year-based: KQSPL-YYYY-YY-SS or DC-KQSPL-YYYY-YY-SS or PI-KQSPL-YYYY-YY-SS
      const fy = getFinancialYear();
      const prefix = `${defaultPrefix}${fy}-`;
      const escapedPrefix = prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp('^' + escapedPrefix + '(\\d+)$', 'i');

      let allNums = [];
      try {
        if (apiService && apiService.getAll) {
          const all = await apiService.getAll();
          if (Array.isArray(all)) {
            all.forEach((item) => {
              const num = (item.invoiceNumber || item.invoiceNo || item.challanNumber || item.number || '').trim();
              if (num) allNums.push(num);
            });
          }
        }
      } catch (e) {
        console.warn('API error for sequence numbering:', e);
      }

      try {
        const fullDataMap = JSON.parse(localStorage.getItem(fullDataStorageKey) || '{}');
        Object.keys(fullDataMap).forEach((k) => allNums.push(k));
        const drafts = JSON.parse(localStorage.getItem('invoiceDrafts') || '[]');
        drafts.forEach((d) => {
          if (d.invoiceNo) allNums.push(d.invoiceNo);
        });
        const storeKey = docType === 'delivery_challan' ? 'invox_challans' : docType === 'proforma_invoice' ? 'invox_proformas' : 'invox_invoices';
        const storeList = JSON.parse(localStorage.getItem(storeKey) || '[]');
        storeList.forEach((s) => {
          if (s.number || s.invoiceNo) allNums.push(s.number || s.invoiceNo);
        });
      } catch (e) {}

      let maxSeq = 0;
      allNums.forEach((num) => {
        const m = num.match(regex);
        if (m) {
          const seq = parseInt(m[1], 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      });
      const nextSeq = String(maxSeq + 1).padStart(2, '0');
      setDocNumber(`${prefix}${nextSeq}`);
    }
  };

  // Check for conversion, edit, copy, or pre-filled client
  useEffect(() => {
    async function init() {
      // 1. Conversion check (e.g. converting Proforma -> Invoice)
      if (convertSourceKey) {
        try {
          const convStr = localStorage.getItem(convertSourceKey);
          if (convStr) {
            const data = JSON.parse(convStr);
            localStorage.removeItem(convertSourceKey);
            if (data) {
              if (data.billedTo) setBilledTo(data.billedTo);
              setBilledBy(FIXED_BILLED_BY);
              if (data.items && data.items.length) setItems(data.items);
              if (data.bankAccounts) setBankAccounts(data.bankAccounts);
              if (data.upiAccounts) setUpiAccounts(data.upiAccounts);

              // TERMS
              const convTerms = Array.isArray(data.terms) ? data.terms : (Array.isArray(data.termsAndConditions) ? data.termsAndConditions : []);
              if (convTerms.length > 0) {
                setTerms(convTerms);
                setShowTerms(true);
              }

              // NOTES
              const convNotes = data.notes || data.note || '';
              if (convNotes && convNotes.trim() && convNotes.trim() !== '<br>') {
                setNotes(convNotes);
                setShowNotes(true);
              }

              // ATTACHMENTS
              const convAtts = Array.isArray(data.attachments) ? data.attachments : (Array.isArray(data.files) ? data.files : []);
              if (convAtts.length > 0) {
                setAttachments(convAtts);
                setShowAttachments(true);
              }

              // CONTACT
              const convEmail = data.contactEmail || data.email || '';
              const convPhone = data.contactPhone || data.phone || '';
              const convCountry = data.countryCode || '+91';
              if (convEmail || convPhone) {
                setContactEmail(convEmail);
                setContactPhone(convPhone);
                setCountryCode(convCountry);
                setShowContact(true);
              }

              if (data.invoiceNo) setRefPiNo(data.invoiceNo);
              if (data.challanNo) setRefDcNo(data.challanNo);
              await generateDocNumber();
              return;
            }
          }
        } catch (e) {}
      }

      // 2. Edit mode
      if (editParam) {
        try {
          const idParam = searchParams.get('id');
          let lookupKey = editParam;
          if ((!lookupKey || lookupKey === '—' || lookupKey === '-' || lookupKey === 'undefined') && idParam) {
            lookupKey = idParam;
          }
          let fullData = await approvalService.getFullDocumentAsync(docType, lookupKey);
          if (!fullData && idParam && lookupKey !== idParam) {
            fullData = await approvalService.getFullDocumentAsync(docType, idParam);
          }
          if (!fullData) {
            const fullDataMap = JSON.parse(localStorage.getItem(fullDataStorageKey) || '{}');
            fullData = fullDataMap[lookupKey] || (idParam ? fullDataMap[idParam] : null);
          }
          if (!fullData) {
            fullData = approvalService.getFullDocument(docType, lookupKey);
          }
          if (!fullData && apiService && apiService.getAll) {
            try {
              const all = await apiService.getAll();
              if (Array.isArray(all) && all.length > 0) {
                const found = (idParam ? all.find((x) => String(x.id) === String(idParam)) : null) || all[all.length - 1];
                if (found) {
                  const fd = found.fullDataJson ? JSON.parse(found.fullDataJson) : {};
                  fullData = { ...found, ...fd };
                }
              }
            } catch (e) {}
          }
          if (fullData) {
            const resolvedDocNum = fullData.proformaNumber || fullData.proformaNo || fullData.invoiceNo || fullData.number || fullData.quotationNumber || fullData.challanNumber || fullData.poNumber || fullData.voucherNumber || fullData.docNumber || (lookupKey !== '—' ? lookupKey : '');
            setDocNumber(resolvedDocNum);
            if (fullData.challanDate || fullData.date) setDocDate(fullData.challanDate || fullData.date);
            if (fullData.dueDate) setDueDate(fullData.dueDate);
            if (fullData.refPoNo) setRefPoNo(fullData.refPoNo);
            if (fullData.refDcNo) setRefDcNo(fullData.refDcNo);
            if (fullData.refPiNo) setRefPiNo(fullData.refPiNo);
            if (fullData.refQuotationNo) setRefQuotationNo(fullData.refQuotationNo);
            if (fullData.logoSrc) setLogoSrc(fullData.logoSrc);
            setBilledBy(FIXED_BILLED_BY);
            const resolvedB = approvalService.resolveDocumentBilledTo
              ? approvalService.resolveDocumentBilledTo(fullData.billedTo || fullData.client, fullData, fullData)
              : null;
            if (resolvedB) {
              setBilledTo((prev) => ({
                ...prev,
                country: resolvedB.country || 'India',
                bizName: resolvedB.bizName !== '—' ? resolvedB.bizName : (prev.bizName || ''),
                gstin: resolvedB.gstin || '',
                address: resolvedB.address || '',
                city: resolvedB.city || '',
                postal: resolvedB.postal || '',
                state: resolvedB.state || '',
                pan: resolvedB.pan || '',
                email: resolvedB.email || '',
                phone: resolvedB.phone || '',
                telephoneNumber: resolvedB.telephoneNumber || ''
              }));
            }
            if (fullData.items && fullData.items.length) setItems(fullData.items);
            const effBankAccounts = normalizeBankAccounts(fullData.bankAccounts);
            setBankAccounts(effBankAccounts);
            try {
              localStorage.setItem('invox_saved_bank_accounts', JSON.stringify(effBankAccounts));
            } catch (e) {}
            if (Array.isArray(fullData.upiAccounts) && fullData.upiAccounts.length > 0) {
              setUpiAccounts(fullData.upiAccounts);
              try {
                localStorage.setItem('invox_saved_upi_accounts', JSON.stringify(fullData.upiAccounts));
              } catch (e) {}
            } else {
              try {
                const savedUpi = JSON.parse(localStorage.getItem('invox_saved_upi_accounts') || '[]');
                if (Array.isArray(savedUpi) && savedUpi.length > 0) setUpiAccounts(savedUpi);
              } catch (e) {}
            }

            // TERMS
            const rawTerms = fullData.terms ?? fullData.termsAndConditions ?? [];
            const loadedTerms = Array.isArray(rawTerms)
              ? rawTerms.filter((t) => t !== undefined && t !== null)
              : (typeof rawTerms === 'string' && rawTerms.trim() ? [rawTerms.trim()] : []);
            setTerms(loadedTerms);
            setShowTerms(loadedTerms.length > 0);

            // NOTES
            const loadedNotes = fullData.notes ?? fullData.note ?? '';
            setNotes(loadedNotes);
            const hasNotes = Boolean(loadedNotes && loadedNotes.trim() && loadedNotes.trim() !== '<br>');
            setShowNotes(hasNotes);
            if (notesEditorRef.current) {
              notesEditorRef.current.innerHTML = loadedNotes;
            }

            // ATTACHMENTS
            const rawAttachments = fullData.attachments ?? fullData.files ?? [];
            const loadedAttachments = Array.isArray(rawAttachments)
              ? rawAttachments
              : (rawAttachments ? [rawAttachments] : []);
            setAttachments(loadedAttachments);
            setShowAttachments(loadedAttachments.length > 0);

            // CONTACT DETAILS
            const loadedEmail = fullData.contactEmail ?? fullData.email ?? '';
            const loadedPhone = fullData.contactPhone ?? fullData.phone ?? '';
            const loadedCountryCode = fullData.countryCode ?? '+91';
            setContactEmail(loadedEmail);
            setContactPhone(loadedPhone);
            setCountryCode(loadedCountryCode);
            setShowContact(Boolean(loadedEmail || loadedPhone));

            // Load status & approval metadata
            let currentStatus = fullData.status ? normalizeStatus(fullData.status) : DOC_STATUS.DRAFT;
            if (fullData.submittedBy) setSubmittedBy(fullData.submittedBy);
            if (fullData.submittedAt) setSubmittedAt(fullData.submittedAt);
            if (fullData.approvedBy) setApprovedBy(fullData.approvedBy);
            if (fullData.approvedAt) setApprovedAt(fullData.approvedAt);
            if (fullData.rejectedBy) setRejectedBy(fullData.rejectedBy);
            if (fullData.rejectedAt) setRejectedAt(fullData.rejectedAt);
            if (fullData.rejectionReason) setRejectionReason(fullData.rejectionReason);

            const storeKey = STORAGE_KEYS[docType] || 'invox_invoices';
            try {
              const storeList = JSON.parse(localStorage.getItem(storeKey) || '[]');
              const match = storeList.find(
                (x) => (x.proformaNumber || x.invoiceNo || x.number || x.quotationNumber || x.challanNumber || x.poNumber || '') === resolvedDocNum || String(x.id) === String(resolvedDocNum) || (idParam && String(x.id) === String(idParam))
              );
              if (match) {
                if (match.status) currentStatus = normalizeStatus(match.status);
                if (match.submittedBy) setSubmittedBy(match.submittedBy);
                if (match.submittedAt) setSubmittedAt(match.submittedAt);
                if (match.approvedBy) setApprovedBy(match.approvedBy);
                if (match.approvedAt) setApprovedAt(match.approvedAt);
                if (match.rejectedBy) setRejectedBy(match.rejectedBy);
                if (match.rejectedAt) setRejectedAt(match.rejectedAt);
                if (match.rejectionReason) setRejectionReason(match.rejectionReason);
              }
            } catch (e) {}

            setDocStatus(currentStatus);

            if (stepParam === '3' || viewParam === 'true' || currentStatus === DOC_STATUS.PENDING_APPROVAL || currentStatus === DOC_STATUS.APPROVED) {
              setCurrentStep(3);
            }

            approvalService.getHistory(docType, fullData.invoiceNo || resolvedDocNum || editParam).then((h) => {
              setHistoryList(h);
            });

            return;
          }
        } catch (e) {}
      }

      // 3. Copy / Duplicate mode
      if (copyParam) {
        try {
          let fullData = await approvalService.getFullDocumentAsync(docType, copyParam);
          if (!fullData && apiService && apiService.getByNumber) {
            try {
              const res = await apiService.getByNumber(copyParam);
              if (res) {
                const fd = res.fullDataJson ? JSON.parse(res.fullDataJson) : {};
                fullData = {
                  ...res,
                  ...fd,
                  items: res.items && res.items.length ? res.items : fd.items || []
                };
              }
            } catch (apiErr) {
              console.warn('API error fetching copy document:', apiErr);
            }
          }
          if (!fullData) {
            const fullDataMap = JSON.parse(localStorage.getItem(fullDataStorageKey) || '{}');
            fullData = fullDataMap[copyParam];
          }
          if (fullData) {
            setDocNumber(newNumParam || `${copyParam}-copy`);
            setBilledBy(FIXED_BILLED_BY);
            const resolvedB = approvalService.resolveDocumentBilledTo
              ? approvalService.resolveDocumentBilledTo(fullData.billedTo || fullData.client, fullData, fullData)
              : null;
            if (resolvedB) {
              setBilledTo((prev) => ({
                ...prev,
                country: resolvedB.country || 'India',
                bizName: resolvedB.bizName !== '—' ? resolvedB.bizName : (prev.bizName || ''),
                gstin: resolvedB.gstin || '',
                address: resolvedB.address || '',
                city: resolvedB.city || '',
                postal: resolvedB.postal || '',
                state: resolvedB.state || '',
                pan: resolvedB.pan || '',
                email: resolvedB.email || '',
                phone: resolvedB.phone || '',
                telephoneNumber: resolvedB.telephoneNumber || ''
              }));
            }
            if (fullData.items && fullData.items.length) setItems(fullData.items);
            const effBankAccounts = normalizeBankAccounts(fullData.bankAccounts);
            setBankAccounts(effBankAccounts);
            try {
              localStorage.setItem('invox_saved_bank_accounts', JSON.stringify(effBankAccounts));
            } catch (e) {}
            if (Array.isArray(fullData.upiAccounts) && fullData.upiAccounts.length > 0) {
              setUpiAccounts(fullData.upiAccounts);
            } else {
              try {
                const savedUpi = JSON.parse(localStorage.getItem('invox_saved_upi_accounts') || '[]');
                if (Array.isArray(savedUpi) && savedUpi.length > 0) setUpiAccounts(savedUpi);
              } catch (e) {}
            }

            // TERMS
            const rawTerms = fullData.terms ?? fullData.termsAndConditions ?? [];
            const loadedTerms = Array.isArray(rawTerms)
              ? rawTerms.filter((t) => t !== undefined && t !== null)
              : (typeof rawTerms === 'string' && rawTerms.trim() ? [rawTerms.trim()] : []);
            setTerms(loadedTerms);
            setShowTerms(loadedTerms.length > 0);

            // NOTES
            const loadedNotes = fullData.notes ?? fullData.note ?? '';
            setNotes(loadedNotes);
            const hasNotes = Boolean(loadedNotes && loadedNotes.trim() && loadedNotes.trim() !== '<br>');
            setShowNotes(hasNotes);
            if (notesEditorRef.current) {
              notesEditorRef.current.innerHTML = loadedNotes;
            }

            // ATTACHMENTS
            const rawAttachments = fullData.attachments ?? fullData.files ?? [];
            const loadedAttachments = Array.isArray(rawAttachments)
              ? rawAttachments
              : (rawAttachments ? [rawAttachments] : []);
            setAttachments(loadedAttachments);
            setShowAttachments(loadedAttachments.length > 0);

            // CONTACT DETAILS
            const loadedEmail = fullData.contactEmail ?? fullData.email ?? '';
            const loadedPhone = fullData.contactPhone ?? fullData.phone ?? '';
            const loadedCountryCode = fullData.countryCode ?? '+91';
            setContactEmail(loadedEmail);
            setContactPhone(loadedPhone);
            setCountryCode(loadedCountryCode);
            setShowContact(Boolean(loadedEmail || loadedPhone));

            setDocStatus(DOC_STATUS.DRAFT);
            setSubmittedBy('');
            setSubmittedAt('');
            setApprovedBy('');
            setApprovedAt('');
            setRejectedBy('');
            setRejectedAt('');
            setRejectionReason('');
            return;
          }
        } catch (e) {
          console.warn('Error loading document to duplicate:', e);
        }
      }

      // 4. Default: generate new number
      await generateDocNumber();
      try {
        const saved = JSON.parse(localStorage.getItem('invox_saved_bank_accounts') || '[]');
        const effBank = normalizeBankAccounts(saved);
        setBankAccounts(effBank);
        localStorage.setItem('invox_saved_bank_accounts', JSON.stringify(effBank));
      } catch (e) {
        setBankAccounts([FIXED_BANK_ACCOUNT]);
      }

      // 5. Pre-fill client from query — load full record if available
      if (clientParam) {
        const allClients = getAllClientsAggregated();
        const matched = allClients.find(
          (c) => (c.bizName || '').trim().toLowerCase() === clientParam.trim().toLowerCase()
        );
        if (matched) {
          setBilledTo({
            country: matched.country || 'India',
            bizName: matched.bizName || clientParam,
            gstin: matched.gstin || '',
            address: matched.address || '',
            city: matched.city || '',
            postal: matched.postal || '',
            state: matched.state || '',
            pan: matched.pan || '',
            email: matched.email || '',
            phone: matched.phone || '',
            telephoneNumber: matched.telephoneNumber || matched.telephone || ''
          });
        } else {
          setBilledTo((prev) => ({ ...prev, bizName: clientParam }));
        }
      }
    }

    init();
  }, [editParam, copyParam, newNumParam, clientParam, convertSourceKey]);

  // Client autocomplete handling
  const handleClientNameChange = (val) => {
    setBilledTo((prev) => ({ ...prev, bizName: val }));
    if (errors.billedToName) setErrors((prev) => ({ ...prev, billedToName: '' }));

    if (val.trim().length > 0) {
      const allClients = getAllClientsAggregated();
      const matches = allClients.filter(
        (c) => c.bizName && c.bizName.toLowerCase().includes(val.toLowerCase())
      );
      setClientMatches(matches);
      setShowClientDropdown(matches.length > 0);
    } else {
      setShowClientDropdown(false);
    }
  };

  const handleSelectClient = (client) => {
    if (!client) return;
    setBilledTo({
      country: client.country || 'India',
      bizName: client.bizName || client.name || '',
      gstin: client.gstin || '',
      address: client.address || '',
      city: client.city || '',
      postal: client.postal || client.zip || '',
      state: client.state || '',
      pan: client.pan || '',
      email: client.email || '',
      phone: client.phone || '',
      telephoneNumber: client.telephoneNumber || client.telephone || ''
    });
    if (errors.billedToName || errors.billedToGstin) {
      setErrors((prev) => ({ ...prev, billedToName: '', billedToGstin: '' }));
    }
    setShowClientDropdown(false);
  };

  // Logo upload
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLogoSrc(ev.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Sync notes rich text editor with state when section opens or notes load
  useEffect(() => {
    if (showNotes && notesEditorRef.current && notes) {
      if (notesEditorRef.current.innerHTML !== notes) {
        notesEditorRef.current.innerHTML = notes;
      }
    }
  }, [showNotes, notes]);

  // Terms and conditions handlers
  const handleAddTerm = () => {
    setShowTerms(true);
    setTerms((prev) => (prev && prev.length > 0 ? prev : ['']));
  };

  const handleTermChange = (idx, val) => {
    const updated = [...terms];
    updated[idx] = val;
    setTerms(updated);
  };

  const handleRemoveTerm = (idx) => {
    const updated = terms.filter((_, i) => i !== idx);
    setTerms(updated);
    if (updated.length === 0) setShowTerms(false);
  };

  const handleMoveTerm = (idx, dir) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= terms.length) return;
    const updated = [...terms];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setTerms(updated);
  };

  // Notes rich text commands
  const handleFormatText = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    if (notesEditorRef.current) {
      setNotes(notesEditorRef.current.innerHTML);
    }
  };

  // Attachment upload
  const handleAttachmentUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      if (file.size > 50 * 1024 * 1024) {
        alert(`"${file.name}" exceeds 50 MB limit.`);
        return;
      }
      setAttachments((prev) => [...prev, file.name]);
    });
    e.target.value = '';
  };

  // Collect all data for save & preview
  const collectFormData = () => {
    const clean = (val) => parseFloat(String(val || '').replace(/[^\d.]/g, '')) || 0;
    const totalAmt = items.reduce((sum, item) => sum + clean(item.total), 0);
    const currentNotes = (notesEditorRef.current ? notesEditorRef.current.innerHTML : notes) || notes || '';
    return {
      docType,
      docTitle,
      invoiceNo: docNumber,
      number: docNumber,
      proformaNumber: docNumber,
      proformaNo: docNumber,
      quotationNumber: docNumber,
      challanNumber: docNumber,
      poNumber: docNumber,
      challanNo: docNumber,
      poNo: docNumber,
      date: docDate,
      docDate,
      dueDate,
      refPoNo,
      refDcNo,
      refPiNo,
      refQuotationNo,
      logoSrc,
      billedBy: FIXED_BILLED_BY,
      billedTo: {
        ...billedTo,
        pan: billedTo.pan || '',
        email: billedTo.email || '',
        phone: billedTo.phone || '',
        telephoneNumber: billedTo.telephoneNumber || billedTo.telephone || ''
      },
      client: {
        name: billedTo.bizName || '',
        bizName: billedTo.bizName || '',
        gstin: billedTo.gstin || '',
        pan: billedTo.pan || '',
        address: billedTo.address || '',
        city: billedTo.city || '',
        postal: billedTo.postal || '',
        state: billedTo.state || '',
        country: billedTo.country || 'India',
        email: billedTo.email || '',
        phone: billedTo.phone || '',
        telephoneNumber: billedTo.telephoneNumber || billedTo.telephone || ''
      },
      items,
      totalAmount: totalAmt,
      amount: totalAmt,
      bankAccounts: normalizeBankAccounts(bankAccounts),
      upiAccounts,
      terms,
      termsAndConditions: terms,
      notes: currentNotes,
      note: currentNotes,
      attachments,
      contactEmail,
      contactPhone,
      countryCode,
      status: docStatus,
      submittedBy,
      submittedAt,
      approvedBy,
      approvedAt,
      rejectedBy,
      rejectedAt,
      rejectionReason
    };
  };

  // Save to database & localStorage
  const saveDocument = async (status = docStatus) => {
    const fullData = collectFormData();
    fullData.status = status;
    const clean = (val) => parseFloat(String(val || '').replace(/[^\d.]/g, '')) || 0;
    const totalAmt = items.reduce((sum, item) => sum + clean(item.total), 0);
    const currentNotes = fullData.notes || '';

    // 1. Save client details to directory
    saveClientFromBilledTo({
      ...billedTo,
      pan: billedTo.pan || '',
      email: billedTo.email || '',
      phone: billedTo.phone || '',
      telephoneNumber: billedTo.telephoneNumber || billedTo.telephone || ''
    });

    // 2. Save fullData to localStorage so edit/duplicate can restore
    try {
      const allFull = JSON.parse(localStorage.getItem(fullDataStorageKey) || '{}');
      allFull[docNumber] = fullData;
      if (editParam && editParam !== docNumber) {
        allFull[editParam] = fullData;
      }
      localStorage.setItem(fullDataStorageKey, JSON.stringify(allFull));
    } catch (e) {}

    // 3. Save to summary list for document dashboard
    const storeKey = STORAGE_KEYS[docType] || 'invox_invoices';
    try {
      const storeList = JSON.parse(localStorage.getItem(storeKey) || '[]');
      const record = {
        id: editParam || docNumber,
        invoiceNo: docNumber,
        number: docNumber,
        proformaNumber: docNumber,
        proformaNo: docNumber,
        quotationNumber: docNumber,
        challanNumber: docNumber,
        poNumber: docNumber,
        billedTo: billedTo.bizName || '—',
        date: docDate,
        dueDate,
        totalAmount: totalAmt,
        amount: totalAmt,
        status,
        terms,
        termsAndConditions: terms,
        notes: currentNotes,
        note: currentNotes,
        attachments,
        contactEmail,
        contactPhone,
        countryCode,
        fullData,
        submittedBy,
        submittedAt,
        approvedBy,
        approvedAt,
        rejectedBy,
        rejectedAt,
        rejectionReason,
        savedAt: new Date().toISOString()
      };
      const idx = storeList.findIndex(
        (x) =>
          (x.proformaNumber || x.invoiceNo || x.number || x.quotationNumber || x.challanNumber || x.poNumber || '') === docNumber ||
          String(x.id) === String(docNumber) ||
          (editParam && (String(x.id) === String(editParam) || (x.proformaNumber || x.invoiceNo || x.number || x.quotationNumber || x.challanNumber || x.poNumber || '') === editParam))
      );
      if (idx !== -1) storeList[idx] = { ...storeList[idx], ...record };
      else storeList.push(record);
      localStorage.setItem(storeKey, JSON.stringify(storeList));
    } catch (e) {}

    // 4. Save to invoiceDrafts ONLY IF status === Draft
    try {
      const drafts = JSON.parse(localStorage.getItem('invoiceDrafts') || '[]');
      const di = drafts.findIndex((d) => d.invoiceNo === docNumber);
      if (normalizeStatus(status) === DOC_STATUS.DRAFT) {
        const draftRecord = {
          invoiceNo: docNumber,
          billedTo: billedTo.bizName || '—',
          amount: '₹' + totalAmt.toFixed(2),
          savedAt: new Date().toISOString(),
          type: draftType,
          status: DOC_STATUS.DRAFT
        };
        if (di >= 0) drafts[di] = draftRecord;
        else drafts.push(draftRecord);
      } else if (di >= 0) {
        drafts.splice(di, 1);
      }
      localStorage.setItem('invoiceDrafts', JSON.stringify(drafts));
    } catch (e) {}

    // 5. Call API if available
    try {
      if (apiService && apiService.create) {
        const payload = {
          invoiceNumber: docNumber,
          proformaNumber: docNumber,
          quotationNumber: docNumber,
          challanNumber: docNumber,
          poNumber: docNumber,
          voucherNumber: docNumber,
          date: docDate,
          dueDate: dueDate || docDate,
          totalAmount: totalAmt,
          amount: totalAmt,
          status,
          client: {
            name: billedTo.bizName || 'Unknown Client',
            gstin: billedTo.gstin || '',
            address: billedTo.address || '',
            city: billedTo.city || '',
            postal: billedTo.postal || '',
            state: billedTo.state || '',
            pan: billedTo.pan || '',
            email: billedTo.email || '',
            phone: billedTo.phone || '',
            telephoneNumber: billedTo.telephoneNumber || billedTo.telephone || ''
          },
          items: (items || []).map((it) => ({
            itemName: it.name || it.itemName || it.description || 'Item',
            description: it.description || it.name || '',
            quantity: parseInt(it.quantity || it.qty || 1, 10) || 1,
            unitPrice: parseFloat(it.price || it.rate || it.unitPrice || 0) || 0,
            taxRate: parseFloat(it.tax || it.taxRate || 0) || 0,
            taxAmount: parseFloat(it.taxAmount || 0) || 0,
            discount: parseFloat(it.discount || 0) || 0,
            totalAmount: parseFloat(it.total || it.amount || 0) || 0
          })),
          fullDataJson: JSON.stringify(fullData)
        };
        await apiService.create(payload);
      }
    } catch (err) {
      console.warn('API save offline/failed, document stored in localStorage:', err.message);
    }
  };

  const handleSaveDraft = async () => {
    const requiredAction = editParam ? 'edit' : 'create';
    if (!isMainAdmin && !hasActionAccess(docType, requiredAction)) {
      alert(`You do not have privilege to ${requiredAction} this document.`);
      return;
    }
    setDocStatus(DOC_STATUS.DRAFT);
    await saveDocument(DOC_STATUS.DRAFT);
    triggerToast('Draft Saved Successfully!');
  };

  const handleSubmitApproval = async () => {
    const fullData = collectFormData();
    const validator = typeof validateDocumentForSubmission === 'function'
      ? validateDocumentForSubmission
      : (typeof approvalService?.validateDocumentForSubmission === 'function'
          ? approvalService.validateDocumentForSubmission
          : () => ({ isValid: true, errors: [] }));
    const validation = validator(fullData, docType);
    if (!validation.isValid) {
      const newErrors = {};
      if (!docNumber.trim()) newErrors.docNumber = 'This field is mandatory';
      if (!docDate) newErrors.docDate = 'This field is mandatory';
      setErrors(newErrors);
      notificationService.addNotification({
        title: 'Validation Error',
        message: validation.errors.join('; '),
        type: 'warning'
      });
      setCurrentStep(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setErrors({});
    setApprovalLoading(true);

    try {
      const submitEmail = userEmail || currentUser?.email || 'user@example.com';
      const submitUser = currentUser || {
        email: submitEmail,
        userEmail: submitEmail,
        userId: userId || 'usr',
        userRole: userRole || 'User',
        role: userRole || 'User',
        fullName: currentUser?.fullName || submitEmail
      };

      fullData.submittedBy = submitEmail;
      fullData.submittedAt = new Date().toISOString();

      // Save changes first with current draft status so document exists in database
      await saveDocument(docStatus || DOC_STATUS.DRAFT);

      const res = await approvalService.submitForApproval({
        docType,
        docNumber,
        docData: fullData,
        user: submitUser,
        currentStatus: docStatus
      });

      if (res.success) {
        setDocStatus(DOC_STATUS.PENDING_APPROVAL);
        setSubmittedBy(submitEmail);
        setSubmittedAt(new Date().toISOString());

        try {
          const updatedHistory = await approvalService.getHistory(docType, docNumber);
          setHistoryList(updatedHistory);
        } catch (e) {}

        try {
          userService.logActivity({
            userEmail: submitEmail,
            userName: currentUser?.fullName || submitEmail,
            action: 'Submit for Approval',
            details: `Submitted ${docTitle} ${docNumber} for approval review`
          });
        } catch (e) {}

        const redirectRoute =
          docType === 'quotation' ? '/quotations' :
          docType === 'purchase_order' ? '/purchase-orders' :
          docType === 'delivery_challan' ? '/delivery-challan' :
          docType === 'proforma_invoice' ? '/proforma' :
          docType === 'payment_voucher' ? '/payment-vouchers' :
          '/invoices';

        // 1. In-app notification for the submitter
        notificationService.addNotification({
          title: 'Document Submitted for Approval',
          message: `${docTitle} ${docNumber} submitted for approval successfully!`,
          type: 'success',
          userEmail: submitEmail,
          targetEmail: submitEmail,
          docType,
          docNumber,
          actionUrl: `${redirectRoute}?edit=${encodeURIComponent(docNumber)}&step=3`
        });

        // 2. In-app notification for all approvers
        notificationService.addNotification({
          title: 'New Document Pending Approval',
          message: `New ${docTitle} ${docNumber} submitted by ${currentUser?.fullName || submitEmail} is awaiting review.`,
          type: 'info',
          targetRole: 'approver',
          docType,
          docNumber,
          actionUrl: '/pending-approvals'
        });

        navigate(redirectRoute);
      } else {
        notificationService.addNotification({
          title: 'Submission Failed',
          message: (res.errors && res.errors.join('; ')) || 'Failed to submit document for approval.',
          type: 'danger'
        });
      }
    } catch (err) {
      console.error('Error submitting document for approval:', err);
      notificationService.addNotification({
        title: 'Error Submitting Document',
        message: err.message,
        type: 'danger'
      });
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleConfirmApprove = async (comments) => {
    setApprovalLoading(true);
    const activeRole = userRole || currentUser?.role || (isMainAdmin ? 'MainAdmin' : 'User');
    const activeEmail = userEmail || currentUser?.email || 'admin@qualitysalespro.com';
    const activeId = userId || currentUser?.id || 1;
    const res = await approvalService.approveDocument({
      docType,
      docNumber,
      comments,
      user: { userEmail: activeEmail, userId: activeId, userRole: activeRole, role: activeRole }
    });
    setApprovalLoading(false);
    setApproveModalOpen(false);

    if (res.success) {
      setDocStatus(DOC_STATUS.APPROVED);
      setApprovedBy(activeEmail);
      setApprovedAt(new Date().toISOString());
      const updatedHistory = await approvalService.getHistory(docType, docNumber);
      setHistoryList(updatedHistory);

      userService.logActivity({
        userEmail: activeEmail,
        userName: currentUser?.fullName || 'Main Admin',
        action: 'Document Approved',
        details: `Approved ${docTitle} ${docNumber}`
      });

      notificationService.addNotification({
        title: 'Document Approved',
        message: `${docTitle} ${docNumber} has been approved successfully!`,
        type: 'success',
        targetEmail: submittedBy,
        userEmail: activeEmail,
        docType,
        docNumber,
        actionUrl: `${getDocRoute(docType)}?edit=${encodeURIComponent(docNumber)}&step=3`
      });

      triggerToast(res.message);
    } else {
      notificationService.addNotification({
        title: 'Approval Failed',
        message: res.errors ? res.errors.join('; ') : 'Error approving document',
        type: 'danger'
      });
    }
  };

  const handleConfirmReject = async (reason) => {
    setApprovalLoading(true);
    const activeRole = userRole || currentUser?.role || (isMainAdmin ? 'MainAdmin' : 'User');
    const activeEmail = userEmail || currentUser?.email || 'admin@qualitysalespro.com';
    const activeId = userId || currentUser?.id || 1;
    const res = await approvalService.rejectDocument({
      docType,
      docNumber,
      reason,
      user: { userEmail: activeEmail, userId: activeId, userRole: activeRole, role: activeRole }
    });
    setApprovalLoading(false);
    setRejectModalOpen(false);

    if (res.success) {
      setDocStatus(DOC_STATUS.REJECTED);
      setRejectedBy(userEmail || 'Main Admin');
      setRejectedAt(new Date().toISOString());
      setRejectionReason(reason);
      const updatedHistory = await approvalService.getHistory(docType, docNumber);
      setHistoryList(updatedHistory);

      userService.logActivity({
        userEmail: userEmail || 'admin@example.com',
        userName: currentUser?.fullName || 'Main Admin',
        action: 'Document Rejected',
        details: `Rejected ${docTitle} ${docNumber}. Reason: ${reason}`
      });

      notificationService.addNotification({
        title: 'Document Rejected',
        message: `${docTitle} ${docNumber} was rejected. Reason: "${reason}"`,
        type: 'danger',
        targetEmail: submittedBy,
        userEmail: userEmail,
        docType,
        docNumber,
        actionUrl: `${getDocRoute(docType)}?edit=${encodeURIComponent(docNumber)}&step=3`
      });

      triggerToast(res.message);
    } else {
      notificationService.addNotification({
        title: 'Rejection Failed',
        message: res.errors ? res.errors.join('; ') : 'Error rejecting document',
        type: 'danger'
      });
    }
  };

  const handleSaveContinue = async () => {
    const isLocked = approvalPermissions.isLocked(docStatus);
    if (isLocked) {
      // In read-only mode, directly navigate to step 2/preview
      setCurrentStep(2);
      return;
    }

    // Validate mandatory fields
    const newErrors = {};
    if (!docNumber.trim()) newErrors.docNumber = 'This field is mandatory';
    if (!docDate) newErrors.docDate = 'This field is mandatory';
    if (!dueDate) newErrors.dueDate = 'This field is mandatory';
    if (supportsRefPo && !refPoNo.trim()) newErrors.refPoNo = 'This field is mandatory';
    if (!billedBy.gstin.trim()) newErrors.billedByGstin = 'This field is mandatory';
    if (!billedTo.gstin.trim()) newErrors.billedToGstin = 'This field is mandatory';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setErrors({});
    await saveDocument(docStatus);
    setCurrentStep(2);
  };

  const handleConvert = () => {
    if (!convertTarget) return;
    const data = collectFormData();
    localStorage.setItem(convertTarget.storageKey, JSON.stringify(data));
    navigate(convertTarget.to);
  };

  return (
    <div>
      {/* STEP 1: Main Form Section */}
      {currentStep === 1 && (
        <section className="main">
          {/* Approval Lifecycle Banner */}
          <ApprovalBanner
            status={docStatus}
            isMainAdmin={isMainAdmin}
            submittedBy={submittedBy}
            submittedAt={submittedAt}
            approvedBy={approvedBy}
            approvedAt={approvedAt}
            rejectedBy={rejectedBy}
            rejectedAt={rejectedAt}
            rejectionReason={rejectionReason}
            onApprove={() => setApproveModalOpen(true)}
            onReject={() => setRejectModalOpen(true)}
            onViewHistory={() => setHistoryModalOpen(true)}
          />

          <section className="invoice-main">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <h2 className="editable" style={{ margin: 0 }}>{docTitle}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ApprovalStatusBadge status={docStatus} />
              </div>
            </div>

            <fieldset
              disabled={approvalPermissions.isLocked(docStatus)}
              style={{ border: 'none', padding: 0, margin: 0 }}
            >
              {/* Document Details Block */}
              <section className="invoice-details">
              <div className="field">
                <div className="f-input" style={{ position: 'relative' }}>
                  <label>{docTitle} No*</label>
                  <input
                    type="text"
                    id="invoiceNoInput"
                    value={docNumber}
                    onChange={(e) => {
                      setDocNumber(e.target.value);
                      if (errors.docNumber) setErrors((prev) => ({ ...prev, docNumber: '' }));
                    }}
                    required
                  />
                  {errors.docNumber && (
                    <div className="error-msg" style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                      {errors.docNumber}
                    </div>
                  )}
                </div>

                <div className="f-input">
                  <label>{docTitle} Date*</label>
                  <div className="date-input-wrapper">
                    <input
                      type="date"
                      id="invoiceDateInput"
                      className="native-date-hidden"
                      value={docDate}
                      onChange={(e) => {
                        setDocDate(e.target.value);
                        if (errors.docDate) setErrors((prev) => ({ ...prev, docDate: '' }));
                      }}
                      required
                    />
                    <span className="date-input-overlay" style={{ color: docDate ? '#0f172a' : '#94a3b8' }}>
                      {docDate ? formatAppDate(docDate) : 'dd/mmm/yyyy'}
                    </span>
                  </div>
                  {errors.docDate && (
                    <div className="error-msg" style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                      {errors.docDate}
                    </div>
                  )}
                </div>

                <div className="f-input">
                  <label>Due Date*</label>
                  <div className="date-input-wrapper">
                    <input
                      type="date"
                      id="dueDateInput"
                      className="native-date-hidden"
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                        if (errors.dueDate) setErrors((prev) => ({ ...prev, dueDate: '' }));
                      }}
                      required
                    />
                    <span className="date-input-overlay" style={{ color: dueDate ? '#0f172a' : '#94a3b8' }}>
                      {dueDate ? formatAppDate(dueDate) : 'dd/mmm/yyyy'}
                    </span>
                  </div>
                  {errors.dueDate && (
                    <div className="error-msg" style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                      {errors.dueDate}
                    </div>
                  )}
                </div>

                {supportsRefPo && (
                  <div className="f-input">
                    <label>Reference PO No*</label>
                    <input
                      type="text"
                      id="refPoNo"
                      placeholder="e.g. 0109062026"
                      value={refPoNo}
                      onChange={(e) => {
                        setRefPoNo(e.target.value);
                        if (errors.refPoNo) setErrors((prev) => ({ ...prev, refPoNo: '' }));
                      }}
                      required
                    />
                    {errors.refPoNo && (
                      <div className="error-msg" style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                        {errors.refPoNo}
                      </div>
                    )}
                  </div>
                )}

                {supportsRefDc && (
                  <div className="f-input">
                    <label>Reference DC No</label>
                    <input
                      type="text"
                      id="refDcNo"
                      placeholder="e.g. DC-KQSPL-2026-27-01"
                      value={refDcNo}
                      onChange={(e) => setRefDcNo(e.target.value)}
                    />
                  </div>
                )}

                {supportsRefPi && (
                  <div className="f-input">
                    <label>Reference PI No</label>
                    <input
                      type="text"
                      id="refPiNo"
                      placeholder="e.g. PI-KQSPL-2026-27-01"
                      value={refPiNo}
                      onChange={(e) => setRefPiNo(e.target.value)}
                    />
                  </div>
                )}

                {supportsRefQuotation && (
                  <div className="f-input">
                    <label>Reference Quotation No</label>
                    <input
                      type="text"
                      id="refQuotationNo"
                      placeholder="e.g. 0109062026"
                      value={refQuotationNo}
                      onChange={(e) => setRefQuotationNo(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Logo Upload */}
              <div className="BLogo">
                {logoSrc && (
                  <button
                    type="button"
                    className="remove-logo-btn"
                    onClick={() => setLogoSrc(defaultLogo)}
                    style={{ display: 'block' }}
                  >
                    ✕
                  </button>
                )}
                <label className="logo-box">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    style={{ display: 'none' }}
                  />
                  {!logoSrc ? (
                    <span className="logo-text">
                      Add Business Logo
                      <br />
                      <small>
                        Resolution upto 1080x1080px
                        <br />
                        PNG or JPEG
                      </small>
                    </span>
                  ) : (
                    <img className="logo-preview" src={logoSrc} alt="Preview" style={{ display: 'block' }} />
                  )}
                </label>
              </div>
            </section>

            {/* Billed By & Billed To */}
            <section className="bills">
              {/* Billing From */}
              <div className="billingFrom">
                <div className="bill-1">
                  <h4 className="editable1">Billed By</h4>
                </div>
                <div className="dropdown">
                  <input
                    type="text"
                    placeholder="Select country"
                    value={FIXED_BILLED_BY.country}
                    readOnly
                  />
                  <input
                    type="text"
                    placeholder="Your Business Name"
                    value={FIXED_BILLED_BY.bizName}
                    readOnly
                  />
                  <input
                    type="text"
                    id="yourGstin"
                    placeholder="Your GSTIN*"
                    value={FIXED_BILLED_BY.gstin}
                    readOnly
                  />
                  <input
                    type="text"
                    placeholder="Address"
                    value={FIXED_BILLED_BY.address}
                    readOnly
                  />
                  <div className="city">
                    <input
                      placeholder="City"
                      value={FIXED_BILLED_BY.city}
                      readOnly
                    />
                    <input
                      placeholder="Postal code/Zip code"
                      value={FIXED_BILLED_BY.postal}
                      readOnly
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Select state"
                    value={FIXED_BILLED_BY.state}
                    readOnly
                  />
                  <input
                    type="text"
                    placeholder="PAN"
                    value={`PAN: ${FIXED_BILLED_BY.pan}`}
                    readOnly
                  />
                  <input
                    type="text"
                    placeholder="Email"
                    value={FIXED_BILLED_BY.email}
                    readOnly
                  />
                  <input
                    type="text"
                    placeholder="Phone"
                    value={FIXED_BILLED_BY.phone}
                    readOnly
                  />
                </div>
              </div>

              {/* Billing To */}
              <div className="billingTo">
                <div className="bill-1">
                  <h4 className="editable1">Billed To</h4>
                </div>
                <div className="dropdown" style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Select country"
                    value={billedTo.country}
                    onChange={(e) => setBilledTo({ ...billedTo, country: e.target.value })}
                  />
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Client's Business Name"
                      value={billedTo.bizName}
                      onChange={(e) => handleClientNameChange(e.target.value)}
                      onFocus={() => {
                        if (billedTo.bizName) handleClientNameChange(billedTo.bizName);
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowClientDropdown(false), 250);
                        if (billedTo.bizName && billedTo.bizName.trim().length > 1) {
                          try {
                            const allClients = getAllClientsAggregated();
                            const matched = allClients.find(
                              (c) => (c.bizName || c.name || '').trim().toLowerCase() === billedTo.bizName.trim().toLowerCase()
                            );
                            if (matched) {
                              setBilledTo((prev) => ({
                                ...prev,
                                country: matched.country || prev.country || 'India',
                                bizName: matched.bizName || matched.name || prev.bizName,
                                gstin: matched.gstin || prev.gstin || '',
                                address: matched.address || prev.address || '',
                                city: matched.city || prev.city || '',
                                postal: matched.postal || matched.zip || prev.postal || '',
                                state: matched.state || prev.state || '',
                                pan: matched.pan || prev.pan || '',
                                email: matched.email || prev.email || '',
                                phone: matched.phone || prev.phone || '',
                                telephoneNumber: matched.telephoneNumber || matched.telephone || prev.telephoneNumber || ''
                              }));
                            }
                          } catch (e) {}
                        }
                      }}
                    />
                    {/* Autocomplete dropdown */}
                    {showClientDropdown && clientMatches.length > 0 && (
                      <ul
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          backgroundColor: '#fff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 1000,
                          margin: 0,
                          padding: 0,
                          listStyle: 'none',
                        }}
                      >
                        {clientMatches.map((c) => (
                          <li
                            key={c.id || c.bizName || c.name}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSelectClient(c);
                            }}
                            onClick={() => handleSelectClient(c)}
                            style={{
                              padding: '8px 12px',
                              fontSize: '13px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f1f5f9',
                            }}
                          >
                            <strong>{c.bizName || c.name}</strong> {c.gstin ? `(${c.gstin})` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <input
                    type="text"
                    id="billedToGstin"
                    placeholder="Client's GSTIN*"
                    value={billedTo.gstin}
                    onChange={(e) => {
                      const newGstin = e.target.value;
                      setBilledTo((prev) => ({
                        ...prev,
                        gstin: newGstin
                      }));
                      if (errors.billedToGstin) setErrors((prev) => ({ ...prev, billedToGstin: '' }));
                    }}
                    onBlur={() => {
                      if (billedTo.bizName && billedTo.bizName.trim()) {
                        saveClientFromBilledTo({ ...billedTo });
                      }
                    }}
                    required
                  />
                  {errors.billedToGstin && (
                    <div className="error-msg" style={{ color: '#ef4444', fontSize: '12px', marginTop: '-4px', paddingLeft: '14px' }}>
                      {errors.billedToGstin}
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Address (optional)"
                    value={billedTo.address}
                    onChange={(e) => setBilledTo({ ...billedTo, address: e.target.value })}
                  />
                  <div className="city">
                    <input
                      placeholder="City"
                      value={billedTo.city}
                      onChange={(e) => setBilledTo({ ...billedTo, city: e.target.value })}
                    />
                    <input
                      placeholder="Postal code/Zip code"
                      value={billedTo.postal}
                      onChange={(e) => setBilledTo({ ...billedTo, postal: e.target.value })}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Select state"
                    value={billedTo.state}
                    onChange={(e) => setBilledTo({ ...billedTo, state: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="PAN (optional)"
                    value={billedTo.pan || ''}
                    onChange={(e) => setBilledTo({ ...billedTo, pan: e.target.value })}
                    onBlur={() => {
                      if (billedTo.bizName && billedTo.bizName.trim()) {
                        saveClientFromBilledTo({ ...billedTo, pan: billedTo.pan || '' });
                      }
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Email (optional)"
                    value={billedTo.email || ''}
                    onChange={(e) => setBilledTo({ ...billedTo, email: e.target.value })}
                    onBlur={() => {
                      if (billedTo.bizName && billedTo.bizName.trim()) {
                        saveClientFromBilledTo({ ...billedTo });
                      }
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Phone (optional)"
                    value={billedTo.phone || ''}
                    onChange={(e) => setBilledTo({ ...billedTo, phone: e.target.value })}
                    onBlur={() => {
                      if (billedTo.bizName && billedTo.bizName.trim()) {
                        saveClientFromBilledTo({ ...billedTo });
                      }
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Telephone Number (optional)"
                    value={billedTo.telephoneNumber || billedTo.telephone || ''}
                    onChange={(e) => setBilledTo({ ...billedTo, telephoneNumber: e.target.value, telephone: e.target.value })}
                    onBlur={() => {
                      if (billedTo.bizName && billedTo.bizName.trim()) {
                        saveClientFromBilledTo({ ...billedTo, telephoneNumber: billedTo.telephoneNumber || billedTo.telephone || '' });
                      }
                    }}
                  />
                </div>
              </div>
            </section>

            {/* Line Items Table */}
            <LineItemsTable items={items} onChange={setItems} />

            {/* Additional Sections Toggles */}
            <section className="bAdd">
              {!showTerms && (
                <div onClick={handleAddTerm} style={{ cursor: 'pointer' }}>
                  <span>
                    <i className="fa-solid fa-plus"></i> Add Terms &amp; Conditions
                  </span>
                </div>
              )}
              {!showNotes && (
                <div onClick={() => setShowNotes(true)} style={{ cursor: 'pointer' }}>
                  <span>
                    <i className="fa-regular fa-note-sticky"></i> Add Note
                  </span>
                </div>
              )}
              {!showAttachments && (
                <div onClick={() => setShowAttachments(true)} style={{ cursor: 'pointer' }}>
                  <span>
                    <i className="fa-solid fa-plus"></i> Add Attachment
                  </span>
                </div>
              )}
              {!showContact && (
                <div onClick={() => setShowContact(true)} style={{ cursor: 'pointer' }}>
                  <span>
                    <i className="fa-solid fa-phone"></i> Add Contact Details
                  </span>
                </div>
              )}
            </section>

            {/* Terms & Conditions Block */}
            {showTerms && (
              <section className="terms-box" style={{ display: 'block' }}>
                <div className="terms-header">
                  <h3>Terms and Conditions</h3>
                  <span className="close-terms" onClick={() => setShowTerms(false)} style={{ cursor: 'pointer' }}>
                    ✕
                  </span>
                </div>
                <div className="terms-list">
                  {terms.map((term, i) => (
                    <div className="term-row" key={i}>
                      <span className="term-number">{String(i + 1).padStart(2, '0')}</span>
                      <input
                        className="term-text"
                        type="text"
                        placeholder="Write your term here..."
                        value={term}
                        onChange={(e) => handleTermChange(i, e.target.value)}
                      />
                      <div className="term-row-btns">
                        <button type="button" className="term-btn move-up" onClick={() => handleMoveTerm(i, -1)}>
                          <i className="fa-solid fa-arrow-up"></i>
                        </button>
                        <button type="button" className="term-btn move-down" onClick={() => handleMoveTerm(i, 1)}>
                          <i className="fa-solid fa-arrow-down"></i>
                        </button>
                        <button type="button" className="term-btn del" onClick={() => handleRemoveTerm(i)}>
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="terms-actions">
                  <button type="button" id="addNewTerm" onClick={() => setTerms([...terms, ''])}>
                    <i className="fa-solid fa-plus"></i> Add New Term
                  </button>
                </div>
              </section>
            )}

            {/* Notes Block */}
            {showNotes && (
              <section className="notes-box" style={{ display: 'block' }}>
                <div className="notes-header">
                  <h3>Additional Notes</h3>
                  <span className="close-Btn" onClick={() => setShowNotes(false)} style={{ cursor: 'pointer' }}>
                    ✕
                  </span>
                </div>
                <div className="editor-box">
                  <div className="toolbar">
                    <button type="button" onClick={() => handleFormatText('bold')}><b>B</b></button>
                    <button type="button" onClick={() => handleFormatText('italic')}><i>I</i></button>
                    <button type="button" onClick={() => handleFormatText('strikeThrough')}><s>S</s></button>
                    <div className="divider"></div>
                    <button type="button" onClick={() => handleFormatText('insertHorizontalRule')}>—</button>
                    <button type="button" onClick={() => handleFormatText('formatBlock', 'blockquote')}>❝</button>
                    <div className="divider"></div>
                    <button type="button" onClick={() => handleFormatText('insertUnorderedList')}>•</button>
                    <button type="button" onClick={() => handleFormatText('insertOrderedList')}>1.</button>
                  </div>
                  <div
                    className="editor"
                    ref={notesEditorRef}
                    contentEditable="true"
                    dangerouslySetInnerHTML={{ __html: notes }}
                    onBlur={(e) => setNotes(e.currentTarget.innerHTML)}
                  />
                </div>
              </section>
            )}

            {/* Attachments Block */}
            {showAttachments && (
              <section className="attachment-box" style={{ display: 'block' }}>
                <div className="attachment-header">
                  <h3>Attachments</h3>
                  <span className="close-attachment" onClick={() => setShowAttachments(false)} style={{ cursor: 'pointer' }}>
                    ✕
                  </span>
                </div>
                <p className="attachment-note">
                  Attachments will not appear as separate documents; instead, they will be available as clickable links. Max file size: 10 MB.
                </p>
                <label className="file-upload-box" style={{ cursor: 'pointer' }}>
                  <input type="file" multiple style={{ display: 'none' }} onChange={handleAttachmentUpload} />
                  <i className="fa-solid fa-plus"></i>
                </label>
                <div className="file-list">
                  {attachments.map((fileItem, i) => {
                    const fileName = typeof fileItem === 'string' ? fileItem : (fileItem?.name || 'Attachment');
                    return (
                      <div className="file-chip" key={i}>
                        <i className="fa-solid fa-paperclip"></i>
                        <span>{fileName}</span>
                        <span
                          className="remove-file"
                          onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                        >
                          ✕
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Contact Details Block */}
            {showContact && (
              <section className="contact-box" style={{ display: 'block' }}>
                <div className="contact-header">
                  <h3>Your Contact Details</h3>
                  <span className="close-contact" onClick={() => setShowContact(false)} style={{ cursor: 'pointer' }}>
                    ✕
                  </span>
                </div>
                <div className="contact-body">
                  <span className="contact-prefix">For any enquiry, reach out via email at</span>
                  <div className="contact-field">
                    <i className="fa-regular fa-envelope contact-icon"></i>
                    <input
                      type="email"
                      id="contactEmail"
                      placeholder="Your Email (optional)"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>
                  <span className="contact-prefix">call on</span>
                  <div className="contact-field contact-phone-field">
                    <select
                      id="countryCode"
                      className="country-code-select"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      <option value="+91">🇮🇳 +91</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+61">🇦🇺 +61</option>
                      <option value="+971">🇦🇪 +971</option>
                      <option value="+65">🇸🇬 +65</option>
                      <option value="+49">🇩🇪 +49</option>
                      <option value="+33">🇫🇷 +33</option>
                    </select>
                    <input
                      type="tel"
                      id="contactPhone"
                      placeholder="Phone number (optional)"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>
                </div>
              </section>
            )}
            </fieldset>
          </section>

          {/* Action Bar */}
          {/* Action Bar */}
          <div className="save-action-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!approvalPermissions.isLocked(docStatus) && (
              <button type="button" className="btn-save-draft" onClick={handleSaveDraft}>
                <i className="fa-regular fa-floppy-disk"></i> Save Draft
              </button>
            )}

            {normalizeStatus(docStatus) === DOC_STATUS.PENDING_APPROVAL && (
              <>
                {(isMainAdmin || hasActionAccess(docType, 'reject')) && (
                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(true)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#ef4444',
                      color: '#ffffff',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-xmark"></i> Reject
                  </button>
                )}
                {(isMainAdmin || hasActionAccess(docType, 'approve')) && (
                  <button
                    type="button"
                    onClick={() => setApproveModalOpen(true)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#16a34a',
                      color: '#ffffff',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-check"></i> Approve
                  </button>
                )}
              </>
            )}

            <button type="button" className="btn-save-continue" onClick={handleSaveContinue}>
              {approvalPermissions.isLocked(docStatus) ? 'Continue to Preview ' : 'Save & Continue '}
              <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </section>
      )}

      {/* STEP 2: Bank and UPI Details */}
      {currentStep === 2 && (
        <BankUpiStep
          bankAccounts={bankAccounts}
          upiAccounts={upiAccounts}
          onUpdateBankAccounts={setBankAccounts}
          onUpdateUpiAccounts={setUpiAccounts}
          onBack={() => setCurrentStep(1)}
          onContinue={() => setCurrentStep(3)}
          docTitle={docTitle}
        />
      )}

      {/* STEP 3: Customise & Share Preview */}
      {currentStep === 3 && (
        <CustomiseShareStep
          docData={collectFormData()}
          status={docStatus}
          isLocked={approvalPermissions.isLocked(docStatus)}
          isMainAdmin={isMainAdmin}
          canApprove={isMainAdmin || hasActionAccess(docType, 'approve')}
          canReject={isMainAdmin || hasActionAccess(docType, 'reject')}
          canSubmit={isMainAdmin || hasActionAccess(docType, 'submit')}
          onSubmitApproval={handleSubmitApproval}
          approvalLoading={approvalLoading}
          onEdit={() => {
            if (approvalPermissions.canEdit(docStatus, currentUser, docType)) {
              setCurrentStep(1);
            } else {
              triggerToast('This document is currently locked from editing.');
            }
          }}
          onBackToBank={() => setCurrentStep(2)}
          onCreateNew={async () => {
            await generateDocNumber();
            setDocStatus(DOC_STATUS.DRAFT);
            setCurrentStep(1);
          }}
          onConvert={convertTarget ? handleConvert : null}
          convertLabel={convertTarget ? convertTarget.label : null}
          onApprove={() => setApproveModalOpen(true)}
          onReject={() => setRejectModalOpen(true)}
          onViewHistory={() => setHistoryModalOpen(true)}
          docType={docType}
          docTitle={docTitle}
        />
      )}

      {/* Approval Modals */}
      <ApproveConfirmModal
        isOpen={approveModalOpen}
        docNumber={docNumber}
        onClose={() => setApproveModalOpen(false)}
        onConfirm={handleConfirmApprove}
        loading={approvalLoading}
      />

      <RejectReasonModal
        isOpen={rejectModalOpen}
        docNumber={docNumber}
        onClose={() => setRejectModalOpen(false)}
        onConfirm={handleConfirmReject}
        loading={approvalLoading}
      />


      <Toast message={toastMsg} show={showToast} />
    </div>
  );
}
