/**
 * 应用层错误基类
 * 所有 service 层抛出的错误都应使用此类或其子类
 */
export class AppError extends Error {
  /** HTTP 状态码 */
  statusCode: number;
  /** 业务错误码 */
  code: number;

  constructor(message: string, statusCode = 500, code = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * 资源不存在 404
 */
export class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(message, 404, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * 参数校验失败 400
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 400);
    this.name = 'ValidationError';
  }
}

/**
 * 数据冲突（如唯一键重复）409
 */
export class ConflictError extends AppError {
  constructor(message = '数据冲突') {
    super(message, 409, 400);
    this.name = 'ConflictError';
  }
}
