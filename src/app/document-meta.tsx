import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import mscLogoUrl from "../../msc-logo.png";

const BRAND_NAME = "MSC Oberlausitzer Dreiländereck";
const APP_NAME = "Event Hub";
const ADMIN_PWA_MANIFEST_URL = "/manifest.webmanifest";

function resolvePageTitle(pathname: string) {
  if (pathname === "/" || pathname === "/anmeldung") {
    return "Anmeldung OLD";
  }
  if (pathname.startsWith("/anmeldung/verify")) {
    return "E-Mail-Verifizierung";
  }
  if (pathname.startsWith("/anmeldung/rechtliches")) {
    return "Rechtliches";
  }
  if (pathname === "/admin/login") {
    return "Admin-Login";
  }
  if (pathname === "/admin/dashboard") {
    return "Dashboard";
  }
  if (pathname === "/admin/entries") {
    return "Nennungen";
  }
  if (pathname.startsWith("/admin/entries/")) {
    return "Nennungsdetails";
  }
  if (pathname === "/admin/communication") {
    return "Kommunikation";
  }
  if (pathname === "/admin/exports") {
    return "Exporte";
  }
  if (pathname === "/admin/settings") {
    return "Einstellungen";
  }
  if (pathname === "/admin/forbidden") {
    return "Kein Zugriff";
  }
  if (pathname.startsWith("/admin")) {
    return "Admin";
  }
  return "Eventportal";
}

function upsertHeadLink(rel: string, href: string, type?: string, extraAttributes?: Record<string, string>) {
  const selector = `link[rel="${rel}"][href="${href}"][data-managed="msc-meta"]`;
  const existing = document.head.querySelector(selector);
  const element = existing instanceof HTMLLinkElement ? existing : document.createElement("link");
  element.setAttribute("rel", rel);
  element.setAttribute("href", href);
  element.setAttribute("data-managed", "msc-meta");
  if (type) {
    element.setAttribute("type", type);
  } else {
    element.removeAttribute("type");
  }
  Object.entries(extraAttributes ?? {}).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  if (!existing) {
    document.head.appendChild(element);
  }
}

function removeManagedHeadElements(selector: string) {
  document.head.querySelectorAll(selector).forEach((element) => {
    element.parentElement?.removeChild(element);
  });
}

function upsertMeta(name: string, content: string) {
  const selector = `meta[name="${name}"][data-managed="msc-meta"]`;
  const existing = document.head.querySelector(selector);
  const element = existing instanceof HTMLMetaElement ? existing : document.createElement("meta");
  element.setAttribute("name", name);
  element.setAttribute("content", content);
  element.setAttribute("data-managed", "msc-meta");
  if (!existing) {
    document.head.appendChild(element);
  }
}

export function DocumentMeta() {
  const location = useLocation();

  useEffect(() => {
    const pageTitle = resolvePageTitle(location.pathname);
    const isAdminRoute = location.pathname.startsWith("/admin");
    if (location.pathname === "/" || location.pathname === "/anmeldung") {
      document.title = pageTitle;
    } else {
      document.title = `${pageTitle} | ${BRAND_NAME}`;
    }

    upsertHeadLink("icon", mscLogoUrl, "image/png");
    if (isAdminRoute) {
      upsertHeadLink("apple-touch-icon", "/apple-touch-icon.png");
      upsertHeadLink("manifest", ADMIN_PWA_MANIFEST_URL);
      upsertMeta("application-name", `${BRAND_NAME} ${APP_NAME}`);
      upsertMeta("apple-mobile-web-app-capable", "yes");
      upsertMeta("apple-mobile-web-app-status-bar-style", "default");
      upsertMeta("apple-mobile-web-app-title", "MSC Admin");
    } else {
      removeManagedHeadElements('link[rel="apple-touch-icon"][data-managed="msc-meta"]');
      removeManagedHeadElements('link[rel="manifest"][data-managed="msc-meta"]');
      removeManagedHeadElements('meta[name="application-name"][data-managed="msc-meta"]');
      removeManagedHeadElements('meta[name="apple-mobile-web-app-capable"][data-managed="msc-meta"]');
      removeManagedHeadElements('meta[name="apple-mobile-web-app-status-bar-style"][data-managed="msc-meta"]');
      removeManagedHeadElements('meta[name="apple-mobile-web-app-title"][data-managed="msc-meta"]');
    }
  }, [location.pathname]);

  return null;
}
