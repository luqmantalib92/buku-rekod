/* Theme: System (follow the phone), Light or Dark. Loaded in every page's
   <head>, right after the theme-color metas, so the choice is applied before
   the body paints and there's no flash of the wrong theme.

   "system" leaves <html> without data-theme, so styles.css follows
   prefers-color-scheme; "light" / "dark" set data-theme to force one. The
   choice is per device (localStorage), like the phone setting it overrides. */

const THEME_KEY = "theme:v1";
const THEME_CHOICES = ["system", "light", "dark"];

// Browser chrome (status bar / address bar) colours, matching --surface.
const THEME_COLORS = { light: "#ffffff", dark: "#171c24" };

function getThemeChoice() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return THEME_CHOICES.includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = choice;

  // Each meta is tied to a prefers-color-scheme query; a forced theme points
  // both at its own colour so the browser chrome matches the page.
  for (const meta of document.querySelectorAll('meta[name="theme-color"][media]')) {
    const scheme = meta.media.includes("dark") ? "dark" : "light";
    meta.content = THEME_COLORS[choice === "system" ? scheme : choice];
  }
}

function setThemeChoice(choice) {
  if (!THEME_CHOICES.includes(choice)) return;
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Storage blocked: the choice still applies to this page.
  }
  applyTheme(choice);
}

applyTheme(getThemeChoice());

// Keep other open tabs in step when the choice changes in one of them.
window.addEventListener("storage", (event) => {
  if (event.key === THEME_KEY || event.key === null) applyTheme(getThemeChoice());
});
