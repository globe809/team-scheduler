import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid))
        setIsAdmin(adminDoc.exists() && adminDoc.data().isAdmin === true)
      } else {
        setUser(null)
        setIsAdmin(false)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const login = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      // Auto-set first user as admin
      const adminDoc = await getDoc(doc(db, 'admins', result.user.uid))
      if (!adminDoc.exists()) {
        const allAdmins = await getDoc(doc(db, 'meta', 'stats'))
        if (!allAdmins.exists()) {
          await setDoc(doc(db, 'admins', result.user.uid), { isAdmin: true })
          await setDoc(doc(db, 'meta', 'stats'), { initialized: true })
        }
      }
    } catch (err) {
      console.error('Login error:', err)
    }
  }

  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
