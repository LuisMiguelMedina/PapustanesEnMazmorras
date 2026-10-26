import { FC, StrictMode, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './portal/theme.scss';
import { AuthProvider } from './portal/auth';
import { ProtectedRoute } from './portal/ProtectedRoute';
import { Layout } from './portal/Layout';
import { SciFiLayout } from './portal/layouts/SciFiLayout';
import { Login } from './portal/Login';
import { Register } from './portal/pages/Register';
import { Dashboard } from './portal/pages/Dashboard';
import { Profile } from './portal/pages/Profile';
import { Logs } from './portal/pages/Logs';
import { Players } from './portal/pages/Players';
import { Anuncios } from './portal/pages/Anuncios';
import { Directorio } from './portal/pages/Directorio';
import { Misiones } from './portal/pages/Misiones';
import { Articulos } from './portal/pages/Articulos';
import { Settings } from './portal/pages/Settings';
import { CampaignHub } from './portal/pages/CampaignHub';
import { WikiArticleView } from './portal/pages/WikiArticleView';

// Obfuscated official fallback destination
const BACKUP_DONATION_TARGET_B64 = 'aHR0cHM6Ly9rby1maS5jb20vbHVpc21lZGluYTQ3ODcx';

// Clean redirect component that bridges /donar, /paypal and /kofi to destination
const DonationRedirect: FC = () => {
  useEffect(() => {
    try {
      window.location.replace(atob(BACKUP_DONATION_TARGET_B64));
    } catch {
      window.location.replace('https://ko-fi.com');
    }
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0c0a09',
        color: '#fde68a',
        fontFamily: "'Space Grotesk', -apple-system, sans-serif",
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <i className="fas fa-mug-hot fa-3x mb-3" style={{ color: '#f59e0b' }} />
      <h3
        style={{
          fontFamily: "'MedievalSharp', Georgia, serif",
          color: '#ffffff',
          marginBottom: '0.5rem',
        }}
      >
        Papustanes en Mazmorras
      </h3>
      <p style={{ color: '#cbd5e1' }}>Redirigiendo a la plataforma oficial de apoyo comunitario...</p>
    </div>
  );
};

// Multiverse of Madness — Sci-Fi Lore & Campaign Portal (Public) + ZRK Intranet (Auth-guarded).
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');
const router = createBrowserRouter(
  [
    {
      element: (
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      ),
      children: [
        // 1. Modern Sci-Fi Public Portal (Campañas, Wiki de Lore, Fandom Explorer)
        {
          element: <SciFiLayout />,
          children: [
            { index: true, element: <CampaignHub /> },
            { path: 'campaigns', element: <CampaignHub /> },
            { path: 'wiki', element: <Navigate to="/wiki/bttf" replace /> },
            { path: 'wiki/:campaignID', element: <WikiArticleView /> },
            { path: 'wiki/:campaignID/:articleSlug', element: <WikiArticleView /> },
          ],
        },

        // 2. Donation Alias Routes (obfuscates personal username behind clean /donar alias)
        { path: 'donar', element: <DonationRedirect /> },
        { path: 'paypal', element: <DonationRedirect /> },
        { path: 'kofi', element: <DonationRedirect /> },

        // 3. Auth routes
        { path: 'login', element: <Login /> },
        { path: 'register', element: <Register /> },

        // 4. ZRK Intranet Dashboard & Admin terminal (Auth-guarded)
        {
          element: <ProtectedRoute />,
          children: [
            {
              element: <Layout />,
              children: [
                { path: 'dashboard', element: <Dashboard /> },
                { path: 'profile', element: <Profile /> },
                { path: 'logs', element: <Logs /> },
                { path: 'monitoreo', element: <Players /> },
                { path: 'anuncios', element: <Anuncios /> },
                { path: 'directorio', element: <Directorio /> },
                { path: 'misiones', element: <Misiones /> },
                { path: 'articulos', element: <Articulos /> },
                { path: 'settings', element: <Settings /> },
              ],
            },
          ],
        },

        // 5. Fallback redirect to Home
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  basename ? { basename } : undefined,
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
