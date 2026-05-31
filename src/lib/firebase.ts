import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize the Firebase app
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add Google Sheets scope so the user can sync their data with Google Sheets
provider.addScope("https://www.googleapis.com/auth/spreadsheets");

// Auth State listeners and token storage
let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Cleanly listen design for auth changes
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // First, check if we have a token stored in sessionStorage to survive refresh
  const storedToken = sessionStorage.getItem("google_sheets_oauth_token");
  if (storedToken) {
    cachedAccessToken = storedToken;
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Logged in but token is missing, clear state
        cachedAccessToken = null;
        sessionStorage.removeItem("google_sheets_oauth_token");
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      sessionStorage.removeItem("google_sheets_oauth_token");
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get google sheets access token from Firebase Auth popup.");
    }

    cachedAccessToken = credential.accessToken;
    sessionStorage.setItem("google_sheets_oauth_token", cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    cachedAccessToken = sessionStorage.getItem("google_sheets_oauth_token");
  }
  return cachedAccessToken;
};

export const googleSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  sessionStorage.removeItem("google_sheets_oauth_token");
};
