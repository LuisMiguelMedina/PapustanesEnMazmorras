import { FC, useState } from 'react';

export const getDonationPagePath = (): string => {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${base}/donar`;
};

export const getDonationShareUrl = (): string =>
  `${window.location.origin}${getDonationPagePath()}`;

export interface DonationCopyLinkButtonProps {
  className?: string;
}

export const DonationCopyLinkButton: FC<DonationCopyLinkButtonProps> = ({ className }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getDonationShareUrl()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleCopyLink}
      title="Copiar enlace de apoyo al portapapeles"
    >
      <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
      <span>{copied ? '¡Enlace copiado!' : 'Copiar enlace'}</span>
    </button>
  );
};
