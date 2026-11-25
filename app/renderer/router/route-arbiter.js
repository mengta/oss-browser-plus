const VUE_PREFIX = '/vue';
const STYLE_ID = 'vue-arbiter-style';

export function arbiterDecision(hash) {
  const normalized = String(hash || '').replace(/^#/, '') || '/';
  if (normalized === VUE_PREFIX) {
    return { vue: true, path: '/' };
  }
  if (normalized.indexOf(VUE_PREFIX + '/') === 0) {
    return { vue: true, path: normalized.slice(VUE_PREFIX.length) || '/' };
  }
  return { vue: false, path: null };
}

function ensureStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
    return;
  }
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent =
    '#vue-app{display:none}body.vue-mode #vue-app{display:block}body.vue-mode [ui-view]{display:none}';
  document.head.appendChild(el);
}

function enterVue(router, path) {
  ensureStyle();
  document.body.classList.add('vue-mode');
  const vueApp = document.getElementById('vue-app');
  if (vueApp) {
    vueApp.style.display = 'block';
  }
  const uiView = document.querySelector('[ui-view]');
  if (uiView) {
    uiView.style.display = 'none';
  }
  document.documentElement.removeAttribute('ng-app');
  if (router && path) {
    router.replace(path).catch(() => {});
  }
}

export function earlyArbiter() {
  if (typeof document === 'undefined') {
    return arbiterDecision('');
  }
  const decision = arbiterDecision(window.location.hash);

  if (decision.vue) {
    enterVue(null, null);
  }
  return decision;
}

export function installArbiter(router) {
  if (typeof document === 'undefined') {
    return;
  }
  ensureStyle();
  const run = () => {
    const decision = arbiterDecision(window.location.hash);
    if (decision.vue) {
      enterVue(router, decision.path);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  window.addEventListener('hashchange', run);
}