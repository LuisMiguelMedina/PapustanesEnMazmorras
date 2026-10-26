import { FC, useState, useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { KofiFooterDonation } from '../components/donations/KofiFooterDonation';
import './SciFiLayout.scss';

const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const defaultFavicon = `${base}/favicon.png`;

export const SciFiLayout: FC = () => {
  const [brandLogo, setBrandLogo] = useState<string>(defaultFavicon);
  const [imgError, setImgError] = useState<boolean>(false);

  // Sync dynamic favicon from Firebase RTDB (best-effort, non-blocking)
  useEffect(() => {
    const faviconRef = ref(db, 'system/branding/favicon');
    const unsubscribe = onValue(
      faviconRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data && (data.base64 || data.url)) {
          const iconHref = data.base64 || data.url;
          setBrandLogo(iconHref);
          setImgError(false);
          const iconLinks = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
          iconLinks.forEach((link) => {
            link.href = iconHref;
          });
        }
      },
      () => {
        // Fallback silently to static default icons if offline
      },
    );

    return () => unsubscribe();
  }, []);

  return (
    <div className="scifi-portal-shell fantasy-theme">
      {/* Medieval Fantasy Top Navigation Bar */}
      <header className="scifi-topbar fantasy-topbar">
        <div className="topbar-inner">
          <Link to="/campaigns" className="brand-mark" title="Papustanes en Mazmorras">
            {!imgError ? (
              <img
                src={brandLogo}
                alt="Papustanes en Mazmorras"
                className="brand-torch-emblem"
                onError={() => setImgError(true)}
              />
            ) : (
              <i className="fas fa-dice-d20 brand-torch-emblem-fallback" />
            )}
            <span className="brand-title-main">PAPUSTANES EN MAZMORRAS</span>
          </Link>

          <div className="topbar-actions">
            <a
              href="http://practically-marine.tun.ply.gg:61342"
              target="_blank"
              rel="noreferrer"
              className="btn-vtt-quick"
              title="Abrir mesa virtual en el servidor Foundry VTT"
            >
              <i className="fas fa-dice-d20 vtt-fantasy-icon" />
              <span>Foundry VTT</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Viewport Stage */}
      <div className="scifi-main-stage">
        <Outlet />
      </div>

      {/* Medieval Fantasy Global Footer */}
      <footer className="scifi-footer fantasy-footer">
        <div className="footer-inner">
          <div className="footer-donation-block">
            <KofiFooterDonation
              username="papustanes"
              label="Invitar un Café"
              sublabel="Apoya el servidor & las crónicas"
              suggestedAmount="$20 MXN"
              minAmount={20}
            />
          </div>
          <div className="footer-bottom">
            <span>© 2020-2026 PAPUSTANES EN MAZMORRAS</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
