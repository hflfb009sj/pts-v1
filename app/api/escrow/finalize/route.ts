import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { paymentId, txid } = await req.json();
    if (!paymentId) throw new Error("paymentId required");

    const db = await getDb();
    const now = new Date();

    await db.collection("transactions").updateOne(
      { paymentId },
      {
        $set: { txid: txid || null, piConfirmed: true, updatedAt: now },
        $push: { auditLog: { action: "PI_CONFIRMED", by: "system", at: now, note: "Payment confirmed" } } as any,
      }
    );

    // Also complete the payment with Pi Network
    if (txid) {
      await fetch("https://api.minepi.com/v2/payments/" + paymentId + "/complete", {
        method: "POST",
        headers: {
          "Authorization": "Key " + process.env.PI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txid }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}