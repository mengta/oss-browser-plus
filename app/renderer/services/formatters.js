export function truncate(text, len) {
  const s = text === null || text === undefined ? '' : String(text);
  const n = Number(len);
  if (!Number.isFinite(n) || n < 0) {
    return s;
  }
  if (s.length < n) {
    return s;
  }
  return s.substring(0, n) + '...';
}

export function hideSecret(secret) {
  const s = secret === null || secret === undefined ? '' : String(secret);
  if (s.length < 6) {
    return '******';
  }
  return s.substring(0, 3) + '****' + s.substring(s.length - 3);
}

export const maskSecret = hideSecret;

export function formatLeftTime(ms) {
  const value = Number(ms);
  if (Number.isNaN(value)) {
    return '';
  }
  if (value <= 0) {
    return 0;
  }
  if (value < 1000) {
    return value + 'ms';
  }

  const parts = [];
  let left = value;

  const days = Math.floor(left / 86400000);
  if (days) {
    left -= days * 86400000;
    parts.push(days + 'D');
  }

  const hours = Math.floor(left / 3600000);
  if (hours) {
    left -= hours * 3600000;
    parts.push(hours + 'h');
  }

  const minutes = Math.floor(left / 60000);
  if (minutes) {
    left -= minutes * 60000;
    parts.push(minutes + 'm');
  }

  const seconds = Math.floor(left / 1000);
  if (seconds) {
    left -= seconds * 1000;
    parts.push(seconds + 's');
  }

  return parts.join(' ');
}

export const sub = truncate;
// 等价 Angular timeFormat filter：moment 'YYYY-MM-DD HH:mm:ss' 逐字符一致；
// falsy 输入返回占位 de；无效日期与 moment 行为一致（返回 'Invalid date' 字面）。
import dayjs from 'dayjs';

export function formatDateTime(d, de = '') {
  if (!d) {
    return de;
  }
  const s = new Date(d);
  if (isNaN(s.getTime())) {
    return 'Invalid date';
  }
  return dayjs(s).format('YYYY-MM-DD HH:mm:ss');
}