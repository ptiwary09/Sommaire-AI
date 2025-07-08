# Stripe Webhook Setup & Troubleshooting Guide

## Overview
This guide explains how to set up Stripe webhooks for your AI PDF summaries app and troubleshoot common issues.

## Environment Variables Setup

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in your environment variables:**
   - `DATABASE_URL`: Your Neon PostgreSQL connection string
   - `STRIPE_SECRET_KEY`: Your Stripe secret key (starts with `sk_`)
   - `STRIPE_WEBHOOK_SECRET`: Your webhook endpoint secret (starts with `whsec_`)

## Database Setup

1. **Run the schema in your Neon database:**
   ```sql
   -- Copy and run the contents of database/schema.sql in your Neon SQL editor
   ```

2. **Verify tables were created:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

## Stripe Webhook Configuration

1. **In your Stripe Dashboard:**
   - Go to Developers > Webhooks
   - Click "Add endpoint"
   - Set endpoint URL: `https://your-domain.com/api/payment`
   - Select events: `checkout.session.completed`

2. **Copy the webhook secret:**
   - After creating the webhook, click on it
   - Copy the "Signing secret" (starts with `whsec_`)
   - Add it to your `.env.local` as `STRIPE_WEBHOOK_SECRET`

## Testing the Webhook

1. **Use Stripe CLI for local testing:**
   ```bash
   # Install Stripe CLI
   brew install stripe/stripe-cli/stripe

   # Login to Stripe
   stripe login

   # Forward events to your local server
   stripe listen --forward-to localhost:3000/api/payment
   ```

2. **Trigger a test event:**
   ```bash
   stripe trigger checkout.session.completed
   ```

## Common Issues & Solutions

### Issue 1: Webhook returns 200 but no data in database

**Symptoms:**
- Stripe shows successful webhook delivery (200 status)
- No data appears in `users` or `payments` tables
- PDF summaries table works fine

**Possible Causes:**
1. **Missing environment variables**
2. **Database connection issues**
3. **Silent errors in payment processing**

**Solutions:**

1. **Check your environment variables:**
   ```bash
   # Verify all required variables are set
   echo $DATABASE_URL
   echo $STRIPE_SECRET_KEY
   echo $STRIPE_WEBHOOK_SECRET
   ```

2. **Check the application logs:**
   ```bash
   # In development
   npm run dev

   # Look for these log messages:
   # ✅ Database connection established
   # 🔔 Webhook received!
   # ✅ Webhook signature verified
   # 💰 Payment details: ...
   # ✅ User created/updated successfully
   # ✅ Payment created successfully
   ```

3. **Test database connection manually:**
   ```sql
   -- Test query in Neon console
   SELECT * FROM users LIMIT 5;
   SELECT * FROM payments LIMIT 5;
   ```

### Issue 2: Database connection errors

**Error:** `Database connection failed`

**Solutions:**
1. Verify your `DATABASE_URL` format:
   ```
   postgresql://username:password@hostname/database?sslmode=require
   ```

2. Check Neon database status in your dashboard

3. Ensure your IP is allowed (Neon should allow all by default)

### Issue 3: Webhook signature verification fails

**Error:** `Webhook signature verification failed`

**Solutions:**
1. Verify your `STRIPE_WEBHOOK_SECRET` is correct
2. Make sure you're using the endpoint-specific secret, not the account-level secret
3. Check that the webhook URL matches exactly

### Issue 4: Customer or line items not found

**Error:** `No customer ID found in session` or `No price ID found`

**Solutions:**
1. Ensure your Stripe Checkout session includes:
   ```javascript
   const session = await stripe.checkout.sessions.create({
     customer_email: "customer@example.com", // or use existing customer
     line_items: [{
       price: 'price_12345', // Your price ID
       quantity: 1,
     }],
     mode: 'payment',
     success_url: 'https://your-domain.com/success',
     cancel_url: 'https://your-domain.com/cancel',
   });
   ```

## Debugging Steps

1. **Enable verbose logging:**
   - The webhook already includes detailed console.log statements
   - Check your application logs during webhook processing

2. **Use Stripe CLI to inspect webhooks:**
   ```bash
   stripe events list --limit 10
   stripe events retrieve evt_1234567890
   ```

3. **Check webhook delivery attempts:**
   - In Stripe Dashboard > Webhooks
   - Click on your webhook endpoint
   - View the "Recent deliveries" tab

4. **Test with curl:**
   ```bash
   # Test if your endpoint is reachable
   curl -X POST https://your-domain.com/api/payment \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

## Success Indicators

When everything is working correctly, you should see:

1. **In your application logs:**
   ```
   🔔 Webhook received!
   ✅ Webhook signature verified
   📨 Event type: checkout.session.completed
   🛒 Processing checkout session: cs_xxx
   💰 Payment details: ...
   👤 Creating/updating user: user@example.com
   ✅ User created successfully: user@example.com
   💰 Creating payment record for session: cs_xxx
   ✅ Payment created successfully: cs_xxx
   ✅ Checkout session processed successfully
   ```

2. **In your Neon database:**
   ```sql
   -- Should show new records
   SELECT * FROM users ORDER BY created_at DESC LIMIT 5;
   SELECT * FROM payments ORDER BY created_at DESC LIMIT 5;
   ```

3. **In Stripe Dashboard:**
   - Webhook delivery shows 200 status
   - Response body shows: `{"status":"success","received":true,"eventType":"checkout.session.completed"}`

## Need Help?

If you're still experiencing issues:
1. Check the application logs carefully for error messages
2. Verify all environment variables are correctly set
3. Test the database connection independently
4. Use Stripe CLI to debug webhook events
5. Check Stripe Dashboard for webhook delivery status