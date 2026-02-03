// pages/api/plans.ts
import type { NextApiRequest, NextApiResponse } from "next";
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ✅ Require login for ALL methods
  const session = await getServerSession(req, res, authOptions);
  if (!session || !(session.user as any)?.id) {
    return res.status(401).json({ ok: false, error: "Not authenticated" });
  }
  const userId = (session.user as any).id as string;

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, // should be APP
  });

  try {
    // ---------- GET: list plans for a city ----------
    if (req.method === "GET") {
      const city = String(req.query.city || "");

      const [rows] = await connection.execute(
        `
        SELECT 
          p.id as plan_id,
          u.id as user_id,
          u.name as user_name,
          v.id as venue_id,
          v.name as venue_name,
          v.city,
          p.created_at
        FROM plans p
        JOIN users u ON u.id = p.user_id
        JOIN venues v ON v.id = p.venue_id
        WHERE v.city = ?
        ORDER BY p.created_at DESC
        `,
        [city]
      );

      await connection.end();
      return res.status(200).json({ ok: true, city, plans: rows });
    }

    // ---------- POST: create/replace ONE "tonight plan" for the logged-in user ----------
    if (req.method === "POST") {
      const { city, venue_id } = req.body || {};

      if (!city || !venue_id) {
        await connection.end();
        return res.status(400).json({ ok: false, error: "Missing city or venue_id" });
      }

      // 1) Enforce "one plan per user per city"
      await connection.execute(
        `
        DELETE p
        FROM plans p
        JOIN venues v ON v.id = p.venue_id
        WHERE p.user_id = ? AND v.city = ?
        `,
        [userId, String(city)]
      );

      // 2) Insert new plan
      const planId = randomUUID();
      await connection.execute(
        `INSERT INTO plans (id, user_id, venue_id, created_at) VALUES (?, ?, ?, NOW())`,
        [planId, userId, String(venue_id)]
      );

      await connection.end();
      return res.status(200).json({
        ok: true,
        plan: {
          plan_id: planId,
          user_id: userId,
          user_name: session.user?.name ?? null,
          venue_id,
          city,
        },
      });
    }

    // ---------- DELETE: clear MY plan for the city ----------
    if (req.method === "DELETE") {
      const city = String(req.query.city || "");
      if (!city) {
        await connection.end();
        return res.status(400).json({ ok: false, error: "Missing city" });
      }

      await connection.execute(
        `
        DELETE p
        FROM plans p
        JOIN venues v ON v.id = p.venue_id
        WHERE p.user_id = ? AND v.city = ?
        `,
        [userId, city]
      );

      await connection.end();
      return res.status(200).json({ ok: true, cleared: true });
    }

    await connection.end();
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err: any) {
    console.error(err);
    await connection.end();
    return res.status(500).json({ ok: false, error: err.message });
  }
}
