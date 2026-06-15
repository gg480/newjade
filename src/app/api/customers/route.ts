import * as customersService from '@/services/customers.service';
import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { guardPermission } from '@/lib/api/permission-guard';

async function customersGET(req: Request) {
  const { searchParams } = new URL(req.url);

  // 支持 sort=lastPurchaseAt 按最近购买日期取前6条
  if (searchParams.get('sort') === 'lastPurchaseAt') {
    const result = await customersService.getRecentCustomers();
    return NextResponse.json({ code: 0, data: result, message: 'ok' });
  }

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
}

async function customersPOST(req: Request) {
  const denied = await guardPermission(req, 'action:customer_create');
  if (denied) return denied;
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
}

export const GET = withApiLogging('customers:GET', customersGET);
export const POST = withApiLogging('customers:POST', customersPOST);
