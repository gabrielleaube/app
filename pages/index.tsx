// pages/index.tsx
import { useEffect, useMemo, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

// ✅ Leaflet map component must be dynamically imported (no SSR)
const VenueMap = dynamic(() => import("../components/VenueMap"), { ssr: false });

type Venue = {
  id: string;
  name: string;
  city: string;
  lat: number | null;
  lng: number | null;
  total_going: number;
  friends_going: number;
};

type Plan = {
  plan_id: string;
  user_id: string;
  user_name: string;
  venue_id: string;
  venue_name: string;
  city: string;
  created_at: string;
};

export default function Home() {
  const city = "athens-ga";
  const { data: session, status } = useSession();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingVenueId, setSavingVenueId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ✅ Map search + selection
  const [search, setSearch] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  const filteredVenues = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return venues;
    return venues.filter((v) => v.name.toLowerCase().includes(s));
  }, [venues, search]);

  // ✅ Require login (no guest mode)
  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google");
    }
  }, [status]);

  // ✅ Helpers that THROW if API returns 401/500, so we see the real issue
  async function refreshVenues() {
    const res = await fetch(`/api/venues?city=${encodeURIComponent(city)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to load venues");
    setVenues(data.venues || []);
  }

  async function refreshPlans() {
    const res = await fetch(`/api/plans?city=${encodeURIComponent(city)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to load plans");
    setPlans(data.plans || []);
  }

  async function refreshAll() {
    await Promise.all([refreshVenues(), refreshPlans()]);
  }

  // ✅ Load venues + plans once authenticated
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        await refreshAll(); // ✅ allowed here

        if (cancelled) return;
      } catch (e: any) {
        if (cancelled) return;
        console.error(e);
        setError(e?.message || "Failed to load data");
        setVenues([]);
        setPlans([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (status === "authenticated") load();

    return () => {
      cancelled = true;
    };
  }, [city, status]);

  async function planToGo(venueId: string) {
    if (!session?.user) return;

    try {
      setSavingVenueId(venueId);

      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          venue_id: venueId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save plan");

      await refreshAll();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Could not save plan");
    } finally {
      setSavingVenueId(null);
    }
  }

  async function clearMyPlan() {
    try {
      const res = await fetch(`/api/plans?city=${encodeURIComponent(city)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to clear plan");

      await refreshAll();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Could not clear plan");
    }
  }

  // ✅ Loading states
  if (status === "loading" || (status === "authenticated" && loading)) {
    return <h1 style={{ padding: 24 }}>Loading…</h1>;
  }
  if (status === "unauthenticated") {
    return <h1 style={{ padding: 24 }}>Redirecting to sign in…</h1>;
  }

  return (
    <main
      style={{
        padding: 24,
        color: "#fff",
        background: "#000",
        minHeight: "100vh",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h1>Who’s Out Tonight 🍻</h1>

        <button
          onClick={() => signOut()}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #555",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
            height: 40,
          }}
        >
          Sign out
        </button>
      </div>

      {/* Error (if any) */}
      {error && (
        <p style={{ marginTop: 12, opacity: 0.9 }}>
          Error: {error}
        </p>
      )}

      {/* Logged in as */}
      <div style={{ marginTop: 12, opacity: 0.9 }}>
        You are:{" "}
        <span style={{ fontWeight: 700 }}>
          {session?.user?.name || session?.user?.email}
        </span>

        <button
          onClick={clearMyPlan}
          style={{
            marginLeft: 12,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #555",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Clear my plan
        </button>
      </div>

      {/* ✅ MAP + SEARCH */}
      <h2 style={{ marginTop: 18 }}>Map</h2>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search a bar..."
        style={{
          marginTop: 10,
          marginBottom: 12,
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #333",
          background: "#0b0b0b",
          color: "#fff",
        }}
      />

      <VenueMap
        venues={filteredVenues}
        selectedVenueId={selectedVenueId}
        onSelectVenue={(id: string) => setSelectedVenueId(id)}
      />

      {/* Venues */}
      <h2 style={{ marginTop: 18 }}>Venues</h2>
      {filteredVenues.length === 0 ? (
        <p style={{ opacity: 0.8 }}>No venues found.</p>
      ) : (
        filteredVenues.map((venue) => (
          <div
            key={venue.id}
            style={{
              padding: 12,
              marginTop: 12,
              borderRadius: 8,
              background: "#111",
              border: "1px solid #333",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div>{venue.name}</div>

              <div
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: "1px solid #333",
                  background: "#0b0b0b",
                  opacity: 0.9,
                  whiteSpace: "nowrap",
                }}
              >
                {venue.total_going} going
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedVenueId(venue.id);
                planToGo(venue.id);
              }}
              disabled={savingVenueId === venue.id}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #555",
                background: savingVenueId === venue.id ? "#222" : "#0d1b12",
                color: "#fff",
                cursor: savingVenueId === venue.id ? "default" : "pointer",
              }}
            >
              {savingVenueId === venue.id ? "Saving..." : "Plan to go"}
            </button>
          </div>
        ))
      )}

      {/* Planning to go */}
      <h2 style={{ marginTop: 32 }}>Planning to go 🗓️</h2>
      {plans.length === 0 ? (
        <p style={{ opacity: 0.8 }}>No plans yet.</p>
      ) : (
        plans.map((p) => (
          <div
            key={p.plan_id}
            style={{
              padding: 12,
              marginTop: 12,
              borderRadius: 8,
              background: "#0d1b12",
              border: "1px solid #2a7a3b",
            }}
          >
            <div style={{ fontWeight: 700 }}>{p.user_name}</div>
            <div style={{ opacity: 0.9 }}>Planning: {p.venue_name}</div>
          </div>
        ))
      )}
    </main>
  );
}
