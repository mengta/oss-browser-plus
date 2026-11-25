// 等价 Angular sizeFormat filter（app/components/filters/formater.js）：
// n==0 → 0；!n → '0'；ex=true 时分段拼接（G/M/K/B），否则单段带小数（GB/MB/KB/B）。

function pow(n) {
  return Math.pow(1024, n);
}

export function sizeFormat(n, ex) {
  if (n == 0) {
    return 0;
  }
  if (!n) {
    return '0';
  }

  const t = [];
  let left = n;
  const gb = Math.floor(n / pow(3));

  if (gb > 0) {
    if (ex) {
      t.push(gb + 'G');
      left %= pow(3);
    } else {
      return Math.round((n * 100) / pow(3)) / 100 + 'GB';
    }
  }

  const mb = Math.floor(left / pow(2));

  if (mb > 0) {
    if (ex) {
      t.push(mb + 'M');
      left %= pow(2);
    } else {
      return Math.round((100 * left) / pow(2)) / 100 + 'MB';
    }
  }

  const kb = Math.floor(left / 1024);

  if (kb > 0) {
    if (ex) {
      t.push(kb + 'K');
      left %= 1024;
    } else {
      return Math.round((100 * left) / 1024) / 100 + 'KB';
    }
  }

  if (left > 0) {
    t.push(left + 'B');
    if (!ex) {
      return left + 'B';
    }
  }

  return t.length > 0 ? t.join('') : 0;
}

export const fileSize = sizeFormat;