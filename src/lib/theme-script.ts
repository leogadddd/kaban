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
export const SPLASH_CSS = "#splash { display: none; } :root[data-splash] #splash { position: fixed; inset: 0; z-index: 100; display: grid !important; place-content: center; justify-items: center; gap: 18px; background: var(--color-bg); transition: opacity 320ms ease, visibility 0s linear 320ms; } :root[data-splash][data-ready] #splash { opacity: 0; visibility: hidden; pointer-events: none; } .splash-chest { width: 132px; height: 123px; animation: splash-float 2.8s ease-in-out infinite; } .splash-chest .kc-lid { animation: splash-lid 2.8s cubic-bezier(0.45, 0, 0.55, 1) infinite; } .splash-chest .kc-eye { animation: splash-blink 2.8s ease-in-out infinite; } .splash-chest .kc-pupil { animation: splash-look 2.8s ease-in-out infinite; } .splash-chest .kc-shadow { animation: splash-shadow 2.8s ease-in-out infinite; } .splash-name { margin: 0; font-size: 1.25rem; font-weight: 600; letter-spacing: -0.01em; color: var(--color-ink); animation: splash-name 900ms 200ms var(--ease-ios, ease-out) backwards; } @keyframes splash-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } } @keyframes splash-shadow { 0%, 100% { transform: scaleX(1); opacity: 0.16; } 50% { transform: scaleX(0.9); opacity: 0.11; } } @keyframes splash-lid { 0%, 12% { transform: translateY(0); } 26%, 74% { transform: translateY(-12px) rotate(2deg); } 88%, 100% { transform: translateY(0); } } @keyframes splash-look { 0%, 34% { transform: translateX(0); } 42%, 52% { transform: translateX(1.6px); } 60%, 70% { transform: translateX(-1.6px); } 78%, 100% { transform: translateX(0); } } @keyframes splash-blink { 0%, 55%, 61%, 100% { transform: scaleY(1); } 58% { transform: scaleY(0.08); } } @keyframes splash-name { from { opacity: 0; transform: translateY(6px); } } @media (prefers-reduced-motion: reduce) { .splash-chest, .splash-chest .kc-eye, .splash-chest .kc-pupil, .splash-chest .kc-shadow, .splash-name { animation: none; } .splash-chest .kc-lid { animation: none; transform: translateY(-12px); } }";
