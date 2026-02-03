import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { query } from "../../../lib/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user?.id) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { toUserId } = req.body;
  if (!toUserId) {
    return res.status(400).json({ error: "Missing toUserId" });
  }

  try {
    await query(
      `
      INSERT INTO friendships (id, requester_id, addressee_id, status)
      VALUES (UUID(), ?, ?, 'pending')
      `,
      [session.user.id, toUserId]
    );

    return res.json({ ok: true });
  } catch (err: any) {
    // Duplicate request or already friends
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ error: "Friend request already exists" });
    }

    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
