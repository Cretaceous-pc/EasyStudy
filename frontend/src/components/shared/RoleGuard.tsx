import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  fallback?: string;
}

export default function RoleGuard({ children, allowedRoles, fallback = '/' }: RoleGuardProps) {
  const { userInfo, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const hasRole = userInfo?.roles.some((role) => allowedRoles.includes(role));

  if (!hasRole) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
