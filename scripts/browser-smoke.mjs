import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const baseUrl = process.env.BROWSER_BASE_URL || "http://127.0.0.1:4173";
const profile = await mkdtemp(join(tmpdir(), "free-ai-chromium-"));
const browser = spawn(process.env.CHROMIUM_BIN || "chromium", [
  "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", baseUrl,
], { stdio: "ignore" });
let socket;

try {
  const activePortFile = join(profile, "DevToolsActivePort");
  let port;
  await waitFor(async () => {
    try {
      const [value] = (await readFile(activePortFile, "utf8")).split("\n");
      port = Number(value);
      return Number.isInteger(port) && port > 0;
    } catch { return false; }
  }, "Chromium DevTools startup");

  let page;
  await waitFor(async () => {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    page = targets.find((target) => target.type === "page" && target.url.startsWith(baseUrl));
    return Boolean(page?.webSocketDebuggerUrl);
  }, "application tab startup");
  if (!page?.webSocketDebuggerUrl) throw new Error("CHROMIUM_PAGE_TARGET_MISSING");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let commandId = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "BROWSER_SCRIPT_FAILED");
    return result.result.value;
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await waitFor(async () => (await evaluate("document.readyState")) === "complete", "page load");
  await waitFor(async () => (await evaluate("Boolean(document.querySelector('#theme-toggle'))")) === true, "application controls");
  await waitFor(async () => (await evaluate("Boolean(document.querySelector('#public-site [data-public-login]'))")) === true, "public landing content");

  const identity = await evaluate("({title:document.title,lang:document.documentElement.lang,dir:document.documentElement.dir,languageControl:Boolean(document.querySelector('#language-toggle')),arabic:/[\\u0600-\\u06ff]/.test(document.body.innerText),brand:document.querySelector('.brand-name')?.innerText,applicationName:document.querySelector('meta[name=application-name]')?.content,logo:document.querySelector('.brand-symbol')?.naturalWidth})");
  if (identity.title !== identity.brand || identity.lang !== "en" || identity.dir !== "ltr" || identity.languageControl || identity.arabic || !identity.brand || identity.applicationName !== "Free AI Platform" || !identity.logo) {
    throw new Error(`PRODUCT_IDENTITY_FAILED:${JSON.stringify(identity)}`);
  }
  const guestBoundary = await evaluate("({workspaceHidden:document.querySelector('#workspace-app').classList.contains('hidden'),publicVisible:!document.querySelector('#public-site').classList.contains('hidden'),internalNavigation:document.querySelector('#workspace-app .nav')?.getClientRects().length>0,signupCopy:/create (a |your )?(workspace|account)/i.test(document.body.innerText)})");
  if (!guestBoundary.workspaceHidden || !guestBoundary.publicVisible || guestBoundary.internalNavigation || guestBoundary.signupCopy) {
    throw new Error(`GUEST_ROUTE_BOUNDARY_FAILED:${JSON.stringify(guestBoundary)}`);
  }
  await evaluate("document.querySelector('[data-public-login]').click()");
  await waitFor(async () => (await evaluate("document.querySelector('#auth-dialog').open")) === true, "sign-in dialog");
  await waitFor(async () => (await evaluate("document.querySelector('.auth-brand')?.naturalWidth || 0")) > 0, "dark sign-in brand image");
  const darkLoginBrand = await evaluate("({alt:document.querySelector('.auth-brand')?.alt,width:document.querySelector('.auth-brand')?.naturalWidth,src:document.querySelector('.auth-brand')?.getAttribute('src')})");
  if (darkLoginBrand.alt !== "Free AI Platform" || !darkLoginBrand.width || !darkLoginBrand.src.endsWith("logo-dark.svg")) throw new Error("DARK_LOGIN_BRAND_FAILED");
  await evaluate("document.querySelector('#auth-cancel').click()");
  await evaluate("document.querySelector('#theme-toggle').click()");
  const appearance = await evaluate("({theme:document.documentElement.dataset.theme,dir:document.documentElement.dir,storedTheme:localStorage.getItem('freeai-theme')})");
  if (appearance.theme !== "light" || appearance.dir !== "ltr" || appearance.storedTheme !== "light") {
    throw new Error(`PREFERENCE_PERSISTENCE_FAILED:${JSON.stringify(appearance)}`);
  }
  await evaluate("document.querySelector('[data-public-login]').click()");
  await waitFor(async () => (await evaluate("document.querySelector('#auth-dialog').open")) === true, "light-theme sign-in dialog");
  await waitFor(async () => (await evaluate("document.querySelector('.auth-brand')?.naturalWidth || 0")) > 0, "light sign-in brand image");
  const lightLoginBrand = await evaluate("({alt:document.querySelector('.auth-brand')?.alt,width:document.querySelector('.auth-brand')?.naturalWidth,src:document.querySelector('.auth-brand')?.getAttribute('src')})");
  if (lightLoginBrand.alt !== "Free AI Platform" || !lightLoginBrand.width || !lightLoginBrand.src.endsWith("logo-light.svg")) throw new Error("LIGHT_LOGIN_BRAND_FAILED");
  await evaluate("document.querySelector('#auth-cancel').click()");

  const publicPages = ["home", "about", "features", "platform", "providers", "models", "pricing", "contact", "documentation", "faq", "terms", "privacy", "login"];
  for (const width of [390, 768, 1024, 1440]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, screenWidth: width, screenHeight: 900, deviceScaleFactor: 1, mobile: width < 700 });
    await waitFor(async () => (await evaluate("window.innerWidth")) === width, `${width}px viewport`);
    const layout = await evaluate("({width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,menu:document.querySelector('.public-menu summary')?.getClientRects().length>0})");
    if (layout.width !== width || layout.scrollWidth > width || !layout.menu) throw new Error(`PUBLIC_LAYOUT_FAILED:${JSON.stringify(layout)}`);
    if (width === 390) {
      await evaluate("document.querySelector('.public-menu summary').click(); document.querySelector('.public-menu summary').focus()");
      const menu = await evaluate("({open:document.querySelector('.public-menu').open,links:document.querySelectorAll('.public-menu nav a').length})");
      if (!menu.open || menu.links < 12) throw new Error(`MOBILE_NAVIGATION_FAILED:${JSON.stringify(menu)}`);
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      const keyboardNav = await evaluate("document.activeElement?.tagName === 'A' && document.activeElement.closest('.public-menu') !== null");
      if (!keyboardNav) throw new Error("PUBLIC_MENU_KEYBOARD_NAVIGATION_FAILED");
      await evaluate("document.querySelector('.public-menu').open=false");
    }
    for (const route of publicPages) {
      await evaluate(`location.hash='#public-${route}'`);
      await waitFor(async () => (await evaluate("document.querySelector('#public-main h1')?.innerText"))?.length > 1, `${route} public page`);
      const page = await evaluate("({title:document.title,brand:document.querySelector('.brand-name')?.textContent.trim(),heading:document.querySelector('#public-main h1')?.textContent.trim(),h1Count:document.querySelectorAll('#public-main h1').length,links:[...document.querySelectorAll('#public-site a')].every(a=>(a.getAttribute('href')?.startsWith('#public-')||a.href.startsWith('mailto:')||a.target==='_blank')&&(a.textContent.trim()||a.getAttribute('aria-label'))),badLinks:[...document.querySelectorAll('#public-site a')].filter(a=>!((a.getAttribute('href')?.startsWith('#public-')||a.href.startsWith('mailto:')||a.target==='_blank')&&(a.textContent.trim()||a.getAttribute('aria-label')))).map(a=>({text:a.textContent,href:a.getAttribute('href'),target:a.target,label:a.getAttribute('aria-label')})),buttons:[...document.querySelectorAll('#public-site button')].every(b=>b.textContent.trim()||b.getAttribute('aria-label')),scrollWidth:document.documentElement.scrollWidth,width:window.innerWidth,icons:[...document.querySelectorAll('.provider-identity-mark')].every(i=>i.querySelector('svg[aria-hidden=true]'))})");
      if ((route === "home" ? page.title !== page.brand : !page.title.endsWith(` — ${page.brand}`)) || page.h1Count !== 1 || page.scrollWidth > width || !page.links || !page.buttons || !page.icons) throw new Error(`PUBLIC_PAGE_ACCEPTANCE_FAILED:${route}:${JSON.stringify(page)}`);
      if (route === "providers" && !await evaluate("document.querySelectorAll('#public-site .provider-identity-mark').length === 3")) throw new Error("PUBLIC_PROVIDER_REGISTRY_RENDER_FAILED");
      if (page.width !== width) throw new Error(`VIEWPORT_WIDTH_MISMATCH:${width}:${page.width}`);
    }
  }

  await evaluate("location.hash='#models'");
  await waitFor(async () => (await evaluate("!document.querySelector('#workspace-app').classList.contains('hidden')")) === false, "anonymous workspace denial");
  const pageLanguage = await evaluate("({lang:document.documentElement.lang,dir:document.documentElement.dir,arabic:/[\\u0600-\\u06ff]/.test(document.body.innerText),text:document.querySelector('#public-site').innerText})");
  if (pageLanguage.lang !== "en" || pageLanguage.dir !== "ltr" || pageLanguage.arabic) throw new Error("ENGLISH_ONLY_PAGE_FAILED");
  console.log("PASS browser: public page routes, English-only identity, LTR layout, anonymous workspace gate, no signup, theme persistence, provider identity fallbacks, 390/768/1024/1440px layout and navigation");
} finally {
  socket?.close();
  browser.kill("SIGTERM");
}

async function waitFor(check, label, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await check()) return; } catch { /* page may still be loading */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`BROWSER_TIMEOUT:${label}`);
}
