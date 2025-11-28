# Mobile API Implementation Summary

## Overview

This document summarizes the implementation of the REST API layer for the SAKAN mobile app. The API exposes server actions as REST endpoints that can be consumed by mobile applications (React Native, Flutter, etc.).

## Implementation Status

### ✅ Completed Endpoints

#### Dashboard
- ✅ `GET /api/mobile/dashboard` - Dashboard statistics

#### Complaints
- ✅ `GET /api/mobile/complaints` - List complaints
- ✅ `POST /api/mobile/complaints` - Create complaint
- ✅ `GET /api/mobile/complaints/[id]` - Get complaint details
- ✅ `PATCH /api/mobile/complaints/[id]` - Update complaint status
- ✅ `GET /api/mobile/complaints/residents` - Get residents for complaint form
- ⚠️ `POST /api/mobile/complaints/evidence` - Upload evidence (placeholder - requires server action)
- ⚠️ `GET /api/mobile/complaints/[id]/evidence` - Get evidence (placeholder - requires server action)

#### Incidents
- ✅ `GET /api/mobile/incidents` - List incidents
- ✅ `POST /api/mobile/incidents` - Create incident
- ✅ `GET /api/mobile/incidents/[id]` - Get incident details
- ✅ `PATCH /api/mobile/incidents/[id]` - Update incident
- ✅ `DELETE /api/mobile/incidents/[id]` - Delete incident
- ✅ `POST /api/mobile/incidents/upload` - Upload incident photo
- ✅ `GET /api/mobile/incidents/assignable-users` - Get assignable users

#### Expenses
- ✅ `GET /api/mobile/expenses` - List expenses
- ✅ `POST /api/mobile/expenses` - Create expense
- ✅ `PATCH /api/mobile/expenses/[id]` - Update expense
- ✅ `DELETE /api/mobile/expenses/[id]` - Delete expense
- ✅ `POST /api/mobile/expenses/upload` - Upload expense attachment

#### Payments
- ✅ `GET /api/mobile/payments` - List payments
- ✅ `POST /api/mobile/payments` - Create payment
- ✅ `GET /api/mobile/payments/balances` - Get balances
- ✅ `GET /api/mobile/payments/residents` - Get residents for payment

#### Fees
- ✅ `GET /api/mobile/fees` - List fees
- ✅ `POST /api/mobile/fees` - Create fee
- ✅ `PATCH /api/mobile/fees/[id]` - Update fee
- ✅ `DELETE /api/mobile/fees/[id]` - Delete fee

#### Residents
- ✅ `GET /api/mobile/residents` - List residents
- ✅ `POST /api/mobile/residents` - Create resident
- ✅ `PATCH /api/mobile/residents/[id]` - Update resident
- ✅ `DELETE /api/mobile/residents/[id]` - Delete resident

---

## File Structure

```
app/api/mobile/
├── dashboard/
│   └── route.ts
├── complaints/
│   ├── route.ts
│   ├── [id]/
│   │   ├── route.ts
│   │   └── evidence/
│   │       └── route.ts
│   ├── residents/
│   │   └── route.ts
│   └── evidence/
│       └── route.ts
├── incidents/
│   ├── route.ts
│   ├── [id]/
│   │   └── route.ts
│   ├── upload/
│   │   └── route.ts
│   └── assignable-users/
│       └── route.ts
├── expenses/
│   ├── route.ts
│   ├── [id]/
│   │   └── route.ts
│   └── upload/
│       └── route.ts
├── payments/
│   ├── route.ts
│   ├── balances/
│   │   └── route.ts
│   └── residents/
│       └── route.ts
├── fees/
│   ├── route.ts
│   └── [id]/
│       └── route.ts
└── residents/
    ├── route.ts
    └── [id]/
        └── route.ts
```

---

## Authentication

All endpoints require NextAuth session authentication. The mobile app must:
1. Authenticate via NextAuth
2. Include session cookies in API requests
3. Handle session expiration and refresh

**Note:** For mobile apps, you may need to implement a custom authentication flow (e.g., JWT tokens) instead of relying on cookies. This would require additional implementation.

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": "Error message"
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
- `501` - Not Implemented

---

## Role-Based Access Control

The API automatically applies role-based filtering:

- **Syndics**: Can view/manage all data in their residence
- **Residents**: Can only view/manage their own data
- **Guards**: Similar to syndics but with limited permissions

---

## Pending Implementations

### Complaint Evidence
The following endpoints are stubbed but require server action implementation:
- `POST /api/mobile/complaints/evidence`
- `GET /api/mobile/complaints/[id]/evidence`

These will be functional once the complaint evidence upload feature is fully implemented (from the previous plan).

---

## Next Steps for Mobile App Development

1. **Set Up Mobile Project**
   - Choose framework (React Native/Flutter)
   - Configure project structure
   - Set up navigation

2. **Implement Authentication**
   - Integrate with NextAuth or create mobile-specific auth flow
   - Handle token storage and refresh
   - Implement session management

3. **Create API Client**
   - Build API client wrapper
   - Implement request/response interceptors
   - Add retry logic
   - Handle offline scenarios

4. **Implement UI Components**
   - Dashboard screens
   - List/detail screens for each module
   - Forms for creating/editing
   - File upload components

5. **Implement Push Notifications**
   - Set up FCM/APNS
   - Create notification handlers
   - Implement notification badges

6. **Add Offline Support**
   - Implement local caching (SQLite/Realm)
   - Queue mutations for sync
   - Handle conflict resolution

---

## Testing Recommendations

1. **Unit Tests**: Test API client and data transformation
2. **Integration Tests**: Test API endpoints with mock data
3. **E2E Tests**: Test complete user flows
4. **Performance Tests**: Test with large datasets
5. **Offline Tests**: Test offline scenarios and sync

---

## API Documentation

Full API documentation is available in [`docs/MOBILE_API.md`](MOBILE_API.md).

---

## Notes

- All endpoints use the existing server actions, ensuring consistency with the web app
- Role-based access control is enforced at the API level
- File uploads are handled via `multipart/form-data`
- All responses are JSON
- Dates should be in ISO 8601 format
- Amounts are numeric (not strings)

