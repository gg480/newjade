import { NextResponse } from 'next/server';
import * as configService from '@/services/config.service';

export async function GET() {
  try {
    const configs = await configService.getAllConfigs();
    return NextResponse.json({ code: 0, data: configs, message: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ code: 500, data: null, message: `查询配置失败: ${e.message || 'unknown error'}` }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { key, value } = await req.json();
    const config = await configService.updateConfig(key, value);
    return NextResponse.json({ code: 0, data: config, message: 'ok' });
  } catch (e: any) {
    const status = e.statusCode || 500;
    return NextResponse.json({ code: status, data: null, message: `保存配置失败: ${e.message || 'unknown error'}` }, { status });
  }
}
