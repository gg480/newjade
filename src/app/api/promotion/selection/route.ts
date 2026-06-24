// 选品评分 API — 场景驱动商品推广价值评估
// GET /api/promotion/selection?scene=new_arrival&page=1&limit=20

import { withApiLogging } from '@/lib/api/with-api-logging';
import { NextResponse } from 'next/server';
import { guardPermissionOrOpenClaw, safeErrorMessage } from '@/lib/api/permission-guard';
import { AppError } from '@/lib/errors';
import * as selectionService from '@/services/product-scoring.service';
import type { SelectionParams, SceneType } from '@/types/promotion';

const VALID_SCENES: SceneType[] = ['new_arrival', 'clearance', 'content', 'festival', 'knowledge'];

async function selectionGet(req: Request) {
  const denied = await guardPermissionOrOpenClaw(req, 'action:content_view');
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const scene = searchParams.get('scene') as SceneType;

  // 参数校验
  if (!scene || !VALID_SCENES.includes(scene)) {
    return NextResponse.json(
      { code: 400, data: null, message: 'scene 参数无效，可选值: ' + VALID_SCENES.join(', ') },
      { status: 400 },
    );
  }

  const params: SelectionParams = {
    scene,
    page: Math.max(1, parseInt(searchParams.get('page') || '1')),
    limit: Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20'))),
    materialId: searchParams.get('material_id') ? parseInt(searchParams.get('material_id')!) : undefined,
    typeId: searchParams.get('type_id') ? parseInt(searchParams.get('type_id')!) : undefined,
    status: searchParams.get('status') || undefined,
  };

  try {
    const result = await selectionService.selectProducts(params);
    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  } catch (e) {
    console.error('[Selection API] Error:', e);
    return NextResponse.json(
      { code: 500, data: null, message: safeErrorMessage(e) },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging('promotion:selection:GET', selectionGet);
