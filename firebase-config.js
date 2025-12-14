// Firebase Configuration
// Get your config from: https://console.firebase.google.com/
// 1. Create new project
// 2. Add web app
// 3. Enable Google Authentication in Authentication > Sign-in method
// 4. Replace this config with your own

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase (will be loaded in index.html)
let auth = null;
let db = null;
let currentUser = null;

function initFirebase() {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        
        // Auth state observer
        auth.onAuthStateChanged((user) => {
            currentUser = user;
            updateAuthUI(user);
            if (user) {
                loadUserData(user.uid);
            }
        });
    }
}

function updateAuthUI(user) {
    const loginBtn = document.getElementById('loginBtn');
    const userProfile = document.getElementById('userProfile');
    
    if (user) {
        loginBtn.style.display = 'none';
        userProfile.style.display = 'flex';
        document.getElementById('userName').textContent = user.displayName || 'User';
        document.getElementById('userAvatar').src = user.photoURL || 'https://via.placeholder.com/40';
    } else {
        loginBtn.style.display = 'flex';
        userProfile.style.display = 'none';
    }
}

async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        showNotification('✅ Signed in successfully!');
    } catch (error) {
        console.error('Sign in error:', error);
        showNotification('❌ Sign in failed. Please try again.');
    }
}

async function signOut() {
    try {
        await auth.signOut();
        showNotification('👋 Signed out successfully!');
    } catch (error) {
        console.error('Sign out error:', error);
    }
}

// User Data Management
async function loadUserData(uid) {
    if (!db) return;
    
    try {
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            const data = doc.data();
            // Merge with localStorage
            if (data.favorites) localStorage.setItem('favorites', JSON.stringify(data.favorites));
            if (data.completed) localStorage.setItem('completed', JSON.stringify(data.completed));
            if (data.progress) localStorage.setItem('progress', JSON.stringify(data.progress));
        }
        updateProgressUI();
    } catch (error) {
        console.error('Load user data error:', error);
    }
}

async function saveUserData() {
    if (!currentUser || !db) return;
    
    try {
        await db.collection('users').doc(currentUser.uid).set({
            favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
            completed: JSON.parse(localStorage.getItem('completed') || '[]'),
            progress: JSON.parse(localStorage.getItem('progress') || '{}'),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Save user data error:', error);
    }
}
