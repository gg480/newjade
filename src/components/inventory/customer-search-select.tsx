'use client';

import { useState, useEffect, useRef } from 'react';
import { customersApi } from '@/lib/api';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomerOption {
  id: number;
  name: string;
  phone: string;
  wechat: string;
  customerCode: string;
}

interface CustomerSearchSelectProps {
  value: string;  // customerId as string
  onChange: (id: string) => void;
  placeholder?: string;
}

export function CustomerSearchSelect({ value, onChange, placeholder = '搜索客户（姓名/手机号/微信）' }: CustomerSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const keyword = search.trim();
        const data = await customersApi.getCustomers(keyword ? { keyword, size: 20 } : { size: 50 });
        const items = data?.items || data || [];
        setOptions(items);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, search.trim() ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Initial load
  useEffect(() => {
    customersApi.getCustomers({ size: 50 }).then((d: any) => setOptions(d?.items || d || [])).catch(() => {});
  }, []);

  const selectedCustomer = options.find((c) => String(c.id) === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {selectedCustomer ? (
            <span className="truncate">
              {selectedCustomer.name}
              {selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(320px,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <User className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder={placeholder}
              value={search}
              onValueChange={setSearch}
              className="flex-1"
            />
          </div>
          <CommandList className="max-h-[200px]">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">搜索中...</div>
            ) : (
              <CommandEmpty>未找到客户</CommandEmpty>
            )}
            <CommandGroup>
              {/* 散客选项 */}
              <CommandItem
                value="_none"
                onSelect={() => { onChange(''); setOpen(false); setSearch(''); }}
                className="cursor-pointer"
              >
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                <span className="text-muted-foreground">无（散客）</span>
              </CommandItem>
              {options.map((c) => (
                <CommandItem
                  key={c.id}
                  value={String(c.id)}
                  onSelect={() => { onChange(String(c.id)); setOpen(false); setSearch(''); }}
                  className="cursor-pointer"
                >
                  <Check className={cn('mr-2 h-4 w-4', value === String(c.id) ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.phone && `${c.phone}`}
                      {c.phone && c.wechat && ' · '}
                      {c.wechat && `微信: ${c.wechat}`}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
