import { NextResponse } from 'next/server';
import * as configService from '@/services/config.service';
import { withApiLogging } from '@/lib/api/with-api-logging';

async function configGET() {
  const configs = await configService.getAllConfigs();
  return NextResponse.json({ code: 0, data: configs, message: 'ok' });
}

async function configPUT(req: Request) {
  const { key, value } = await req.json();
  const config = await configService.updateConfig(key, value);
  return NextResponse.json({ code: 0, data: config, message: 'ok' });
}

export const GET = withApiLogging('config:GET', configGET);
export const PUT = withApiLogging('config:PUT', configPUT);
