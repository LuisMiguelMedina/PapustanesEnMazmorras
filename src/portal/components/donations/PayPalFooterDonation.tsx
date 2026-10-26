import { FC, useState, useEffect, useRef, MouseEvent } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import './PayPalFooterDonation.scss';

export interface PayPalFooterDonationProps {
  communityName?: string;
  label?: string;
  sublabel?: string;
  suggestedAmount?: string;
  minAmount?: number;
  hideKofi?: boolean;
}

// Obfuscated official Ko-fi target (secondary/fallback channel)
const OBFUSCATED_KOFI_TARGET = 'aHR0cHM6Ly9rby1maS5jb20vbHVpc21lZGluYTQ3ODcx';

const getTargetKofiUrl = (): string => {
  try {
    return atob(OBFUSCATED_KOFI_TARGET);
  } catch {
    return 'https://ko-fi.com';
  }
};

const DEFAULT_PAYPAL_CLIENT_ID =
  'BAA-aiHBfRBEkWGGh8umZAuwjJwpsUA104wjv6EJFoaDieVF93wwOrNXdSZjvP__hya21sARA2sWhVjUHg';
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || DEFAULT_PAYPAL_CLIENT_ID;

/**
 * Español (México): etiquetas, código postal y prefijo +52 en tarjeta de débito/crédito.
 * El script del SDK exige locale con guion bajo (es_MX); la Orders API usa BCP-47 (es-MX).
 */
const PAYPAL_SDK_LOCALE = 'es_MX';
const PAYPAL_ORDER_LOCALE = 'es-MX';
const PAYPAL_CARD_FORM_MIN_HEIGHT_PX = 110;

const isCardFundingSource = (fundingSource: unknown): boolean => {
  const value = String(fundingSource ?? '').toLowerCase();
  return value === 'card' || value === 'credit';
};

const buildPayPalScriptOptions = () => {
  const options: {
    clientId: string;
    currency: string;
    intent: string;
    locale: string;
    buyerCountry?: string;
  } = {
    clientId: PAYPAL_CLIENT_ID,
    currency: 'MXN',
    intent: 'capture',
    locale: PAYPAL_SDK_LOCALE,
  };
  // PayPal solo permite buyer-country en sandbox; ayuda a probar CP y móvil MX en local.
  if (import.meta.env.DEV) {
    options.buyerCountry = 'MX';
  }
  return options;
};

