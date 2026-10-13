import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { fmtDate, getDueDate } from '../../utils/dateUtils';
import { numberToWords } from '../../utils/numberToWords';
import ApprovalStatusBadge from '../approvals/ApprovalStatusBadge';
import ApprovalBanner from '../approvals/ApprovalBanner';
import { DOC_STATUS, normalizeStatus, approvalPermissions } from '../../services/approvalService';
import { FIXED_BILLED_BY, FIXED_BANK_ACCOUNT, normalizeBankAccounts } from '../../constants/companyDetails';
import { extractPanFromGstin, getAllClientsAggregated } from '../../utils/clientHelper';

export default function CustomiseShareStep({
  docData,
  onEdit,
  onBackToBank,
  onCreateNew,
  onConvert,
  convertLabel,
  docType = 'invoice',
  docTitle = 'Quotation',
  status,
  isLocked,
  isMainAdmin,
  canApprove = isMainAdmin,
  canReject = isMainAdmin,
  canSubmit = isMainAdmin,
  onSubmitApproval,
  approvalLoading = false,
  onApprove,
  onReject,
  onViewHistory
}) {
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef(null);

  const isInvoice = String(docType || '').toLowerCase() === 'invoice';
  const effectiveStatus = status || docData.status || DOC_STATUS.DRAFT;
  const locked = isLocked !== undefined ? isLocked : approvalPermissions.isLocked(effectiveStatus);

  const {
    invoiceNo = '',
    challanNo = '',
    poNo = '',
    date = '',
    dueDate = '',
    refPoNo = '',
    refDcNo = '',
    refPiNo = '',
    refQuotationNo = '',
    logoSrc = '',
    billedBy = FIXED_BILLED_BY,
    billedTo = {},
    items = [],
    bankAccounts = [],
    upiAccounts = [],
    terms = docData.terms || docData.termsAndConditions || [],
    notes = docData.notes || docData.note || '',
    attachments = docData.attachments || docData.files || [],
    contactEmail = docData.contactEmail || docData.email || '',
    contactPhone = docData.contactPhone || docData.phone || '',
    countryCode = docData.countryCode || '+91',
  } = docData;

  const displayBankAccounts = (Array.isArray(bankAccounts) && bankAccounts.length > 0)
    ? normalizeBankAccounts(bankAccounts)
    : (() => {
        try {
          const s = JSON.parse(localStorage.getItem('invox_saved_bank_accounts') || '[]');
          return Array.isArray(s) && s.length > 0 ? normalizeBankAccounts(s) : [FIXED_BANK_ACCOUNT];
        } catch (e) { return [FIXED_BANK_ACCOUNT]; }
      })();

  const displayUpiAccounts = (Array.isArray(upiAccounts) && upiAccounts.length > 0)
    ? upiAccounts
    : (() => {
        try {
          const s = JSON.parse(localStorage.getItem('invox_saved_upi_accounts') || '[]');
          return Array.isArray(s) ? s : [];
        } catch (e) { return []; }
      })();

  const currentDocNo = invoiceNo || challanNo || poNo || '—';
  const refNo = refQuotationNo || refPoNo || refDcNo || refPiNo || '';

  // Totals calculations
  const clean = (val) => parseFloat(String(val || '').replace(/[^\d.]/g, '')) || 0;
  let totalAmount = 0;
  let totalCgst = 0;
  let totalSgst = 0;

  items.forEach((item) => {
    const rateNum = clean(item.rate);
    const qtyNum = clean(item.qty);
    const gstNum = clean(item.gst);
    const amtNum = clean(item.amount) || (qtyNum * rateNum);
    const cgstNum = clean(item.cgst) || ((amtNum * gstNum) / 200);
    const sgstNum = clean(item.sgst) || ((amtNum * gstNum) / 200);

    totalAmount += amtNum;
    totalCgst += cgstNum;
    totalSgst += sgstNum;
  });

  const grandTotal = totalAmount + totalCgst + totalSgst;
  const totalWords = numberToWords(Math.round(grandTotal));
  const estimatedTotalPages = items && items.length > 10 ? Math.ceil((items.length - 10) / 14) + 1 : 1;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!previewRef.current) return;
    setDownloading(true);
    try {
      const element = previewRef.current;
      let detectedSafeBoxes = [];
      let theadTop = 0;
      let theadBottom = 0;
      const renderScale = 2;

      const canvas = await html2canvas(element, {
        scale: renderScale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll(
            '.approval-banner, .approval-status-badge, .no-print, button, .cs-topbar, .cs-stepper, .cs-action-bar, .remove-logo-btn, .cs-doc-footer, .cs-table-tfoot-spacer'
          ).forEach((el) => {
            el.style.display = 'none';
          });
          const tbl = clonedDoc.querySelector('.cs-table');
          if (tbl) {
            tbl.style.tableLayout = 'fixed';
            tbl.style.borderCollapse = 'collapse';
            tbl.style.width = '100%';
            tbl.style.border = '1px solid #cbd5e1';
            const thBg = isInvoice ? '#2e7d47' : '#7b3fe4';
            const thBorder = isInvoice ? '#1b5e20' : '#6d28d9';
            tbl.querySelectorAll('thead tr').forEach((tr) => {
              tr.style.background = thBg;
              tr.style.color = '#ffffff';
            });
            tbl.querySelectorAll('th').forEach((th) => {
              th.style.background = thBg;
              th.style.color = '#ffffff';
              th.style.border = `1px solid ${thBorder}`;
              th.style.borderRight = '1px solid rgba(255, 255, 255, 0.45)';
              th.style.boxSizing = 'border-box';
              th.style.padding = '8px 3px';
              th.style.fontSize = '11px';
              th.style.whiteSpace = 'normal';
              th.style.lineHeight = '1.25';
            });
            tbl.querySelectorAll('tbody tr').forEach((tr, idx) => {
              const rowBg = idx % 2 === 0 ? (isInvoice ? '#f0fdf4' : '#f3f0ff') : '#ffffff';
              tr.style.backgroundColor = rowBg;
              tr.querySelectorAll('td').forEach((td) => {
                td.style.border = '1px solid #cbd5e1';
                td.style.boxSizing = 'border-box';
                td.style.padding = '7px 3px';
                td.style.fontSize = '11px';
                td.style.backgroundColor = rowBg;
              });
            });
          }
          const titleEl = clonedDoc.querySelector('.cs-preview-title');
          if (titleEl) {
            titleEl.style.color = isInvoice ? '#2e7d32' : '#7b3fe4';
            titleEl.style.fontSize = '28px';
          }
          if (isInvoice) {
            clonedDoc.querySelectorAll('.cs-billed-label').forEach((el) => {
              el.style.color = '#2e7d32';
            });
            clonedDoc.querySelectorAll('.cs-section-title').forEach((el) => {
              el.style.color = '#2e7d32';
            });
            clonedDoc.querySelectorAll('.cs-billed-box').forEach((el) => {
              el.style.backgroundColor = '#f0fdf4';
              el.style.border = '1px solid #bbf7d0';
            });
          }

          // Measure safe boxes directly on the cloned document AFTER all styling changes
          const clonedPreview = clonedDoc.querySelector('.cs-preview');
          if (clonedPreview) {
            clonedPreview.style.paddingBottom = '0px';
            clonedPreview.style.marginBottom = '0px';
            clonedPreview.style.minHeight = 'auto';
            clonedPreview.style.height = 'auto';

            const clonedWrap = clonedDoc.querySelector('.cs-preview-wrap');
            if (clonedWrap) {
              clonedWrap.style.marginBottom = '0px';
              clonedWrap.style.paddingBottom = '0px';
              clonedWrap.style.minHeight = 'auto';
              clonedWrap.style.height = 'auto';
            }

            const clonedFooterSec = clonedDoc.querySelector('.cs-footer-sections');
            if (clonedFooterSec) {
              clonedFooterSec.style.marginBottom = '0px';
              clonedFooterSec.style.paddingBottom = '0px';
            }

            const pRect = clonedPreview.getBoundingClientRect();
            const avoidSelectors = [
              '.cs-preview-header',
              '.cs-preview-meta',
              '.cs-billed-grid',
              '.cs-table thead tr',
              '.cs-table tbody tr',
              '.cs-totals-row',
              '.cs-section-block',
              '.cs-bank-row'
            ];
            const avoidNodes = Array.from(clonedPreview.querySelectorAll(avoidSelectors.join(', ')));
            detectedSafeBoxes = avoidNodes
              .map((el) => {
                const r = el.getBoundingClientRect();
                if (r.height <= 0 || r.width <= 0) return null;
                return {
                  top: Math.round((r.top - pRect.top) * renderScale),
                  bottom: Math.round((r.bottom - pRect.top) * renderScale)
                };
              })
              .filter(Boolean);

            const theadTr = clonedPreview.querySelector('.cs-table thead tr');
            if (theadTr) {
              const trRect = theadTr.getBoundingClientRect();
              theadTop = Math.round((trRect.top - pRect.top) * renderScale);
              theadBottom = Math.round((trRect.bottom - pRect.top) * renderScale);
            }
          }
        }
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const imgW = pageW;
      const pxPerMm = canvas.width / pageW;
      const bottomMarginMm = 22;
      const topMarginMm = 12;
      const bottomMarginPx = Math.round(bottomMarginMm * pxPerMm);
      const topMarginPx = Math.round(topMarginMm * pxPerMm);
      const pageHeightPx = Math.round(pageH * pxPerMm);

      const maxContentBottom = detectedSafeBoxes.length > 0
        ? Math.max(...detectedSafeBoxes.map((b) => b.bottom))
        : canvas.height;
      const effectiveCanvasH = Math.min(canvas.height, maxContentBottom + Math.round(8 * renderScale));
      const effectiveImgH = (effectiveCanvasH * imgW) / canvas.width;

      if (effectiveImgH <= pageH - bottomMarginMm) {
        if (effectiveCanvasH < canvas.height) {
          const singleCanvas = document.createElement('canvas');
          singleCanvas.width = canvas.width;
          singleCanvas.height = effectiveCanvasH;
          const sCtx = singleCanvas.getContext('2d');
          sCtx.drawImage(canvas, 0, 0, canvas.width, effectiveCanvasH, 0, 0, canvas.width, effectiveCanvasH);
          pdf.addImage(singleCanvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, effectiveImgH);
        } else {
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, effectiveImgH);
        }
      } else {
        let yOffset = 0;
        let pageIndex = 0;

        while (yOffset < effectiveCanvasH) {
          // Check if any actual content remains below yOffset
          const remainingBoxes = detectedSafeBoxes.filter((b) => b.bottom > yOffset + 15);
          if (pageIndex > 0 && remainingBoxes.length === 0) {
            // No more content to render, do not create an empty page
            break;
          }

          const topPadding = pageIndex > 0 ? topMarginPx : 0;
          const usablePageH = pageHeightPx - topPadding - bottomMarginPx;
          const targetY = yOffset + usablePageH;

          let cutY;
          const belowTarget = detectedSafeBoxes.filter((b) => b.bottom > targetY);
          if (targetY >= effectiveCanvasH || belowTarget.length === 0) {
            // All remaining content fits within this page
            cutY = effectiveCanvasH;
          } else {
            // Find all elements that targetY slices through
            const crossing = detectedSafeBoxes.filter((b) => b.top < targetY && b.bottom > targetY);
            if (crossing.length > 0) {
              const minTop = Math.min(...crossing.map((b) => b.top));
              if (minTop > yOffset + 20) {
                cutY = minTop - 1;
              } else {
                cutY = Math.floor(targetY);
              }
            } else {
              // targetY falls in a gap between elements
              const above = detectedSafeBoxes.filter((b) => b.bottom <= targetY);
              if (above.length > 0) {
                const maxBottom = Math.max(...above.map((b) => b.bottom));
                if (maxBottom > yOffset + 20 && maxBottom <= targetY) {
                  cutY = maxBottom;
                } else {
                  cutY = Math.floor(targetY);
                }
              } else {
                cutY = Math.floor(targetY);
              }
            }

            // Do not leave table header orphaned without any table rows
            if (theadBottom > 0 && cutY > theadTop && cutY <= theadBottom + 30) {
              if (theadTop > yOffset + 20) {
                cutY = theadTop - 1;
              }
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

          if (pageIndex > 0) {
            pdf.addPage();
          }

          const pdfSliceH = ((sliceH + topPadding) * imgW) / canvas.width;
          pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, pdfSliceH);

          yOffset = cutY;
          pageIndex++;
        }
      }

      // Add running footer on every page
      const totalPages = pdf.getNumberOfPages();
      const clientName = billedTo?.bizName || billedTo?.name || (typeof billedTo === 'string' ? billedTo : '') || '—';
      const formattedDate = fmtDate(date);
      const docNo = currentDocNo && currentDocNo !== '—' ? currentDocNo : (docData.invoiceNo || docData.number || '—');

      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);

        // Dashed divider line across bottom
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.25);
        pdf.setLineDashPattern([1.5, 1.5], 0);
        pdf.line(12, 280, 198, 280);
        pdf.setLineDashPattern([], 0);

        // Column 1: Invoice No
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`${docTitle} No`, 12, 283.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text(docNo, 12, 287.5);

        // Column 2: Invoice Date
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`${docTitle} Date`, 62, 283.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text(formattedDate, 62, 287.5);

        // Column 3: Billed To
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Billed To', 105, 283.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);
        const truncatedClient = clientName.length > 38 ? clientName.substring(0, 36) + '...' : clientName;
        pdf.text(truncatedClient, 105, 287.5);

        // Column 4: Page calculation
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text(`Page ${p} of ${totalPages}`, 198, 286.5, { align: 'right' });

        // Note below
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text('NOTE: This is an Electronically Generated Document, Signatures are not Required.', 105, 292.5, { align: 'center' });
      }

      const fileName = (currentDocNo && currentDocNo !== '—' ? currentDocNo : docTitle || 'document').replace(/[^a-zA-Z0-9-_]/g, '_');
      pdf.save(`${fileName}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Could not download PDF. Please use the Print button as an alternative.');
    } finally {
      setDownloading(false);
    }
  };

  const renderBillingDetails = (b, isBilledBy = false) => {
    const details = isBilledBy ? { ...FIXED_BILLED_BY, ...(b || {}) } : b;
    if (!details) return <div className="cs-billed-name">—</div>;
    let name = details.bizName || details.name || '—';
    if (isBilledBy || /^k\s*quality\s*soft\s*private\s*limited$/i.test(String(name).trim())) {
      name = FIXED_BILLED_BY.bizName;
    }
    const cityLine = [details.city, details.postal].filter(Boolean).join(', ');
    let panVal = details.pan || (isBilledBy ? FIXED_BILLED_BY.pan : '');
    let emailVal = details.email || (isBilledBy ? FIXED_BILLED_BY.email : (docData.clientEmail || docData.email || ''));
    let phoneVal = details.phone || (isBilledBy ? FIXED_BILLED_BY.phone : (docData.clientPhone || docData.phone || ''));
    let telVal = details.telephoneNumber || details.telephone || (isBilledBy ? '' : (docData.telephoneNumber || docData.telephone || ''));

    if (!isBilledBy && (!emailVal || !phoneVal || !telVal || !panVal)) {
      try {
        const allClients = getAllClientsAggregated();
        const matched = allClients.find(
          (c) =>
            (details.gstin && c.gstin && c.gstin.trim().toUpperCase() === details.gstin.trim().toUpperCase()) ||
            (name && name !== '—' && c.bizName && c.bizName.trim().toLowerCase() === String(name).trim().toLowerCase())
        );
        if (matched) {
          if (!panVal) panVal = matched.pan || '';
          if (!emailVal) emailVal = matched.email || '';
          if (!phoneVal) phoneVal = matched.phone || '';
          if (!telVal) telVal = matched.telephoneNumber || matched.telephone || '';
        }
      } catch (e) {}
    }

    return (
      <div>
        <div className="cs-billed-name">{name}</div>
        {details.address && <div className="cs-billed-detail">{details.address}</div>}
        {cityLine && <div className="cs-billed-detail">{cityLine}</div>}
        {details.state && (
          <div className="cs-billed-detail">
            {details.state}, {details.country || 'India'}{details.postal ? ` - ${details.postal}` : ''}
          </div>
        )}
        {details.gstin && <div className="cs-billed-detail">GSTIN: {details.gstin}</div>}
        {panVal && <div className="cs-billed-detail">PAN: {panVal}</div>}
        {emailVal && <div className="cs-billed-detail">Email: {emailVal}</div>}
        {phoneVal && <div className="cs-billed-detail">Phone: {phoneVal}</div>}
        {telVal && <div className="cs-billed-detail">Telephone Number: {telVal}</div>}
      </div>
    );
  };

  return (
    <div className="customise-share-page" id="customiseSharePage" style={{ display: 'block', padding: '24px 32px' }}>
      <style>{`
        .cs-footer-sections {
          margin-top: 24px;
          border-top: 2px solid #f1f5f9;
          padding-top: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .cs-section-block {}
        .cs-section-title {
          font-size: 13px;
          font-weight: 700;
          color: ${isInvoice ? '#2e7d32' : '#6366f1'};
          text-transform: uppercase;
          letter-spacing: .06em;
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid #e2e8f0;
        }
        .cs-bank-grid {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .cs-bank-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          padding: 5px 0;
          border-bottom: 1px dashed #f1f5f9;
          color: #334155;
        }
        .cs-bank-row span:first-child {
          color: #94a3b8;
          font-weight: 500;
        }
        .cs-bank-row span:last-child {
          font-weight: 600;
          color: #0f172a;
        }
        .cs-upi-id {
          display: inline-flex;
          align-items: center;
          font-size: 13px;
          font-weight: 600;
          background: #f0fdf4;
          color: ${isInvoice ? '#2e7d32' : '#4338ca'};
          padding: 5px 12px;
          border-radius: 20px;
        }
        .cs-preview-title {
          font-size: 28px !important;
          font-weight: 800 !important;
          color: ${isInvoice ? '#2e7d32' : '#7b3fe4'} !important;
          margin: 0 !important;
        }
        .cs-billed-box {
          background: ${isInvoice ? '#f0fdf4' : '#f3f0ff'} !important;
          border: 1px solid ${isInvoice ? '#bbf7d0' : 'transparent'} !important;
          border-radius: 10px;
          padding: 18px 20px;
        }
        .cs-billed-detail {
          font-size: 12px;
          color: #475569;
          margin-top: 2px;
        }
        .cs-billed-country {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }
        .cs-table {
          width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
          margin-bottom: 24px !important;
          font-size: 11.5px !important;
          word-wrap: break-word !important;
          border: 1px solid #cbd5e1 !important;
        }
        .cs-table thead tr {
          background: ${isInvoice ? '#2e7d47' : '#7b3fe4'} !important;
          color: #ffffff !important;
        }
        .cs-table thead th {
          background: ${isInvoice ? '#2e7d47' : '#7b3fe4'} !important;
          color: #ffffff !important;
          padding: 8px 3px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          white-space: normal !important;
          line-height: 1.25 !important;
          word-break: normal !important;
          overflow-wrap: break-word !important;
          border: 1px solid ${isInvoice ? '#1b5e20' : '#6d28d9'} !important;
          border-right: 1px solid rgba(255, 255, 255, 0.45) !important;
          box-sizing: border-box !important;
        }
        .cs-table thead th:last-child {
          border-right: 1px solid ${isInvoice ? '#1b5e20' : '#6d28d9'} !important;
        }
        .cs-table thead th.cs-col-item {
          white-space: normal !important;
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
        }
        .cs-table tbody tr {
          border-bottom: 1px solid #cbd5e1 !important;
        }
        .cs-table tbody td {
          padding: 7px 3px !important;
          vertical-align: top !important;
          font-size: 11px !important;
          word-break: normal !important;
          overflow-wrap: normal !important;
          border: 1px solid #cbd5e1 !important;
          box-sizing: border-box !important;
        }
        .cs-table tbody td.cs-col-item {
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
          white-space: normal !important;
        }
        .cs-table .cs-num-cell {
          white-space: nowrap !important;
          word-break: keep-all !important;
          overflow-wrap: normal !important;
        }
        .cs-table-tfoot-spacer {
          display: none;
        }
        .cs-table-tfoot-spacer td {
          border: none !important;
          background: transparent !important;
          padding: 0 !important;
          height: 0 !important;
        }
        .cs-doc-footer {
          margin-top: 28px;
          padding-top: 10px;
          border-top: 1px dashed #cbd5e1;
        }
        .cs-df-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .cs-df-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .cs-df-label {
          font-size: 10.5px;
          color: #64748b;
          font-weight: 500;
        }
        .cs-df-val {
          font-size: 12px;
          font-weight: 600;
          color: #0f172a;
        }
        .cs-df-col-page {
          text-align: right;
          align-self: center;
        }
        .cs-df-page-text {
          font-size: 12px;
          font-weight: 600;
          color: #0f172a;
        }
        .cs-df-note {
          text-align: center;
          font-size: 10px;
          color: #64748b;
          margin-top: 8px;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 12mm 12mm;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          html,
          body,
          body.db-body,
          .db-body,
          .db-app-wrapper,
          #root,
          .app-layout,
          .app-main,
          .db-main,
          #dbMain,
          .document-editor,
          .customise-share-page,
          #customiseSharePage,
          .cs-preview-wrap,
          .cs-preview {
            background: #ffffff !important;
            color: #111827 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            overflow-x: visible !important;
            overflow-y: visible !important;
            position: static !important;
            display: block !important;
            border: none !important;
            box-shadow: none !important;
            float: none !important;
          }
          aside,
          nav,
          header,
          .sidebar,
          .db-sidebar,
          .db-header,
          .top-navbar,
          .app-sidebar,
          .cs-topbar,
          .cs-stepper,
          .cs-action-bar,
          .cs-summary-wrap,
          .save-action-bar,
          .toast,
          .modal-overlay,
          button,
          .remove-logo-btn,
          .approval-banner,
          .approval-banner *,
          .approval-status-badge,
          .approval-status-badge *,
          .approval-banner-approved,
          .approval-banner-pending,
          .approval-banner-rejected,
          .approval-banner-draft,
          .no-print,
          .no-print * {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          #customiseSharePage > *:not(.cs-preview-wrap) {
            display: none !important;
          }
          #customiseSharePage .cs-preview-wrap {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          .cs-preview {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 0 24mm 0 !important;
            background: #ffffff !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          .cs-preview-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            margin-bottom: 16px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .cs-preview-title {
            font-size: 28px !important;
            font-weight: 800 !important;
            color: ${isInvoice ? '#2e7d32' : '#7b3fe4'} !important;
            margin: 0 !important;
          }
          .cs-preview-header img {
            max-width: 220px !important;
            max-height: 90px !important;
            object-fit: contain !important;
          }
          .cs-preview-meta {
            margin-bottom: 18px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .cs-meta-row {
            display: flex !important;
            gap: 16px !important;
            font-size: 12px !important;
            color: #4b5563 !important;
            margin-bottom: 4px !important;
          }
          .cs-meta-row strong {
            color: #111827 !important;
            min-width: 130px !important;
          }
          .cs-billed-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 14px !important;
            margin-bottom: 18px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .cs-billed-box {
            background: ${isInvoice ? '#f0fdf4' : '#f3f0ff'} !important;
            border: 1px solid ${isInvoice ? '#bbf7d0' : 'transparent'} !important;
            border-radius: 6px !important;
            padding: 12px 14px !important;
          }
          .cs-billed-label {
            font-size: 13px !important;
            font-weight: 700 !important;
            color: #7b3fe4 !important;
            margin-bottom: 4px !important;
          }
          .cs-billed-name {
            font-size: 12.5px !important;
            font-weight: 700 !important;
            color: #0f172a !important;
            margin-bottom: 2px !important;
          }
          .cs-billed-detail, .cs-billed-country {
            font-size: 11px !important;
            color: #475569 !important;
            margin-top: 1px !important;
          }
          .cs-table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            margin-bottom: 16px !important;
            font-size: 10px !important;
            word-wrap: break-word !important;
            border: 1px solid #94a3b8 !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          .cs-table thead {
            display: table-header-group !important;
          }
          .cs-table thead tr {
            background: ${isInvoice ? '#2e7d47' : '#7b3fe4'} !important;
            color: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .cs-table thead th {
            background: ${isInvoice ? '#2e7d47' : '#7b3fe4'} !important;
            color: #ffffff !important;
            padding: 6px 3px !important;
            font-weight: 600 !important;
            font-size: 10px !important;
            line-height: 1.25 !important;
            border: 1px solid ${isInvoice ? '#1b5e20' : '#5b21b6'} !important;
            border-right: 1px solid rgba(255, 255, 255, 0.45) !important;
            white-space: normal !important;
            word-break: normal !important;
            overflow-wrap: break-word !important;
            box-sizing: border-box !important;
          }
          .cs-table thead th:last-child {
            border-right: 1px solid ${isInvoice ? '#1b5e20' : '#5b21b6'} !important;
          }
          .cs-table thead th.cs-col-item {
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
          }
          .cs-table tbody tr {
            border-bottom: 1px solid #cbd5e1 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            break-inside: avoid-page !important;
          }
          .cs-table tbody td {
            border: 1px solid #cbd5e1 !important;
            padding: 6px 3px !important;
            color: #374151 !important;
            vertical-align: top !important;
            font-size: 10px !important;
            word-break: normal !important;
            overflow-wrap: normal !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            break-inside: avoid-page !important;
          }
          .cs-table tbody td.cs-col-item {
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            white-space: normal !important;
          }
          .cs-table .cs-num-cell {
            white-space: nowrap !important;
            font-size: 10px !important;
            word-break: keep-all !important;
            overflow-wrap: normal !important;
          }
          .cs-totals-row {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            gap: 16px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 16px !important;
          }
          .cs-total-words {
            font-size: 11.5px !important;
            color: #374151 !important;
            max-width: 380px !important;
            line-height: 1.5 !important;
          }
          .cs-total-breakdown {
            min-width: 220px !important;
          }
          .cs-tb-row {
            display: flex !important;
            justify-content: space-between !important;
            font-size: 11.5px !important;
            color: #374151 !important;
            padding: 4px 0 !important;
            border-bottom: 1px solid #e5e7eb !important;
          }
          .cs-tb-total {
            display: flex !important;
            justify-content: space-between !important;
            font-size: 13.5px !important;
            font-weight: 700 !important;
            color: #111827 !important;
            padding: 8px 0 4px !important;
            border-top: 2px solid #9ca3af !important;
            margin-top: 4px !important;
          }
          .cs-footer-sections {
            margin-top: 16px !important;
            border-top: 2px solid #e2e8f0 !important;
            padding-top: 12px !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 14px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .cs-section-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .cs-section-title {
            font-size: 11.5px !important;
            font-weight: 700 !important;
            color: #6366f1 !important;
            text-transform: uppercase !important;
            letter-spacing: .06em !important;
            margin-bottom: 6px !important;
            padding-bottom: 3px !important;
            border-bottom: 1px solid #e2e8f0 !important;
          }
          .cs-bank-row {
            display: flex !important;
            justify-content: space-between !important;
            font-size: 11px !important;
            padding: 3px 0 !important;
            border-bottom: 1px dashed #e2e8f0 !important;
            color: #334155 !important;
          }
          .cs-upi-id {
            display: inline-flex !important;
            align-items: center !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            background: #f0fdf4 !important;
            color: ${isInvoice ? '#2e7d32' : '#4338ca'} !important;
            padding: 3px 8px !important;
            border-radius: 12px !important;
          }
          .cs-table tfoot.cs-table-tfoot-spacer {
            display: table-footer-group !important;
          }
          .cs-table tfoot.cs-table-tfoot-spacer tr {
            height: 24mm !important;
            border: none !important;
            background: transparent !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .cs-table tfoot.cs-table-tfoot-spacer td {
            height: 24mm !important;
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .cs-doc-footer {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            margin: 0 !important;
            padding: 5px 0 0 0 !important;
            border-top: 1px dashed #94a3b8 !important;
            background: #ffffff !important;
            z-index: 9999 !important;
            display: block !important;
            box-sizing: border-box !important;
            width: 100% !important;
            height: 18mm !important;
          }
          .cs-df-row {
            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
          }
          .cs-df-col {
            display: flex !important;
            flex-direction: column !important;
            gap: 1px !important;
          }
          .cs-df-label {
            font-size: 8.5px !important;
            color: #64748b !important;
          }
          .cs-df-val {
            font-size: 10px !important;
            font-weight: 600 !important;
            color: #0f172a !important;
          }
          .cs-df-col-page {
            text-align: right !important;
            align-self: center !important;
          }
          .cs-df-curr-page::after {
            content: counter(page) !important;
          }
          .cs-df-total-page::after {
            content: counter(pages) !important;
          }
          .cs-df-curr-page {
            font-size: 0 !important;
          }
          .cs-df-total-page {
            font-size: 0 !important;
          }
          .cs-df-curr-page::after,
          .cs-df-total-page::after {
            font-size: 10px !important;
            font-weight: 600 !important;
            color: #0f172a !important;
          }
          .cs-df-note {
            text-align: center !important;
            font-size: 8px !important;
            color: #64748b !important;
            margin-top: 4px !important;
          }
        }
      `}</style>

      {/* Top Bar */}
      <div className="cs-topbar no-print">
        <div className="cs-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="cs-back-arrow"
            id="csBackBtn"
            onClick={onBackToBank || onEdit}
            title="Go back"
          >
            &#8592;
          </button>
          <span className="cs-bc-link" id="csBcInvoice" onClick={onEdit} style={{ cursor: 'pointer' }}>
            {docTitle}
          </span>
          <span className="cs-bc-sep">&#8250;</span>
          <span className="cs-bc-current">{currentDocNo}</span>
          <ApprovalStatusBadge status={effectiveStatus} />
        </div>
        <div className="cs-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button type="button" className="cs-create-btn" id="csCreateNewBtn" onClick={onCreateNew}>
            <i className="fa-solid fa-plus"></i> Create New {docTitle}
          </button>
        </div>
      </div>

      {/* Approval Banner (hidden for draft on summary page) */}
      {normalizeStatus(effectiveStatus) !== DOC_STATUS.DRAFT && (
        <ApprovalBanner
          status={effectiveStatus}
          isMainAdmin={isMainAdmin}
          canApprove={canApprove}
          canReject={canReject}
          submittedBy={docData.submittedBy}
          submittedAt={docData.submittedAt}
          approvedBy={docData.approvedBy}
          approvedAt={docData.approvedAt}
          rejectedBy={docData.rejectedBy}
          rejectedAt={docData.rejectedAt}
          rejectionReason={docData.rejectionReason}
          onApprove={onApprove}
          onReject={onReject}
          onViewHistory={onViewHistory}
        />
      )}

      {/* Stepper */}
      <div className="cs-stepper no-print">
        <div className="cs-step cs-step-done" id="csStep1Link" onClick={onEdit} style={{ cursor: 'pointer' }}>
          <span className="cs-scircle">&#10003;</span>
          <span className="cs-slabel">Add {docTitle} Details</span>
        </div>
        <span className="cs-sarrow">&#8250;</span>
        <div
          className="cs-step cs-step-done"
          id="csStep2Link"
          onClick={onBackToBank || onEdit}
          style={{ cursor: 'pointer' }}
        >
          <span className="cs-scircle">&#10003;</span>
          <span className="cs-slabel">Add Bank &amp; UPI Details</span>
        </div>
        <span className="cs-sarrow">&#8250;</span>
        <div className="cs-step cs-step-active">
          <span className="cs-scircle cs-scircle-active">3</span>
          <div>
            <div className="cs-slabel-main">Customise &amp; Share</div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="cs-action-bar no-print" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="cs-action-btn"
          id="csEditBtn"
          onClick={onEdit}
          disabled={locked}
          title={locked ? 'Document editing is locked while under review or approved.' : 'Edit Document'}
          style={locked ? { opacity: 0.5, cursor: 'not-allowed', background: '#f1f5f9' } : {}}
        >
          <i className={`fa-solid ${locked ? 'fa-lock' : 'fa-pen'}`}></i> {locked ? 'Locked' : 'Edit'}
        </button>
        <button type="button" className="cs-action-btn" id="csPrintBtn" onClick={handlePrint}>
          <i className="fa-solid fa-print"></i> Print
        </button>
        <button
          type="button"
          className="cs-action-btn"
          id="csDownloadBtn"
          onClick={handleDownloadPDF}
          disabled={downloading}
        >
          <i className={`fa-solid ${downloading ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>{' '}
          {downloading ? 'Generating...' : 'Download'}
        </button>

        {convertLabel && (
          <button
            type="button"
            className="cs-action-btn"
            style={{ backgroundColor: '#f5f3ff', color: '#6366f1', borderColor: '#c7d2fe' }}
            onClick={onConvert}
          >
            <i className="fa-solid fa-arrow-right-arrow-left"></i> {convertLabel}
          </button>
        )}

        {/* Submit for Approval (on last summary page) */}
        {!locked && canSubmit && onSubmitApproval && (
          <button
            type="button"
            className="cs-action-btn"
            style={{
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              borderColor: '#4f46e5',
              fontWeight: 700,
              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
              cursor: approvalLoading ? 'wait' : 'pointer'
            }}
            onClick={onSubmitApproval}
            disabled={approvalLoading}
          >
            <i className={`fa-solid ${approvalLoading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>{' '}
            {approvalLoading
              ? 'Submitting...'
              : normalizeStatus(effectiveStatus) === DOC_STATUS.REJECTED
              ? 'Resubmit for Approval'
              : 'Submit for Approval'}
          </button>
        )}

        {normalizeStatus(effectiveStatus) === DOC_STATUS.PENDING_APPROVAL && (
          <>
            {canReject && onReject && (
              <button
                type="button"
                className="cs-action-btn"
                style={{ backgroundColor: '#ef4444', color: '#ffffff', borderColor: '#ef4444', marginLeft: 'auto' }}
                onClick={onReject}
              >
                <i className="fa-solid fa-xmark"></i> Reject
              </button>
            )}
            {canApprove && onApprove && (
              <button
                type="button"
                className="cs-action-btn"
                style={{ backgroundColor: '#16a34a', color: '#ffffff', borderColor: '#16a34a', marginLeft: canReject ? '0' : 'auto' }}
                onClick={onApprove}
              >
                <i className="fa-solid fa-check"></i> Approve
              </button>
            )}
          </>
        )}
      </div>

      {/* Invoice / Quotation Preview */}
      <div className="cs-preview-wrap">
        <div className="cs-preview" ref={previewRef}>
          {/* Header */}
          <div
            className="cs-preview-header"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}
          >
            <h1
              className="cs-preview-title"
              style={{
                margin: 0,
                color: isInvoice ? '#2e7d32' : '#7b3fe4',
                fontSize: '28px',
                fontWeight: 800
              }}
            >
              {docTitle}
            </h1>
            {logoSrc && (
              <img
                src={logoSrc}
                alt="Logo"
                style={{ maxWidth: '320px', maxHeight: '130px', objectFit: 'contain' }}
              />
            )}
          </div>

          {/* Meta Information */}
          <div className="cs-preview-meta">
            <div className="cs-meta-row">
              <span>{docTitle} No</span>
              <strong>{currentDocNo}</strong>
            </div>
            <div className="cs-meta-row">
              <span>{docTitle} Date</span>
              <strong>{fmtDate(date)}</strong>
            </div>
            <div className="cs-meta-row">
              <span>Due Date</span>
              <strong>{fmtDate(dueDate || getDueDate({ date }))}</strong>
            </div>
            {refPoNo && (
              <div className="cs-meta-row">
                <span>Reference PO No</span>
                <strong>{refPoNo}</strong>
              </div>
            )}
            {refDcNo && (
              <div className="cs-meta-row">
                <span>Reference DC No</span>
                <strong>{refDcNo}</strong>
              </div>
            )}
            {refPiNo && (
              <div className="cs-meta-row">
                <span>Reference PI No</span>
                <strong>{refPiNo}</strong>
              </div>
            )}
            {refQuotationNo && (
              <div className="cs-meta-row">
                <span>Reference Quotation No</span>
                <strong>{refQuotationNo}</strong>
              </div>
            )}
            {!refPoNo && !refDcNo && !refPiNo && !refQuotationNo && (docData.refNo || refNo) && (
              <div className="cs-meta-row">
                <span>Reference No</span>
                <strong>{docData.refNo || refNo}</strong>
              </div>
            )}
          </div>

          {/* Billed By & Billed To */}
          <div className="cs-billed-grid">
            <div
              className="cs-billed-box"
              style={isInvoice ? { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' } : {}}
            >
              <div className="cs-billed-label" style={{ color: isInvoice ? '#2e7d32' : '#475569', fontWeight: 700 }}>Billed By</div>
              {renderBillingDetails(billedBy, true)}
            </div>
            <div
              className="cs-billed-box"
              style={isInvoice ? { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' } : {}}
            >
              <div className="cs-billed-label" style={{ color: isInvoice ? '#2e7d32' : '#475569', fontWeight: 700 }}>Billed To</div>
              {renderBillingDetails(billedTo, false)}
            </div>
          </div>

          {/* Line Items Table */}
          <table className="cs-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '3.5%' }} />
              <col style={{ width: '16.5%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '9.5%' }} />
              <col style={{ width: '9.5%' }} />
              <col style={{ width: '11%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ width: '3.5%', textAlign: 'center' }} className="cs-num-cell">#</th>
                <th style={{ width: '16.5%', textAlign: 'left' }} className="cs-col-item">Item</th>
                <th style={{ width: '8%', textAlign: 'center' }} className="cs-num-cell">HSN/SAC</th>
                <th style={{ width: '8%', textAlign: 'center' }} className="cs-num-cell">GST Rate</th>
                <th style={{ width: '7%', textAlign: 'center' }} className="cs-num-cell">Quantity</th>
                <th style={{ width: '6%', textAlign: 'center' }} className="cs-num-cell">UOM</th>
                <th style={{ width: '10%', textAlign: 'right' }} className="cs-num-cell">Rate</th>
                <th style={{ width: '11%', textAlign: 'right' }} className="cs-num-cell">Amount</th>
                <th style={{ width: '9.5%', textAlign: 'right' }} className="cs-num-cell">CGST</th>
                <th style={{ width: '9.5%', textAlign: 'right' }} className="cs-num-cell">SGST</th>
                <th style={{ width: '11%', textAlign: 'right' }} className="cs-num-cell">Total</th>
              </tr>
            </thead>
            <tbody>
              {items && items.length > 0 ? (
                items.map((row, idx) => {
                  const rateNum = clean(row.rate);
                  const qtyNum = clean(row.qty);
                  const gstNum = clean(row.gst);
                  const amtNum = clean(row.amount) || (qtyNum * rateNum);
                  const cgstNum = clean(row.cgst) || ((amtNum * gstNum) / 200);
                  const sgstNum = clean(row.sgst) || ((amtNum * gstNum) / 200);
                  const totNum = clean(row.total) || (amtNum + cgstNum + sgstNum);

                  const rowBg = idx % 2 === 0 ? (isInvoice ? '#f0fdf4' : '#f3f0ff') : '#ffffff';
                  return (
                    <tr key={idx} style={{ backgroundColor: rowBg }}>
                      <td style={{ verticalAlign: 'top', whiteSpace: 'nowrap', textAlign: 'center', backgroundColor: rowBg }} className="cs-num-cell">{idx + 1}</td>
                      <td className="cs-col-item" style={{ verticalAlign: 'top', textAlign: 'left', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal', backgroundColor: rowBg }}>
                        <strong style={{ display: 'block', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal', lineHeight: 1.4 }}>
                          {row.itemName || '—'}
                        </strong>
                        {row.desc && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#64748b',
                              marginTop: '3px',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              wordWrap: 'break-word',
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.4
                            }}
                          >
                            {row.desc}
                          </div>
                        )}
                      </td>
                      <td style={{ verticalAlign: 'top', whiteSpace: 'nowrap', textAlign: 'center', backgroundColor: rowBg }} className="cs-num-cell">{row.hsn || '—'}</td>
                      <td style={{ verticalAlign: 'top', whiteSpace: 'nowrap', textAlign: 'center', backgroundColor: rowBg }} className="cs-num-cell">{row.gst ? `${row.gst}%` : '0%'}</td>
                      <td style={{ verticalAlign: 'top', whiteSpace: 'nowrap', textAlign: 'center', backgroundColor: rowBg }} className="cs-num-cell">{row.qty || '0'}</td>
                      <td style={{ verticalAlign: 'top', whiteSpace: 'nowrap', textAlign: 'center', backgroundColor: rowBg }} className="cs-num-cell">{row.uom || '—'}</td>
                      <td style={{ verticalAlign: 'top', whiteSpace: 'nowrap', textAlign: 'right', backgroundColor: rowBg }} className="cs-num-cell">₹{rateNum.toFixed(2)}</td>
                      <td style={{ verticalAlign: 'top', whiteSpace: 'nowrap', textAlign: 'right', backgroundColor: rowBg }} className="cs-num-cell">₹{amtNum.toFixed(2)}</td>
                      <td style={{ verticalAlign: 'top', whiteSpace: 'nowrap', textAlign: 'right', backgroundColor: rowBg }} className="cs-num-cell">₹{cgstNum.toFixed(2)}</td>
                      <td style={{ verticalAlign: 'top', whiteSpace: 'nowrap', textAlign: 'right', backgroundColor: rowBg }} className="cs-num-cell">₹{sgstNum.toFixed(2)}</td>
                      <td style={{ verticalAlign: 'top', whiteSpace: 'nowrap', textAlign: 'right', backgroundColor: rowBg }} className="cs-num-cell">
                        <strong>₹{totNum.toFixed(2)}</strong>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>
                    No items added
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="cs-table-tfoot-spacer">
              <tr>
                <td colSpan={11}></td>
              </tr>
            </tfoot>
          </table>

          {/* Totals Summary */}
          <div className="cs-totals-row">
            <div className="cs-total-words">
              Total (in words) : <strong>{totalWords}</strong>
            </div>
            <div className="cs-total-breakdown">
              <div className="cs-tb-row">
                <span>Amount</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="cs-tb-row">
                <span>CGST</span>
                <span>₹{totalCgst.toFixed(2)}</span>
              </div>
              <div className="cs-tb-row">
                <span>SGST</span>
                <span>₹{totalSgst.toFixed(2)}</span>
              </div>
              <div className="cs-tb-total">
                <span>Total (INR)</span>
                <strong>₹{grandTotal.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* Extra Sections (Bank, UPI, Terms, Notes, Contact) */}
          {(displayBankAccounts.length > 0 ||
            displayUpiAccounts.length > 0 ||
            terms.length > 0 ||
            notes ||
            contactEmail ||
            contactPhone) && (
            <div className="cs-footer-sections">
              {/* Bank Details */}
              {displayBankAccounts.length > 0 && (
                <div className="cs-section-block">
                  <div className="cs-section-title">Bank Details</div>
                  <div className="cs-bank-grid">
                    {displayBankAccounts.map((b, i) => (
                      <div key={i} style={{ marginBottom: '8px' }}>
                        <div className="cs-bank-row">
                          <span>Account Name</span>
                          <span>{b.accountHolderName || b.holder || '—'}</span>
                        </div>
                        <div className="cs-bank-row">
                          <span>Account Number</span>
                          <span>{b.accountNumber || b.accNo || '—'}</span>
                        </div>
                        <div className="cs-bank-row">
                          <span>Bank</span>
                          <span>{b.bankName || b.name || '—'}</span>
                        </div>
                        {(b.ifscCode || b.ifsc) && (
                          <div className="cs-bank-row">
                            <span>IFSC</span>
                            <span>{b.ifscCode || b.ifsc}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* UPI Details */}
              {displayUpiAccounts.length > 0 && (
                <div className="cs-section-block">
                  <div className="cs-section-title">UPI Details</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                    {displayUpiAccounts.map((u, i) => (
                      <span key={i} className="cs-upi-id">
                        <i className="fa-solid fa-qrcode" style={{ marginRight: '6px', color: '#6366f1' }}></i>
                        {u.upiId}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Terms and Conditions */}
              {terms.length > 0 && (
                <div className="cs-section-block">
                  <div className="cs-section-title">Terms and Conditions</div>
                  <ol style={{ margin: '8px 0 0 18px', padding: 0, fontSize: '13px', color: '#475569', lineHeight: '1.7' }}>
                    {terms.map((t, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>
                        {t}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Additional Notes */}
              {notes && notes.trim() !== '' && notes.trim() !== '<br>' && (
                <div className="cs-section-block">
                  <div className="cs-section-title">Additional Notes</div>
                  <div
                    style={{ fontSize: '13px', color: '#475569', lineHeight: '1.7', marginTop: '8px' }}
                    dangerouslySetInnerHTML={{ __html: notes }}
                  />
                </div>
              )}

              {/* Contact Details */}
              {(contactEmail || contactPhone) && (
                <div className="cs-section-block">
                  <div className="cs-section-title">Contact Details</div>
                  <div style={{ fontSize: '13px', color: '#475569', marginTop: '8px', lineHeight: '1.8' }}>
                    {contactEmail && (
                      <div>
                        <i className="fa-regular fa-envelope" style={{ width: '18px', color: '#6366f1' }}></i>{' '}
                        {contactEmail}
                      </div>
                    )}
                    {contactPhone && (
                      <div>
                        <i className="fa-solid fa-phone" style={{ width: '18px', color: '#6366f1' }}></i>{' '}
                        {countryCode} {contactPhone}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Attachments */}
              {attachments && attachments.length > 0 && (
                <div className="cs-section-block">
                  <div className="cs-section-title">Attachments</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                    {attachments.map((att, i) => (
                      <span
                        key={i}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          background: '#f1f5f9',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#334155'
                        }}
                      >
                        <i className="fa-solid fa-paperclip" style={{ color: '#6366f1' }}></i>
                        {typeof att === 'string' ? att : (att?.name || 'Attachment')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Running Page Footer */}
          <div className="cs-doc-footer">
            <div className="cs-df-row">
              <div className="cs-df-col">
                <span className="cs-df-label">{docTitle} No</span>
                <span className="cs-df-val">{currentDocNo}</span>
              </div>
              <div className="cs-df-col">
                <span className="cs-df-label">{docTitle} Date</span>
                <span className="cs-df-val">{fmtDate(date)}</span>
              </div>
              <div className="cs-df-col cs-df-col-billed">
                <span className="cs-df-label">Billed To</span>
                <span className="cs-df-val">
                  {billedTo?.bizName || billedTo?.name || (typeof billedTo === 'string' ? billedTo : '') || '—'}
                </span>
              </div>
              <div className="cs-df-col cs-df-col-page">
                <span className="cs-df-page-text">
                  Page <span className="cs-df-curr-page">1</span> of <span className="cs-df-total-page">{estimatedTotalPages}</span>
                </span>
              </div>
            </div>
            <div className="cs-df-note">
              NOTE: This is an Electronically Generated Document, Signatures are not Required.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
