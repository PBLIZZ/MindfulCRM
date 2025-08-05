import { useAuth as useAuthContext } from "@/contexts/AuthContext.js";

export const useAuth = () => {
  return useAuthContext();
};
