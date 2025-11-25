import { NextResponse } from 'next/server';

/**
 * API Error Handler Utility
 * Ensures all API routes return JSON responses, never HTML error pages
 */

export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
}

/**
 * Wraps an API route handler to ensure it always returns JSON
 * Catches errors and converts them to JSON responses
 */
export function withJsonErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<Response | NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      const response = await handler(...args);
      
      // If response is already a NextResponse, return it
      if (response instanceof NextResponse) {
        return response;
      }
      
      // If response is a regular Response, convert to NextResponse
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
      }
      
      // If it's HTML (error page), return JSON error instead
      if (contentType && contentType.includes('text/html')) {
        console.error('[API Error Handler] Received HTML response instead of JSON');
        return NextResponse.json(
          { error: 'Internal server error', message: 'Unexpected response format' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: 'Unknown response format' },
        { status: 500 }
      );
    } catch (error: any) {
      console.error('[API Error Handler] Unhandled error:', error);
      
      // Handle Next.js redirects
      if (error.message === 'NEXT_REDIRECT') {
        return NextResponse.json(
          { error: 'Authentication required', message: 'Please sign in' },
          { status: 401 }
        );
      }
      
      // Handle other errors
      return NextResponse.json(
        {
          error: error.message || 'Internal server error',
          message: 'An unexpected error occurred',
        },
        { status: error.statusCode || 500 }
      );
    }
  };
}

/**
 * Creates a standardized JSON error response
 */
export function createErrorResponse(
  error: string,
  statusCode: number = 500,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      error,
      ...(details && { details }),
    },
    { status: statusCode }
  );
}

/**
 * Validates that a response is JSON, throws error if not
 */
export async function ensureJsonResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type');
  
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    
    // If it's HTML (error page), throw a meaningful error
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      throw new Error('Server returned HTML error page instead of JSON. This usually means the API route encountered an error.');
    }
    
    throw new Error(`Expected JSON response, got ${contentType}`);
  }
  
  return response.json();
}

