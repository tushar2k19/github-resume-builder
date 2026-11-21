/**
 * GitHub Linguist colors for common languages, plus a deterministic fallback.
 * Values follow github-linguist/linguist languages.yml.
 */

export const OTHER_COLOR = '#9AA0B4';

export const LINGUIST_COLORS: Readonly<Record<string, string>> = {
  'ABAP': '#E8274B',
  'Apex': '#1797c0',
  'Assembly': '#6E4C13',
  'Astro': '#ff5a03',
  'AutoHotkey': '#6594b9',
  'Batchfile': '#C1F12E',
  'Blade': '#f7523f',
  'C': '#555555',
  'C#': '#178600',
  'C++': '#f34b7d',
  'CMake': '#DA3434',
  'CSS': '#663399',
  'Clojure': '#db5855',
  'CoffeeScript': '#244776',
  'Common Lisp': '#3fb68b',
  'Crystal': '#000100',
  'Cuda': '#3A4E3A',
  'D': '#ba595e',
  'Dart': '#00B4AB',
  'Dockerfile': '#384d54',
  'EJS': '#a91e50',
  'Elixir': '#6e4a7e',
  'Elm': '#60B5CC',
  'Emacs Lisp': '#c065db',
  'Erlang': '#B83998',
  'F#': '#b845fc',
  'Fortran': '#4d41b1',
  'GLSL': '#5686a5',
  'Gherkin': '#5B2063',
  'Go': '#00ADD8',
  'Groovy': '#4298b8',
  'HCL': '#844FBA',
  'HTML': '#e34c26',
  'Handlebars': '#f7931e',
  'Haskell': '#5e5086',
  'Java': '#b07219',
  'JavaScript': '#f1e05a',
  'Jinja': '#a52a22',
  'Jupyter Notebook': '#DA5B0B',
  'Julia': '#a270ba',
  'Kotlin': '#A97BFF',
  'Less': '#1d365d',
  'Lua': '#000080',
  'MATLAB': '#e16737',
  'MDX': '#fcb32c',
  'Makefile': '#427819',
  'Mojo': '#ff4c1f',
  'Nim': '#ffc200',
  'Nix': '#7e7eff',
  'OCaml': '#ef7a08',
  'Objective-C': '#438eff',
  'Objective-C++': '#6866fb',
  'PHP': '#4F5D95',
  'PLpgSQL': '#336790',
  'Pascal': '#E3F171',
  'Perl': '#0298c3',
  'PowerShell': '#012456',
  'Prolog': '#74283c',
  'Pug': '#a86454',
  'PureScript': '#1D222D',
  'Python': '#3572A5',
  'R': '#198CE7',
  'Racket': '#3c5caa',
  'Raku': '#0000fb',
  'Reason': '#ff5847',
  'Ruby': '#701516',
  'Rust': '#dea584',
  'SCSS': '#c6538c',
  'SQL': '#e38c00',
  'Sass': '#a53b70',
  'Scala': '#c22d40',
  'Scheme': '#1e4aec',
  'Shell': '#89e051',
  'Smarty': '#f0c040',
  'Solidity': '#AA6746',
  'Stylus': '#ff6347',
  'Svelte': '#ff3e00',
  'Swift': '#F05138',
  'TSQL': '#e38c00',
  'Tcl': '#e4cc98',
  'TeX': '#3D6117',
  'TypeScript': '#3178c6',
  'V': '#4f87c4',
  'Vala': '#a56de2',
  'Verilog': '#b2b7f8',
  'VHDL': '#adb2cb',
  'Vim Script': '#199f4b',
  'Visual Basic .NET': '#945db7',
  'Vue': '#41b883',
  'WebAssembly': '#04133b',
  'Zig': '#ec915c',
};

/** Case-insensitive lookup table built once. */
const LOWER_LOOKUP: Readonly<Record<string, string>> = Object.keys(LINGUIST_COLORS).reduce<
  Record<string, string>
>((acc, key) => {
  const value = LINGUIST_COLORS[key];
  if (value) acc[key.toLowerCase()] = value;
  return acc;
}, {});

/** FNV-1a 32-bit hash. Deterministic across sessions and platforms. */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic hue (0..359) for languages Linguist does not list here. */
export function languageHue(name: string): number {
  return hash32(name.toLowerCase()) % 360;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number): string => {
    const k = (n + h / 30) % 12;
    const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * value)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
}

/** Linguist color when known, else a stable saturated hue derived from the name. */
export function languageColor(name: string | null | undefined): string {
  if (!name) return OTHER_COLOR;
  const known = LINGUIST_COLORS[name] ?? LOWER_LOOKUP[name.toLowerCase()];
  if (known) return known;
  return hslToHex(languageHue(name), 62, 52);
}

export function isKnownLanguage(name: string): boolean {
  return LINGUIST_COLORS[name] !== undefined || LOWER_LOOKUP[name.toLowerCase()] !== undefined;
}
