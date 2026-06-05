import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AUTH_UNAUTHORIZED_EVENT,
  type AuthUser,
  clearAuthToken,
  fetchMe,
  getAuthToken,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type RegisterInput,
  setAuthToken,
  updateMe as updateMeRequest,
} from "@/lib";

export type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  login: (input: RegisterInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  resolveUser: () => Promise<AuthUser | null>;
  updateProfile: (input: { name?: string | null }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState(() => getAuthToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const tokenRef = useRef(token);
  const userRef = useRef<AuthUser | null>(null);

  function updateSession(nextToken: string | null, nextUser: AuthUser | null) {
    tokenRef.current = nextToken;
    userRef.current = nextUser;
    setToken(nextToken);
    setUser(nextUser);

    if (nextToken) {
      setAuthToken(nextToken);
    } else {
      clearAuthToken();
    }
  }

  async function resolveUser() {
    const storedToken = getAuthToken();
    if (!storedToken) {
      updateSession(null, null);
      return null;
    }

    if (storedToken === tokenRef.current && userRef.current) {
      return userRef.current;
    }

    try {
      const nextUser = await fetchMe();
      updateSession(storedToken, nextUser);
      return nextUser;
    } catch {
      updateSession(null, null);
      return null;
    }
  }

  async function login(input: RegisterInput) {
    const session = await loginRequest(input);
    updateSession(session.token, session.user);
  }

  async function register(input: RegisterInput) {
    const session = await registerRequest(input);
    updateSession(session.token, session.user);
  }

  async function logout() {
    try {
      await logoutRequest();
    } finally {
      updateSession(null, null);
    }
  }

  async function updateProfile(input: { name?: string | null }) {
    const nextUser = await updateMeRequest(input);
    updateSession(tokenRef.current, nextUser);
  }

  useEffect(() => {
    function onUnauthorized() {
      updateSession(null, null);
      window.location.assign("/login");
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () =>
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        login,
        register,
        logout,
        resolveUser,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return auth;
}
