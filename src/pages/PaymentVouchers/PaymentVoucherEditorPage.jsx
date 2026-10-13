import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { paymentVouchersApi, clientsApi } from '../../services/api';
import { numberToWords } from '../../utils/numberToWords';
import Toast from '../../components/common/Toast';
import defaultLogo from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';
import approvalService, {
  DOC_STATUS,
  normalizeStatus,
  approvalPermissions,
  validateDocumentForSubmission
} from '../../services/approvalService';
import ApprovalBanner from '../../components/approvals/ApprovalBanner';
import ApprovalStatusBadge from '../../components/approvals/ApprovalStatusBadge';
import {
  ApproveConfirmModal,
  RejectReasonModal,
  ApprovalHistoryModal
} from '../../components/approvals/ApprovalModals';
import { fmtDate } from '../../utils/dateUtils';
import '../../styles/payment-voucher.css';

export default function PaymentVoucherEditorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { userEmail, userId, userRole, isMainAdmin, hasActionAccess, currentUser } = useAuth();

  const editId = searchParams.get('edit') || searchParams.get('id');
  const copyId = searchParams.get('copy');
  const loadId = editId || copyId;

  const voucherCardRef = useRef(null);
  const handlePrintRef = useRef(null);

  // Approval State
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

  // Form State
  const [voucherNumber, setVoucherNumber] = useState(() => `PV-${Date.now()}`);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [amountWords, setAmountWords] = useState('');

  const [paymentRows, setPaymentRows] = useState([
    { description: '', payee: '', attachment: null }
  ]);

  const [receivedSign, setReceivedSign] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [approvedSign, setApprovedSign] = useState('');
  const [approvedDate, setApprovedDate] = useState('');

  // Optional Attachment State (legacy / voucher-level)
  const [attachment, setAttachment] = useState(null); // { name, type, size, dataUrl }
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewAttachmentOpen, setPreviewAttachmentOpen] = useState(false);

  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const viewAttachment = (att) => {
    if (!att || !att.dataUrl) return;
    setPreviewAttachment(att);
    setPreviewAttachmentOpen(true);
  };

  const processRowAttachment = (index, file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const validExts = ['pdf', 'jpg', 'jpeg', 'png'];
    const validMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

    if (!validExts.includes(ext) && !validMimes.includes(file.type)) {
      alert('Please upload a valid PDF or image file (JPG, JPEG, PNG).');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('File size exceeds the 50 MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPaymentRows((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          attachment: {
            name: file.name,
            type: file.type || (ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`),
            size: file.size,
            dataUrl: reader.result
          }
        };
        return updated;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveRowAttachment = (index) => {
    setPaymentRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], attachment: null };
      return updated;
    });
  };

  const processAttachmentFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const validExts = ['pdf', 'jpg', 'jpeg', 'png'];
    const validMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

    if (!validExts.includes(ext) && !validMimes.includes(file.type)) {
      alert('Please upload a valid PDF or image file (JPG, JPEG, PNG).');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('File size exceeds the 50 MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        type: file.type || (ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`),
        size: file.size,
        dataUrl: reader.result
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAttachmentChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      processAttachmentFile(file);
    }
    e.target.value = '';
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
  };

  // Auto-update amount in words when amount changes
  const handleAmountChange = (val) => {
    setAmount(val);
    const num = parseFloat(String(val || '').replace(/,/g, ''));
    if (!isNaN(num) && num > 0) {
      setAmountWords(numberToWords(num));
    } else {
      setAmountWords('');
    }
  };

  useEffect(() => {
    if (!loadId) return;

    async function loadVoucher() {
      // 1. Try Backend API first (single source of truth)
      try {
        let pv = null;
        if (String(loadId).startsWith('PV-')) {
          pv = await paymentVouchersApi.getByNumber(loadId);
        } else {
          try {
            pv = await paymentVouchersApi.getById(loadId);
          } catch {
            pv = await paymentVouchersApi.getByNumber(loadId);
          }
        }

        if (pv) {
          const num = editId ? pv.voucherNumber || `PV-${pv.id}` : (pv.voucherNumber || `PV-${Date.now()}`) + '-copy';
          setVoucherNumber(num);
          if (pv.date) setDate(pv.date.split('T')[0]);
          if (pv.dueDate) setDueDate(pv.dueDate.split('T')[0]);
          if (pv.amount != null) {
            setAmount(String(pv.amount));
            const n = parseFloat(String(pv.amount));
            if (!isNaN(n) && n > 0) setAmountWords(numberToWords(n));
          }

          let finalStatus = pv.status ? normalizeStatus(pv.status) : DOC_STATUS.DRAFT;
          if (pv.submittedBy) setSubmittedBy(pv.submittedBy);
          if (pv.submittedAt) setSubmittedAt(pv.submittedAt);
          if (pv.approvedBy) setApprovedBy(pv.approvedBy);
          if (pv.approvedAt) setApprovedAt(pv.approvedAt);
          if (pv.rejectedBy) setRejectedBy(pv.rejectedBy);
          if (pv.rejectedAt) setRejectedAt(pv.rejectedAt);
          if (pv.rejectionReason) setRejectionReason(pv.rejectionReason);

          const rawFd = pv.fullDataJson || pv.FullDataJson || pv.fullData || pv.FullData;
          if (rawFd) {
            const fd = typeof rawFd === 'string' ? JSON.parse(rawFd) : rawFd;
            if (fd.amountWords) setAmountWords(fd.amountWords);
            if (fd.status && !pv.status) finalStatus = normalizeStatus(fd.status);
            if (fd.submittedBy && !pv.submittedBy) setSubmittedBy(fd.submittedBy);
            if (fd.submittedAt && !pv.submittedAt) setSubmittedAt(fd.submittedAt);
            if (fd.approvedBy && !pv.approvedBy) setApprovedBy(fd.approvedBy);
            if (fd.approvedAt && !pv.approvedAt) setApprovedAt(fd.approvedAt);
            if (fd.rejectedBy && !pv.rejectedBy) setRejectedBy(fd.rejectedBy);
            if (fd.rejectedAt && !pv.rejectedAt) setRejectedAt(fd.rejectedAt);
            if (fd.rejectionReason && !pv.rejectionReason) setRejectionReason(fd.rejectionReason);

            if (fd.items && fd.items.length) {
              setPaymentRows(
                fd.items.map((it, i) => ({
                  description: it.desc || it.description || '',
                  payee: it.payee || '',
                  attachment: it.attachment || (i === 0 && fd.attachment ? fd.attachment : null)
                }))
              );
            }
            const isDocApproved = normalizeStatus(finalStatus) === DOC_STATUS.APPROVED;
            const approverEmail = pv.approvedBy || fd.approvedBy || '';
            const fallbackSign = approverEmail ? (approverEmail.includes('@') ? approverEmail.split('@')[0] : approverEmail) : 'admin';
            const fallbackDate = (pv.approvedAt || fd.approvedAt || pv.date || fd.date || '').split('T')[0] || new Date().toISOString().split('T')[0];

            if (fd.receivedSign) setReceivedSign(fd.receivedSign);
            if (fd.receivedDate) setReceivedDate(fd.receivedDate);
            if (fd.approvedSign) setApprovedSign(fd.approvedSign);
            else if (isDocApproved) setApprovedSign(fallbackSign);

            if (fd.approvedDate) setApprovedDate(fd.approvedDate);
            else if (isDocApproved) setApprovedDate(fallbackDate);

            if (fd.attachment) setAttachment(fd.attachment);
            else setAttachment(null);
          } else {
            const payeeName = pv.client ? pv.client.name : pv.paidTo || '';
            setPaymentRows([{ description: pv.description || '', payee: payeeName }]);
            const isDocApproved = normalizeStatus(finalStatus) === DOC_STATUS.APPROVED;
            const approverEmail = pv.approvedBy || '';
            const fallbackSign = approverEmail ? (approverEmail.includes('@') ? approverEmail.split('@')[0] : approverEmail) : 'admin';
            const fallbackDate = (pv.approvedAt || pv.date || '').split('T')[0] || new Date().toISOString().split('T')[0];

            if (pv.receivedSign) setReceivedSign(pv.receivedSign);
            if (pv.receivedDate) setReceivedDate(pv.receivedDate);
            if (pv.approvedSign) setApprovedSign(pv.approvedSign);
            else if (isDocApproved) setApprovedSign(fallbackSign);

            if (pv.approvedDate) setApprovedDate(pv.approvedDate);
            else if (isDocApproved) setApprovedDate(fallbackDate);

            setAttachment(null);
          }

          if (!editId && copyId) {
            const newNum = searchParams.get('newnum') || `PV-${Date.now()}`;
            setVoucherNumber(newNum);
            finalStatus = DOC_STATUS.DRAFT;
            setDate(new Date().toISOString().split('T')[0]);
            setDueDate('');
            setSubmittedBy('');
            setSubmittedAt('');
            setApprovedBy('');
            setApprovedAt('');
            setRejectedBy('');
            setRejectedAt('');
            setRejectionReason('');
          }

          setDocStatus(finalStatus);

          // Update local cache so it stays synchronized with DB
          try {
            const stored = JSON.parse(localStorage.getItem('invox_payment_vouchers') || '[]');
            const idx = stored.findIndex((x) => String(x.id) === String(pv.id) || x.number === num || x.voucherNumber === num);
            const cacheItem = {
              id: pv.id,
              number: num,
              voucherNumber: num,
              paidTo: pv.client?.name || pv.paidTo || '',
              amount: pv.amount,
              date: pv.date,
              dueDate: pv.dueDate,
              status: finalStatus,
              submittedBy: pv.submittedBy,
              submittedAt: pv.submittedAt,
              approvedBy: pv.approvedBy,
              approvedAt: pv.approvedAt,
              rejectedBy: pv.rejectedBy,
              rejectedAt: pv.rejectedAt,
              rejectionReason: pv.rejectionReason,
              fullData: rawFd
            };
            if (idx !== -1) stored[idx] = { ...stored[idx], ...cacheItem };
            else stored.push(cacheItem);
            localStorage.setItem('invox_payment_vouchers', JSON.stringify(stored));
          } catch (e) {}

          approvalService.getHistory('payment_voucher', num).then((h) => {
            setHistoryList(h);
            const approvedRec = Array.isArray(h) && h.find((x) => x.action === 'Approved');
            if (approvedRec) {
              const histSign = approvedRec.userEmail ? (approvedRec.userEmail.includes('@') ? approvedRec.userEmail.split('@')[0] : approvedRec.userEmail) : 'admin';
              const histDate = approvedRec.createdAt ? approvedRec.createdAt.split('T')[0] : '';
              setApprovedSign((prev) => prev || histSign);
              setApprovedDate((prev) => prev || histDate);
            }
          });
          return;
        }
      } catch (err) {
        console.warn('API load failed, checking localStorage:', err);
      }

      // 2. Fallback localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('invox_payment_vouchers') || '[]');
        const match = stored.find((x) => String(x.id) === String(loadId) || x.number === loadId || x.voucherNumber === loadId);
        if (match) {
          const num = editId ? match.number || `PV-${match.id}` : (match.number || `PV-${Date.now()}`) + '-copy';
          setVoucherNumber(num);
          if (match.date) setDate(match.date);
          if (match.dueDate) setDueDate(match.dueDate);
          if (match.amount) {
            setAmount(String(match.amount));
            const n = parseFloat(String(match.amount));
            if (!isNaN(n) && n > 0) setAmountWords(numberToWords(n));
          }
          if (match.status) setDocStatus(normalizeStatus(match.status));
          if (match.submittedBy) setSubmittedBy(match.submittedBy);
          if (match.submittedAt) setSubmittedAt(match.submittedAt);
          if (match.approvedBy) setApprovedBy(match.approvedBy);
          if (match.approvedAt) setApprovedAt(match.approvedAt);
          if (match.rejectedBy) setRejectedBy(match.rejectedBy);
          if (match.rejectedAt) setRejectedAt(match.rejectedAt);
          if (match.rejectionReason) setRejectionReason(match.rejectionReason);

          if (match.fullData) {
            const fd = typeof match.fullData === 'string' ? JSON.parse(match.fullData) : match.fullData;
            if (fd.amountWords) setAmountWords(fd.amountWords);
            if (fd.items && fd.items.length) {
              setPaymentRows(
                fd.items.map((it, i) => ({
                  description: it.desc || it.description || '',
                  payee: it.payee || '',
                  attachment: it.attachment || (i === 0 && (fd.attachment || match.attachment) ? (fd.attachment || match.attachment) : null)
                }))
              );
            }
            const isDocApproved = normalizeStatus(match.status) === DOC_STATUS.APPROVED;
            const approverEmail = match.approvedBy || (fd && fd.approvedBy) || '';
            const fallbackSign = approverEmail ? (approverEmail.includes('@') ? approverEmail.split('@')[0] : approverEmail) : 'admin';
            const fallbackDate = (match.approvedAt || (fd && fd.approvedAt) || match.date || '').split('T')[0] || new Date().toISOString().split('T')[0];

            if (fd.receivedSign) setReceivedSign(fd.receivedSign);
            if (fd.receivedDate) setReceivedDate(fd.receivedDate);
            if (fd.approvedSign) setApprovedSign(fd.approvedSign);
            else if (isDocApproved) setApprovedSign(fallbackSign);

            if (fd.approvedDate) setApprovedDate(fd.approvedDate);
            else if (isDocApproved) setApprovedDate(fallbackDate);
            if (fd.attachment) setAttachment(fd.attachment);
            else setAttachment(null);
          } else if (match.attachment) {
            setAttachment(match.attachment);
            setPaymentRows([{ description: match.description || '', payee: match.paidTo || '' }]);
          } else {
            setAttachment(null);
            setPaymentRows([{ description: match.description || '', payee: match.paidTo || '' }]);
          }

          approvalService.getHistory('payment_voucher', num).then((h) => {
            setHistoryList(h);
            const approvedRec = Array.isArray(h) && h.find((x) => x.action === 'Approved');
            if (approvedRec) {
              const histSign = approvedRec.userEmail ? (approvedRec.userEmail.includes('@') ? approvedRec.userEmail.split('@')[0] : approvedRec.userEmail) : 'admin';
              const histDate = approvedRec.createdAt ? approvedRec.createdAt.split('T')[0] : '';
              setApprovedSign((prev) => prev || histSign);
              setApprovedDate((prev) => prev || histDate);
            }
          });
        }
      } catch (e) {}
    }

    loadVoucher();

    const handleApprovalUpdate = (e) => {
      const detail = e.detail;
      if (detail && (detail.docNumber === voucherNumber || detail.docNumber === loadId)) {
        loadVoucher();
      }
    };
    window.addEventListener('invox_approvals_updated', handleApprovalUpdate);
    return () => window.removeEventListener('invox_approvals_updated', handleApprovalUpdate);
  }, [loadId, editId, voucherNumber]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        const hasAnyPdf =
          paymentRows.some(
            (r) =>
              r.attachment &&
              r.attachment.dataUrl &&
              (r.attachment.type === 'application/pdf' || (r.attachment.name || '').toLowerCase().endsWith('.pdf'))
          ) ||
          (attachment &&
            attachment.dataUrl &&
            (attachment.type === 'application/pdf' || (attachment.name || '').toLowerCase().endsWith('.pdf')));
        if (hasAnyPdf) {
          e.preventDefault();
          handlePrintRef.current?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attachment, voucherNumber, amount, date, amountWords, paymentRows, receivedSign, receivedDate, approvedSign, approvedDate]);

  const handleAddRow = () => {
    setPaymentRows([...paymentRows, { description: '', payee: '', attachment: null }]);
  };

  const handleRowChange = (index, field, value) => {
    const updated = [...paymentRows];
    updated[index][field] = value;
    setPaymentRows(updated);
  };

  const handleRemoveRow = (index) => {
    if (paymentRows.length <= 1) return;
    setPaymentRows(paymentRows.filter((_, i) => i !== index));
  };

  const isApproved = normalizeStatus(docStatus) === DOC_STATUS.APPROVED;
  const approverRef = approvedBy || (currentUser?.email) || '';
  const fallbackSign = approverRef ? (approverRef.includes('@') ? approverRef.split('@')[0] : approverRef) : 'admin';
  const fallbackDate = approvedAt ? approvedAt.split('T')[0] : (date || new Date().toISOString().split('T')[0]);

  const displayApprovedSign = approvedSign || (isApproved ? fallbackSign : '');
  const displayApprovedDate = approvedDate || (isApproved ? fallbackDate : '');

  const saveVoucher = async (status = docStatus, overrideAppSign = null, overrideAppDate = null) => {
    const primaryPayee = paymentRows[0]?.payee || '';
    const numAmount = parseFloat(String(amount).replace(/,/g, '')) || 0;
    setSaving(true);

    const isTargetApproved = normalizeStatus(status) === DOC_STATUS.APPROVED;
    const finalApprovedSign = overrideAppSign !== null ? overrideAppSign : (approvedSign || (isTargetApproved ? displayApprovedSign : ''));
    const finalApprovedDate = overrideAppDate !== null ? overrideAppDate : (approvedDate || (isTargetApproved ? displayApprovedDate : ''));

    const fullData = {
      amountWords: amountWords || (numAmount ? numberToWords(numAmount) : ''),
      items: paymentRows.map((r) => ({
        desc: r.description,
        payee: r.payee,
        attachment: r.attachment
          ? {
              name: r.attachment.name,
              type: r.attachment.type,
              size: r.attachment.size,
              dataUrl: r.attachment.dataUrl
            }
          : null
      })),
      receivedSign: (receivedSign || '').trim(),
      receivedDate: (receivedDate || '').trim(),
      approvedSign: (finalApprovedSign || '').trim(),
      approvedDate: (finalApprovedDate || '').trim(),
      attachment: attachment
        ? {
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            dataUrl: attachment.dataUrl
          }
        : null,
      status,
      submittedBy,
      submittedAt,
      approvedBy,
      approvedAt,
      rejectedBy,
      rejectedAt,
      rejectionReason
    };

    const record = {
      id: editId || 'pv_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      number: voucherNumber,
      voucherNumber,
      paidTo: primaryPayee,
      amount: numAmount,
      date,
      dueDate,
      paymentMode: 'Cash',
      paymentMethod: 'Cash',
      receivedSign: (receivedSign || '').trim(),
      receivedDate: (receivedDate || '').trim(),
      approvedSign: (finalApprovedSign || '').trim(),
      approvedDate: (finalApprovedDate || '').trim(),
      attachment: attachment || null,
      status,
      submittedBy,
      submittedAt,
      approvedBy,
      approvedAt,
      rejectedBy,
      rejectedAt,
      rejectionReason,
      savedAt: new Date().toISOString(),
      fullData
    };

    // 1. Sync localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('invox_payment_vouchers') || '[]');
      const idx = stored.findIndex((x) => String(x.id) === String(record.id) || x.number === voucherNumber);
      if (idx !== -1) stored[idx] = { ...stored[idx], ...record };
      else stored.push(record);
      localStorage.setItem('invox_payment_vouchers', JSON.stringify(stored));
    } catch (e) {}

    // 2. Sync to API if available (without creating a customer)
    try {
      let match = null;
      if (primaryPayee) {
        try {
          const clients = await clientsApi.getAll();
          match = Array.isArray(clients)
            ? clients.find((c) => c.name && c.name.toLowerCase() === primaryPayee.toLowerCase())
            : null;
        } catch (e) {}
      }

      const savedRes = await paymentVouchersApi.create({
        id: editId && !String(editId).startsWith('pv_') && !isNaN(parseInt(editId, 10)) ? parseInt(editId, 10) : 0,
        voucherNumber,
        date,
        dueDate: dueDate || null,
        amount: numAmount,
        paymentMethod: 'Cash',
        paymentMode: 'Cash',
        paidTo: primaryPayee,
        fullData: JSON.stringify(fullData),
        fullDataJson: JSON.stringify(fullData),
        clientId: match ? match.id : null,
        status,
        submittedBy,
        submittedAt,
        approvedBy,
        approvedAt,
        rejectedBy,
        rejectedAt,
        rejectionReason,
        createdByUserId: currentUser?.id || userId ? parseInt(currentUser?.id || userId, 10) : null
      });
      if (savedRes && savedRes.id) {
        record.id = savedRes.id;
      }
    } catch (err) {
      console.warn('API error saving payment voucher, saved locally:', err.message);
    }

    setSaving(false);
    return record;
  };

  const handleSaveDraft = async () => {
    const requiredAction = editId ? 'edit' : 'create';
    if (!isMainAdmin && !hasActionAccess('payment_vouchers', requiredAction)) {
      alert(`You do not have privilege to ${requiredAction} payment vouchers.`);
      return;
    }
    setDocStatus(DOC_STATUS.DRAFT);
    await saveVoucher(DOC_STATUS.DRAFT);
    setToastMsg('Draft Saved Successfully!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleSubmitApproval = async () => {
    if (!isMainAdmin && !hasActionAccess('payment_vouchers', 'submit')) {
      alert('You do not have privilege to submit payment vouchers for approval.');
      return;
    }

    // Mandatory Received By Signature and Date validation
    if (!receivedSign || !receivedSign.trim() || !receivedDate || !receivedDate.trim()) {
      alert('Received By Signature and Date are required before sending for approval.');
      return;
    }

    const primaryPayee = paymentRows[0]?.payee || '';
    const numAmount = parseFloat(String(amount).replace(/,/g, '')) || 0;

    const validator = typeof validateDocumentForSubmission === 'function'
      ? validateDocumentForSubmission
      : (typeof approvalService?.validateDocumentForSubmission === 'function'
          ? approvalService.validateDocumentForSubmission
          : () => ({ isValid: true, errors: [] }));
    const validation = validator(
      {
        number: voucherNumber,
        date,
        paidTo: primaryPayee,
        amount: numAmount,
        receivedSign: receivedSign.trim(),
        receivedDate: receivedDate.trim()
      },
      'payment_voucher'
    );

    if (!validation.isValid) {
      alert(validation.errors.join('\n'));
      return;
    }

    await saveVoucher(docStatus || DOC_STATUS.DRAFT);

    const res = await approvalService.submitForApproval({
      docType: 'payment_voucher',
      docNumber: voucherNumber,
      docData: {
        number: voucherNumber,
        date,
        paidTo: primaryPayee,
        amount: numAmount,
        receivedSign: receivedSign.trim(),
        receivedDate: receivedDate.trim()
      },
      user: { userEmail: userEmail || 'user@example.com', userId, userRole },
      currentStatus: docStatus
    });

    if (res.success) {
      setDocStatus(DOC_STATUS.PENDING_APPROVAL);
      setSubmittedBy(userEmail || 'user@example.com');
      setSubmittedAt(new Date().toISOString());
      const updatedHistory = await approvalService.getHistory('payment_voucher', voucherNumber);
      setHistoryList(updatedHistory);
      setToastMsg(res.message);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } else {
      alert(res.errors.join('\n'));
    }
  };

  const handleInitiateApprove = () => {
    const signToCheck = (approvedSign || displayApprovedSign || '').trim();
    const dateToCheck = (approvedDate || displayApprovedDate || '').trim();
    if (!signToCheck || !dateToCheck) {
      alert('Approved By Signature and Date are required before approving the payment voucher.');
      return;
    }
    setApproveModalOpen(true);
  };

  const handleConfirmApprove = async (comments, modalSign, modalDate) => {
    const finalSign = (modalSign || approvedSign || displayApprovedSign || '').trim();
    const finalDate = (modalDate || approvedDate || displayApprovedDate || '').trim();

    if (!finalSign || !finalDate) {
      alert('Approved By Signature and Date are required before approving the payment voucher.');
      return;
    }

    setApprovedSign(finalSign);
    setApprovedDate(finalDate);

    // Save voucher with Approved status and both signatures preserved
    await saveVoucher(DOC_STATUS.APPROVED, finalSign, finalDate);

    const res = await approvalService.approveDocument({
      docType: 'payment_voucher',
      docNumber: voucherNumber,
      comments,
      approvedSign: finalSign,
      approvedDate: finalDate,
      user: { userEmail: userEmail || 'admin@example.com', userId, userRole }
    });
    setApproveModalOpen(false);

    if (res.success) {
      setDocStatus(DOC_STATUS.APPROVED);
      setApprovedBy(userEmail || 'Main Admin');
      setApprovedAt(new Date().toISOString());
      const updatedHistory = await approvalService.getHistory('payment_voucher', voucherNumber);
      setHistoryList(updatedHistory);
      setToastMsg(res.message);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } else {
      alert(res.errors.join('\n'));
    }
  };

  const handleConfirmReject = async (reason) => {
    const res = await approvalService.rejectDocument({
      docType: 'payment_voucher',
      docNumber: voucherNumber,
      reason,
      user: { userEmail: userEmail || 'admin@example.com', userId, userRole }
    });
    setRejectModalOpen(false);

    if (res.success) {
      setDocStatus(DOC_STATUS.REJECTED);
      setRejectedBy(userEmail || 'Main Admin');
      setRejectedAt(new Date().toISOString());
      setRejectionReason(reason);
      const updatedHistory = await approvalService.getHistory('payment_voucher', voucherNumber);
      setHistoryList(updatedHistory);
      setToastMsg(res.message);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } else {
      alert(res.errors.join('\n'));
    }
  };

  const buildVoucherPdf = async () => {
    if (!voucherCardRef.current) return null;

    const header = document.getElementById('companyHeader');
    const prevDisplay = header ? header.style.display : '';
    if (header) header.style.display = 'table';

    try {
      const canvas = await html2canvas(voucherCardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          const clHeader = clonedDoc.getElementById('companyHeader');
          if (clHeader) clHeader.style.display = 'table';
          clonedDoc.querySelectorAll(
            '.remove-row-cell, .remove-row-btn, .add-row-btn, .approval-banner, .approval-status-badge, .voucher-header-bar, .no-print, .print-btn-wrap, button, .voucher-print-attachment, .voucher-attachment-col'
          ).forEach((el) => {
            el.style.display = 'none';
          });
        }
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const imgW = pageW - 20; // 10mm margins on each side
      const imgH = (canvas.height * imgW) / canvas.width;
      const imgData = canvas.toDataURL('image/png');

      if (imgH <= pageH - 20) {
        pdf.addImage(imgData, 'PNG', 10, 10, imgW, imgH);
      } else {
        const elem = voucherCardRef.current;
        const elemRect = elem.getBoundingClientRect();
        const scaleY = canvas.height / (elemRect.height || 1);

        const avoidSelectors = [
          'tr',
          '.voucher-sig-box',
          '.voucher-sig-row',
          '.voucher-details-grid',
          '.voucher-notes-wrap',
          '.voucher-header'
        ];
        const avoidNodes = Array.from(elem.querySelectorAll(avoidSelectors.join(', ')));
        const safeBoxes = avoidNodes
          .map((el) => {
            const r = el.getBoundingClientRect();
            if (r.height <= 0 || r.width <= 0) return null;
            return {
              top: (r.top - elemRect.top) * scaleY,
              bottom: (r.bottom - elemRect.top) * scaleY
            };
          })
          .filter(Boolean);

        const pageHeightPx = ((pageH - 20) / imgW) * canvas.width;
        const topMarginPx = Math.round(16 * (canvas.width / (elemRect.width || 1)));
        const bottomMarginPx = Math.round(16 * (canvas.width / (elemRect.width || 1)));

        let yOffset = 0;
        let pageIndex = 0;

        while (yOffset < canvas.height) {
          const topPadding = pageIndex > 0 ? topMarginPx : 0;
          const usablePageH = pageHeightPx - topPadding - bottomMarginPx;
          const targetY = yOffset + usablePageH;

          let cutY;
          if (targetY >= canvas.height) {
            cutY = canvas.height;
          } else {
            const crossing = safeBoxes.filter((b) => b.top < targetY && b.bottom > targetY);
            if (crossing.length > 0) {
              const minTop = Math.min(...crossing.map((b) => b.top));
              if (minTop > yOffset + 20) {
                cutY = Math.floor(minTop);
              } else {
                cutY = Math.floor(targetY);
              }
            } else {
              cutY = Math.floor(targetY);
            }
          }

          const sliceH = cutY - yOffset;
          if (sliceH <= 0) break;

          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceH + topPadding;
          const ctx = sliceCanvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            yOffset,
            canvas.width,
            sliceH,
            0,
            topPadding,
            canvas.width,
            sliceH
          );

          if (pageIndex > 0) pdf.addPage();
          const pdfSliceH = ((sliceH + topPadding) * imgW) / canvas.width;
          pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 10, 10, imgW, pdfSliceH);

          yOffset = cutY;
          pageIndex++;
        }
      }

      // Collect all row attachments
      const allRowAttachments = [];
      paymentRows.forEach((r, idx) => {
        if (r.attachment && r.attachment.dataUrl) {
          allRowAttachments.push({
            ...r.attachment,
            label: `Attachment (Row ${idx + 1}${r.description ? ` - ${r.description}` : ''}): ${r.attachment.name}`
          });
        }
      });
      if (attachment && attachment.dataUrl && !allRowAttachments.some((a) => a.dataUrl === attachment.dataUrl)) {
        allRowAttachments.push({
          ...attachment,
          label: `Attachment: ${attachment.name}`
        });
      }

      if (allRowAttachments.length > 0) {
        const voucherPdfBytes = pdf.output('arraybuffer');
        const mergedPdf = await PDFDocument.load(voucherPdfBytes);

        for (const att of allRowAttachments) {
          const isPdf =
            att.type === 'application/pdf' ||
            (att.name || '').toLowerCase().endsWith('.pdf');

          if (isPdf) {
            const base64Data = att.dataUrl.includes(',')
              ? att.dataUrl.split(',')[1]
              : att.dataUrl;
            const binaryString = atob(base64Data);
            const attachBytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              attachBytes[i] = binaryString.charCodeAt(i);
            }

            const attachDoc = await PDFDocument.load(attachBytes);
            const copiedPages = await mergedPdf.copyPages(attachDoc, attachDoc.getPageIndices());
            copiedPages.forEach((p) => mergedPdf.addPage(p));
          } else {
            const imgDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pW = imgDoc.internal.pageSize.getWidth();
            const pH = imgDoc.internal.pageSize.getHeight();
            const margin = 12;
            const maxW = pW - margin * 2;
            const maxH = pH - margin * 2 - 14;

            imgDoc.setFontSize(11);
            imgDoc.setTextColor(71, 85, 105);
            imgDoc.text(att.label, margin, margin + 4);

            const img = new Image();
            img.src = att.dataUrl;
            await new Promise((resolve) => {
              if (img.complete) resolve();
              else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }
            });

            let drawW = maxW;
            let drawH = ((img.naturalHeight || 1) / (img.naturalWidth || 1)) * drawW;
            if (drawH > maxH) {
              drawH = maxH;
              drawW = ((img.naturalWidth || 1) / (img.naturalHeight || 1)) * drawH;
            }
            const xPos = margin + (maxW - drawW) / 2;
            const yPos = margin + 10;

            const imgFormat =
              (att.type || '').includes('png') || (att.name || '').toLowerCase().endsWith('.png')
                ? 'PNG'
                : 'JPEG';
            imgDoc.addImage(att.dataUrl, imgFormat, xPos, yPos, drawW, drawH);

            const imgBytes = imgDoc.output('arraybuffer');
            const imgDocLoaded = await PDFDocument.load(imgBytes);
            const copiedImgPages = await mergedPdf.copyPages(imgDocLoaded, imgDocLoaded.getPageIndices());
            copiedImgPages.forEach((p) => mergedPdf.addPage(p));
          }
        }

        const mergedBytes = await mergedPdf.save();
        return new Blob([mergedBytes], { type: 'application/pdf' });
      }

      return pdf.output('blob');
    } finally {
      if (header) header.style.display = prevDisplay;
    }
  };

  const handlePrint = async () => {
    const hasAnyPdf =
      paymentRows.some(
        (r) =>
          r.attachment &&
          r.attachment.dataUrl &&
          (r.attachment.type === 'application/pdf' || (r.attachment.name || '').toLowerCase().endsWith('.pdf'))
      ) ||
      (attachment &&
        attachment.dataUrl &&
        (attachment.type === 'application/pdf' || (attachment.name || '').toLowerCase().endsWith('.pdf')));

    if (hasAnyPdf) {
      setDownloading(true);
      try {
        const blob = await buildVoucherPdf();
        if (blob) {
          const blobUrl = URL.createObjectURL(blob);
          const printIframe = document.createElement('iframe');
          printIframe.style.position = 'fixed';
          printIframe.style.right = '0';
          printIframe.style.bottom = '0';
          printIframe.style.width = '1px';
          printIframe.style.height = '1px';
          printIframe.style.opacity = '0.01';
          printIframe.style.border = '0';
          printIframe.src = blobUrl;
          document.body.appendChild(printIframe);

          let printed = false;
          const doPrint = () => {
            if (printed) return;
            printed = true;
            try {
              if (printIframe.contentWindow) {
                printIframe.contentWindow.focus();
                printIframe.contentWindow.print();
              } else {
                window.print();
              }
            } catch (e) {
              window.open(blobUrl, '_blank');
            }
            setTimeout(() => {
              if (document.body.contains(printIframe)) {
                document.body.removeChild(printIframe);
              }
              URL.revokeObjectURL(blobUrl);
            }, 60000);
          };

          printIframe.onload = () => setTimeout(doPrint, 350);
          setTimeout(doPrint, 1400);
          return;
        }
      } catch (err) {
        console.warn('PDF print iframe fallback:', err);
      } finally {
        setDownloading(false);
      }
    }

    window.print();
  };
  handlePrintRef.current = handlePrint;

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const blob = await buildVoucherPdf();
      if (!blob) return;
      const fileName = (voucherNumber || 'Payment_Voucher').replace(/[^a-zA-Z0-9-_]/g, '_');
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${fileName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Could not download PDF. Please use the Print button as an alternative.');
    } finally {
      setDownloading(false);
    }
  };

  const isLocked = approvalPermissions.isLocked(docStatus);

  return (
    <div className="voucher-page-wrapper">
      <div className="voucher-header-bar no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 className="voucher-page-title" style={{ margin: 0 }}>Payment Voucher</h1>
          <ApprovalStatusBadge status={docStatus} />
        </div>
      </div>

      {/* Approval Lifecycle Banner */}
      <ApprovalBanner
        status={docStatus}
        isMainAdmin={isMainAdmin}
        canApprove={isMainAdmin || hasActionAccess('payment_vouchers', 'approve')}
        canReject={isMainAdmin || hasActionAccess('payment_vouchers', 'reject')}
        submittedBy={submittedBy}
        submittedAt={submittedAt}
        approvedBy={approvedBy}
        approvedAt={approvedAt}
        rejectedBy={rejectedBy}
        rejectedAt={rejectedAt}
        rejectionReason={rejectionReason}
        onApprove={handleInitiateApprove}
        onReject={() => setRejectModalOpen(true)}
        onViewHistory={() => setHistoryModalOpen(true)}
      />

      <div className="voucher-card" id="voucherCard" ref={voucherCardRef}>
        <fieldset disabled={isLocked} style={{ border: 'none', padding: 0, margin: 0 }}>
          {/* Company header */}
          <table
            className="company-header"
            id="companyHeader"
            style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', border: '1px solid #333' }}
          >
            <tbody>
              <tr>
                <td
                  rowSpan="2"
                  style={{ width: '120px', padding: '10px', border: '1px solid #333', textAlign: 'center' }}
                  id="printLogoCell"
                >
                  <img
                    src={defaultLogo}
                    style={{ maxWidth: '110px', maxHeight: '70px', objectFit: 'contain', display: 'block', margin: 'auto' }}
                    alt="K QualitySoft Logo"
                  />
                </td>
                <td
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    padding: '8px 12px',
                    border: '1px solid #333',
                    letterSpacing: '.05em'
                  }}
                  colSpan="2"
                  id="printCompanyName"
                >
                  K QUALITY SOFT PRIVATE LIMITED
                </td>
              </tr>
              <tr>
                <td style={{ fontSize: '.78rem', padding: '8px 12px', border: '1px solid #333', verticalAlign: 'top' }} id="printRegistered">
                  <strong>Registered Office:</strong>
                  <br />
                  Risinia Intelli Park, Block-B,
                  <br />
                  Flat: 213, Bachupally,
                  <br />
                  Hyderabad, Telangana-500090
                </td>
                <td style={{ fontSize: '.78rem', padding: '8px 12px', border: '1px solid #333', verticalAlign: 'top' }} id="printCorporate">
                  <strong>Corporate Office:</strong>
                  <br />
                  Srikrishna Pride, 401, Beside:
                  <br />
                  ALEAP gate-1, Near: Sreenidhi
                  <br />
                  Global School, Pragathi Nagar,
                  <br />
                  Hyderabad, Telangana-500090
                </td>
              </tr>
            </tbody>
          </table>

          {/* Top Row: No, Amount, Date */}
          <div
            className="voucher-row top-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '20px',
              alignItems: 'flex-end',
              width: '100%',
              marginBottom: '20px'
            }}
          >
            <div className="field-group" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <label className="field-label">Payment Voucher No:</label>
              <input
                className="field-input"
                type="text"
                id="voucherNumber"
                value={voucherNumber}
                onChange={(e) => setVoucherNumber(e.target.value)}
                style={{ height: '36px', boxSizing: 'border-box' }}
              />
            </div>
            <div className="field-group" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <label className="field-label">Amount (₹):</label>
              <input
                className="field-input"
                type="text"
                id="amountInput"
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                style={{ height: '36px', boxSizing: 'border-box' }}
              />
            </div>
            <div className="field-group" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <label className="field-label">Date:</label>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '36px',
                  boxSizing: 'border-box'
                }}
              >
                <input
                  type="date"
                  id="voucherDate"
                  value={date}
                  disabled={isLocked}
                  onChange={(e) => setDate(e.target.value)}
                  onClick={(e) => {
                    try {
                      if (!isLocked && typeof e.target.showPicker === 'function') e.target.showPicker();
                    } catch (_) {}
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    zIndex: 2,
                    cursor: isLocked ? 'default' : 'pointer'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '2px solid var(--input-border)',
                    fontSize: '0.95rem',
                    color: date ? 'var(--text-primary)' : '#94a3b8',
                    fontFamily: 'var(--font)',
                    pointerEvents: 'none',
                    padding: '6px 0',
                    boxSizing: 'border-box'
                  }}
                >
                  <span>{date ? fmtDate(date) : 'DD/MMM/YYYY'}</span>
                  <i
                    className="fa-regular fa-calendar no-print"
                    style={{
                      color: 'var(--table-header, #7b3fe4)',
                      fontSize: '15px',
                      marginLeft: '8px'
                    }}
                  ></i>
                </div>
              </div>
            </div>
          </div>

          {/* Amount in words */}
          <div className="voucher-row" style={{ display: 'flex', width: '100%', marginBottom: '20px' }}>
            <div className="field-group full-width" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <label className="field-label">Amount (in words):</label>
              <input
                className="field-input"
                type="text"
                id="amountWords"
                placeholder="Rupees..."
                value={amountWords}
                onChange={(e) => setAmountWords(e.target.value)}
                style={{ height: '36px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Payment breakdown table */}
          <table className="payment-table voucher-table" id="paymentTable">
            <thead>
              <tr>
                <th style={{ width: '48px', textAlign: 'center' }}>S.No</th>
                <th style={{ textAlign: 'left' }}>Payment Description</th>
                <th style={{ width: '200px', textAlign: 'left' }}>Paid To</th>
                <th className="voucher-attachment-col no-print" style={{ width: '220px', textAlign: 'center' }}>Attachment</th>
                {!isLocked && <th className="remove-row-cell" style={{ width: '40px', textAlign: 'center' }}></th>}
              </tr>
            </thead>
            <tbody id="paymentTbody">
              {paymentRows.map((row, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)' }}>{idx + 1}</td>
                  <td>
                    <input
                      className="table-input"
                      type="text"
                      placeholder="e.g. Server hosting charges"
                      value={row.description}
                      disabled={isLocked}
                      onChange={(e) => handleRowChange(idx, 'description', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="table-input"
                      type="text"
                      placeholder="Payee name"
                      value={row.payee}
                      disabled={isLocked}
                      onChange={(e) => handleRowChange(idx, 'payee', e.target.value)}
                    />
                  </td>
                  <td className="voucher-attachment-col no-print" style={{ textAlign: 'center', verticalAlign: 'middle', padding: '6px 10px' }}>
                    {!row.attachment ? (
                      !isLocked ? (
                        <label
                          className="no-print"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1.5px dashed #cbd5e1',
                            backgroundColor: '#f8fafc',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: 'var(--table-header)',
                            fontWeight: '600',
                            transition: 'all 0.15s ease'
                          }}
                          title="Attach PDF, JPG, JPEG, PNG up to 50MB"
                        >
                          <i className="fa-solid fa-cloud-arrow-up"></i>
                          <span>Attach File</span>
                          <input
                            type="file"
                            accept=".pdf,image/png,image/jpeg,image/jpg"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const f = e.target.files && e.target.files[0];
                              if (f) processRowAttachment(idx, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>—</span>
                      )
                    ) : (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#f5f3ff',
                          border: '1px solid #ddd6fe',
                          fontSize: '12px',
                          maxWidth: '200px'
                        }}
                      >
                        <i
                          className={
                            row.attachment.type === 'application/pdf' ||
                            (row.attachment.name || '').toLowerCase().endsWith('.pdf')
                              ? 'fa-solid fa-file-pdf'
                              : 'fa-solid fa-file-image'
                          }
                          style={{
                            color: 'var(--table-header)',
                            fontSize: '14px',
                            flexShrink: 0
                          }}
                        ></i>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: '#0f172a',
                            fontWeight: '500',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                          title={`${row.attachment.name} (${formatFileSize(row.attachment.size)}) - Click to view`}
                          onClick={() => viewAttachment(row.attachment)}
                        >
                          {row.attachment.name}
                        </span>
                        {!isLocked && (
                          <button
                            type="button"
                            className="no-print"
                            onClick={() => handleRemoveRowAttachment(idx)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '0 2px',
                              fontSize: '15px',
                              lineHeight: 1,
                              marginLeft: '2px'
                            }}
                            title="Remove attachment"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  {!isLocked && (
                    <td className="remove-row-cell" style={{ textAlign: 'center' }}>
                      {paymentRows.length > 1 && (
                        <button
                          type="button"
                          className="remove-row-btn"
                          title="Remove row"
                          onClick={() => handleRemoveRow(idx)}
                        >
                          &times;
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Add row button */}
          {!isLocked && (
            <div style={{ marginTop: '8px', marginBottom: '18px' }}>
              <button
                type="button"
                className="add-row-btn"
                id="addRowBtn"
                onClick={handleAddRow}
              >
                + Add Row
              </button>
            </div>
          )}
        </fieldset>

        {/* Signatures table */}
        <table className="sig-table">
          <thead>
            <tr>
              <th>Received By:</th>
              <th>Approved By:</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="sig-row">
                  <span className="sig-label">
                    Sign: <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    className="sig-line"
                    type="text"
                    placeholder="Recipient signature"
                    value={receivedSign}
                    disabled={isLocked}
                    onChange={(e) => setReceivedSign(e.target.value)}
                  />
                </div>
                <div className="sig-row">
                  <span className="sig-label">
                    Date: <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <div
                    style={{
                      position: 'relative',
                      flex: 1,
                      height: '28px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <input
                      type="date"
                      id="receivedDate"
                      value={receivedDate}
                      disabled={isLocked}
                      onChange={(e) => setReceivedDate(e.target.value)}
                      onClick={(e) => {
                        try {
                          if (!isLocked && typeof e.target.showPicker === 'function') e.target.showPicker();
                        } catch (_) {}
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        zIndex: 2,
                        cursor: isLocked ? 'default' : 'pointer'
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        right: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #999',
                        pointerEvents: 'none',
                        fontSize: '0.88rem',
                        color: receivedDate ? '#0f172a' : '#94a3b8'
                      }}
                    >
                      <span>{receivedDate ? fmtDate(receivedDate) : 'DD/MMM/YYYY'}</span>
                      <i
                        className="fa-regular fa-calendar no-print"
                        style={{
                          color: 'var(--table-header, #7b3fe4)',
                          fontSize: '13px',
                          marginLeft: '6px'
                        }}
                      ></i>
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div className="sig-row">
                  <span className="sig-label">
                    Sign: <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <input
                    className="sig-line"
                    type="text"
                    placeholder="Approver signature"
                    value={displayApprovedSign}
                    disabled={
                      normalizeStatus(docStatus) === DOC_STATUS.APPROVED ||
                      (!isMainAdmin && !hasActionAccess('payment_vouchers', 'approve'))
                    }
                    onChange={(e) => setApprovedSign(e.target.value)}
                  />
                </div>
                <div className="sig-row">
                  <span className="sig-label">
                    Date: <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                  <div
                    style={{
                      position: 'relative',
                      flex: 1,
                      height: '28px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <input
                      type="date"
                      id="approvedDate"
                      value={displayApprovedDate}
                      disabled={
                        normalizeStatus(docStatus) === DOC_STATUS.APPROVED ||
                        (!isMainAdmin && !hasActionAccess('payment_vouchers', 'approve'))
                      }
                      onChange={(e) => setApprovedDate(e.target.value)}
                      onClick={(e) => {
                        try {
                          const canEdit = !(
                            normalizeStatus(docStatus) === DOC_STATUS.APPROVED ||
                            (!isMainAdmin && !hasActionAccess('payment_vouchers', 'approve'))
                          );
                          if (canEdit && typeof e.target.showPicker === 'function') e.target.showPicker();
                        } catch (_) {}
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        zIndex: 2,
                        cursor:
                          normalizeStatus(docStatus) === DOC_STATUS.APPROVED ||
                          (!isMainAdmin && !hasActionAccess('payment_vouchers', 'approve'))
                            ? 'default'
                            : 'pointer'
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        right: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #999',
                        pointerEvents: 'none',
                        fontSize: '0.88rem',
                        color: displayApprovedDate ? '#0f172a' : '#94a3b8'
                      }}
                    >
                      <span>{displayApprovedDate ? fmtDate(displayApprovedDate) : 'DD/MMM/YYYY'}</span>
                      <i
                        className="fa-regular fa-calendar no-print"
                        style={{
                          color: 'var(--table-header, #7b3fe4)',
                          fontSize: '13px',
                          marginLeft: '6px'
                        }}
                      ></i>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Row Attachments Print Section - rendered for each row that has an attachment */}
        {paymentRows.map((r, i) => {
          if (!r.attachment || !r.attachment.dataUrl) return null;
          return (
            <div key={i} className="voucher-print-attachment">
              <div className="attachment-print-header">
                <span className="attachment-print-title">
                  Attachment (Row {i + 1}{r.description ? ` - ${r.description}` : ''}): {r.attachment.name}
                </span>
              </div>
              {r.attachment.type === 'application/pdf' || (r.attachment.name || '').toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={r.attachment.dataUrl}
                  title={`Attachment Row ${i + 1}`}
                  className="attachment-print-frame"
                />
              ) : (
                <img
                  src={r.attachment.dataUrl}
                  alt={r.attachment.name || `Attachment Row ${i + 1}`}
                  className="attachment-print-img"
                />
              )}
            </div>
          );
        })}
        {attachment && attachment.dataUrl && !paymentRows.some((r) => r.attachment && r.attachment.dataUrl === attachment.dataUrl) && (
          <div className="voucher-print-attachment">
            <div className="attachment-print-header">
              <span className="attachment-print-title">Attachment: {attachment.name}</span>
            </div>
            {attachment.type === 'application/pdf' || (attachment.name || '').toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={attachment.dataUrl}
                title="Attachment Preview"
                className="attachment-print-frame"
              />
            ) : (
              <img
                src={attachment.dataUrl}
                alt={attachment.name || 'Attachment'}
                className="attachment-print-img"
              />
            )}
          </div>
        )}
      </div>

      {/* Action Buttons Wrap */}
      <div className="print-btn-wrap no-print" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '20px' }}>
        {!isLocked && (
          <button
            type="button"
            className="print-btn"
            style={{ background: '#64748b' }}
            onClick={handleSaveDraft}
            disabled={saving}
          >
            <i className="fa-regular fa-floppy-disk"></i> {saving ? 'Saving...' : 'Save Draft'}
          </button>
        )}

        {!isLocked && (isMainAdmin || hasActionAccess('payment_vouchers', 'submit')) && (
          <button
            type="button"
            className="print-btn"
            style={{ background: '#4f46e5' }}
            onClick={handleSubmitApproval}
            disabled={saving}
          >
            <i className="fa-solid fa-paper-plane"></i>{' '}
            {normalizeStatus(docStatus) === DOC_STATUS.REJECTED
              ? 'Resubmit for Approval'
              : 'Submit for Approval'}
          </button>
        )}

        {normalizeStatus(docStatus) === DOC_STATUS.PENDING_APPROVAL && (
          <>
            {(isMainAdmin || hasActionAccess('payment_vouchers', 'reject')) && (
              <button
                type="button"
                className="print-btn"
                style={{ background: '#ef4444' }}
                onClick={() => setRejectModalOpen(true)}
              >
                <i className="fa-solid fa-xmark"></i> Reject
              </button>
            )}
            {(isMainAdmin || hasActionAccess('payment_vouchers', 'approve')) && (
              <button
                type="button"
                className="print-btn"
                style={{ background: '#16a34a' }}
                onClick={handleInitiateApprove}
              >
                <i className="fa-solid fa-check"></i> Approve
              </button>
            )}
          </>
        )}

        <button
          type="button"
          className="print-btn"
          style={{ background: '#9b2cdb' }}
          onClick={handlePrint}
        >
          <i className="fa-solid fa-print"></i> Print Voucher
        </button>

        <button
          type="button"
          className="print-btn"
          style={{ background: '#2563eb' }}
          onClick={handleDownloadPDF}
          disabled={downloading}
        >
          <i className={`fa-solid ${downloading ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>{' '}
          {downloading ? 'Generating...' : 'Download Voucher'}
        </button>
      </div>

      {/* Approval Modals */}
      <div className="no-print">
        <ApproveConfirmModal
          isOpen={approveModalOpen}
          docNumber={voucherNumber}
          docType="payment_voucher"
          initialApprovedSign={approvedSign || displayApprovedSign || (userEmail ? userEmail.split('@')[0] : 'admin')}
          initialApprovedDate={approvedDate || displayApprovedDate || new Date().toISOString().split('T')[0]}
          onClose={() => setApproveModalOpen(false)}
          onConfirm={handleConfirmApprove}
        />

        <RejectReasonModal
          isOpen={rejectModalOpen}
          docNumber={voucherNumber}
          onClose={() => setRejectModalOpen(false)}
          onConfirm={handleConfirmReject}
        />

        <Toast message={toastMsg} show={showToast} />

        {/* Attachment Preview Modal */}
        {previewAttachmentOpen && (previewAttachment || attachment) && (
          (() => {
            const activeAtt = previewAttachment || attachment;
            return (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 99999,
                  padding: '20px'
                }}
                onClick={() => {
                  setPreviewAttachmentOpen(false);
                  setPreviewAttachment(null);
                }}
              >
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    maxWidth: '900px',
                    width: '100%',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 20px',
                      borderBottom: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <i
                        className={
                          activeAtt.type === 'application/pdf' || (activeAtt.name || '').toLowerCase().endsWith('.pdf')
                            ? 'fa-solid fa-file-pdf'
                            : 'fa-solid fa-file-image'
                        }
                        style={{
                          fontSize: '18px',
                          color:
                            activeAtt.type === 'application/pdf' || (activeAtt.name || '').toLowerCase().endsWith('.pdf')
                              ? '#ef4444'
                              : '#8b5cf6'
                        }}
                      ></i>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                        {activeAtt.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewAttachmentOpen(false);
                        setPreviewAttachment(null);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '22px',
                        color: '#64748b',
                        cursor: 'pointer',
                        lineHeight: 1
                      }}
                    >
                      &times;
                    </button>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      overflow: 'auto',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'center',
                      backgroundColor: '#f1f5f9'
                    }}
                  >
                    {activeAtt.type === 'application/pdf' || (activeAtt.name || '').toLowerCase().endsWith('.pdf') ? (
                      <iframe
                        src={activeAtt.dataUrl}
                        title="Preview Attachment"
                        style={{ width: '100%', height: '75vh', border: 'none', borderRadius: '6px', backgroundColor: '#fff' }}
                      />
                    ) : (
                      <img
                        src={activeAtt.dataUrl}
                        alt={activeAtt.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '75vh',
                          objectFit: 'contain',
                          borderRadius: '6px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
