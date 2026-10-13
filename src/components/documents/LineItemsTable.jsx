import React from 'react';
import { numberToWords } from '../../utils/numberToWords';
import {
  getUomConversionFactor,
  areUomsCompatible,
  formatRate,
  parseQtyInput,
  normalizeUom,
  isStandardUom,
  getDisplayUom
} from '../../utils/uomUtils';

export default function LineItemsTable({ items, onChange }) {
  const clean = (val) => parseFloat(String(val || '').replace(/[^\d.]/g, '')) || 0;

  const handleUomBlur = (index) => {
    const newItems = [...items];
    const currentItem = { ...newItems[index] };
    const rawVal = (currentItem.uom || '').trim();
    if (!rawVal) return;

    if (isStandardUom(rawVal)) {
      const display = getDisplayUom(rawVal);
      if (display && display !== currentItem.uom) {
        currentItem.uom = display;
      }
    } else {
      currentItem.baseUom = rawVal;
      currentItem.baseRate = clean(currentItem.rate).toString();
    }
    newItems[index] = currentItem;
    onChange(newItems);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    const currentItem = { ...newItems[index] };

    if (field === 'qty') {
      // Check if user entered quantity with a unit suffix, e.g. "500gm", "2.5kg", "10pcs"
      const parsed = parseQtyInput(value);
      if (parsed && parsed.uom) {
        currentItem.qty = parsed.qty !== null ? String(parsed.qty) : '';
        const rawUom = parsed.uom;
        currentItem.uom = rawUom;

        let baseUom = currentItem.baseUom ? currentItem.baseUom.trim() : '';
        let baseRateVal = currentItem.baseRate ? parseFloat(currentItem.baseRate) : NaN;
        const currentRate = clean(currentItem.rate);

        if (isNaN(baseRateVal) || baseRateVal === 0) {
          if (currentRate > 0) {
            baseRateVal = currentRate;
            currentItem.baseRate = baseRateVal.toString();
          }
        }

        if (!baseUom || isNaN(baseRateVal)) {
          baseUom = rawUom;
          baseRateVal = currentRate;
          currentItem.baseUom = baseUom;
          currentItem.baseRate = isNaN(baseRateVal) ? '0' : baseRateVal.toString();
        }

        if (areUomsCompatible(baseUom, rawUom)) {
          const factor = getUomConversionFactor(baseUom, rawUom);
          const displayedRate = factor !== 0 ? baseRateVal / factor : baseRateVal;
          currentItem.rate = displayedRate % 1 === 0 ? displayedRate.toString() : parseFloat(displayedRate.toFixed(4)).toString();
        } else {
          currentItem.baseUom = rawUom;
          currentItem.baseRate = currentRate.toString();
        }
      } else {
        // Strip negative signs
        currentItem.qty = String(value || '').replace(/-/g, '');
      }
    } else if (field === 'uom') {
      const rawVal = String(value || '').trim();
      currentItem.uom = value;

      const normNew = normalizeUom(rawVal);
      const isValid = Boolean(normNew && isStandardUom(rawVal));

      let baseUom = currentItem.baseUom ? currentItem.baseUom.trim() : '';
      let baseRateVal = currentItem.baseRate ? parseFloat(currentItem.baseRate) : NaN;
      const currentRate = clean(currentItem.rate);

      if (isNaN(baseRateVal) || baseRateVal === 0) {
        if (currentRate > 0) {
          baseRateVal = currentRate;
          currentItem.baseRate = baseRateVal.toString();
        }
      }

      // Auto-initialize base UOM and base Rate if not set
      if (!baseUom || isNaN(baseRateVal)) {
        if (isValid) {
          baseUom = rawVal;
          baseRateVal = currentRate;
          currentItem.baseUom = baseUom;
          currentItem.baseRate = isNaN(baseRateVal) ? '0' : baseRateVal.toString();
        }
      }

      if (isValid && baseUom) {
        if (areUomsCompatible(baseUom, rawVal)) {
          const factor = getUomConversionFactor(baseUom, rawVal);
          const displayedRate = factor !== 0 ? baseRateVal / factor : baseRateVal;
          currentItem.rate = displayedRate % 1 === 0 ? displayedRate.toString() : parseFloat(displayedRate.toFixed(4)).toString();
        } else {
          // Incompatible or new base UOM family
          currentItem.baseUom = rawVal;
          currentItem.baseRate = currentRate.toString();
        }
      }
    } else if (field === 'rate') {
      const cleanVal = String(value || '').replace(/-/g, '');
      currentItem.rate = cleanVal;
      const currentRate = clean(cleanVal);
      const currentUom = (currentItem.uom || '').trim();

      let baseUom = currentItem.baseUom ? currentItem.baseUom.trim() : '';
      let baseRateVal = currentItem.baseRate ? parseFloat(currentItem.baseRate) : NaN;

      if (!baseUom || isNaN(baseRateVal) || baseRateVal === 0) {
        baseUom = currentUom;
        baseRateVal = currentRate;
        currentItem.baseUom = baseUom;
        currentItem.baseRate = isNaN(baseRateVal) ? '0' : baseRateVal.toString();
      }

      if (currentUom && baseUom && areUomsCompatible(baseUom, currentUom)) {
        const factor = getUomConversionFactor(baseUom, currentUom);
        baseRateVal = currentRate * factor;
        currentItem.baseRate = baseRateVal.toString();
      } else if (currentUom) {
        currentItem.baseUom = currentUom;
        currentItem.baseRate = currentRate.toString();
      } else {
        currentItem.baseRate = currentRate.toString();
      }
    } else if (field === 'gst') {
      currentItem.gst = String(value || '').replace(/-/g, '');
    } else {
      currentItem[field] = value;
    }

    // Auto recalculations of amount, cgst, sgst, total
    const qty = clean(currentItem.qty);
    const rate = clean(currentItem.rate);
    const gst = clean(currentItem.gst);

    const amount = qty * rate;
    const cgst = (amount * gst) / 2 / 100;
    const sgst = cgst;
    const total = amount + cgst + sgst;

    currentItem.amount = amount ? '₹' + amount.toFixed(2) : '₹0.00';
    currentItem.cgst = cgst ? '₹' + cgst.toFixed(2) : '₹0.00';
    currentItem.sgst = sgst ? '₹' + sgst.toFixed(2) : '₹0.00';
    currentItem.total = total ? '₹' + total.toFixed(2) : '₹0.00';

    newItems[index] = currentItem;
    onChange(newItems);
  };

  const handleToggleDesc = (index) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      showDesc: !newItems[index].showDesc,
    };
    onChange(newItems);
  };

  const handleAddLine = () => {
    const newItem = {
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
    };
    onChange([...items, newItem]);
  };

  const handleRemoveLine = (index) => {
    if (items.length <= 1) {
      // keep at least 1 empty row
      onChange([
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
        },
      ]);
      return;
    }
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  // Summary calculations
  const cleanVal = (val) => parseFloat(String(val || '').replace(/[^\d.]/g, '')) || 0;
  let totalAmount = 0;
  let totalCgst = 0;
  let totalSgst = 0;

  items.forEach((item) => {
    totalAmount += cleanVal(item.amount);
    totalCgst += cleanVal(item.cgst);
    totalSgst += cleanVal(item.sgst);
  });

  const grandTotal = totalAmount + totalCgst + totalSgst;
  const wordsOut = numberToWords(Math.round(grandTotal));

  return (
    <div className="invoice-box-wrapper">
      <div className="invoice-box">
        {/* Table Header */}
        <div className="invoice-header">
          <span>Item</span>
          <span>HSN/SAC</span>
          <span>GST Rate</span>
          <span>Quantity</span>
          <span>UOM</span>
          <span>Rate</span>
          <span>Amount</span>
          <span>CGST</span>
          <span>SGST</span>
          <span>Total</span>
        </div>

        {/* Rows */}
        {items.map((row, idx) => (
          <div className="invoice-row" key={idx}>
            <div className="item-col">
              <strong>{idx + 1}.</strong>
              <input
                type="text"
                placeholder="Item Name / SKU Id"
                value={row.itemName || ''}
                onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
              />
            </div>

            <input
              type="text"
              className="hsn-input"
              placeholder="HSN/SAC"
              value={row.hsn || ''}
              onChange={(e) => handleItemChange(idx, 'hsn', e.target.value)}
            />
            <input
              type="text"
              className="gst-input"
              placeholder="GST %"
              value={row.gst || ''}
              onChange={(e) => handleItemChange(idx, 'gst', e.target.value)}
            />
            <input
              type="text"
              className="qty-input"
              placeholder="Qty"
              value={row.qty || ''}
              onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
            />
            <input
              type="text"
              className="uom-input"
              list="uom-options"
              placeholder="UOM"
              value={row.uom || ''}
              onChange={(e) => handleItemChange(idx, 'uom', e.target.value)}
              onBlur={() => handleUomBlur(idx)}
            />
            <input
              type="text"
              className="rate-input"
              placeholder="Rate (₹)"
              value={row.rate || ''}
              onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
            />
            <input
              type="text"
              className="amount-out"
              readOnly
              placeholder="₹0.00"
              value={row.amount || '₹0.00'}
            />
            <input
              type="text"
              className="cgst-out"
              readOnly
              placeholder="₹0.00"
              value={row.cgst || '₹0.00'}
            />
            <input
              type="text"
              className="sgst-out"
              readOnly
              placeholder="₹0.00"
              value={row.sgst || '₹0.00'}
            />
            <div className="total row-total">{row.total || '₹0.00'}</div>

            <div className="item-actions">
              <span
                onClick={() => handleToggleDesc(idx)}
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <i className={`fa-solid ${row.showDesc ? 'fa-minus' : 'fa-plus'}`}></i>{' '}
                {row.showDesc ? 'Hide Description' : 'Add Description'}
              </span>
              {items.length > 1 && (
                <span
                  className="remove-row-btn"
                  onClick={() => handleRemoveLine(idx)}
                  style={{
                    color: '#e74c3c',
                    cursor: 'pointer',
                    marginLeft: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: '500',
                    lineHeight: '1'
                  }}
                  title="Remove item"
                >
                  <i className="fa-solid fa-trash" style={{ fontSize: '10px' }}></i> Remove
                </span>
              )}
            </div>

            {row.showDesc && (
              <div className="item-desc-row">
                <textarea
                  className="item-desc-textarea"
                  placeholder="Enter item description..."
                  rows="3"
                  value={row.desc || ''}
                  onChange={(e) => handleItemChange(idx, 'desc', e.target.value)}
                />
              </div>
            )}
          </div>
        ))}

        {/* Add New Line */}
        <div className="add-line" onClick={handleAddLine} style={{ cursor: 'pointer' }}>
          <i className="fa-solid fa-plus"></i> Add New Line
        </div>

        {/* UOM Autocomplete Options */}
        <datalist id="uom-options">
          <option value="Pcs" />
          <option value="Kg" />
          <option value="Gram" />
          <option value="Liter" />
          <option value="Milliliter" />
        </datalist>
      </div>

      {/* Total Summary */}
      <section className="total-summary">
        <h3 className="ts-heading">Total Summary</h3>
        <div className="ts-line">
          <span>Amount</span>
          <span id="disp-amount">₹{totalAmount.toFixed(2)}</span>
        </div>
        <div className="ts-line">
          <span>CGST</span>
          <span id="disp-cgst">₹{totalCgst.toFixed(2)}</span>
        </div>
        <div className="ts-line">
          <span>SGST</span>
          <span id="disp-sgst">₹{totalSgst.toFixed(2)}</span>
        </div>
        <hr className="ts-divider" />
        <div className="ts-grand">
          <span>Grand Total</span>
          <span id="disp-total">₹{grandTotal.toFixed(2)}</span>
        </div>
        <div className="ts-words-row">
          <span id="words-out">{wordsOut}</span>
        </div>
      </section>
    </div>
  );
}
