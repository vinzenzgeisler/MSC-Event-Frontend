import { useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { Loader2, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { acceptanceStatusLabel } from "@/lib/admin-status";
import type { AcceptanceStatus, RegistrationStatus } from "@/types/common";

export type DashboardDriverLocationDriver = {
  entryId: string;
  driverName: string;
  className: string;
  startNumber: string;
  vehicleLabel: string;
  acceptanceStatus: AcceptanceStatus;
  registrationStatus: RegistrationStatus;
};

export type DashboardDriverLocationItem = {
  locationKey: string;
  country: string;
  zip: string;
  city: string;
  lat: number;
  lng: number;
  driverCount: number;
  entryCount: number;
  drivers: DashboardDriverLocationDriver[];
};

export type DashboardDriverLocationsMeta = {
  totalLocations: number;
  totalDrivers: number;
  missingLocationsTotal: number;
  missingEntriesTotal: number;
  pendingGeocodeTotal?: number;
  geocodeAttemptedTotal?: number;
  geocodeResolvedTotal?: number;
  autoRefreshTriggered?: boolean;
  hasPendingGeocoding?: boolean;
  maxPoints: number;
};

type DriverOriginMapProps = {
  locations: DashboardDriverLocationItem[];
  meta: DashboardDriverLocationsMeta;
  loading: boolean;
  refreshingCoordinates: boolean;
  error: string;
};

type DriverMarker = DashboardDriverLocationDriver & {
  locationKey: string;
  country: string;
  zip: string;
  city: string;
  lat: number;
  lng: number;
};

const DEFAULT_CENTER: L.LatLngExpression = [51.1, 10.4];
const DEFAULT_ZOOM = 5;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatLocationLabel(location: Pick<DashboardDriverLocationItem, "city" | "zip" | "country">) {
  const cityLine = [location.zip, location.city].filter(Boolean).join(" ");
  return [cityLine, location.country].filter(Boolean).join(", ") || "Unbekannter Ort";
}

function formatCountryLabel(value: string) {
  const normalized = value.trim().toUpperCase();
  const labels: Record<string, string> = {
    DE: "Deutschland",
    D: "Deutschland",
    GER: "Deutschland",
    CZ: "Tschechien",
    CZE: "Tschechien",
    PL: "Polen",
    POL: "Polen",
    AT: "Österreich",
    AUT: "Österreich"
  };
  return (labels[normalized] ?? value.trim()) || "Unbekannt";
}

function createDriverIcon() {
  return L.divIcon({
    className: "driver-origin-marker",
    html: '<span class="driver-origin-marker__dot"></span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12]
  });
}

function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const sizeClass = count >= 50 ? "driver-origin-cluster--large" : count >= 10 ? "driver-origin-cluster--medium" : "driver-origin-cluster--small";
  return L.divIcon({
    className: `driver-origin-cluster ${sizeClass}`,
    html: `<span>${count}</span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });
}

function popupHtml(marker: DriverMarker) {
  const location = formatLocationLabel(marker);
  const status = acceptanceStatusLabel(marker.acceptanceStatus) || "Offen";
  const startNumber = marker.startNumber && marker.startNumber !== "-" ? `#${escapeHtml(marker.startNumber)} · ` : "";
  return `
    <div class="driver-origin-popup">
      <div class="driver-origin-popup__title">${escapeHtml(marker.driverName)}</div>
      <div class="driver-origin-popup__meta">${escapeHtml(location)}</div>
      <div class="driver-origin-popup__row">${startNumber}${escapeHtml(marker.className || "-")}</div>
      <div class="driver-origin-popup__row">${escapeHtml(marker.vehicleLabel || "Fahrzeug")}</div>
      <div class="driver-origin-popup__status">${escapeHtml(status)}</div>
      <a class="driver-origin-popup__link" href="/admin/entries/${encodeURIComponent(marker.entryId)}">Nennung öffnen</a>
    </div>
  `;
}

function DriverMarkerClusterLayer({ markers }: { markers: DriverMarker[] }) {
  const map = useMap();

  useEffect(() => {
    const clusterLayer = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      removeOutsideVisibleBounds: true,
      maxClusterRadius: 46,
      iconCreateFunction: createClusterIcon
    });

    markers.forEach((driver) => {
      const marker = L.marker([driver.lat, driver.lng], { icon: createDriverIcon(), title: driver.driverName || "Fahrer" });
      marker.bindPopup(popupHtml(driver), {
        className: "driver-origin-popup-shell",
        maxWidth: 260,
        minWidth: 220
      });
      clusterLayer.addLayer(marker);
    });

    map.addLayer(clusterLayer);
    return () => {
      map.removeLayer(clusterLayer);
    };
  }, [map, markers]);

  useEffect(() => {
    if (!markers.length) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(markers.map((marker) => [marker.lat, marker.lng] as L.LatLngTuple));
    map.fitBounds(bounds.pad(0.18), { maxZoom: 8, animate: false });
  }, [map, markers]);

  return null;
}

export function DriverOriginMap({ locations, meta, loading, refreshingCoordinates, error }: DriverOriginMapProps) {
  const markers = useMemo<DriverMarker[]>(() => {
    return locations.flatMap((location) =>
      location.drivers.map((driver) => ({
        ...driver,
        locationKey: location.locationKey,
        country: location.country,
        zip: location.zip,
        city: location.city,
        lat: location.lat,
        lng: location.lng
      }))
    );
  }, [locations]);

  const countryCount = useMemo(() => {
    const countries = new Set<string>();
    locations.forEach((location) => {
      const country = location.country.trim().toUpperCase();
      if (country) {
        countries.add(country);
      }
    });
    return countries.size;
  }, [locations]);

  const driversOnMap = markers.length;
  const totalDrivers = Math.max(meta.totalDrivers, driversOnMap + meta.missingEntriesTotal);
  const coveragePercent = totalDrivers > 0 ? Math.round((driversOnMap / totalDrivers) * 100) : 0;
  const pendingDrivers = Math.max(0, meta.missingEntriesTotal);
  const pendingLocations = Math.max(0, meta.pendingGeocodeTotal ?? meta.missingLocationsTotal);
  const countryStats = useMemo(() => {
    const counts = new Map<string, number>();
    locations.forEach((location) => {
      const label = formatCountryLabel(location.country);
      counts.set(label, (counts.get(label) ?? 0) + location.driverCount);
    });
    return Array.from(counts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((left, right) => right.count - left.count || left.country.localeCompare(right.country))
      .slice(0, 6);
  }, [locations]);
  const maxCountryCount = Math.max(1, ...countryStats.map((item) => item.count));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900">Fahrer-Herkunft</h2>
        </div>
        {(loading || refreshingCoordinates) && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Aktualisiert
          </div>
        )}
      </div>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="relative min-h-[360px] overflow-hidden rounded-lg border bg-slate-50 sm:min-h-[430px]">
          {loading && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/75 text-sm text-slate-600">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fahrerdaten werden geladen…
            </div>
          )}
          <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} minZoom={3} maxZoom={18} className="h-[360px] w-full sm:h-[430px]" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            <DriverMarkerClusterLayer markers={markers} />
          </MapContainer>
        </div>

        <aside className="space-y-4 rounded-lg border bg-white p-3">
          <div className="rounded-md border bg-slate-50 p-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase text-slate-500">Kartenabdeckung</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{coveragePercent}%</div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>{driversOnMap}/{totalDrivers}</div>
                <div>Fahrer</div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${coveragePercent}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border bg-white p-2">
              <div className="text-xs text-slate-500">Offen</div>
              <div className="font-semibold text-slate-900">{pendingDrivers}</div>
            </div>
            <div className="rounded-md border bg-white p-2">
              <div className="text-xs text-slate-500">Orte offen</div>
              <div className="font-semibold text-slate-900">{pendingLocations}</div>
            </div>
            <div className="rounded-md border bg-white p-2">
              <div className="text-xs text-slate-500">Orte auf Karte</div>
              <div className="font-semibold text-slate-900">{locations.length}</div>
            </div>
            <div className="rounded-md border bg-white p-2">
              <div className="text-xs text-slate-500">Länder</div>
              <div className="font-semibold text-slate-900">{countryCount}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Herkunftsländer</div>
            {countryStats.map((item) => (
              <div key={item.country} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-slate-700">{item.country}</span>
                  <span className="shrink-0 font-medium text-slate-900">{item.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, Math.round((item.count / maxCountryCount) * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
