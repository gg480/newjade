'use client';

import React, { createContext, useContext } from 'react';
import type { DictMaterial, DictType, DictTag, Supplier, SysConfig } from '@/lib/api.types';

interface SettingsContextValue {
  materials: DictMaterial[];
  types: DictType[];
  tags: DictTag[];
  configs: SysConfig[];
  suppliers: Supplier[];
  refreshMaterials: () => Promise<void>;
  refreshTypes: () => Promise<void>;
  refreshTags: (materialId?: number) => Promise<void>;
  refreshConfigs: () => Promise<void>;
  refreshSuppliers: () => Promise<void>;
}

const SettingsCtx = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

export function SettingsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: SettingsContextValue;
}) {
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}
