# Legacy Checkout Flow (Deprecated)

**Note: This document describes the old checkout flow. Please refer to user-flow.figma.json for the current implementation.**

## Old Flow (Before March 2026)

### Step 1: Cart Review
User reviews items in cart on a single page with checkout button.

### Step 2: Combined Checkout Page
Single page with:
- Shipping address form
- Payment information
- Order summary

**Issue:** This approach had high abandonment rates (45%) due to form length.

### Step 3: Order Confirmation
Simple confirmation page.

## Problems with Old Flow
1. Single long form was overwhelming
2. No progress indication
3. Payment errors required re-entering all information
4. No guest checkout option
5. Inventory not reserved during checkout

## Migration to New Flow
The new flow (documented in user-flow.figma.json) addresses these issues by:
- Breaking checkout into multiple steps
- Adding progress indicators
- Implementing inventory reservation
- Supporting guest checkout
- Improving error handling

**Deprecation Date:** March 15, 2026
**Removal Date:** June 1, 2026
