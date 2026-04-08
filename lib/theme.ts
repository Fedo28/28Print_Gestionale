export const DEFAULT_THEME = "light" as const;
export const THEME_ATTRIBUTE = "data-theme" as const;
export const THEME_STORAGE_KEY = "gestionale28-theme" as const;

export const THEMES = {
  light: "light",
  dark: "dark"
} as const;

export type ThemeName = (typeof THEMES)[keyof typeof THEMES];

export function sanitizeTheme(theme: string | null | undefined): ThemeName {
  return theme === THEMES.dark ? THEMES.dark : THEMES.light;
}

export function readStoredTheme(): ThemeName {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  return sanitizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function getAppliedTheme(): ThemeName {
  if (typeof document === "undefined") {
    return DEFAULT_THEME;
  }

  return sanitizeTheme(document.documentElement.getAttribute(THEME_ATTRIBUTE));
}

export function applyTheme(theme: ThemeName) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
}

export function persistTheme(theme: ThemeName) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export const themeBootstrapScript = `
  (() => {
    const themeAttribute = "${THEME_ATTRIBUTE}";
    const themeStorageKey = "${THEME_STORAGE_KEY}";
    const defaultTheme = "${DEFAULT_THEME}";

    try {
      const storedTheme = window.localStorage.getItem(themeStorageKey);
      const theme = storedTheme === "dark" ? "dark" : defaultTheme;
      document.documentElement.setAttribute(themeAttribute, theme);
    } catch {
      document.documentElement.setAttribute(themeAttribute, defaultTheme);
    }
  })();
`;
