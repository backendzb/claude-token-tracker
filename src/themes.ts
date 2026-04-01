export interface ThemeInfo {
  id: string;
  name: string;
  group: 'dark' | 'light';
  preview: string; // bg color for preview swatch
}

export const themes: ThemeInfo[] = [
  { id: 'deep-ocean', name: '深海蓝', group: 'dark', preview: '#1a1a2e' },
  { id: 'midnight', name: '纯黑', group: 'dark', preview: '#000000' },
  { id: 'github-dark', name: 'GitHub Dark', group: 'dark', preview: '#0d1117' },
  { id: 'dracula', name: 'Dracula', group: 'dark', preview: '#282a36' },
  { id: 'nord', name: 'Nord', group: 'dark', preview: '#2e3440' },
  { id: 'monokai', name: 'Monokai', group: 'dark', preview: '#272822' },
  { id: 'light', name: '浅色', group: 'light', preview: '#f0f0f5' },
  { id: 'github-light', name: 'GitHub Light', group: 'light', preview: '#ffffff' },
];

export function applyTheme(themeId: string) {
  document.documentElement.setAttribute('data-theme', themeId);
  localStorage.setItem('theme', themeId);
}

export function getStoredTheme(): string {
  return localStorage.getItem('theme') || 'deep-ocean';
}
