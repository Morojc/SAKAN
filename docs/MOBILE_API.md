# Mobile API Documentation

This document describes the REST API endpoints available for the SAKAN mobile app.

## Base URL

All endpoints are prefixed with `/api/mobile/`

## Authentication

All endpoints require authentication via NextAuth session. Include the session cookie in requests.

## Response Format

All responses follow this format:

```json
{
  "success": true|false,
  "data": {...},  // Present when success is true
  "error": "Error message"  // Present when success is false
}
```

## Endpoints

### Dashboard

#### GET /api/mobile/dashboard

Get dashboard statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalResidents": 0,
    "cashOnHand": 0,
    "bankBalance": 0,
    "outstandingFees": 0,
    "openIncidents": 0,
    "recentAnnouncementsCount": 0,
    "todayPayments": 0,
    "monthlyPayments": 0,
    "fillRate": 100,
    "residentsChange": 0,
    "topResidents": [],
    "user": {...},
    "residence": {...}
  }
}
```

---

### Complaints

#### GET /api/mobile/complaints

Get all complaints (filtered by user role).

**Query Parameters:**
- `status` (optional): Filter by status (`submitted`, `reviewed`, `resolved`)
- `residence_id` (optional): Filter by residence ID

**Response:**
```json
{
  "success": true,
  "data": [...]
}
```

#### POST /api/mobile/complaints

Create a new complaint (residents only).

**Request Body:**
```json
{
  "complained_about_id": "string",
  "reason": "noise|trash|behavior|parking|pets|property_damage|other",
  "privacy": "private|anonymous",
  "title": "string",
  "description": "string",
  "residence_id": 1
}
```

#### GET /api/mobile/complaints/[id]

Get complaint details by ID.

#### PATCH /api/mobile/complaints/[id]

Update complaint status (syndics only).

**Request Body:**
```json
{
  "status": "submitted|reviewed|resolved",
  "resolution_notes": "string (optional)"
}
```

#### GET /api/mobile/complaints/residents?residence_id={id}

Get list of residents for complaint form (excludes current user).

#### POST /api/mobile/complaints/evidence

Upload complaint evidence file.

**Request:** `multipart/form-data`
- `file`: File (image, audio, or video)
- `maxSizeMB` (optional): Max file size in MB (default: 50)
- `complaint_id` (optional): If provided, automatically links evidence to complaint

**Response:**
```json
{
  "success": true,
  "url": "https://...",
  "fileName": "file.jpg",
  "fileType": "image|audio|video",
  "mimeType": "image/jpeg",
  "fileSize": 123456
}
```

#### GET /api/mobile/complaints/[id]/evidence

Get all evidence for a complaint (syndics only).

---

### Incidents

#### GET /api/mobile/incidents

Get all incidents (filtered by user role).

**Query Parameters:**
- `status` (optional): Filter by status (`open`, `in_progress`, `resolved`, `closed`)
- `residence_id` (optional): Filter by residence ID

#### POST /api/mobile/incidents

Create a new incident.

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "residence_id": 1,
  "photo_url": "string (optional)"
}
```

#### GET /api/mobile/incidents/[id]

Get incident details by ID.

#### PATCH /api/mobile/incidents/[id]

Update an incident.

**Request Body:**
```json
{
  "title": "string (optional)",
  "description": "string (optional)",
  "status": "open|in_progress|resolved|closed (optional, syndics only)",
  "assigned_to": "user_id|null (optional, syndics only)",
  "photo_url": "string (optional)"
}
```

#### DELETE /api/mobile/incidents/[id]

Delete an incident (syndics only).

#### POST /api/mobile/incidents/upload

Upload incident photo.

**Request:** `multipart/form-data`
- `file`: Image file (jpeg, png, jpg, webp)

**Response:**
```json
{
  "success": true,
  "url": "https://..."
}
```

#### GET /api/mobile/incidents/assignable-users?residence_id={id}

Get list of users (guards/syndics) who can be assigned to incidents (syndics only).

---

### Expenses

#### GET /api/mobile/expenses

Get all expenses.

**Query Parameters:**
- `category` (optional): Filter by category
- `start_date` (optional): Filter by start date (ISO format)
- `end_date` (optional): Filter by end date (ISO format)

