import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface FrontendUser {
  id: string;
  name: string;
  mobile: string;
  position: string | null;
  department: string | null;
  organization: string | null;
  security_level: string;
}

export const useFrontendAuth = () => {
  const [user, setUser] = useState<FrontendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem("frontendUser");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("frontendUser");
      }
    }
    setLoading(false);
  }, []);

  const logout = () => {
    localStorage.removeItem("frontendUser");
    setUser(null);
    navigate("/login");
  };

  const requireAuth = () => {
    if (!loading && !user) {
      navigate("/login");
    }
  };

  return { user, loading, logout, requireAuth };
};
