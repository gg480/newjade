import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { uploadItemImage, lookupItemBySkuAnyStatus } from '@/services/items-extra.service';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { guardPermission } from '@/lib/api/permission-guard';

// 扫码拍摄上传 — 接收SKU + 图片 + 角度，自动定位货品后上传
async function scanPhotoHandler(req: Request) {
  const denied = await guardPermission(req, 'action:item_batch_ops');
  if (denied) return denied;
  const formData = await req.formData();
  const skuCode = formData.get('skuCode') as string | null;
  const file = formData.get('image') as File | null;
  const angleCode = formData.get('angleCode') as string | null;

  if (!skuCode) {
    return NextResponse.json({ code: 400, data: null, message: '请提供SKU码' }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ code: 400, data: null, message: '请选择图片' }, { status: 400 });
  }

  // 根据SKU定位货品（不限状态，已售/已退也能补拍）
  const item = await lookupItemBySkuAnyStatus(skuCode);
  const imageRecord = await uploadItemImage(item.id, file, angleCode || undefined);

  return NextResponse.json({ code: 0, data: imageRecord, message: 'ok' });
}

export const POST = withApiLogging('items:scan-photo', scanPhotoHandler);
