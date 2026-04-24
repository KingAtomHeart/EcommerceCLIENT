import { Navigate } from 'react-router-dom';

// Order history now lives under the Profile page. Keep this route as a legacy redirect.
export default function OrderHistory() {
  return <Navigate to="/profile" replace />;
}
