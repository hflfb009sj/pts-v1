import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

const ADMIN = "GhaithriAHI96";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, username, escrowCode, reason, resolveFor } = body;
    if (username !== ADMIN)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    const db = await getDb();
    const now = new Date();
    if (action === "getAll") {
      const transactions = await db.collection("transactions").find({}).sort({ createdAt: -1 }).limit(200).toArray();
      const stats = {
        total: await db.collection("transactions").countDocuments(),
        pending: await db.collection("transactions").countDocuments({ status: "PENDING" }),
        delivered: await db.collection("transactions").countDocuments({ status: "DELIVERED" }),
        frozen: await db.collection("transactions").countDocuments({ status: { : ["FROZEN", "UNDER_REVIEW"] } }),
        released: await db.collection("transactions").countDocuments({ status: "RELEASED" }),
      };
      return NextResponse.json({ success: true, transactions, stats });
    }
    if (action === "refund") {
      const tx = await db.collection("transactions").findOne({ escrowCode: escrowCode.toUpperCase() });
      if (!tx) throw new Error("Transaction not found");
      if (tx.status === "RELEASED") throw new Error("Already released - cannot refund");
      await db.collection("transactions").updateOne(
        { escrowCode: escrowCode.toUpperCase() },
        { : { status: "REFUNDED", refundedAt: now, updatedAt: now },
          : { auditLog: { action: "ADMIN_REFUND", by: ADMIN, at: now, note: reason  "Emergency refund" } } as any }
      );
      return NextResponse.json({ success: true, message: "Refunded to buyer" });
    }
    if (action === "freeze") {
      await db.collection("transactions").updateOne(
        { escrowCode: escrowCode.toUpperCase() },
        { : { status: "FROZEN", frozenAt: now, updatedAt: now },
          : { auditLog: { action: "ADMIN_FREEZE", by: ADMIN, at: now, note: reason  "Frozen by admin" } } as any }
      );
      return NextResponse.json({ success: true, message: "Transaction frozen" });
    }
    if (action === "resolve") {
      const newStatus = resolveFor === "seller" ? "RELEASED" : "REFUNDED";
      await db.collection("transactions").updateOne(
        { escrowCode: escrowCode.toUpperCase() },
        { : { status: newStatus, resolvedAt: now, updatedAt: now },
          : { auditLog: { action: "ADMIN_RESOLVE", by: ADMIN, at: now, note: "Resolved for " + resolveFor } } as any }
      );
      return NextResponse.json({ success: true, message: "Resolved for " + resolveFor });
    }
    throw new Error("Unknown action");
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
