import { useRoutes, Navigate } from 'react-router-dom';
import General from '@/view/General';

export default function AppRoutes() {
  return useRoutes([
    { path: '/', element: <Navigate to="/config" replace /> },
    { path: '/config', element: <General /> },
    { path: '*', element: <Navigate to="/config" replace /> },
  ]);
}

export const menuItems = [{ key: '/config', label: 'Control Center' }];
