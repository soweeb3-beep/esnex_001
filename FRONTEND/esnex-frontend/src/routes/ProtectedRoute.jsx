import { Navigate } from "react-router-dom";
import { isLoggedIn, getRole } from "../utils/auth";

export default function ProtectedRoute({ children, role }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" />;
  }

  if (role && getRole() !== role) {
    return <Navigate to="/" />;
  }

  return children;
}