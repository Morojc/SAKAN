/**
 * Client-side API utility
 * Handles fetch requests and ensures proper error handling
 * Prevents HTML error pages from breaking JSON parsing
 */

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Safe fetch wrapper that ensures JSON responses
 * Catches HTML error pages and converts them to proper error responses
 */
export async function safeFetch<T = any>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    // Check if response is OK
    if (!response.ok) {
      // Try to parse as JSON first
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Request failed',
          message: errorData.message,
        };
      }
      
      // If it's HTML (error page), return a proper error
      if (contentType && contentType.includes('text/html')) {
        console.error('[API Client] Received HTML error page:', url);
        return {
          success: false,
          error: 'Server error',
          message: 'The server returned an error page. Please try again later.',
        };
      }
      
      return {
        success: false,
        error: `HTTP ${response.status}`,
        message: response.statusText || 'Request failed',
      };
    }

    // Parse response
    const contentType = response.headers.get('content-type');
    
    // If it's HTML, something went wrong
    if (contentType && contentType.includes('text/html')) {
      const text = await response.text();
      
      // Check if it's an error page
      if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        console.error('[API Client] Received HTML instead of JSON:', url);
        return {
          success: false,
          error: 'Invalid response format',
          message: 'The server returned an HTML page instead of JSON. This usually indicates an error.',
        };
      }
    }
    
    // Try to parse as JSON
    try {
      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (jsonError) {
      // If JSON parsing fails, return error
      console.error('[API Client] Failed to parse JSON response:', jsonError);
      return {
        success: false,
        error: 'Invalid JSON response',
        message: 'The server response could not be parsed as JSON.',
      };
    }
  } catch (error: any) {
    console.error('[API Client] Fetch error:', error);
    
    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        success: false,
        error: 'Network error',
        message: 'Failed to connect to the server. Please check your internet connection.',
      };
    }
    
    // JSON parsing errors (HTML responses)
    if (error.message && error.message.includes('JSON')) {
      return {
        success: false,
        error: 'Invalid response',
        message: 'The server returned an unexpected response format.',
      };
    }
    
    return {
      success: false,
      error: error.message || 'Unknown error',
      message: 'An unexpected error occurred.',
    };
  }
}

/**
 * Fetch JSON with automatic error handling
 */
export async function fetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const result = await safeFetch<T>(url, options);
  
  if (!result.success || !result.data) {
    throw new Error(result.error || result.message || 'Request failed');
  }
  
  return result.data;
}

