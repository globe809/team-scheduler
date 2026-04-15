import { createContext, useContext } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // 認證暫時停用，所有人預設為管理者
  const value = {
    user: { displayName: '管理者', photoURL: null },
    isAdmin: true,
    loading: false,
    login: () => {},
    logout: () => {},
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
