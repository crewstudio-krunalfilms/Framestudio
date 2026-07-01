import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs, deleteDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBec2SEgRIiGxKQ3QmxPq4wNR5R_CBWox8",
  authDomain: "frame-studio-481c4.firebaseapp.com",
  projectId: "frame-studio-481c4",
  storageBucket: "frame-studio-481c4.firebasestorage.app",
  messagingSenderId: "644674946255",
  appId: "1:644674946255:web:cb08325f7c9bfad86fe3ba",
  measurementId: "G-FEPTTW37MX"
});

const auth = getAuth(app);
const db = getFirestore(app);
const gProvider = new GoogleAuthProvider();

window.FS = {
  auth,
  signUpEmail: (e,p) => createUserWithEmailAndPassword(auth,e,p),
  signInEmail: (e,p) => signInWithEmailAndPassword(auth,e,p),
  signInGoogle: () => signInWithPopup(auth, gProvider),
  signOut: () => signOut(auth),
  onAuth: (cb) => onAuthStateChanged(auth, cb),

  async getProfile(uid) {
    const s = await getDoc(doc(db,"studios",uid));
    return s.exists() ? s.data() : null;
  },
  async saveProfile(uid, data) {
    await setDoc(doc(db,"studios",uid), data, {merge:true});
  },
  async getGalleries(uid) {
    const s = await getDocs(collection(db,"studios",uid,"galleries"));
    return s.docs.map(d=>({id:d.id,...d.data()}));
  },
  async createGallery(uid, data) {
    const r = await addDoc(collection(db,"studios",uid,"galleries"), {
      ...data, createdAt:serverTimestamp(), photoCount:0, videoCount:0, viewCount:0, photos:[], videos:[]
    });
    return r.id;
  },
  async updateGallery(uid, gid, data) {
    await updateDoc(doc(db,"studios",uid,"galleries",gid), data);
  },
  async deleteGallery(uid, gid) {
    await deleteDoc(doc(db,"studios",uid,"galleries",gid));
  },
  async findByShareId(shareId) {
    const studios = await getDocs(collection(db,"studios"));
    for (const s of studios.docs) {
      const q = query(collection(db,"studios",s.id,"galleries"), where("shareId","==",shareId));
      const res = await getDocs(q);
      if (!res.empty) return { studioId:s.id, studio:s.data(), gallery:{id:res.docs[0].id,...res.docs[0].data()} };
    }
    return null;
  }
};
