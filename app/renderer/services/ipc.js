export const DEFAULT_TIMEOUT = 8000;
export const DIALOG_TIMEOUT = 60000;
export const MAIL_TIMEOUT = 20000;

export function resolveTimeout(domain, method) {
  if (domain === 'transfer') {
    return 0;
  }
  if (domain === 'system' && method === 'showOpenDialog') {
    return DIALOG_TIMEOUT;
  }
  if (domain === 'mail' && (method === 'sendTest' || method === 'send')) {
    return MAIL_TIMEOUT;
  }
  return DEFAULT_TIMEOUT;
}

export function normalizeError(err) {
  const code = (err && err.code) || 'INTERNAL';
  const message = (err && err.message) || String(err || code);
  const out = { ok: false, code, message };
  if (err && err.requestId) {
    out.requestId = err.requestId;
  }
  if (err && err.ecCode) {
    out.ecCode = err.ecCode;
  }
  return out;
}

export function normalizeResult(res) {
  if (res && typeof res === 'object' && res.ok === false) {
    const out = { ok: false, code: res.code || 'INTERNAL', message: res.message || res.code || 'failed' };
    if (res.requestId) {
      out.requestId = res.requestId;
    }
    if (res.ecCode) {
      out.ecCode = res.ecCode;
    }
    return out;
  }
  if (res && typeof res === 'object' && res.ok === true) {
    return res;
  }
  return { ok: true, data: res };
}

function timeoutPromise(ms, label) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ ok: false, code: 'TIMEOUT', message: label + ' timed out' });
    }, ms);
  });
}

export async function invoke(fn, label, timeoutMs) {
  let pending;
  try {
    pending = Promise.resolve().then(fn);
  } catch (err) {
    return normalizeError(err);
  }

  if (!timeoutMs || timeoutMs <= 0) {
    try {
      return normalizeResult(await pending);
    } catch (err) {
      return normalizeError(err);
    }
  }

  const timed = timeoutPromise(timeoutMs, label);
  const winner = await Promise.race([pending.then((res) => normalizeResult(res)).catch(normalizeError), timed]);
  return winner;
}