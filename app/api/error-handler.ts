import { NextResponse } from 'next/server';

/**
 * Global API Error Handler
 * Use this in API routes to ensure JSON responses
 */

export function handleApiError(error: any): NextResponse {
  console.error('[API Error Handler]', error);

  // Handle Next.js redirects
  if (error?.message === 'NEXT_REDIRECT' || error?.digest === 'NEXT_REDIRECT') {
    return NextResponse.json(
      { error: 'Authentication required', message: 'Please sign in' },
      { status: 401 }
    );
  }

  // Handle known error types
  if (error?.statusCode) {
    return NextResponse.json(
      {
        error: error.message || 'Request failed',
        ...(error.details && { details: error.details }),
      },
      { status: error.statusCode }
    );
  }

  // Handle authentication errors
  if (error?.message?.includes('not authenticated') || error?.message?.includes('Unauthorized')) {
    return NextResponse.json(
      { error: 'Authentication required', message: 'Please sign in' },
      { status: 401 }
    );
  }

  // Generic error
  return NextResponse.json(
    {
      error: 'Internal server error',
      message: error?.message || 'An unexpected error occurred',
    },
    { status: 500 }
  );
}

/**
 * Wraps an API route handler with error handling
 */
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<Response | NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      const response = await handler(...args);
      
      // If it's already a NextResponse, return it
      if (response instanceof NextResponse) {
        return response;
      }
      
      // Convert Response to NextResponse
      const contentType = response.headers.get('content-type');
      
      // If it's HTML, something went wrong
      if (contentType?.includes('text/html')) {
        console.error('[API Error Handler] Received HTML response');
        return NextResponse.json(
          { error: 'Invalid response format', message: 'Server returned HTML instead of JSON' },
          { status: 500 }
        );
      }
      
      // If it's JSON, parse and return
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
      }
      
      // For other types, return as-is but ensure it's a NextResponse
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error: any) {
      return handleApiError(error);
    }
  };
}

