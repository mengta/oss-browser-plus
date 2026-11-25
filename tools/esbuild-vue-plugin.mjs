import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parse, compileScript, compileTemplate, compileStyle } from '@vue/compiler-sfc';

const UNSUPPORTED_LANG_MESSAGE =
  'esbuild-vue-plugin: only plain JS <script>/<script setup> and plain CSS <style> are supported';

function scopeIdOf(file) {
  return 'data-v-' + crypto.createHash('sha256').update(file).digest('hex').slice(0, 8);
}

function toError(text) {
  return { text };
}

export default function vuePlugin() {
  return {
    name: 'esbuild-vue-plugin',
    setup(build) {
      build.onLoad({ filter: /\.vue$/ }, async (args) => {
        const source = fs.readFileSync(args.path, 'utf8');
        const parsed = parse(source, { filename: args.path });
        if (parsed.errors.length) {
          return { errors: parsed.errors.map((e) => toError(String(e.message || e))) };
        }

        const { descriptor } = parsed;

        if (descriptor.template && descriptor.template.lang && descriptor.template.lang !== 'html') {
          return { errors: [toError(UNSUPPORTED_LANG_MESSAGE + ' (template lang=' + descriptor.template.lang + ')')] };
        }
        const scriptLang = (descriptor.script && descriptor.script.lang) || (descriptor.scriptSetup && descriptor.scriptSetup.lang);
        if (scriptLang && scriptLang !== 'js') {
          return { errors: [toError(UNSUPPORTED_LANG_MESSAGE + ' (script lang=' + scriptLang + ')')] };
        }
        for (const style of descriptor.styles) {
          if (style.lang && style.lang !== 'css') {
            return { errors: [toError(UNSUPPORTED_LANG_MESSAGE + ' (style lang=' + style.lang + ')')] };
          }
        }

        const scopeId = scopeIdOf(args.path);
        const hasScoped = descriptor.styles.some((s) => s.scoped);
        let code = '';
        let bindings = null;

        if (descriptor.script || descriptor.scriptSetup) {
          const compiled = compileScript(descriptor, { id: scopeId });
          bindings = compiled.bindings || null;
          const body = compiled.content.replace('export default', 'const __sfc_main__ =');
          code += body.indexOf('const __sfc_main__') >= 0 ? body : body + '\nconst __sfc_main__ = {};\n';
        } else {
          code += 'const __sfc_main__ = {};\n';
        }

        if (descriptor.template) {
          const tpl = compileTemplate({
            source: descriptor.template.content,
            filename: args.path,
            id: scopeId,
            scoped: hasScoped,
            compilerOptions: {
              scopeId: hasScoped ? scopeId : undefined,
              bindingMetadata: bindings || undefined,
            },
          });
          if (tpl.errors.length) {
            return { errors: tpl.errors.map((e) => toError(String(e.message || e))) };
          }
          const renderCode = tpl.code.replace('export function render', 'function render');
          code += '\n' + renderCode + '\n__sfc_main__.render = render;\n';
        }

        const cssParts = [];
        for (const style of descriptor.styles) {
          const st = compileStyle({
            source: style.content,
            filename: args.path,
            id: scopeId,
            scoped: !!style.scoped,
          });
          if (st.errors.length) {
            return { errors: st.errors.map((e) => toError(String(e.message || e))) };
          }
          cssParts.push(st.code);
        }

        if (cssParts.length > 0) {
          code += '\nconst __css__ = ' + JSON.stringify(cssParts.join('\n')) + ';\n';
          code +=
            'if (typeof document !== "undefined") {\n' +
            '  var __el = document.createElement("style");\n' +
            '  __el.setAttribute("data-vue-sfc", "");\n' +
            '  __el.textContent = __css__;\n' +
            '  document.head.appendChild(__el);\n' +
            '}\n';
        }

        if (hasScoped) {
          code += '\n__sfc_main__.__scopeId = ' + JSON.stringify(scopeId) + ';\n';
        }

        code += '\nexport default __sfc_main__;\n';

        return { contents: code, loader: 'js', resolveDir: path.dirname(args.path) };
      });
    },
  };
}

export { UNSUPPORTED_LANG_MESSAGE, scopeIdOf };