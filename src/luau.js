export const LUAU_KEYWORDS = [
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function",
  "if", "in", "local", "nil", "not", "or", "repeat", "return", "then", "true",
  "until", "while", "continue",
];

export const ROBLOX_GLOBALS = [
  { label: "game", detail: "DataModel" },
  { label: "workspace", detail: "Workspace" },
  { label: "script", detail: "Script" },
  { label: "print", detail: "function(...: any)" },
  { label: "warn", detail: "function(...: any)" },
  { label: "error", detail: "function(msg: string)" },
  { label: "tostring", detail: "function(v: any): string" },
  { label: "tonumber", detail: "function(v: any): number?" },
  { label: "type", detail: "function(v: any): string" },
  { label: "typeof", detail: "function(v: any): string" },
  { label: "pairs", detail: "function(t: table): iterator" },
  { label: "ipairs", detail: "function(t: table): iterator" },
  { label: "next", detail: "function(t: table, key?: any)" },
  { label: "select", detail: "function(index: number|string, ...)" },
  { label: "unpack", detail: "function(t: table)" },
  { label: "pcall", detail: "function(f: function, ...): (boolean, any)" },
  { label: "xpcall", detail: "function(f: function, handler: function)" },
  { label: "rawget", detail: "function(t: table, k: any): any" },
  { label: "rawset", detail: "function(t: table, k: any, v: any)" },
  { label: "setmetatable", detail: "function(t: table, mt: table?): table" },
  { label: "getmetatable", detail: "function(t: table): table?" },
  { label: "Instance", detail: "class" },
  { label: "Vector3", detail: "class" },
  { label: "Vector2", detail: "class" },
  { label: "CFrame", detail: "class" },
  { label: "Color3", detail: "class" },
  { label: "BrickColor", detail: "class" },
  { label: "UDim2", detail: "class" },
  { label: "UDim", detail: "class" },
  { label: "TweenInfo", detail: "class" },
  { label: "Enum", detail: "class" },
  { label: "Ray", detail: "class" },
  { label: "NumberSequence", detail: "class" },
  { label: "ColorSequence", detail: "class" },
  { label: "task", detail: "library" },
  { label: "math", detail: "library" },
  { label: "string", detail: "library" },
  { label: "table", detail: "library" },
  { label: "coroutine", detail: "library" },
  { label: "os", detail: "library" },
  { label: "RunService", detail: "Service" },
  { label: "Players", detail: "Service" },
  { label: "ReplicatedStorage", detail: "Service" },
  { label: "ServerStorage", detail: "Service" },
  { label: "ServerScriptService", detail: "Service" },
  { label: "StarterGui", detail: "Service" },
  { label: "Lighting", detail: "Service" },
  { label: "UserInputService", detail: "Service" },
  { label: "TweenService", detail: "Service" },
  { label: "HttpService", detail: "Service" },
  { label: "CollectionService", detail: "Service" },
  { label: "DataStoreService", detail: "Service" },
  { label: "MarketplaceService", detail: "Service" },
];

export const LUAU_SNIPPETS = [
  { label: "local", insert: "local ${1:name} = ${2:value}" },
  { label: "function", insert: "function ${1:name}(${2:args})\n\t${3}\nend" },
  { label: "lfunction", insert: "local function ${1:name}(${2:args})\n\t${3}\nend" },
  { label: "if", insert: "if ${1:cond} then\n\t${2}\nend" },
  { label: "ife", insert: "if ${1:cond} then\n\t${2}\nelse\n\t${3}\nend" },
  { label: "fori", insert: "for ${1:i} = ${2:1}, ${3:10} do\n\t${4}\nend" },
  { label: "forp", insert: "for ${1:k}, ${2:v} in pairs(${3:t}) do\n\t${4}\nend" },
  { label: "forip", insert: "for ${1:i}, ${2:v} in ipairs(${3:t}) do\n\t${4}\nend" },
  { label: "while", insert: "while ${1:cond} do\n\t${2}\nend" },
  { label: "repeat", insert: "repeat\n\t${1}\nuntil ${2:cond}" },
  { label: "pcall", insert: "local ${1:ok}, ${2:err} = pcall(function()\n\t${3}\nend)" },
  { label: "Instance.new", insert: 'Instance.new("${1:Class}", ${2:parent})' },
  { label: "task.wait", insert: "task.wait(${1:0})" },
  { label: "task.spawn", insert: "task.spawn(function()\n\t${1}\nend)" },
  { label: "task.delay", insert: "task.delay(${1:1}, function()\n\t${2}\nend)" },
  { label: "GetService", insert: 'game:GetService("${1:ServiceName}")' },
  { label: "Connect", insert: "${1:event}:Connect(function(${2})\n\t${3}\nend)" },
];

