import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const messages = await db.collection("messages")
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return NextResponse.json({ success: true, messages: messages.reverse() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { username, text } = await req.json();
    if (!username || !text?.trim()) throw new Error("All fields required");
    if (text.trim().length > 500) throw new Error("Message too long (max 500 chars)");
    const db = await getDb();
    const now = new Date();
    const message = {
      username,
      text: text.trim(),
      createdAt: now,
    };
    await db.collection("messages").insertOne(message);
    return NextResponse.json({ success: true, message });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}