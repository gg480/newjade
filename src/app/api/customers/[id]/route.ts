import * as customersService from '@/services/customers.service';
import { NextResponse } from 'next/server';
import { withApiLogging } from '@/lib/api/with-api-logging';

type CustomerParams = { params: Promise<{ id: string }> };

async function customerByIdGET(req: Request, { params }: CustomerParams) {
  const { id } = await params;
  const customer = await customersService.getCustomerById(parseInt(id));

  return NextResponse.json({
    code: 0,
    data: customer,
    message: 'ok',
  });
}

async function customerByIdPUT(req: Request, { params }: CustomerParams) {
  const { id } = await params;
  const body = await req.json();
  const { name, phone, wechat, address, notes, tags } = body;

  const customer = await customersService.updateCustomer(parseInt(id), {
    name,
    phone,
    wechat,
    address,
    notes,
    tags,
  });

  return NextResponse.json({ code: 0, data: customer, message: 'ok' });
}

async function customerByIdDELETE(req: Request, { params }: CustomerParams) {
  const { id } = await params;
  await customersService.deleteCustomer(parseInt(id));

  return NextResponse.json({ code: 0, data: null, message: '已删除' });
}

export const GET = withApiLogging('customers/[id]:GET', customerByIdGET);
export const PUT = withApiLogging('customers/[id]:PUT', customerByIdPUT);
export const DELETE = withApiLogging('customers/[id]:DELETE', customerByIdDELETE);
