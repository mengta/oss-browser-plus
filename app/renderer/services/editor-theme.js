// VS Code Dark 代码编辑器主题（CM6；CodeEditor / DiffEditor 共用）
import { EditorView } from '@codemirror/view';

export const vscodeEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#1e1e1e',
      color: '#cccccc',
      fontSize: '13px',
    },
    '.cm-content': { caretColor: '#aeafad' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#aeafad' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: '#264f78',
    },
    '.cm-gutters': {
      backgroundColor: '#1e1e1e',
      color: '#858585',
      border: 'none',
    },
    '.cm-activeLine': { backgroundColor: '#2a2d2e' },
    '.cm-activeLineGutter': { backgroundColor: '#2a2d2e' },
    '.cm-line': { padding: '0 4px' },
    '.cm-scroller': { fontFamily: '"Cascadia Code", Consolas, "Courier New", monospace' },
  },
  { dark: true }
);