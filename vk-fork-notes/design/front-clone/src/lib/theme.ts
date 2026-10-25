export type Theme = "light" | "dark";

export const THEME_KEY = "vk-theme";

/** Dark unless the user explicitly picked light. */
export function resolveTheme(stored: string | null | undefined): Theme {
    return stored === "light" ? "light" : "dark";
}

export function nextTheme(current: Theme): Theme {
    return current === "dark" ? "light" : "dark";
}

/**
 * Runs in <head> before the first paint, so the page never flashes light.
 * Must stay in sync with resolveTheme.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light")document.documentElement.classList.add("dark")}catch(e){document.documentElement.classList.add("dark")}})()`;
