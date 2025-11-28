# Mobile App Setup Guide

This guide provides instructions for setting up and integrating with the SAKAN mobile API.

## Prerequisites

1. Node.js 18+ installed
2. Mobile development environment set up:
   - For React Native: React Native CLI or Expo
   - For Flutter: Flutter SDK
3. Access to the SAKAN web application API endpoints

## API Base URL

```
Production: https://your-domain.com/api/mobile
Development: http://localhost:3000/api/mobile
```

## Authentication

The mobile app needs to authenticate using NextAuth. You have two options:

### Option 1: Use NextAuth with Cookies (Recommended for Web Views)

If your mobile app uses WebView for authentication:
- User logs in via web view
- Session cookies are automatically handled
- Include cookies in all API requests

### Option 2: Implement Custom JWT Authentication (Recommended for Native Apps)

For better mobile app experience, you may want to:
1. Create a mobile-specific authentication endpoint that returns JWT tokens
2. Store tokens securely (Keychain on iOS, Keystore on Android)
3. Include tokens in Authorization header: `Bearer <token>`

**Note:** This requires additional implementation on the backend.

## API Client Setup

### React Native Example

```typescript
// api/client.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://your-domain.com/api/mobile';

class ApiClient {
  private async getAuthHeaders(): Promise<HeadersInit> {
    // Get session cookie or JWT token
    const token = await AsyncStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: await this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  }

  async uploadFile(endpoint: string, file: File, additionalData?: Record<string, any>): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        // Don't set Content-Type - let browser set it with boundary
        ...(await this.getAuthHeaders()),
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  }
}

export const apiClient = new ApiClient();
```

### Flutter Example

```dart
// lib/api/client.dart
import 'dart:io';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  static const String baseUrl = 'https://your-domain.com/api/mobile';
  
  Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }
  
  Future<Map<String, dynamic>> get(String endpoint) async {
    final response = await http.get(
      Uri.parse('$baseUrl$endpoint'),
      headers: await _getHeaders(),
    );
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return json.decode(response.body);
    }
    
    throw Exception('API Error: ${response.statusCode}');
  }
  
  Future<Map<String, dynamic>> post(String endpoint, Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl$endpoint'),
      headers: await _getHeaders(),
      body: json.encode(data),
    );
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return json.decode(response.body);
    }
    
    throw Exception('API Error: ${response.statusCode}');
  }
  
  Future<Map<String, dynamic>> uploadFile(
    String endpoint,
    File file,
    Map<String, String>? additionalData,
  ) async {
    var request = http.MultipartRequest('POST', Uri.parse('$baseUrl$endpoint'));
    
    request.files.add(await http.MultipartFile.fromPath('file', file.path));
    
    if (additionalData != null) {
      request.fields.addAll(additionalData);
    }
    
    final token = (await SharedPreferences.getInstance()).getString('auth_token');
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }
    
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return json.decode(response.body);
    }
    
    throw Exception('API Error: ${response.statusCode}');
  }
}
```

## Error Handling

All API responses follow this format:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

Example error handling:

```typescript
try {
  const response = await apiClient.get('/complaints');
  if (response.success) {
    // Use response.data
  } else {
    // Handle error: response.error
    console.error(response.error);
  }
} catch (error) {
  // Handle network or parsing errors
  console.error(error);
}
```

## File Uploads

For file uploads (images, documents), use `multipart/form-data`:

```typescript
// Upload incident photo
const file = {
  uri: 'path/to/image.jpg',
  type: 'image/jpeg',
  name: 'incident.jpg',
};

const result = await apiClient.uploadFile('/incidents/upload', file);
if (result.success) {
  const photoUrl = result.url;
  // Use photoUrl when creating incident
}
```

## Offline Support

Implement offline caching using local storage:

### React Native
- Use `@react-native-async-storage/async-storage` for simple data
- Use `react-native-sqlite-storage` or `realm` for complex data
- Queue mutations when offline, sync when online

### Flutter
- Use `shared_preferences` for simple data
- Use `sqflite` or `hive` for complex data
- Use `connectivity_plus` to detect network status

## Push Notifications

Set up push notifications using:
- **React Native**: `react-native-push-notification` or `@react-native-firebase/messaging`
- **Flutter**: `firebase_messaging`

Register device tokens with your backend to receive notifications for:
- New incidents
- New complaints
- Payment confirmations
- Fee due reminders
- Complaint status updates

## Testing

1. **Unit Tests**: Test API client and data transformation
2. **Integration Tests**: Test API endpoints with mock responses
3. **E2E Tests**: Test complete user flows
4. **Offline Tests**: Verify offline functionality

## Next Steps

1. Review the [Mobile API Documentation](MOBILE_API.md)
2. Set up your mobile project
3. Implement authentication
4. Create API client
5. Build UI components
6. Implement offline support
7. Set up push notifications

## Support

For API issues or questions, refer to:
- [Mobile API Documentation](MOBILE_API.md)
- [Mobile API Implementation Summary](MOBILE_API_IMPLEMENTATION_SUMMARY.md)

