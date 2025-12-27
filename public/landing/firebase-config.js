// firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyDlDu3x6_UTE9SHHAn0quWN30IVPBiegyU",
    authDomain: "callcare-428c3.firebaseapp.com",
    projectId: "callcare-428c3",
    storageBucket: "callcare-428c3.firebasestorage.app",
    messagingSenderId: "827277116710",
    appId: "1:827277116710:web:e41c882a929b2e6f3cade7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Enable offline persistence
db.enablePersistence().catch(err => {
    console.log('Persistence failed:', err);
});