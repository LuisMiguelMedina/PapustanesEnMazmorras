import { FC, useState, useEffect, MouseEvent } from 'react';
import './KofiFooterDonation.scss';

export interface KofiFooterDonationProps {
  label?: string;
  sublabel?: string;
  suggestedAmount?: string;
  minAmount?: number;
}

// Obfuscated official Ko-fi target (prevents exposing personal username in plaintext and to crawlers)
const OBFUSCATED_KOFI_TARGET = 'aHR0cHM6Ly9rby1maS5jb20vbHVpc21lZGluYTQ3ODcx';

const getTargetKofiUrl = (): string => {
  try {
    return atob(OBFUSCATED_KOFI_TARGET);
  } catch {
    return 'https://ko-fi.com';
  }
};

export const KofiFooterDonation: FC<KofiFooterDonationProps> = ({
  label = 'Invitar un Café',
  sublabel = 'Apoya el servidor Foundry VTT & las crónicas',
  suggestedAmount = '$20 MXN',
  minAmount = 20,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [coverPaypalFee, setCoverPaypalFee] = useState<boolean>(false);

  // Initialize selected amount from prop or minAmount
  const initialBase = parseFloat(suggestedAmount.replace(/[^0-9.]/g, '')) || minAmount;
  const [selectedAmount, setSelectedAmount] = useState<number>(initialBase);
  const [customAmountText, setCustomAmountText] = useState<string>('');

  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const cleanAliasPath = `${base}/donar`;
  const presets = [20, 50, 100, 200];

  // Base amount calculation (minimum minAmount)
  const baseAmountNum = selectedAmount > 0 ? selectedAmount : minAmount;
  const isBelowMin = selectedAmount > 0 && selectedAmount < minAmount;

  // Estimated PayPal Mexico fee: ~3.95% + $4.00 MXN fixed
  const estimatedFee = Math.round((baseAmountNum * 0.0395 + 4.0) * 100) / 100;
  const totalWithFee = Math.round((baseAmountNum + estimatedFee) * 100) / 100;

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
  };

  return (
    <div className="kofi-footer-donation-wrapper">
      {/* Footer Interactive Trigger Button */}
      <button
        type="button"
        className="btn-kofi-fantasy-trigger"
        onClick={() => setIsModalOpen(true)}
        title="Apoyar el proyecto y el servidor en Ko-fi"
        aria-haspopup="dialog"
        aria-expanded={isModalOpen}
      >
        <span className="kofi-icon-badge">
          <i className="fas fa-mug-hot" />
        </span>
        <div className="kofi-label-stack">
          <span className="kofi-primary-text">{label}</span>
          <span className="kofi-subtext">{sublabel}</span>
        </div>
      </button>

      {/* Medieval Fantasy Informative Modal */}
      {isModalOpen && (
        <div
          className="kofi-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kofi-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="kofi-modal-card animate__animated animate__fadeInUp">
            {/* Modal Header */}
            <div className="modal-header-banner">
              <div className="banner-emblem">
                <i className="fas fa-dice-d20" />
              </div>
              <div className="banner-titles">
                <span className="banner-kicker">MECENAZGO COMUNITARIO</span>
                <h4 id="kofi-modal-title" className="banner-main-title">
                  Papustanes en Mazmorras
                </h4>
              </div>
              <button
                type="button"
                className="btn-modal-dismiss"
                onClick={() => setIsModalOpen(false)}
                title="Cerrar ventana (Esc)"
              >
                <i className="fas fa-times" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body-content">
              <p className="lead-paragraph">
                Tus aportaciones sostienen la infraestructura del servidor en la nube de{' '}
                <strong>Foundry VTT</strong>, el almacenamiento de fichas y la documentación del
                lore en la <strong>Wiki del Multiverso</strong>.
              </p>

              {/* Commission & Processor Recommendation Notice */}
              <div className="processor-tip-box">
                <div className="tip-icon">
                  <i className="fas fa-shield-alt" />
                </div>
                <div className="tip-text">
                  <strong>Aportaciones Seguras y Sin Límites</strong>
                  <p>
                    Cualquier aportación es bien recibida (mínimo sugerido de <strong>${minAmount} MXN</strong>).
                    Puedes colaborar al instante con <strong>Apple Pay</strong>,{' '}
                    <strong>Google Pay</strong>, tarjeta o <strong>PayPal</strong> mediante <strong>Stripe</strong>.
                  </p>
                </div>
              </div>

              {/* Amount Selector Section */}
              <div className="donation-amount-section">
                <div className="amount-section-header">
                  <span className="amount-section-label">
                    <i className="fas fa-coins me-1" />
                    Monto de tu aportación:
                  </span>
                  <span className="amount-min-badge">
                    Desde ${minAmount} MXN (sin límite)
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
                    onChange={(e) => setCoverPaypalFee(e.target.checked)}
                  />
                  <span className="checkbox-text-main">
                    Apóyame pagando la comisión de PayPal
                  </span>
                  {coverPaypalFee && (
                    <span className="fee-addon-inline-tag animate__animated animate__fadeIn">
                      <i className="fas fa-plus-circle me-1" />
                      Incluyendo esta cantidad (+${estimatedFee.toFixed(2)} MXN) como adicional a lo que ibas a donar (Total sugerido: ${totalWithFee.toFixed(2)} MXN)
                    </span>
                  )}
                </label>
              </div>

              {/* Action Buttons */}
              <div className="modal-action-buttons">
                <a
                  href={cleanAliasPath}
                  onClick={handleOpenKofi}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-kofi-primary-action"
                  title="Abrir página oficial de donación en Ko-fi"
                >
                  <i className="fas fa-heart me-2" />
                  <span>
                    {coverPaypalFee
                      ? `Donar en Ko-fi ($${totalWithFee.toFixed(2)} MXN sugeridos)`
                      : `Donar en Ko-fi ($${baseAmountNum.toFixed(2)} MXN)`}
                  </span>
                  <i className="fas fa-external-link-alt ms-2 external-arrow" />
                </a>

                <button
                  type="button"
                  className="btn-kofi-copy-link"
                  onClick={handleCopyLink}
                  title="Copiar enlace de donación al portapapeles"
                >
                  <i className={`fas ${copied ? 'fa-check text-success' : 'fa-copy'} me-1`} />
                  <span>{copied ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
                </button>
              </div>

              {/* Direct link footer note */}
              <div className="modal-footer-direct-note">
                <span>Plataforma oficial: </span>
                <a
                  href={cleanAliasPath}
                  onClick={handleOpenKofi}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ko-fi.com (Papustanes en Mazmorras)
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
