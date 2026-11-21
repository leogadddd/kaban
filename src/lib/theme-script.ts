// Shared with the server layout, so this file must not be a client module.

/** Device-level preference (not synced): read by the inline script in layout.tsx before first paint. */
export const THEME_KEY = "kaban-theme";

/**
 * Runs in <head> before paint: resolves the saved preference (default: light), sets
 * <html data-theme>, keeps the browser chrome colour in step, and follows OS changes while on "system".
 */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)");function a(){var p=null;try{p=localStorage.getItem("${THEME_KEY}")}catch(e){}var t=p==="system"?(m.matches?"dark":"light"):p==="dark"?"dark":"light";d.setAttribute("data-theme",t);var c=document.getElementById("theme-color");if(!c){c=document.createElement("meta");c.name="theme-color";c.id="theme-color";document.head.appendChild(c)}c.content=t==="dark"?"#141816":"#F7FAF7"}a();m.addEventListener("change",a);window.__kabanApplyTheme=a}catch(e){}})()`;

/** App routes (not the public landing/legal pages) show the launch splash until the ledger is open. */
const SPLASH_SKIP = ["/", "/terms", "/privacy"];

/**
 * Runs in <head>: marks <html data-splash> on app routes so the server-rendered splash shows from first
 * paint (no JS, no splash). AppShell sets data-ready once it can render; a backstop clears it regardless.
 */
export const SPLASH_SCRIPT = `(function(){try{var d=document.documentElement;if(${JSON.stringify(SPLASH_SKIP)}.indexOf(location.pathname)>=0)return;d.setAttribute("data-splash","");setTimeout(function(){d.setAttribute("data-ready","")},8000)}catch(e){}})()`;

/**
 * The splash's own CSS, inlined in <head> next to its markup (layout.tsx) so the two always ship together:
 * if it lived in the app stylesheet, a stale or slow stylesheet would show the splash as a giant inline chest.
 */
export const SPLASH_CSS = `
  #splash {
    display: none;
    --splash-bg: #f7faf7;
    --splash-ink: #17241d;
  }

  :root[data-theme="dark"] #splash {
    --splash-bg: #141816;
    --splash-ink: #edf3ef;
  }

  :root[data-splash] #splash {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid !important;
    place-content: center;
    justify-items: center;
    gap: 18px;
    background: var(--color-bg, var(--splash-bg));
    transition: opacity 320ms ease, visibility 0s linear 320ms;
  }

  :root[data-splash][data-ready] #splash {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .splash-chest {
    display: block;
    width: 132px;
    height: 123px;
  }

  /* Use the device font from first paint so the app font cannot shift the title or chest. */
  .splash-name {
    margin: 0;
    font: 600 20px / 24px system-ui, sans-serif;
    letter-spacing: -0.01em;
    color: var(--color-ink, var(--splash-ink));
  }

  @media (prefers-reduced-motion: reduce) {
    :root[data-splash] #splash {
      transition: none;
    }
  }
`;
