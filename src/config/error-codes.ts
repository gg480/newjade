export const ErrorCodes = {
  SUCCESS: 0,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.SUCCESS]: "ok",
  [ErrorCodes.BAD_REQUEST]: "请求参数错误",
  [ErrorCodes.UNAUTHORIZED]: "未认证或登录已过期",
  [ErrorCodes.NOT_FOUND]: "资源未找到",
  [ErrorCodes.CONFLICT]: "数据冲突",
  [ErrorCodes.RATE_LIMITED]: "请求过于频繁，请稍后再试",
  [ErrorCodes.INTERNAL_ERROR]: "服务器内部错误",
};
