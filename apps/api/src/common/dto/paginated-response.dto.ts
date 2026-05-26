export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function buildPagination(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Wraps an array response with pagination metadata so TransformInterceptor
 * picks it up correctly.
 *
 * Usage in service:
 *   return paginatedResponse(items, page, limit, total);
 */
export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResult<T> {
  return {
    data,
    pagination: buildPagination(page, limit, total),
  };
}
