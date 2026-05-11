# Checkout System API Specification

## Base URL
`https://api.checkout.example.com/v1`

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### POST /checkout/initiate
Initiates the checkout process for a user's cart.

**Request:**
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
  "expiresAt": "timestamp",
  "paymentIntentId": "string"
}
```

### POST /checkout/process-payment
Processes payment for a checkout session.

**Request:**
```json
{
  "checkoutId": "string",
  "paymentMethodId": "string",
  "savePaymentMethod": "boolean"
}
```

**Response:**
```json
{
  "orderId": "string",
  "status": "success|failed",
  "transactionId": "string",
  "confirmationEmail": "string"
}
```

### POST /checkout/cancel
Cancels an active checkout session.

**Request:**
```json
{
  "checkoutId": "string",
  "reason": "string"
}
```

**Response:**
```json
{
  "status": "cancelled",
  "reservationReleased": "boolean"
}
```

### GET /checkout/{checkoutId}/status
Retrieves the status of a checkout session.

**Response:**
```json
{
  "checkoutId": "string",
  "status": "pending|processing|completed|failed|cancelled",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "items": [
    {
      "productId": "string",
      "quantity": "number",
      "price": "number"
    }
  ]
}
```

## Error Codes

- `INSUFFICIENT_INVENTORY`: Not enough stock available
- `RESERVATION_EXPIRED`: Checkout session has expired
- `PAYMENT_FAILED`: Payment processing failed
- `INVALID_ADDRESS`: Shipping address validation failed
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Rate Limits
- 100 requests per minute per user
- 10 checkout initiations per minute per user
