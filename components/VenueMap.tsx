import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";

// Fix default marker icons in Next.js builds
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export type VenueMapItem = {
  id: string;
  name: string;
  // ✅ allow string because MySQL DECIMAL often comes back as string
  lat: number | string | null;
  lng: number | string | null;
  total_going: number;
  friends_going: number;
};

function toNumber(val: number | string | null): number | null {
  if (val == null) return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 15, { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

export default function VenueMap({
  venues,
  selectedVenueId,
  onSelectVenue,
}: {
  venues: VenueMapItem[];
  selectedVenueId: string | null;
  onSelectVenue: (id: string) => void;
}) {
  // Athens, GA default center
  const defaultCenter: [number, number] = [33.9519, -83.3576];

  // ✅ normalize venues so Leaflet always gets numbers
  const normalized = useMemo(() => {
    return venues
      .map((v) => {
        const lat = toNumber(v.lat);
        const lng = toNumber(v.lng);
        return { ...v, lat, lng };
      })
      .filter((v) => v.lat != null && v.lng != null);
  }, [venues]);

  const selected = normalized.find((v) => v.id === selectedVenueId);

  return (
    <div
      style={{
        height: 520,
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #333",
        background: "#0b0b0b",
      }}
    >
      <MapContainer center={defaultCenter} zoom={15} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {selected?.lat != null && selected?.lng != null && (
          <FlyTo lat={selected.lat as number} lng={selected.lng as number} />
        )}

        {normalized.map((v) => {
          const others = Math.max(0, (v.total_going || 0) - (v.friends_going || 0));

          return (
            <Marker
              key={v.id}
              position={[v.lat as number, v.lng as number]}
              eventHandlers={{
                click: () => onSelectVenue(v.id),
                mouseover: (e) => (e.target as any).openTooltip(),
                mouseout: (e) => (e.target as any).closeTooltip(),
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                <div style={{ fontWeight: 700 }}>{v.name}</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  {v.friends_going} friends going · {others} others
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
