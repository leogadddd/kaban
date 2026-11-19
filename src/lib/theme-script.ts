// Shared with the server layout, so this file must not be a client module.

/** Device-level preference (not synced): read by the inline script in layout.tsx before first paint. */
export const THEME_KEY = "kaban-theme";

/**
 * Runs in <head> before paint: resolves the saved preference (default: follow the system), sets
 * <html data-theme>, keeps the browser chrome colour in step, and follows OS changes while on "system".
 */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)");function a(){var p=null;try{p=localStorage.getItem("${THEME_KEY}")}catch(e){}var t=p==="dark"||p==="light"?p:m.matches?"dark":"light";d.setAttribute("data-theme",t);var c=document.getElementById("theme-color");if(!c){c=document.createElement("meta");c.name="theme-color";c.id="theme-color";document.head.appendChild(c)}c.content=t==="dark"?"#141816":"#F7FAF7"}a();m.addEventListener("change",a);window.__kabanApplyTheme=a}catch(e){}})()`;
