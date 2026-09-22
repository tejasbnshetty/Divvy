import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebaseClient'
import type { UserProfile } from '../types/models'

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  /** Signs in anonymously (if not already signed in), sets a display name, and returns the uid. */
  joinAnonymously: (displayName: string) => Promise<string>
  /** Upgrades the current anonymous account to a permanent one, preserving uid and history. */
  upgradeToEmailAccount: (email: string, password: string) => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function ensureProfileDoc(user: User, displayName?: string): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as UserProfile
  }
  const profile = {
    displayName: displayName ?? user.displayName ?? 'Friend',
    avatarUrl: null,
    isAnonymous: user.isAnonymous,
    preferredCurrency: 'USD',
    createdAt: serverTimestamp(),
  }
  await setDoc(ref, profile)
  const created = await getDoc(ref)
  return { id: created.id, ...created.data() } as UserProfile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)
      if (nextUser) {
        const p = await ensureProfileDoc(nextUser)
        setProfile(p)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function joinAnonymously(displayName: string): Promise<string> {
    const credential = auth.currentUser ?? (await signInAnonymously(auth)).user
    await updateProfile(credential, { displayName })
    const p = await ensureProfileDoc(credential, displayName)
    setUser(credential)
    setProfile(p)
    return credential.uid
  }

  async function upgradeToEmailAccount(email: string, password: string) {
    if (!auth.currentUser) throw new Error('No active session to upgrade')
    const credential = EmailAuthProvider.credential(email, password)
    await linkWithCredential(auth.currentUser, credential)
    const ref = doc(db, 'users', auth.currentUser.uid)
    await setDoc(ref, { isAnonymous: false }, { merge: true })
    const snap = await getDoc(ref)
    setProfile({ id: snap.id, ...snap.data() } as UserProfile)
  }

  async function signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function signUpWithEmail(email: string, password: string, displayName: string) {
    const credential = (await createUserWithEmailAndPassword(auth, email, password)).user
    await updateProfile(credential, { displayName })
    await ensureProfileDoc(credential, displayName)
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, joinAnonymously, upgradeToEmailAccount, signInWithEmail, signUpWithEmail, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
