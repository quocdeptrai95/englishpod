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
        showNotification(`👋 Welcome back, ${user.displayName || 'User'}!`);
    } else {
        loginBtn.style.display = 'flex';
        userProfile.style.display = 'none';
        // Clear user data from UI when logged out
        clearUserDataUI();
    }
}

function clearUserDataUI() {
    // Clear localStorage user data
    localStorage.removeItem('favorites');
    localStorage.removeItem('completed');
    localStorage.removeItem('progress');
    
    // Update UI to reflect no user data
    if (typeof updateProgressUI === 'function') updateProgressUI();
    if (typeof updateFavoritesUI === 'function') updateFavoritesUI();
    if (typeof updateContinueLearning === 'function') updateContinueLearning();
    
    // Re-render episodes to remove completed badges and favorite stars
    if (typeof renderEpisodes === 'function') renderEpisodes();
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
        showNotification('📥 Loading your learning data...');
        
        const doc = await db.collection('users').doc(uid).get();
        if (doc.exists) {
            const data = doc.data();
            
            // Replace localStorage with cloud data
            if (data.favorites) {
                localStorage.setItem('favorites', JSON.stringify(data.favorites));
            } else {
                localStorage.setItem('favorites', JSON.stringify([]));
            }
            
            if (data.completed) {
                localStorage.setItem('completed', JSON.stringify(data.completed));
            } else {
                localStorage.setItem('completed', JSON.stringify([]));
            }
            
            if (data.progress) {
                localStorage.setItem('progress', JSON.stringify(data.progress));
            } else {
                localStorage.setItem('progress', JSON.stringify({}));
            }
            
            showNotification('✅ Loaded your learning progress!');
        } else {
            // First time user - create initial empty data
            await db.collection('users').doc(uid).set({
                favorites: [],
                completed: [],
                progress: {},
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            localStorage.setItem('favorites', JSON.stringify([]));
            localStorage.setItem('completed', JSON.stringify([]));
            localStorage.setItem('progress', JSON.stringify({}));
            
            showNotification('🎉 Welcome! Your learning journey starts now!');
        }
        
        // Update all UI components
        if (typeof updateProgressUI === 'function') updateProgressUI();
        if (typeof updateFavoritesUI === 'function') updateFavoritesUI();
        if (typeof updateContinueLearning === 'function') updateContinueLearning();
        if (typeof renderEpisodes === 'function') renderEpisodes();
        
    } catch (error) {
        console.error('Load user data error:', error);
        showNotification('❌ Failed to load your data. Using local data.');
    }
}

async function saveUserData() {
    if (!currentUser || !db) {
        console.log('Not logged in or Firebase not initialized - data saved locally only');
        return;
    }
    
    try {
        const userData = {
            favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
            completed: JSON.parse(localStorage.getItem('completed') || '[]'),
            progress: JSON.parse(localStorage.getItem('progress') || '{}'),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL
        };
        
        await db.collection('users').doc(currentUser.uid).set(userData, { merge: true });
        
        console.log('✅ User data synced to cloud');
    } catch (error) {
        console.error('Save user data error:', error);
        // Don't show notification - silent background sync
    }
}
