import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDHwHfqzXgQRcQDOSrNPUSxXMZV_bpeV8g",
  authDomain: "team-scheduler-97c89.firebaseapp.com",
  projectId: "team-scheduler-97c89",
  storageBucket: "team-scheduler-97c89.firebasestorage.app",
  messagingSenderId: "473406109192",
  appId: "1:473406109192:web:af5868555ea935467d83bd"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
