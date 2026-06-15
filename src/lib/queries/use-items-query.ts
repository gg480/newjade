/**
 * TanStack Query hooks for inventory items
 *
 * 渐进式迁移：先迁移核心的货品列表查询，后续逐步迁移其他数据请求。
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '@/lib/api';
import type { ItemsQueryParams, ItemSummary, PaginatedData, UpdateItemBody } from '@/lib/api.types';

const ITEMS_KEY = 'items';

/** 构建稳定的 query key（含所有筛选条件） */
function itemsQueryKey(params: ItemsQueryParams): [string, ItemsQueryParams] {
  return [ITEMS_KEY, params];
}

/**
 * 货品列表查询
 *
 * 替代 inventory-tab.tsx 中 useEffect + loadData 的手动数据加载模式。
 * 自动处理：缓存/去重/后台刷新/loading/error 状态。
 */
export function useItemsQuery(params: ItemsQueryParams) {
  return useQuery<PaginatedData<ItemSummary>>({
    queryKey: itemsQueryKey(params),
    queryFn: () => itemsApi.getItems(params),
    placeholderData: (prev) => prev, // 分页/筛选切换时保留旧数据，避免闪烁
  });
}

/**
 * 手动刷新货品列表
 *
 * 在创建/编辑/删除货品后调用，使相关缓存失效并重新获取。
 */
export function useInvalidateItems() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [ITEMS_KEY] });
}

/**
 * 删除货品 mutation
 *
 * 成功后自动刷新列表缓存。
 */
export function useDeleteItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => itemsApi.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ITEMS_KEY] });
    },
  });
}

/**
 * 更新货品 mutation
 *
 * 成功后自动刷新列表缓存。
 */
export function useUpdateItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UpdateItemBody> }) =>
      itemsApi.updateItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ITEMS_KEY] });
    },
  });
}
