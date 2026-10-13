import React, { useState, useEffect } from 'react';
import { FIXED_BANK_ACCOUNT, normalizeBankAccounts } from '../../constants/companyDetails';

export default function BankUpiStep({
  bankAccounts,
  upiAccounts,
  onUpdateBankAccounts,
  onUpdateUpiAccounts,
  onBack,
  onContinue,
  docTitle = 'Invoice'
}) {
  // Modal states
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [upiModalOpen, setUpiModalOpen] = useState(false);

  // Bank form state
  const [bankForm, setBankForm] = useState({ ...FIXED_BANK_ACCOUNT });

  // UPI form state
  const [upiForm, setUpiForm] = useState({
    upiId: '',
    linkedBank: '',
    ledger: ''
  });

  const [editingBankIdx, setEditingBankIdx] = useState(-1);
  const [editingUpiIdx, setEditingUpiIdx] = useState(-1);

  useEffect(() => {
    if (!bankAccounts || bankAccounts.length === 0) {
      onUpdateBankAccounts([FIXED_BANK_ACCOUNT]);
      try {
        localStorage.setItem('invox_saved_bank_accounts', JSON.stringify([FIXED_BANK_ACCOUNT]));
      } catch (e) {}
    } else {
      const normalized = normalizeBankAccounts(bankAccounts);
      const isDifferent = JSON.stringify(normalized) !== JSON.stringify(bankAccounts);
      if (isDifferent) {
        onUpdateBankAccounts(normalized);
        try {
          localStorage.setItem('invox_saved_bank_accounts', JSON.stringify(normalized));
        } catch (e) {}
      }
    }
  }, []);

  const resetBankForm = () => {
    setBankForm({ ...FIXED_BANK_ACCOUNT });
    setEditingBankIdx(-1);
  };

  const resetUpiForm = () => {
    setUpiForm({
      upiId: '',
      linkedBank: '',
      ledger: ''
    });
    setEditingUpiIdx(-1);
  };

  const handleSaveBankAccount = (e, andContinue = false) => {
    e.preventDefault();
    if (!bankForm.bankName || !bankForm.accountNumber || !bankForm.confirmAccountNumber || !bankForm.ifscCode || !bankForm.accountHolderName) {
      alert('Please fill all mandatory fields marked with *');
      return;
    }

    if (bankForm.accountNumber !== bankForm.confirmAccountNumber) {
      alert('Account numbers do not match!');
      return;
    }

    const updated = [...bankAccounts];
    if (editingBankIdx >= 0) {
      updated[editingBankIdx] = { ...bankForm };
    } else {
      updated.push({ ...bankForm });
    }
    onUpdateBankAccounts(updated);
    try {
      localStorage.setItem('invox_saved_bank_accounts', JSON.stringify(updated));
    } catch (e) {}
    setBankModalOpen(false);
    resetBankForm();
    if (andContinue && onContinue) {
      onContinue();
    }
  };

  const handleSaveUpiAccount = (e, andContinue = false) => {
    e.preventDefault();
    if (!upiForm.upiId) {
      alert('Please enter a valid UPI ID (e.g. name@upi)');
      return;
    }

    const updated = [...upiAccounts];
    if (editingUpiIdx >= 0) {
      updated[editingUpiIdx] = { ...upiForm };
    } else {
      updated.push({ ...upiForm });
    }
    onUpdateUpiAccounts(updated);
    try {
      localStorage.setItem('invox_saved_upi_accounts', JSON.stringify(updated));
    } catch (e) {}
    setUpiModalOpen(false);
    resetUpiForm();
    if (andContinue && onContinue) {
      onContinue();
    }
  };

  const handleDeleteBank = (idx) => {
    const updated = bankAccounts.filter((_, i) => i !== idx);
    onUpdateBankAccounts(updated);
    try {
      localStorage.setItem('invox_saved_bank_accounts', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleDeleteUpi = (idx) => {
    const updated = upiAccounts.filter((_, i) => i !== idx);
    onUpdateUpiAccounts(updated);
    try {
      localStorage.setItem('invox_saved_upi_accounts', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleAddCustomBankField = () => {
    setBankForm((prev) => ({
      ...prev,
      customFields: [...prev.customFields, { label: '', value: '' }]
    }));
  };

  const handleCustomBankFieldChange = (index, key, val) => {
    const fields = [...bankForm.customFields];
    fields[index][key] = val;
    setBankForm((prev) => ({ ...prev, customFields: fields }));
  };

  const handleRemoveCustomBankField = (index) => {
    const fields = bankForm.customFields.filter((_, i) => i !== index);
    setBankForm((prev) => ({ ...prev, customFields: fields }));
  };

  const hasAccounts = bankAccounts.length > 0 || upiAccounts.length > 0;

  return (
    <div className="bank-step-page" id="bankStepPage" style={{ display: 'block' }}>
      {/* Stepper Header */}
      <div className="bsp-stepper">
        <div className="bsp-step bsp-done" onClick={onBack} style={{ cursor: 'pointer' }}>
          <span className="bsp-circle">&#10003;</span>
          <span className="bsp-label" id="backToInvoiceLink">
            Add {docTitle} Details
          </span>
        </div>
        <div className="bsp-arrow">
          <i className="fa-solid fa-chevron-right"></i>
        </div>
        <div className="bsp-step bsp-active">
          <span className="bsp-circle bsp-circle-active">2</span>
          <div>
            <div className="bsp-label-main">Add Bank &amp; UPI Details</div>
            <div className="bsp-label-sub">Optional</div>
          </div>
        </div>
        <div className="bsp-arrow">
          <i className="fa-solid fa-chevron-right"></i>
        </div>
        <div className="bsp-step" onClick={onContinue} style={{ cursor: 'pointer' }}>
          <span className="bsp-circle bsp-circle-dim">3</span>
          <div>
            <div className="bsp-label-main bsp-dim">Customise &amp; Share</div>
            <div className="bsp-label-sub">Optional</div>
          </div>
        </div>
      </div>

      <h3 className="bsp-title">Add Bank &amp; UPI Details</h3>

      {/* State A: No accounts yet */}
      {!hasAccounts ? (
        <div className="bsp-empty-state">
          <div className="bsp-cards">
            <div
              className="bsp-card"
              onClick={() => {
                resetBankForm();
                setBankModalOpen(true);
              }}
            >
              <div className="bsp-card-icon">
                <i className="fa-solid fa-building-columns"></i>
              </div>
              <h4>Add Bank Account Details</h4>
              <p>
                Record all payments received against this and future documents in the respective
                Bank and other Payment Accounts.
              </p>
              <button type="button" className="bsp-add-btn">
                <i className="fa-solid fa-plus"></i> Add Bank Account
              </button>
            </div>

            <div
              className="bsp-card"
              onClick={() => {
                resetUpiForm();
                setUpiModalOpen(true);
              }}
            >
              <div className="bsp-card-icon bsp-card-icon-upi">
                <i className="fa-solid fa-qrcode"></i>
              </div>
              <h4>Add UPI Details</h4>
              <p>Collect payments via UPI apps such as Google Pay, PhonePe, and PayTM.</p>
              <button type="button" className="bsp-add-btn">
                <i className="fa-solid fa-plus"></i> Add UPI ID
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* State B: Accounts exist */
        <div className="bsp-accounts-state" style={{ display: 'block' }}>
          {/* Bank Accounts */}
          <div className="bsp-accounts-section">
            <div className="bsp-accounts-header">
              <h4>Bank Accounts</h4>
              <button
                type="button"
                className="bsp-add-new-link"
                onClick={() => {
                  resetBankForm();
                  setBankModalOpen(true);
                }}
              >
                <i className="fa-solid fa-plus"></i> Add New
              </button>
            </div>
            <div className="bsp-account-list" id="bankAccountList">
              {bankAccounts.map((b, i) => (
                <div
                  key={i}
                  className={`bsp-account-card ${i === 0 ? 'bsp-account-card-selected' : ''}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="radio"
                      name="selectedBank"
                      defaultChecked={i === 0}
                      style={{ accentColor: '#7b3fe4', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <div>
                      <strong style={{ color: '#0f172a' }}>{b.bankName}</strong> — A/C:{' '}
                      {b.accountNumber} ({b.accountHolderName})
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        IFSC: {b.ifscCode} • {b.accountType} • {b.currency}
                      </div>
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        const normalized = normalizeBankAccounts([b])[0] || { ...FIXED_BANK_ACCOUNT };
                        setBankForm(normalized);
                        setEditingBankIdx(i);
                        setBankModalOpen(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6366f1',
                        cursor: 'pointer',
                        marginRight: '12px',
                      }}
                    >
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBank(i)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#dc2626',
                        cursor: 'pointer',
                      }}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* UPI Accounts */}
          <div className="bsp-accounts-section" style={{ marginTop: '24px' }}>
            <div className="bsp-accounts-header">
              <h4>UPI Details</h4>
              <button
                type="button"
                className="bsp-add-new-link"
                onClick={() => {
                  resetUpiForm();
                  setUpiModalOpen(true);
                }}
              >
                <i className="fa-solid fa-plus"></i> Add New
              </button>
            </div>
            <div className="bsp-upi-list">
              {upiAccounts.map((u, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    background: '#fff',
                  }}
                >
                  <div>
                    <strong style={{ color: '#0f172a' }}>{u.upiId}</strong>
                    {u.linkedBank && (
                      <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '10px' }}>
                        Linked: {u.linkedBank}
                      </span>
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setUpiForm(u);
                        setEditingUpiIdx(i);
                        setUpiModalOpen(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6366f1',
                        cursor: 'pointer',
                        marginRight: '12px',
                      }}
                    >
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUpi(i)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#dc2626',
                        cursor: 'pointer',
                      }}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="bsp-footer">
        <button type="button" className="bsp-back-btn" id="bspBackBtn" onClick={onBack}>
          <i className="fa-solid fa-chevron-left"></i> Go back
        </button>
        <button
          type="button"
          className="bsp-skip-btn"
          id="bspSkipBtn"
          onClick={onContinue}
          style={hasAccounts ? { background: '#7b3fe4', color: '#fff', borderColor: '#7b3fe4', display: 'inline-flex', alignItems: 'center', gap: '8px' } : {}}
        >
          {hasAccounts ? (
            <>
              Continue <i className="fa-solid fa-arrow-right"></i>
            </>
          ) : (
            'Skip & Continue'
          )}
        </button>
      </div>

      {/* Bank Modal */}
      {bankModalOpen && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal-box" id="bankModal" style={{ width: '600px', maxWidth: '95vw' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {editingBankIdx >= 0 ? 'Edit Bank Account' : 'Add New Bank Account'}
              </h3>
              <span
                className="modal-close"
                style={{ cursor: 'pointer', fontSize: '18px' }}
                onClick={() => setBankModalOpen(false)}
              >
                &#10005;
              </span>
            </div>
            <div className="modal-body">
              <div className="modal-row" style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div className="modal-field" style={{ flex: 1 }}>
                  <label>Country<span className="req">*</span></label>
                  <select
                    className="modal-select"
                    value={bankForm.country}
                    onChange={(e) => setBankForm({ ...bankForm, country: e.target.value })}
                  >
                    <option>India</option>
                    <option>USA</option>
                    <option>UK</option>
                    <option>UAE</option>
                  </select>
                </div>
                <div className="modal-field" style={{ flex: 1 }}>
                  <label>Bank Name<span className="req">*</span></label>
                  <input
                    type="text"
                    className="modal-input"
                    value={bankForm.bankName}
                    onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-row" style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div className="modal-field" style={{ flex: 1 }}>
                  <label>Account Number<span className="req">*</span></label>
                  <input
                    type="text"
                    className="modal-input"
                    value={bankForm.accountNumber}
                    onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="modal-field" style={{ flex: 1 }}>
                  <label>Confirm Account Number<span className="req">*</span></label>
                  <input
                    type="text"
                    className="modal-input"
                    value={bankForm.confirmAccountNumber}
                    onChange={(e) => setBankForm({ ...bankForm, confirmAccountNumber: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-row" style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div className="modal-field" style={{ flex: 1 }}>
                  <label>IFSC Code<span className="req">*</span></label>
                  <input
                    type="text"
                    className="modal-input"
                    value={bankForm.ifscCode}
                    onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value })}
                    required
                  />
                </div>
                <div className="modal-field" style={{ flex: 1 }}>
                  <label>Account Holder Name<span className="req">*</span></label>
                  <input
                    type="text"
                    className="modal-input"
                    value={bankForm.accountHolderName}
                    onChange={(e) => setBankForm({ ...bankForm, accountHolderName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-row" style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div className="modal-field" style={{ flex: 1 }}>
                  <label>Bank Account Type</label>
                  <select
                    className="modal-select"
                    value={bankForm.accountType}
                    onChange={(e) => setBankForm({ ...bankForm, accountType: e.target.value })}
                  >
                    <option>Current</option>
                    <option>Savings</option>
                  </select>
                </div>
                <div className="modal-field" style={{ flex: 1 }}>
                  <label>Currency<span className="req">*</span></label>
                  <select
                    className="modal-select"
                    value={bankForm.currency}
                    onChange={(e) => setBankForm({ ...bankForm, currency: e.target.value })}
                  >
                    <option>Indian Rupee (INR, ₹)</option>
                    <option>US Dollar (USD, $)</option>
                    <option>Euro (EUR, €)</option>
                  </select>
                </div>
              </div>

              <div className="swift-toggle" onClick={() => setBankForm({ ...bankForm, showSwift: !bankForm.showSwift })} style={{ cursor: 'pointer', color: '#6366f1', marginBottom: '12px' }}>
                <i className={`fa-solid ${bankForm.showSwift ? 'fa-minus' : 'fa-plus'}`}></i> {bankForm.showSwift ? 'Remove SWIFT Code' : 'Add SWIFT Code'}
              </div>

              {bankForm.showSwift && (
                <div className="modal-field" style={{ marginBottom: '12px' }}>
                  <label>SWIFT Code</label>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="Enter SWIFT/BIC code"
                    value={bankForm.swiftCode}
                    onChange={(e) => setBankForm({ ...bankForm, swiftCode: e.target.value })}
                  />
                </div>
              )}

              {/* Custom Bank Fields */}
              <div className="custom-bank-section" style={{ marginTop: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>Custom Bank Details</h4>
                  <button
                    type="button"
                    className="custom-field-add-btn"
                    onClick={handleAddCustomBankField}
                    style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                  >
                    <i className="fa-solid fa-plus"></i> Add Custom Field
                  </button>
                </div>
                {bankForm.customFields.map((cf, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="modal-input"
                      placeholder="Field name"
                      style={{ flex: 1 }}
                      value={cf.label}
                      onChange={(e) => handleCustomBankFieldChange(i, 'label', e.target.value)}
                    />
                    <input
                      type="text"
                      className="modal-input"
                      placeholder="Value"
                      style={{ flex: 1 }}
                      value={cf.value}
                      onChange={(e) => handleCustomBankFieldChange(i, 'value', e.target.value)}
                    />
                    <span
                      style={{ cursor: 'pointer', color: '#dc2626' }}
                      onClick={() => handleRemoveCustomBankField(i)}
                    >
                      &#10005;
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                className="modal-btn cancel"
                onClick={() => setBankModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-submit-btn"
                onClick={(e) => handleSaveBankAccount(e, false)}
                style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '9px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                {editingBankIdx >= 0 ? 'Update Account' : 'Save Account'}
              </button>
              <button
                type="button"
                className="modal-submit-btn"
                id="saveBankAndContinueBtn"
                onClick={(e) => handleSaveBankAccount(e, true)}
                style={{ background: '#7b3fe4', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                Save &amp; Continue <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPI Modal */}
      {upiModalOpen && (
        <div className="modal-overlay" style={{ display: 'flex' }}>
          <div className="modal-box modal-box-sm" style={{ width: '450px', maxWidth: '95vw' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {editingUpiIdx >= 0 ? 'Edit Payment Account' : 'Add New Payment Account'}
              </h3>
              <span
                className="modal-close"
                style={{ cursor: 'pointer', fontSize: '18px' }}
                onClick={() => setUpiModalOpen(false)}
              >
                &#10005;
              </span>
            </div>
            <div className="modal-body">
              <div className="modal-field" style={{ marginBottom: '12px' }}>
                <label>VPA (UPI ID)<span className="req">*</span></label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="example@upi"
                  value={upiForm.upiId}
                  onChange={(e) => setUpiForm({ ...upiForm, upiId: e.target.value })}
                  required
                />
              </div>
              <div className="modal-field" style={{ marginBottom: '12px' }}>
                <label>Link Bank Account</label>
                <select
                  className="modal-select"
                  value={upiForm.linkedBank}
                  onChange={(e) => setUpiForm({ ...upiForm, linkedBank: e.target.value })}
                >
                  <option value="">Select Bank Account</option>
                  {bankAccounts.map((b, i) => (
                    <option key={i} value={b.bankName}>
                      {b.bankName} (..{b.accountNumber.slice(-4)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                className="modal-btn cancel"
                onClick={() => setUpiModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-submit-btn"
                onClick={(e) => handleSaveUpiAccount(e, false)}
                style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '9px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                {editingUpiIdx >= 0 ? 'Update' : 'Save'}
              </button>
              <button
                type="button"
                className="modal-submit-btn"
                id="saveUpiAndContinueBtn"
                onClick={(e) => handleSaveUpiAccount(e, true)}
                style={{ background: '#7b3fe4', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                Save &amp; Continue <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
