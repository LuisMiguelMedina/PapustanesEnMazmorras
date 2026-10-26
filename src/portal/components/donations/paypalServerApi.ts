const DEFAULT_FUNCTIONS_BASE =
  'https://us-central1-multiverseofmadness21-fefd9.cloudfunctions.net';

function getApiBase(): string {
  const fromEnv = (import.meta.env.VITE_PAYPAL_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    '',
  );
  return fromEnv || DEFAULT_FUNCTIONS_BASE;
}

export async function createDonationOrderOnServer(params: {
  amount: number;
  communityName: string;
}): Promise<string> {
  const res = await fetch(`${getApiBase()}/createDonationOrder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: params.amount,
      communityName: params.communityName,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.error === 'string'
        ? data.error
        : 'No se pudo crear la orden de pago en el servidor';
    throw new Error(msg);
  }
  if (!data?.id || typeof data.id !== 'string') {
    throw new Error('Respuesta inválida al crear la orden');
  }
  return data.id;
}

export type PayPalCaptureResult = Record<string, unknown>;

export async function captureDonationOrderOnServer(orderID: string): Promise<PayPalCaptureResult> {
  const res = await fetch(`${getApiBase()}/captureDonationOrder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderID }),
  });

  const data = (await res.json().catch(() => ({}))) as PayPalCaptureResult & {
    details?: Array<{ issue?: string }>;
  };

  if (!res.ok) {
    const detailsList = Array.isArray(data.details) ? data.details : undefined;
    const firstIssue = detailsList?.[0]?.issue;
    const err = new Error('No se pudo completar el cobro') as Error & {
      paypalDetails?: typeof detailsList;
      httpStatus?: number;
    };
    err.paypalDetails = detailsList;
    err.httpStatus = res.status;
    if (firstIssue) {
      err.message = `PayPal: ${firstIssue}`;
    }
    throw err;
  }

  return data;
}
