import * as customersService from '@/services/customers.service';
import { AppError } from '@/lib/errors';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const size = parseInt(searchParams.get('size') || '20');
    const keyword = searchParams.get('keyword');
    const tag = searchParams.get('tag');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';

    const result = await customersService.getCustomers({
      page,
      size,
      keyword,
      tag,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      code: 0,
      data: result,
      message: 'ok',
    });
  } catch (e: any) {
    console.error('Customer API error:', e);
    return NextResponse.json({ code: 500, data: null, message: e.message || '服务器错误' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone, wechat, address, notes, tags } = body;

    const customer = await customersService.createCustomer({
      name,
      phone,
      wechat,
      address,
      notes,
      tags,
    });

    return NextResponse.json({ code: 0, data: customer, message: 'ok' });
  } catch (e: any) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: '创建失败' }, { status: 500 });
  }
}
