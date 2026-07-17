export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ApiError[];
  timestamp: string;
  requestId?: string;
}

export interface ApiError {
  field?: string;
  message: string;
  code?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export function createApiResponse<T>(
  data: T,
  message?: string,
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

export function createErrorResponse(
  message: string,
  errors?: ApiError[],
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    message,
    errors,
    timestamp: new Date().toISOString(),
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  meta: PaginationMeta,
  message?: string,
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    meta,
    message,
    timestamp: new Date().toISOString(),
  };
}
