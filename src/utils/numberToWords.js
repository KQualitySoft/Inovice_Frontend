/**
 * Converts a number to words according to the Indian Numbering System
 * (Crore, Lakh, Thousand, Hundred)
 */
export function numberToWords(n) {
  if (n === null || n === undefined || isNaN(n)) return 'Zero Rupees Only';
  const roundNum = Math.round(Number(n));
  if (roundNum === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const chunk = (num) => {
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 ? ' ' + a[num % 10] : '');
    return a[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + chunk(num % 100) : '');
  };

  let num = Math.abs(roundNum);
  let str = '';

  if (num >= 10000000) {
    str += chunk(Math.floor(num / 10000000)) + ' Crore ';
    num %= 10000000;
  }
  if (num >= 100000) {
    str += chunk(Math.floor(num / 100000)) + ' Lakh ';
    num %= 100000;
  }
  if (num >= 1000) {
    str += chunk(Math.floor(num / 1000)) + ' Thousand ';
    num %= 1000;
  }
  if (num > 0) {
    str += chunk(num) + ' ';
  }

  return (str.trim() + ' Rupees Only');
}

export default numberToWords;
