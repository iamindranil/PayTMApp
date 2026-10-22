import crypto from "crypto";

export const DEFAULT_WEBHOOK_SECRET = "whsec_test_secret_99a8b7c6d5e4f3a2b1c0";

export interface VerificationResult {
  isValid: boolean;
  statusCode?: number;
  error?: string;
  timestamp?: number;
}

export interface GeneratedSignature {
  timestamp: number;
  signature: string;
  header: string;
}

/**
 * Generates an industry-standard (Stripe/Razorpay style) HMAC-SHA256 signature
 * for a webhook payload.
 *
 * Signature format: `t=<timestamp>,v1=<hex_signature>`
 * Signed payload: `${timestamp}.${rawBody}`
 */
export function generateWebhookSignature(
  payload: string | Buffer | object,
  secret: string = DEFAULT_WEBHOOK_SECRET,
  timestamp: number = Math.floor(Date.now() / 1000)
): GeneratedSignature {
  const rawBody =
    typeof payload === "string"
      ? payload
      : Buffer.isBuffer(payload)
      ? payload.toString("utf8")
      : JSON.stringify(payload);

  const signedPayload = `${timestamp}.${rawBody}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  return {
    timestamp,
    signature,
    header: `t=${timestamp},v1=${signature}`,
  };
}

/**
 * Cryptographically verifies an incoming webhook request's HMAC-SHA256 signature
 * against timing attacks, payload tampering, and replay attacks.
 *
 * @param rawBody The unparsed, exact byte buffer of the HTTP request body
 * @param signatureHeader The value of `X-Webhook-Signature` header
 * @param secret The shared HMAC secret key
 * @param toleranceSeconds Maximum allowed clock skew / replay attack window (default: 300s / 5 mins)
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string | undefined,
  signatureHeader: string | string[] | undefined,
  secret: string = DEFAULT_WEBHOOK_SECRET,
  toleranceSeconds: number = 300
): VerificationResult {
  if (!signatureHeader || Array.isArray(signatureHeader) && signatureHeader.length === 0) {
    return {
      isValid: false,
      statusCode: 401,
      error: "Missing signature header (X-Webhook-Signature required)",
    };
  }

  const headerValue = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!headerValue || typeof headerValue !== "string") {
    return {
      isValid: false,
      statusCode: 401,
      error: "Invalid signature header format",
    };
  }

  // Parse header items: e.g. "t=1729621200,v1=5a89c3..."
  const parts = headerValue.split(",").map((p) => p.trim());
  let timestampStr: string | undefined;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t" && value) {
      timestampStr = value;
    } else if (key === "v1" && value) {
      signatures.push(value);
    }
  }

  if (!timestampStr) {
    return {
      isValid: false,
      statusCode: 401,
      error: "Invalid signature header: missing timestamp 't'",
    };
  }

  if (signatures.length === 0) {
    return {
      isValid: false,
      statusCode: 401,
      error: "Invalid signature header: missing signature 'v1'",
    };
  }

  const timestampNum = Number(timestampStr);
  if (isNaN(timestampNum) || timestampNum <= 0) {
    return {
      isValid: false,
      statusCode: 401,
      error: "Invalid signature header: timestamp 't' must be a valid epoch number",
    };
  }

  // Handle epoch in seconds vs milliseconds
  const eventTimeMs = timestampNum > 1e11 ? timestampNum : timestampNum * 1000;
  const nowMs = Date.now();
  const timeDifferenceMs = Math.abs(nowMs - eventTimeMs);
  const maxToleranceMs = toleranceSeconds * 1000;

  // Replay Attack Protection: Enforce tolerance window
  if (timeDifferenceMs > maxToleranceMs) {
    return {
      isValid: false,
      statusCode: 400,
      error: `Webhook timestamp expired or too far in the future (difference: ${Math.round(
        timeDifferenceMs / 1000
      )}s, max allowed: ${toleranceSeconds}s)`,
      timestamp: timestampNum,
    };
  }

  const bodyString =
    rawBody === undefined
      ? ""
      : Buffer.isBuffer(rawBody)
      ? rawBody.toString("utf8")
      : rawBody;

  // Recompute expected HMAC-SHA256 signature
  const signedPayload = `${timestampStr}.${bodyString}`;
  const expectedHash = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedHash, "hex");

  // Constant-time comparison against all provided v1 signatures (supports secret rotation)
  let signatureMatched = false;
  for (const sig of signatures) {
    const receivedBuffer = Buffer.from(sig, "hex");

    // timingSafeEqual requires buffers of identical byte length
    if (receivedBuffer.length === expectedBuffer.length) {
      if (
        crypto.timingSafeEqual(
          new Uint8Array(receivedBuffer),
          new Uint8Array(expectedBuffer)
        )
      ) {
        signatureMatched = true;
        break;
      }
    }
  }

  if (!signatureMatched) {
    return {
      isValid: false,
      statusCode: 401,
      error: "Invalid webhook signature (cryptographic HMAC-SHA256 mismatch)",
      timestamp: timestampNum,
    };
  }

  return {
    isValid: true,
    timestamp: timestampNum,
  };
}
