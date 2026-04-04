// Firebase Configuration (Injecting User Keys)
const firebaseConfig = {
  apiKey: "AIzaSyBH5d3ccsWvbDcs0zV9tbkPuta-yUzATUA",
  authDomain: "aetheric-ai-17.firebaseapp.com",
  projectId: "aetheric-ai-17",
  storageBucket: "aetheric-ai-17.firebasestorage.app",
  messagingSenderId: "947970513803",
  appId: "1:947970513803:web:eb5087b5acc2b00c97ed8e",
  measurementId: "G-GYZGRQNJQ7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// Auth Logic
async function loginWithGoogle() {
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    
    // Sync with MongoDB
    await fetch('/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firebaseUid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      })
    });

    console.log("Logged in and synced:", user.displayName);
    window.location.reload(); 
  } catch (error) {
    console.error("Login failed:", error.message);
    alert("Login failed. Check your connection or try again.");
  }
}

function logout() {
  auth.signOut().then(() => {
    window.location.href = '/';
  });
}

// Check session
auth.onAuthStateChanged((user) => {
  const loginBtns = document.querySelectorAll('.login-trigger');
  const userProfiles = document.querySelectorAll('.user-profile-trigger');
  const userNames = document.querySelectorAll('.user-display-name');
  const userPhotos = document.querySelectorAll('.user-display-photo');

  if (user) {
    // User is signed in
    loginBtns.forEach(b => b.classList.add('hidden'));
    userProfiles.forEach(p => p.classList.remove('hidden'));
    userNames.forEach(n => n.innerText = user.displayName.split(' ')[0]);
    userPhotos.forEach(p => {
        if(p.tagName === 'IMG') p.src = user.photoURL;
        else p.innerText = user.displayName[0];
    });
    localStorage.setItem('aetheric_user', JSON.stringify({
        id: user.uid,
        name: user.displayName,
        email: user.email,
        photo: user.photoURL
    }));
  } else {
    // User is signed out
    loginBtns.forEach(b => b.classList.remove('hidden'));
    userProfiles.forEach(p => p.classList.add('hidden'));
    localStorage.removeItem('aetheric_user');
  }
});
