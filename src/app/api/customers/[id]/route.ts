import * as customersService from '@/services/customers.service';
import { AppError } from '@/lib/errors';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const customer = await customersService.getCustomerById(parseInt(id));

    return NextResponse.json({
      code: 0,
      data: customer,
      message: 'ok',
    });
  } catch (e: any) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: e.message || '服务器错误' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
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
  } catch (e: any) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await customersService.deleteCustomer(parseInt(id));

    return NextResponse.json({ code: 0, data: null, message: '已删除' });
  } catch (e: any) {
    if (e instanceof AppError) {
      return NextResponse.json({ code: e.code, data: null, message: e.message }, { status: e.statusCode });
    }
    return NextResponse.json({ code: 500, data: null, message: '删除失败' }, { status: 500 });
  }
}
