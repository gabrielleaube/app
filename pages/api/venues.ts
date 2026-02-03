import type { NextApiRequest, NextApiResponse } from "next";
import mysql from "mysql2/promise";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // ✅ Require login
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ ok: false, error: "Not authenticated" });
  }

  const city = String(req.query.city || "").trim();
  if (!city) {
    return res.status(400).json({ ok: false, error: "Missing city parameter" });
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // ✅ Find "me" (db user id) by email (reliable even if session.user.id missing)
    const [meRows] = await connection.execute(
      `SELECT id FROM users WHERE email = ? LIMIT 1`,
      [session.user.email]
    );

    // @ts-expect-error mysql rows
    const me = meRows?.[0]?.id as string | undefined;
    if (!me) {
      await connection.end();
      return res.status(401).json({ ok: false, error: "User not found in DB (email not synced)" });
    }

    const [rows] = await connection.execute(
      `
      SELECT
        v.id,
        v.name,
        v.city,
        v.lat,
        v.lng,

        -- total going (all users)
        COALESCE(t.total_going, 0) AS total_going,

        -- friends going (accepted friends only)
        COALESCE(f.friends_going, 0) AS friends_going

      FROM venues v

      -- Total going per venue
      LEFT JOIN (
        SELECT venue_id, COUNT(DISTINCT user_id) AS total_going
        FROM plans
        GROUP BY venue_id
      ) t ON t.venue_id = v.id

      -- Friends going per venue for the logged-in user
      LEFT JOIN (
        SELECT p.venue_id, COUNT(DISTINCT p.user_id) AS friends_going
        FROM plans p
        JOIN (
          SELECT
            CASE
              WHEN requester_id = ? THEN addressee_id
              ELSE requester_id
            END AS friend_id
          FROM friendships
          WHERE status = 'accepted'
            AND (requester_id = ? OR addressee_id = ?)
        ) fr ON fr.friend_id = p.user_id
        GROUP BY p.venue_id
      ) f ON f.venue_id = v.id

      WHERE v.city = ?
      ORDER BY v.name ASC
      `,
      [me, me, me, city]
    );

    await connection.end();
    return res.status(200).json({ ok: true, city, venues: rows });
  } catch (err: any) {
    console.error("venues api error:", err);
    await connection.end();
    return res.status(500).json({ ok: false, error: err.message || "Server error" });
  }
}
