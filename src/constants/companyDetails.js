// Fixed company billing details for all modules
export const FIXED_BILLED_BY = {
  country: 'India',
  bizName: 'K QUALITY SOFT PRIVATE LIMITED',
  gstin: '36AAMCK3562E1ZG',
  address: 'Registered office Risinia Intelli Park, Block-B, Flat: 213, Bachupally',
  city: 'Hyderabad',
  postal: '500090',
  state: 'Telangana',
  pan: 'AAMCK3562E',
  email: 'krishnasumanth@kqualitysoft.com',
  phone: '+91 73372 60099'
};

export const normalizeCompanyName = (name) => {
  if (!name) return FIXED_BILLED_BY.bizName;
  if (/^k\s*quality\s*soft\s*private\s*limited$/i.test(String(name).trim())) {
    return FIXED_BILLED_BY.bizName;
  }
  return name;
};

// Fixed company bank account details for all modules
export const FIXED_BANK_ACCOUNT = {
  country: 'India',
  bankName: 'HDFC',
  accountNumber: '99999121045999',
  confirmAccountNumber: '99999121045999',
  ifscCode: 'HDFC0008575',
  accountHolderName: 'K QUALITY SOFT PRIVATE LIMITED',
  accountType: 'Current',
  currency: 'Indian Rupee (INR, ₹)',
  ledger: '',
  swiftCode: '',
  showSwift: false,
  customFields: []
};

export const FIXED_BANK_ACCOUNTS = [FIXED_BANK_ACCOUNT];

export const normalizeBankAccounts = (accounts) => {
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return [FIXED_BANK_ACCOUNT];
  }
  return accounts.map((acc) => {
    if (
      !acc ||
      !acc.bankName ||
      acc.accountNumber === '45' ||
      acc.ifscCode === 'tioi' ||
      acc.accountHolderName === 'igyft' ||
      String(acc.bankName).trim().toLowerCase() === 'hdfc'
    ) {
      return {
        ...acc,
        country: 'India',
        bankName: 'HDFC',
        accountNumber: '99999121045999',
        confirmAccountNumber: '99999121045999',
        ifscCode: 'HDFC0008575',
        accountHolderName: 'K QUALITY SOFT PRIVATE LIMITED',
        accountType: acc?.accountType || 'Current',
        currency: acc?.currency || 'Indian Rupee (INR, ₹)',
        customFields: Array.isArray(acc?.customFields) ? acc.customFields : []
      };
    }
    return acc;
  });
};
