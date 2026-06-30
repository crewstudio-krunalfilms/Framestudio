// firebase-init.js
//
// Shared Firebase setup for FrameStudio.
// Loaded by both index.html (studio dashboard) and client-gallery.html
// (couple's gallery view) via <script type="module" src="firebase-init.js">.
//
// Uses Firebase's modular v10 SDK loaded from Google's CDN.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBec2SEgRIiGxKQ3QmxPq4wNR5R_CBWox8",
  authDomain: "frame-studio-481c4.firebaseapp.com",
  projectId: "frame-studio-481c4",
  storageBucket: "frame-studio-481c4.firebasestorage.app",
  messagingSenderId: "644674946255",
  appId: "1:644674946255:web:cb08325f7c9bfad86fe3ba"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

window.FrameStudioFirebase = {
  auth,
  db,
  googleProvider,

  // ---- AUTH ----
  async signUpEmail(email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return cred.user;
  },

  async signInEmail(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  },

  async signInGoogle() {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  },

  async signOutUser() {
    await signOut(auth);
  },

  onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
  },

  // ---- STUDIO PROFILE ----
  async createStudioProfile(uid, data) {
    await setDoc(doc(db, "studios", uid), {
      ...data,
      createdAt: serverTimestamp()
    });
  },

  async getStudioProfile(uid) {
    const snap = await getDoc(doc(db, "studios", uid));
    return snap.exists() ? snap.data() : null;
  },

  async updateStudioProfile(uid, data) {
    await updateDoc(doc(db, "studios", uid), data);
  },

  // ---- GALLERIES ----
  async createGallery(studioId, galleryData) {
    const ref = await addDoc(collection(db, "studios", studioId, "galleries"), {
      ...galleryData,
      createdAt: serverTimestamp(),
      photoCount: 0,
      videoCount: 0,
      viewCount: 0,
      downloadCount: 0,
      photos: [],
      videos: []
    });
    return ref.id;
  },

  async getGalleries(studioId) {
    const snap = await getDocs(collection(db, "studios", studioId, "galleries"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getGallery(studioId, galleryId) {
    const snap = await getDoc(doc(db, "studios", studioId, "galleries", galleryId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async updateGallery(studioId, galleryId, data) {
    await updateDoc(doc(db, "studios", studioId, "galleries", galleryId), data);
  },

  async deleteGallery(studioId, galleryId) {
    await deleteDoc(doc(db, "studios", studioId, "galleries", galleryId));
  },

  // Find a gallery across all studios by its public share ID (for client-gallery.html)
  // Galleries store a "shareId" field generated at creation time.
  async findGalleryByShareId(shareId) {
    const studiosSnap = await getDocs(collection(db, "studios"));
    for (const studioDoc of studiosSnap.docs) {
      const galleriesRef = collection(db, "studios", studioDoc.id, "galleries");
      const q = query(galleriesRef, where("shareId", "==", shareId));
      const matchSnap = await getDocs(q);
      if (!matchSnap.empty) {
        const galleryDoc = matchSnap.docs[0];
        return {
          studioId: studioDoc.id,
          studio: studioDoc.data(),
          gallery: { id: galleryDoc.id, ...galleryDoc.data() }
        };
      }
    }
    return null;
  }
};
