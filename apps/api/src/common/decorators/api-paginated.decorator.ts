import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Swagger decorator for paginated list endpoints.
 * Usage: @ApiPaginatedResponse(ProductResponseDto)
 */
export function ApiPaginatedResponse<T extends Type<unknown>>(model: T) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              pagination: {
                type: 'object',
                properties: {
                  page:       { type: 'number', example: 1 },
                  limit:      { type: 'number', example: 24 },
                  total:      { type: 'number', example: 120 },
                  totalPages: { type: 'number', example: 5 },
                  hasNext:    { type: 'boolean', example: true },
                  hasPrev:    { type: 'boolean', example: false },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', format: 'date-time' },
                  requestId: { type: 'string', example: 'req_a1b2c3d4' },
                },
              },
            },
          },
        ],
      },
    }),
  );
}
