import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AUDIT_ACTIONS, AUDIT_MODULES, logAudit } from "@/hooks/useAuditLog";

interface FrontendUser {
  id: string;
  name: string;
  mobile: string;
  position: string | null;
  department: string | null;
  organization: string | null;
  security_level: string;
}

interface LogoutOptions {
  reason?: string;
  redirectTo?: string;
}

const readStoredUser = (): FrontendUser | null => {
  const storedUser = localStorage.getItem("frontendUser");
  if (!storedUser) return null;

  try {
    return JSON.parse(storedUser) as FrontendUser;
  } catch {
    localStorage.removeItem("frontendUser");
    return null;
  }
};

export const useFrontendAuth = () => {
  const [user, setUser] = useState<FrontendUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setUser(readStoredUser());
    setLoading(false);
  }, []);

  const logout = async (options: LogoutOptions = {}) => {
    const reason = options.reason || "manual";
    const redirectTo = options.redirectTo || "/login";
    const currentUser = user || readStoredUser();

    if (currentUser?.id) {
      await logAudit({
        operator_id: currentUser.id,
        operator_name: currentUser.name,
        operator_role: "user",
        action: AUDIT_ACTIONS.LOGOUT,
        module: AUDIT_MODULES.AUTH,
        detail: { source: "frontend", reason },
      });
    }

    localStorage.removeItem("frontendUser");
    localStorage.removeItem("loginMethod");
    setUser(null);
    navigate(redirectTo);
  };

  const requireAuth = () => {
    if (!loading && !user) {
      navigate("/login");
    }
  };

  return { user, loading, logout, requireAuth };
};
