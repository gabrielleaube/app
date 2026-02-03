import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { query } from "../../../lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token }) {
      const email = token.email as string | undefined;
      if (!email) return token;

      try {
        // Always fetch id at least once; refresh profile each login
        const rows = (await query(
          `SELECT id FROM users WHERE email = ? LIMIT 1`,
          [email]
        )) as Array<{ id: string }>;

        let dbUserId = rows?.[0]?.id;

        if (!dbUserId) {
          await query(
            `
            INSERT INTO users (id, name, email, image, created_at)
            VALUES (UUID(), ?, ?, ?, NOW())
            `,
            [
              (token.name as string) ?? null,
              email,
              (token.picture as string) ?? null,
            ]
          );

          const created = (await query(
            `SELECT id FROM users WHERE email = ? LIMIT 1`,
            [email]
          )) as Array<{ id: string }>;

          dbUserId = created?.[0]?.id;
        } else {
          // keep profile fresh
          await query(
            `UPDATE users SET name = ?, image = ? WHERE email = ?`,
            [
              (token.name as string) ?? null,
              (token.picture as string) ?? null,
              email,
            ]
          );
        }

        token.dbUserId = dbUserId;
      } catch (err) {
        console.error("NextAuth DB sync error:", err);
        // Allow auth to continue even if DB sync fails (optional)
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.dbUserId) {
        // @ts-expect-error custom field
        session.user.id = token.dbUserId as string;
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
