const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();

const paypalClientId = defineSecret('PAYPAL_CLIENT_ID');
const paypalClientSecret = defineSecret('PAYPAL_CLIENT_SECRET');

const PAYPAL_API = 'https://api-m.paypal.com';
const MIN_AMOUNT_MXN = 20;
const ORDER_LOCALE = 'es-MX';

const CORS_ORIGINS = [
  'https://luismiguelmedina.github.io',
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

/** @param {import('firebase-functions/v2/https').Request} req */
function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.rawBody === 'string' && req.rawBody.length > 0) {
    try {
      return JSON.parse(req.rawBody);
    } catch {
      return {};
    }
  }
  return {};
}

let tokenCache = { accessToken: null, expiresAtMs: 0 };

async function getPayPalAccessToken(clientId, clientSecret) {
  const now = Date.now();
  if (tokenCache.accessToken && now < tokenCache.expiresAtMs - 60_000) {
    return tokenCache.accessToken;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenRes = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`PayPal OAuth failed (${tokenRes.status}): ${body}`);
  }

  const tokenJson = await tokenRes.json();
  tokenCache = {
    accessToken: tokenJson.access_token,
    expiresAtMs: now + (tokenJson.expires_in || 3000) * 1000,
  };
  return tokenCache.accessToken;
}

function parseAmount(value) {
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(num) || num < MIN_AMOUNT_MXN) {
    return null;
  }
  return Math.round(num * 100) / 100;
}

const functionOptions = {
  region: 'us-central1',
  secrets: [paypalClientId, paypalClientSecret],
  invoker: 'public',
  cors: CORS_ORIGINS,
};

exports.createDonationOrder = onRequest(functionOptions, async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = readJsonBody(req);

  try {
    const amount = parseAmount(body.amount);
    const communityName =
      typeof body.communityName === 'string' && body.communityName.trim()
        ? body.communityName.trim().slice(0, 120)
        : 'Papustanes en Mazmorras';

    if (amount === null) {
      res.status(400).json({ error: `Monto inválido (mínimo ${MIN_AMOUNT_MXN} MXN)` });
      return;
    }

    const clientId = paypalClientId.value();
    const clientSecret = paypalClientSecret.value();
    const accessToken = await getPayPalAccessToken(clientId, clientSecret);
    const value = amount.toFixed(2);

    const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        application_context: {
          brand_name: communityName,
          locale: ORDER_LOCALE,
          landing_page: 'NO_PREFERENCE',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
        purchase_units: [
          {
            description: `Invitar un café - Apoyo a ${communityName}`,
            amount: {
              currency_code: 'MXN',
              value,
              breakdown: {
                item_total: { currency_code: 'MXN', value },
              },
            },
            items: [
              {
                name: `Invitar un café (${communityName})`,
                description: 'Soporte digital Foundry VTT y mantenimiento',
                unit_amount: { currency_code: 'MXN', value },
                quantity: '1',
                category: 'DIGITAL_GOODS',
              },
            ],
          },
        ],
      }),
    });

    const orderBody = await orderRes.json();
    if (!orderRes.ok) {
      res.status(orderRes.status).json(orderBody);
      return;
    }

    res.status(200).json({ id: orderBody.id });
  } catch (err) {
    console.error('createDonationOrder', err);
    res.status(500).json({ error: 'No se pudo crear la orden de PayPal' });
  }
});

exports.captureDonationOrder = onRequest(functionOptions, async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = readJsonBody(req);
  const orderID = body.orderID;
  if (!orderID || typeof orderID !== 'string') {
    res.status(400).json({ error: 'orderID requerido' });
    return;
  }

  try {
    const clientId = paypalClientId.value();
    const clientSecret = paypalClientSecret.value();
    const accessToken = await getPayPalAccessToken(clientId, clientSecret);

    const captureRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const captureBody = await captureRes.json();
    res.status(captureRes.status).json(captureBody);
  } catch (err) {
    console.error('captureDonationOrder', err);
    res.status(500).json({ error: 'No se pudo capturar el pago' });
  }
});