export function setupLuau(monaco) {
  if (monaco._luauSetup) return;
  monaco._luauSetup = true;
  window.__monaco = monaco;

  monaco.languages.register({ id: "luau" });

  monaco.languages.setLanguageConfiguration("luau", {
    comments: { lineComment: "--", blockComment: ["--[[", "]]"] },
    brackets: [["(", ")"], ["{", "}"], ["[", "]"]],
    autoClosingPairs: [
      { open: "(", close: ")" },
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });

  monaco.languages.setMonarchTokensProvider("luau", {
    keywords: LUAU_KEYWORDS,
    builtins: ROBLOX_GLOBALS.map((g) => g.label),
    symbols: /[=><!~?:&|+\-*\/\^%#\.]+/,
    tokenizer: {
      root: [
        [/--\[\[/, "comment", "@blockComment"],
        [/--.*/, "comment"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/'([^'\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@strD"],
        [/'/, "string", "@strS"],
        [/\[\[/, "string", "@strML"],
        [/0x[0-9a-fA-F_]+/, "number"],
        [/\d+\.?\d*([eE][\-+]?\d+)?/, "number"],
        [/[a-zA-Z_]\w*/, { cases: { "@keywords": "keyword", "@builtins": "type", "@default": "identifier" } }],
        [/[{}()\[\]]/, "delimiter"],
        [/@symbols/, "operator"],
        [/[,;]/, "delimiter"],
      ],
      blockComment: [[/\]\]/, "comment", "@pop"], [/./, "comment"]],
      strD: [[/[^\\"]+/, "string"], [/\\./, "string.escape"], [/"/, "string", "@pop"]],
      strS: [[/[^\\']+/, "string"], [/\\./, "string.escape"], [/'/, "string", "@pop"]],
      strML: [[/\]\]/, "string", "@pop"], [/./, "string"]],
    },
  });

  monaco.languages.registerCompletionItemProvider("luau", {
    triggerCharacters: [".", ":", " "],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const line = model.getLineContent(position.lineNumber);
      const before = line.substring(0, position.column - 1).trimStart();
      if (before.startsWith("--")) return { suggestions: [] };

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      return {
        suggestions: [
          ...ROBLOX_GLOBALS.map((g) => ({
            label: g.label,
            kind: g.detail === "Service" || g.detail === "library"
              ? monaco.languages.CompletionItemKind.Module
              : g.detail === "class"
                ? monaco.languages.CompletionItemKind.Class
                : monaco.languages.CompletionItemKind.Function,
            insertText: g.label,
            detail: g.detail,
            range,
          })),
          ...LUAU_KEYWORDS.map((k) => ({
            label: k,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: k,
            range,
          })),
          ...LUAU_SNIPPETS.map((s) => ({
            label: s.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: s.insert,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: "snippet",
            sortText: "z" + s.label,
            range,
          })),
        ],
      };
    },
  });

  monaco.editor.defineTheme("sirhurt", {
    base: "vs-dark",
    inherit: false,
    rules: [
      { token: "", foreground: "c9d1d9", background: "181818" },
      { token: "comment", foreground: "3d5166", fontStyle: "italic" },
      { token: "keyword", foreground: "e05a47", fontStyle: "bold" },
      { token: "type", foreground: "4ec9b0" },
      { token: "string", foreground: "ce9178" },
      { token: "string.escape", foreground: "d7ba7d" },
      { token: "string.invalid", foreground: "f44747" },
      { token: "number", foreground: "b5cea8" },
      { token: "identifier", foreground: "c9d1d9" },
      { token: "operator", foreground: "c9d1d9" },
      { token: "delimiter", foreground: "ffd700" },
    ],
    colors: {
      "editor.background": "#181818",
      "editor.foreground": "#c9d1d9",
      "editor.lineHighlightBackground": "#00000000",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#4a90d960",
      "editor.inactiveSelectionBackground": "#4a90d930",
      "editorLineNumber.foreground": "#aaaaaa",
      "editorLineNumber.activeForeground": "#ffffff",
      "editorCursor.foreground": "#e74c3c",
      "editorIndentGuide.background1": "#5a1a1a18",
      "editorIndentGuide.activeBackground1": "#c0392b28",
      "editorSuggestWidget.background": "#0f1318",
      "editorSuggestWidget.border": "#8a1a1a55",
      "editorSuggestWidget.foreground": "#c9d1d9",
      "editorSuggestWidget.selectedBackground": "#c0392b38",
      "editorSuggestWidget.selectedForeground": "#ffffff",
      "editorSuggestWidget.highlightForeground": "#e74c3c",
      "editorHoverWidget.background": "#0f1318",
      "editorHoverWidget.border": "#8a1a1a55",
      "editorBracketMatch.background": "#c0392b30",
      "editorBracketMatch.border": "#c0392b55",
      "editor.wordHighlightBackground": "#4a90d930",
      "editor.wordHighlightBorder": "#4a90d960",
      "editor.wordHighlightStrongBackground": "#4a90d945",
      "editor.wordHighlightStrongBorder": "#4a90d975",
      "editorOverviewRuler.border": "#00000000",
      "minimap.background": "#181818",
      "minimapSlider.background": "#c0392b38",
      "minimapSlider.hoverBackground": "#c0392b60",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#9a2a2a30",
      "scrollbarSlider.hoverBackground": "#cc3a3a45",
      "scrollbarSlider.activeBackground": "#dd4a4a58",
    },
  });
}

export const MONACO_OPTIONS = (settings) => ({
  fontSize: settings.fontSize || 12,
  fontFamily: settings.fontFamily ? `"${settings.fontFamily}", JetBrains Mono, Fira Code, Consolas, monospace` : "JetBrains Mono, Fira Code, Consolas, monospace",
  lineNumbers: settings.lineNumbers ? "on" : "off",
  lineNumbersMinChars: settings.lineNumbers ? 2 : 0,
  lineDecorationsWidth: settings.lineNumbers ? 4 : 0,
  glyphMargin: false,
  folding: !!settings.folding,
  foldingStrategy: "indentation",
  showFoldingControls: settings.folding ? "always" : "never",
  stickyScroll: { enabled: !!settings.folding },
  minimap: {
    enabled: false,
    scale: 1,
    showSlider: "mouseover",
    renderCharacters: false,
    side: "right",
    size: "fixed",
    maxColumn: 75,
  },
  renderLineHighlight: "none",
  scrollBeyondLastLine: false,
  padding: { top: 8, bottom: 0, left: 8 },
  overviewRulerLanes: settings.minimap ? 3 : 0,
  hideCursorInOverviewRuler: true,
  scrollbar: {
    vertical: settings.minimap ? "visible" : "hidden",
    horizontal: "hidden",
    handleMouseWheel: true,
    alwaysConsumeMouseWheel: false,
    verticalScrollbarSize: settings.minimap ? 8 : 0,
    useShadows: false,
  },
  wordWrap: settings.wordWrap ? "on" : "off",
  renderWhitespace: "none",
  cursorBlinking: "smooth",
  cursorSmoothCaretAnimation: "on",
  smoothScrolling: true,
  contextmenu: true,
  roundedSelection: true,
  automaticLayout: false,
  renderValidationDecorations: "off",
  renderLineHighlightOnlyWhenFocus: false,
  accessibilitySupport: "off",
  suggestOnTriggerCharacters: true,
  quickSuggestions: { other: true, comments: false, strings: false },
  acceptSuggestionOnEnter: "on",
  tabCompletion: "on",
  snippetSuggestions: "top",
  bracketPairColorization: { enabled: false },
  suggest: { showWords: false, showFiles: false },
  mouseWheelZoom: false,
  guides: { indentation: true, highlightActiveIndentation: true },
});