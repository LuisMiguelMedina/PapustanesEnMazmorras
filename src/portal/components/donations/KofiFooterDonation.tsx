import { FC, useState, useEffect } from 'react';
import './KofiFooterDonation.scss';

export interface KofiFooterDonationProps {
  username?: string;
  label?: string;
  sublabel?: string;
  suggestedAmount?: string;
}

export const KofiFooterDonation: FC<KofiFooterDonationProps> = ({
  username = 'papustanes',
  label = 'Invitar un Café',
  sublabel = 'Apoya el servidor Foundry VTT & las crónicas',
  suggestedAmount = '$50 MXN',
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const kofiUrl = `https://ko-fi.com/${username}`;

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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(kofiUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
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
                  <strong>Donaciones Seguras y Transparentes</strong>
                  <p>
                    Puedes colaborar al instante con <strong>Apple Pay</strong>,{' '}
                    <strong>Google Pay</strong> o tarjeta mediante <strong>Stripe</strong>. Para
                    diluir la tarifa fija por transacción bancaria, sugerimos una aportación mínima
                    de <strong>{suggestedAmount}</strong> (o ~$3 USD).
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="modal-action-buttons">
                <a
                  href={kofiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-kofi-primary-action"
                >
                  <i className="fas fa-heart me-2" />
                  <span>Donar en Ko-fi ({username})</span>
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
            </div>

            {/* Modal Footer Note */}
            <div className="modal-footer-caption">
              <span>
                <i className="fas fa-coffee me-1 text-warning" />
                No se requiere crear cuenta obligatoria para apoyar. ¡Gracias por mantener vivas las
                aventuras!
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
