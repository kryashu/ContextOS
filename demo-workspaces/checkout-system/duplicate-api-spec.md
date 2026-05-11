# Checkout API Specification (Duplicate)

## Overview
This document provides the API specification for the checkout service endpoints.

## Base URL
`https://api.checkout.example.com/v1`

## Authentication
Bearer token required for all requests.

## Endpoints

### POST /checkout/initiate
Start a new checkout session.

**Request Body:**
```json
{
  "userId": "string",
  "cartId": "string",
  "shippingAddress": {
    "street": "string",
    "city": "string",
    "state": "string",
    "zipCode": "string",
    "country": "string"
  }
}
```

**Response:**
```json
{
  "checkoutId": "string",
  "reservationId": "string",
  "total": "number",
  "expiresAt": "timestamp"
}
```

### POST /checkout/process-payment
Process payment for checkout session.

**Request Body:**
```json
{
  "checkoutId": "string",
  "paymentMethodId": "string"
}
```

**Response:**
```json
{
  "orderId": "string",
  "status": "success|failed",
  "transactionId": "string"
}
```

## Rate Limiting
- 100 requests per minute per user
- 10 checkout initiations per minute per user

## Error Handling
Standard HTTP status codes with JSON error responses.
