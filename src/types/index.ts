// 共享 TypeScript 类型定义
// 所有者：@Architect
// 各领域 Agent 在此定义跨模块共享的类型

export interface ApiResponse<T = unknown> {
  code: number;
  data: T | null;
  message: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
