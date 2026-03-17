import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    const { escrowCode, buyerUsername, reason } = await req.json();
    if (!escrowCode || !buyerUsername) throw new Error("All fields required");
    const db = await getDb();
    const tx = await db.collection("transactions").findOne({ escrowCode: escrowCode.toUpperCase() });
    if (!tx) throw new Error("Escrow not found");
    if (tx.buyerUsername !== buyerUsername)
      return NextResponse.json({ success: false, error: "Only buyer can open dispute" }, { status: 403 });
    if (tx.status !== "DELIVERED") throw new Error("Can only dispute after delivery");
    const exists = await db.collection("disputes").findOne({ escrowCode: escrowCode.toUpperCase() });
    if (exists) throw new Error("Dispute already exists");
    const now = new Date();
    await db.collection("disputes").insertOne({
      escrowCode: escrowCode.toUpperCase(),
      buyerUsername,
      sellerUsername: tx.sellerUsername,
      reason: reason || "Item not received",
      status: "PENDING_ADMIN",
      openedAt: now,
      auditLog: [{ action: "OPENED", by: buyerUsername, at: now, note: reason || "Dispute opened" }],
    });
    await db.collection("transactions").updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $set: { status: "PENDING_ADMIN", frozenAt: now, updatedAt: now },
        $push: { auditLog: { action: "DISPUTE_OPENED", by: buyerUsername, at: now, note: reason || "Dispute opened — awaiting admin" } } as any,
      }
    );
    return NextResponse.json({ success: true, message: "Dispute opened. Admin will review and resolve." });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}