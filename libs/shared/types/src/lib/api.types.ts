export interface ApiResponse<T> {
  success: boolean;
  data:    T;
  message?: string;
}

export interface PaginationMeta {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data:    T[];
  pagination: PaginationMeta;
  meta?: {
    timestamp:  string;
    requestId?: string;
  };
}

export interface ApiError {
  success:    false;
  statusCode: number;
  message:    string;
  errors?:    Record<string, string[]>;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}
