import { createContext, useContext, useState, useEffect } from "react";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAuthFromStorage = () => {
    const token = sessionStorage.getItem("token");
    const role = sessionStorage.getItem("role");
    const name = sessionStorage.getItem("name");
    const email = sessionStorage.getItem("email");
    const userId = sessionStorage.getItem("userId");

    if (token && role && name) {
      setUser({ token, role, name, email, userId });
    } else {
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAuthFromStorage();

    // Tabs are independent: do not listen for storage events or broadcast auth changes.
  }, []);

  const login = (data) => {
    setUser(data);
    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("role", data.role);
    sessionStorage.setItem("name", data.name);
    sessionStorage.setItem("email", data.email || "");
    sessionStorage.setItem("userId", data.userId || "");
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('name');
    sessionStorage.removeItem('email');
    sessionStorage.removeItem('userId');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);