#### POST /api/mobile/expenses

Create a new expense (syndics/guards only).

**Request Body:**
```json
{
  "description": "string",
  "category": "string",
  "amount": 100.50,
  "expense_date": "2025-01-01",
  "residence_id": 1,
  "attachment_url": "string (optional)"
}
```

#### PATCH /api/mobile/expenses/[id]

Update an expense (syndics/guards only).

#### DELETE /api/mobile/expenses/[id]

Delete an expense (syndics/guards only).

#### POST /api/mobile/expenses/upload

Upload expense attachment (receipt/document).

**Request:** `multipart/form-data`
- `file`: File (PDF or image)

**Response:**
```json
{
  "success": true,
  "url": "https://..."
}
```

---

### Payments

#### GET /api/mobile/payments

Get all payments (filtered by user role).

**Query Parameters:**
- `method` (optional): Filter by method (`cash`, `bank_transfer`, `card`, `check`)
- `status` (optional): Filter by status (`pending`, `verified`, `rejected`)
- `user_id` (optional): Filter by user ID (syndics only)

#### POST /api/mobile/payments

Create a new payment.

**Request Body:**
```json
{
  "userId": "string",
  "amount": 100.50,
  "method": "cash|bank_transfer|card|check",
  "feeId": 1,  // optional
  "residenceId": 1  // optional
}
```

#### GET /api/mobile/payments/balances?residence_id={id}

Get cash on hand and bank balance.

**Response:**
```json
{
  "success": true,
  "data": {
    "cashOnHand": 5000.00,
    "bankBalance": 10000.00
  }
}
```

#### GET /api/mobile/payments/residents?residence_id={id}

Get list of residents for payment entry.

---

### Fees

#### GET /api/mobile/fees

Get all fees (filtered by user role - residents see only their own).

**Query Parameters:**
- `user_id` (optional): Filter by user ID (syndics only)
- `status` (optional): Filter by status (`unpaid`, `paid`, `overdue`)

#### POST /api/mobile/fees

Create a new fee (syndics only).

**Request Body:**
```json
{
  "user_id": "string",
  "residence_id": 1,
  "title": "string",
  "amount": 100.50,
  "due_date": "2025-01-01",
  "status": "unpaid|paid|overdue (optional)"
}
```

#### PATCH /api/mobile/fees/[id]

Update a fee (syndics only).

#### DELETE /api/mobile/fees/[id]

Delete a fee (syndics only).

---

### Residents

#### GET /api/mobile/residents

Get all residents (syndics only).

**Query Parameters:**
- `search` (optional): Search by name, email, or apartment number
- `role` (optional): Filter by role (`resident`, `guard`, `all`)

#### POST /api/mobile/residents

Create a new resident (syndics only).

**Request Body:**
```json
{
  "full_name": "string",
  "email": "string",
  "phone_number": "string (optional)",
  "apartment_number": "string",
  "residence_id": 1,
  "role": "resident|guard (optional)"
}
```

#### PATCH /api/mobile/residents/[id]

Update a resident (syndics only).

#### DELETE /api/mobile/residents/[id]

Delete a resident (syndics only).

---

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": "Error message"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Only syndics can perform this action"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Notes

1. All dates should be in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)
2. All amounts are in numeric format (not strings)
3. File uploads use `multipart/form-data`
4. Role-based filtering is automatically applied based on the authenticated user's role
5. Residence ID is automatically resolved from the user's session when not provided

---

## Implementation Status

✅ Fully Implemented:
- Dashboard
- Complaints (basic CRUD)
- Incidents (full CRUD)
- Expenses (full CRUD)
- Payments (full CRUD)
- Fees (full CRUD)
- Residents (full CRUD)

⚠️ Partially Implemented:
- Complaint evidence upload (endpoints exist, but server actions need to be implemented)

---

## Mobile App Integration

The mobile app should:
1. Store authentication tokens/session cookies
2. Handle token refresh
3. Implement retry logic for failed requests
4. Cache responses for offline viewing
5. Queue mutations for sync when offline
6. Handle file uploads with progress tracking