export const PayPalFooterDonation: FC<PayPalFooterDonationProps> = ({
  communityName = 'Papustanes en Mazmorras',
  label = 'Invitar un Café',
  sublabel = 'Apoya el servidor Foundry VTT & mantenimiento de la página',
  suggestedAmount = '$20 MXN',
  minAmount = 20,
  hideKofi = true,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [coverPaypalFee, setCoverPaypalFee] = useState<boolean>(false);

  // Success state after PayPal capture
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [payerName, setPayerName] = useState<string>('Aventurero');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Initialize selected amount from prop or minAmount
  const initialBase = parseFloat(suggestedAmount.replace(/[^0-9.]/g, '')) || minAmount;
  const [selectedAmount, setSelectedAmount] = useState<number>(initialBase);
  const [customAmountText, setCustomAmountText] = useState<string>('');
  const [isCardCheckoutActive, setIsCardCheckoutActive] = useState<boolean>(false);
  const paypalEmbedRef = useRef<HTMLDivElement>(null);

  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const cleanAliasPath = `${base}/donar`;
  const presets = [20, 50, 100, 200];

  // Base amount calculation (minimum minAmount)
  const baseAmountNum = selectedAmount > 0 ? selectedAmount : minAmount;
  const isBelowMin = selectedAmount > 0 && selectedAmount < minAmount;

  // Estimated PayPal Mexico fee: ~3.95% + $4.00 MXN fixed
  const estimatedFee = Math.round((baseAmountNum * 0.0395 + 4.0) * 100) / 100;
  const totalWithFee = Math.round((baseAmountNum + estimatedFee) * 100) / 100;

  // Final amount to pass to PayPal
  const finalAmount = coverPaypalFee ? totalWithFee : baseAmountNum;

  // Lock body scroll while modal is active
  useEffect(() => {
    if (!isModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isModalOpen]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Formulario de tarjeta: fondo claro + color-scheme light (texto PayPal legible).
  useEffect(() => {
    if (!isModalOpen) {
      setIsCardCheckoutActive(false);
      return;
    }
    const root = document.documentElement;
    if (isCardCheckoutActive) {
      root.classList.add('paypal-donate-card-flow');
    } else {
      root.classList.remove('paypal-donate-card-flow');
    }
    return () => root.classList.remove('paypal-donate-card-flow');
  }, [isModalOpen, isCardCheckoutActive]);

  useEffect(() => {
    const node = paypalEmbedRef.current;
    if (!isModalOpen || !node) return;

    const syncExpanded = () => {
      if (node.offsetHeight >= PAYPAL_CARD_FORM_MIN_HEIGHT_PX) {
        setIsCardCheckoutActive(true);
      }
    };

    syncExpanded();
    const observer = new ResizeObserver(syncExpanded);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isModalOpen, finalAmount]);

  const handleOpenKofi = (e?: MouseEvent) => {
    if (e) e.preventDefault();
    window.open(getTargetKofiUrl(), '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}${cleanAliasPath}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handlePresetClick = (val: number) => {
    setSelectedAmount(val);
    setCustomAmountText('');
    setPaymentError(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setCustomAmountText(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed)) {
      setSelectedAmount(parsed);
    } else {
      setSelectedAmount(0);
    }
    setPaymentError(null);
  };

  const resetModalState = () => {
    setIsSuccess(false);
    setPaymentError(null);
    setIsCardCheckoutActive(false);
    setIsModalOpen(false);
  };

  return (
    <div className="paypal-footer-donation-wrapper">
      {/* Footer Interactive Trigger Button */}
      <button
        type="button"
        className="btn-paypal-fantasy-trigger"
        onClick={() => {
          setIsSuccess(false);
          setPaymentError(null);
          setIsModalOpen(true);
        }}
        title={`Invitar un café para apoyar a ${communityName} y su servidor`}
        aria-haspopup="dialog"
        aria-expanded={isModalOpen}
      >
        <span className="paypal-icon-badge">
          <i className="fas fa-mug-hot" />
        </span>
        <div className="paypal-label-stack">
          <span className="paypal-primary-text">{label}</span>
          <span className="paypal-subtext">{sublabel}</span>
        </div>
      </button>

      {/* Medieval Fantasy Informative Modal */}
      {isModalOpen && (
        <div
          className={`paypal-modal-backdrop${isCardCheckoutActive ? ' is-paypal-card-checkout' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="paypal-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) resetModalState();
          }}
        >
          <div className="paypal-modal-card animate__animated animate__fadeInUp">
            {/* Pinned Modal Header Banner */}
            <div className="modal-header-banner">
              <div className="banner-emblem">
                <i className="fas fa-mug-hot" />
              </div>
              <div className="banner-titles">
                <span className="banner-kicker">APOYO COMUNITARIO</span>
                <h4 id="paypal-modal-title" className="banner-main-title">
                  {communityName}
                </h4>
              </div>
              <button
                type="button"
                className="btn-modal-dismiss"
                onClick={resetModalState}
                title="Cerrar ventana (Esc)"
              >
                <i className="fas fa-times" />
              </button>
            </div>

            {/* If Payment Succeeded */}
            {isSuccess ? (
              <div className="payment-success-card animate__animated animate__zoomIn">
                <div className="success-emblem">
                  <i className="fas fa-mug-hot" />
                </div>
                <h4 className="success-title">¡Café Recibido con Honor!</h4>
                <p className="success-desc">
                  Muchas gracias, <strong>{payerName}</strong>. Tu aportación de{' '}
                  <span className="success-amount-badge">${finalAmount.toFixed(2)} MXN</span> ha
                  sido procesada exitosamente como soporte digital para el servidor Foundry VTT y
                  el mantenimiento de la página.
                </p>
                <button
                  type="button"
                  className="btn-success-close"
                  onClick={resetModalState}
                >
                  <i className="fas fa-dungeon me-2" />
                  Volver a {communityName}
                </button>
              </div>
            ) : (
              /* Unified Scrollable Modal Body */
              <div
                className={`modal-body-content${isCardCheckoutActive ? ' is-paypal-card-checkout' : ''}`}
              >
                <p className="lead-paragraph">
                  Tus cafés sostienen la infraestructura del servidor en la nube de{' '}
                  <strong>Foundry VTT</strong>, el almacenamiento de fichas y el{' '}
                  <strong>mantenimiento de la página</strong>.
                </p>

                {/* Commission & Processor Recommendation Notice */}
                <div className="processor-tip-box">
                  <div className="tip-icon">
                    <i className="fas fa-mug-hot" />
                  </div>
                  <div className="tip-text">
                    <span className="tip-heading">Apoyo Digital Directo vía PayPal</span>
                    <p>
                      Puedes invitar desde 1 café (mínimo de <strong>${minAmount} MXN</strong>).
                      El pago se procesa al instante como contenido y soporte digital con saldo de{' '}
                      <strong>PayPal</strong> o directamente con tu{' '}
                      <strong>tarjeta de débito/crédito</strong>.
                    </p>
                  </div>
                </div>

                {paymentError && (
                  <div className="payment-error-alert animate__animated animate__shakeX">
                    <i className="fas fa-exclamation-triangle" />
                    <span>{paymentError}</span>
                  </div>
                )}

                {/* Amount Selector Section */}
                <div className="donation-amount-section">
                  <div className="amount-section-header">
                    <span className="amount-section-label">
                      <i className="fas fa-coins me-1" />
                      Monto de tu café / apoyo:
                    </span>
                    <span className="amount-min-badge">
                      Desde ${minAmount} MXN (1 café)
                    </span>
                  </div>

                  <div className="amount-chips-grid">
                    {presets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`amount-chip-btn ${selectedAmount === preset && !customAmountText ? 'active' : ''}`}
                        onClick={() => handlePresetClick(preset)}
                      >
                        ${preset} MXN
                      </button>
                    ))}
                  </div>

                  <div className="custom-amount-wrapper">
                    <span className="currency-prefix">$</span>
                    <input
                      type="number"
                      min={minAmount}
                      step={5}
                      value={customAmountText}
                      onChange={handleCustomChange}
                      placeholder={`Otro monto libre (ej. ${minAmount})`}
                      className="custom-amount-input"
                    />
                    <span className="currency-suffix">MXN</span>
                  </div>

                  {isBelowMin && (
                    <div className="amount-warning-text">
                      <i className="fas fa-info-circle me-1" />
                      El monto mínimo sugerido para cubrir procesadores bancarios es de ${minAmount} MXN.
                    </div>
                  )}
                </div>

                {/* PayPal Fee Support Option (Checkbox) */}
                <div className={`paypal-fee-support-row ${coverPaypalFee ? 'is-active' : ''}`}>
                  <label className="checkbox-fee-container">
                    <input
                      type="checkbox"
                      className="fantasy-fee-checkbox"
                      checked={coverPaypalFee}
                      onChange={(e) => {
                        setCoverPaypalFee(e.target.checked);
                        setPaymentError(null);
                      }}
                    />
                    <span className="checkbox-text-main">
                      Apóyame cubriendo la comisión de PayPal
                    </span>
                    {coverPaypalFee && (
                      <span className="fee-addon-inline-tag animate__animated animate__fadeIn">
                        <i className="fas fa-plus-circle me-1" />
                        Incluyendo comisión (+${estimatedFee.toFixed(2)} MXN) | Total: ${totalWithFee.toFixed(2)} MXN
                      </span>
                    )}
                  </label>
                </div>

                {/* Live PayPal Buttons (Expands smoothly in scrollable container) */}
                <div
                  ref={paypalEmbedRef}
                  className={`paypal-button-embed-wrapper${isCardCheckoutActive ? ' is-card-checkout-expanded' : ''}`}
                >
                  <PayPalScriptProvider options={buildPayPalScriptOptions()}>
                    <PayPalButtons
                      style={{
                        layout: 'vertical',
                        color: 'gold',
                        shape: 'rect',
                        label: 'pay',
                        height: 44,
                        tagline: false,
                      }}
                      forceReRender={[finalAmount]}
                      onClick={(data, actions) => {
                        if (isCardFundingSource(data.fundingSource)) {
                          setIsCardCheckoutActive(true);
                        }
                        return actions.resolve();
                      }}
                      createOrder={(_data, actions) => {
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
                                value: finalAmount.toFixed(2),
                                breakdown: {
                                  item_total: {
                                    currency_code: 'MXN',
                                    value: finalAmount.toFixed(2),
                                  },
                                },
                              },
                              items: [
                                {
                                  name: `Invitar un café (Soporte digital ${communityName})`,
                                  description: 'Soporte para Foundry VTT y mantenimiento de la página',
                                  unit_amount: {
                                    currency_code: 'MXN',
                                    value: finalAmount.toFixed(2),
                                  },
                                  quantity: '1',
                                  category: 'DIGITAL_GOODS',
                                },
                              ],
                            },
                          ],
                        });
                      }}
                      onApprove={async (_data, actions) => {
                        try {
                          if (!actions.order) return;
                          const details = await actions.order.capture();
                          const donorName =
                            details.payer?.name?.given_name ||
                            details.payer?.name?.surname ||
                            'Aventurero';
                          setPayerName(donorName);
                          setIsSuccess(true);
                        } catch (err) {
                          console.error('Capture error:', err);
                          setPaymentError('No se pudo completar el cobro. Por favor verifica tu cuenta.');
                        }
                      }}
                      onError={(err) => {
                        console.error('PayPal Buttons error:', err);
                        setPaymentError('Hubo un inconveniente al cargar PayPal. Revisa tu conexión.');
                      }}
                      onCancel={() => {
                        setIsCardCheckoutActive(false);
                        setPaymentError('Operación cancelada por el usuario.');
                      }}
                    />
                  </PayPalScriptProvider>
                </div>

                {/* Secondary Actions */}
                <div className="modal-secondary-actions">
                  <button
                    type="button"
                    className="btn-paypal-copy-link"
                    onClick={handleCopyLink}
                    title="Copiar enlace de apoyo al portapapeles"
                  >
                    <i className={`fas ${copied ? 'fa-check text-success' : 'fa-copy'} me-1`} />
                    <span>{copied ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
                  </button>

                  {!hideKofi && (
                    <a
                      href={cleanAliasPath}
                      onClick={handleOpenKofi}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-paypal-secondary-link hide"
                      hidden={hideKofi}
                      title="Colaborar alternativamente a través de Ko-fi"
                    >
                      <i className="fas fa-mug-hot me-1" />
                      <span>O colaborar vía Ko-fi</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Backward compatibility alias
export { PayPalFooterDonation as KofiFooterDonation };
