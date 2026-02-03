import { signIn, useSession } from "next-auth/react";
import { useEffect } from "react";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google"); // auto-redirect to Google
    }
  }, [status]);

  if (status === "loading") return <div style={{ padding: 24 }}>Loading...</div>;

  // While redirecting
  if (status === "unauthenticated") return <div style={{ padding: 24 }}>Redirecting to sign in...</div>;

  return <>{children}</>;
}
