/**
 * Handles localStorage with user-specific namespace isolation
 */

export const getUserPrefix = () => {
  try {
    const uid = localStorage.getItem('userId');
    return uid ? `_u${uid}_` : '';
  } catch (e) {
    return '';
  }
};

export const getStorageKey = (baseKey) => `${getUserPrefix()}${baseKey}`;

export const getJSON = (key, defaultVal = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch (e) {
    console.warn(`Error reading localStorage key: ${key}`, e);
    return defaultVal;
  }
};

export const setJSON = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error(`Error saving localStorage key: ${key}`, e);
  }
};

export const removeItem = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error(`Error removing localStorage key: ${key}`, e);
  }
};
