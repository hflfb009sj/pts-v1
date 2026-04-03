import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { getDb } from '@/lib/mongodb';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData   = await req.formData();
    const file       = formData.get('file') as File;
    const escrowCode = formData.get('escrowCode') as string;
    const username   = formData.get('username') as string;

    if (!file || !escrowCode || !username) throw new Error('Missing required fields');
    if (file.size > 10 * 1024 * 1024) throw new Error('File too large (max 10MB)');

    const db = await getDb();
    const tx = await db.collection('transactions').findOne({ escrowCode: escrowCode.toUpperCase() });
    if (!tx) throw new Error('Escrow not found');
    if (tx.sellerUsername !== username) throw new Error('Only seller can upload delivery');
    if (!['ACCEPTED', 'DELIVERED'].includes(tx.status)) throw new Error('Invalid escrow status');

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'ptrust-deliveries', resource_type: 'auto', public_id: 'delivery-' + escrowCode },
        (err, res) => err ? reject(err) : resolve(res)
      ).end(buffer);
    });

    const deliveryCode = 'DL-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const now = new Date();

    await db.collection('transactions').updateOne(
      { escrowCode: escrowCode.toUpperCase() },
      {
        $set: {
          deliveryFile: { url: result.secure_url, publicId: result.public_id, fileName: file.name, uploadedAt: now },
          deliveryCode,
          status: 'DELIVERED',
          updatedAt: now,
        },
        $push: { auditLog: { action: 'FILE_UPLOADED', by: username, at: now, note: 'Digital delivery uploaded' } } as any,
      }
    );

    return NextResponse.json({ success: true, deliveryCode });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
