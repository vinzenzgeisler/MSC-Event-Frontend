import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import mscLogoUrl from "../../msc-logo.png";

const BRAND_NAME = "MSC Oberlausitzer Dreiländereck";
const APP_NAME = "Event Hub";

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

function upsertHeadLink(rel: string, href: string, type?: string) {
  const selector = `link[rel="${rel}"][data-managed="msc-meta"]`;
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
  if (!existing) {
    document.head.appendChild(element);
  }
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
    if (location.pathname === "/" || location.pathname === "/anmeldung") {
      document.title = pageTitle;
    } else {
      document.title = `${pageTitle} | ${BRAND_NAME}`;
    }

    upsertHeadLink("icon", mscLogoUrl, "image/png");
    upsertHeadLink("apple-touch-icon", mscLogoUrl);
    upsertMeta("application-name", `${BRAND_NAME} ${APP_NAME}`);
  }, [location.pathname]);

  return null;
}
