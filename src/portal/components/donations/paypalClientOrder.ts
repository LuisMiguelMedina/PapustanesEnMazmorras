import type { CreateOrderActions, OnApproveActions } from '@paypal/paypal-js';

const PAYPAL_ORDER_LOCALE = 'es-MX';

/** Respaldo si Cloud Functions aún no están desplegadas (evita CORS / 404). */
export function createClientPayPalOrder(
  actions: CreateOrderActions,
  finalAmount: number,
  communityName: string,
) {
  if (!actions.order) {
    throw new Error('PayPal order actions no disponibles');
  }
  const value = finalAmount.toFixed(2);
  return actions.order.create({
    intent: 'CAPTURE',
    application_context: {
      brand_name: communityName,
      locale: PAYPAL_ORDER_LOCALE,
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
            name: `Invitar un café (Soporte digital ${communityName})`,
            description: 'Soporte para Foundry VTT y mantenimiento de la página',
            unit_amount: { currency_code: 'MXN', value },
            quantity: '1',
            category: 'DIGITAL_GOODS',
          },
        ],
      },
    ],
  });
}

export async function captureClientPayPalOrder(actions: OnApproveActions) {
  if (!actions.order) {
    throw new Error('PayPal order actions no disponibles');
  }
  return actions.order.capture();
}
