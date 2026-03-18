import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const db = await getDb();
    const tx = await db.collection("transactions").findOne({ escrowCode: params.code.toUpperCase() });
    if (!tx) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, transaction: tx });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}