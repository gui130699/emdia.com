import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export interface UserProfile {
  fullName: string;
  email: string;
  phone?: string;
}

export const userProfileService = {
  async get(uid: string): Promise<UserProfile | null> {
    const snapshot = await getDoc(doc(db, "users", uid));
    return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
  },

  async update(uid: string, patch: Partial<UserProfile>): Promise<void> {
    await setDoc(doc(db, "users", uid), patch, { merge: true });
  },
};
