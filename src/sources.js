export const SOURCE_APPS = Object.freeze([
  { id: 'tide', label: 'Tide', icon: '≈', href: '../tide/' },
  { id: 'focus', label: 'Focus', icon: '◷', href: '../focus/' },
  { id: 'loom', label: 'Loom', icon: '▦', href: '../loom/' },
  { id: 'petal', label: 'Petal', icon: '⌑', href: '../petal/' },
  { id: 'folio', label: 'Folio', icon: '▤', href: '../folio/' },
  { id: 'quill', label: 'Quill', icon: '⌁', href: '../quill/' },
  { id: 'slate', label: 'Slate', icon: '◇', href: '../slate/' },
  { id: 'grove', label: 'Grove', icon: '⌘', href: '../grove/' },
  { id: 'today', label: 'Today', icon: '◉', href: '../today/' },
]);
export const SOURCE_BY_ID = new Map(SOURCE_APPS.map((source) => [source.id, source]));
export const FILE_APPS = Object.freeze(['folio', 'quill', 'slate', 'grove']);
export const APP_ORDER = new Map(SOURCE_APPS.map((source, index) => [source.id, index]));
