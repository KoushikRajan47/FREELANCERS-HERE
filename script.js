// =======================================================
//  IMPORTS
// =======================================================
import { initializeApp, setLogLevel } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut, 
    updateProfile 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    onSnapshot, 
    serverTimestamp, 
    deleteDoc,
    doc,
    setDoc, // For creating user profiles
    getDoc, // For fetching user profiles
    updateDoc, // For updating profiles and ratings
    arrayUnion, // For adding ratings
    arrayRemove, // (Not used here, but good to know)
    getCountFromServer // For dashboard
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =======================================================
//  FIREBASE CONFIGURATION
// =======================================================
// Using the 'freelancer-here' config from our previous session
const firebaseConfig = {
  apiKey: "AIzaSyCPoBCgSMptHiACr_zjsKRrAVGsGNBWQns",
  authDomain: "freelancer-here.firebaseapp.com",
  projectId: "freelancer-here",
  storageBucket: "freelancer-here.firebasestorage.app",
  messagingSenderId: "383884579649",
  appId: "1:383884579649:web:795caeb5c75af8090407c0"
};

// =======================================================
//  INITIALIZE FIREBASE
// =======================================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setLogLevel('debug');
console.log("Firebase Initialized with Project ID:", firebaseConfig.projectId);

// =======================================================
//  FIRESTORE COLLECTIONS
// =======================================================
const servicesCollection = collection(db, "services");
const usersCollection = collection(db, "users");

// =======================================================
//  GLOBAL STATE
// =======================================================
let currentUserProfile = null; // Caches the logged-in user's profile
let allServices = []; // Caches all services for filtering
let unsubscribeServices = null; // To store the services listener

// =======================================================
//  DOM ELEMENT REFERENCES
// =======================================================
const loader = document.getElementById('loader');
const authPage = document.getElementById('auth-page');
const appPage = document.getElementById('app-page');
const authError = document.getElementById('auth-error');

// --- Pages ---
const homePage = document.getElementById('home-page');
const profilePage = document.getElementById('profile-page');

// --- Nav ---
const navHomeBtn = document.getElementById('nav-home-btn');
const navProfileBtn = document.getElementById('nav-profile-btn');
const logoutBtn = document.getElementById('logout-btn');

// --- Home Page ---
const servicesGrid = document.getElementById('services-grid');
const noServicesMsg = document.getElementById('no-services-message');
const filterContainer = document.getElementById('filter-container');

// --- Modal ---
const modal = document.getElementById('post-service-modal');
const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const serviceForm = document.getElementById('service-form');
const modalError = document.getElementById('modal-error');

// --- Toast ---
const toast = document.getElementById('toast-notification');

// =======================================================
//  TOAST NOTIFICATION
// =======================================================
const showToast = (message, isError = false) => {
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.toggle('bg-danger', isError);
    toast.classList.toggle('bg-success', !isError);
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
};

// =======================================================
//  PAGE NAVIGATION
// =======================================================
const navigateTo = (page) => {
    homePage.classList.add('hidden');
    profilePage.classList.add('hidden');

    if (page === 'home') {
        homePage.classList.remove('hidden');
        // Refresh services grid with current filter
        const activeFilter = document.querySelector('.btn-filter.active').dataset.filter;
        filterServices(activeFilter);
    } else if (page === 'profile') {
        profilePage.classList.remove('hidden');
    }
};

navHomeBtn.addEventListener('click', () => navigateTo('home'));
navProfileBtn.addEventListener('click', () => {
    // When "My Profile" is clicked, load the current user's profile
    if (auth.currentUser) {
        loadProfilePage(auth.currentUser.uid);
        navigateTo('profile');
    }
});

// =======================================================
//  AUTH LOGIC
// =======================================================

onAuthStateChanged(auth, async (user) => {
    loader.classList.add('hidden');
    if (user) {
        // User is logged in
        console.log("Auth state changed: User signed in:", user.uid);
        
        // --- NEW: Fetch or Create User Profile ---
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            currentUserProfile = userDocSnap.data();
            console.log("Fetched user profile:", currentUserProfile);
        } else {
            console.log("No profile found, creating new one...");
            const newUserProfile = {
                uid: user.uid,
                name: user.displayName || 'New User',
                email: user.email,
                photoURL: user.photoURL || `https://placehold.co/100x100/0e1224/9fb1d9?text=${user.displayName ? user.displayName[0] : 'U'}`,
                description: "Welcome to my profile! I'm new here.",
                links: {
                    mobile: "",
                    linkedin: "",
                    github: "",
                    instagram: ""
                },
                ratings: [],
                avgRating: 0,
                createdAt: serverTimestamp()
            };
            await setDoc(userDocRef, newUserProfile);
            currentUserProfile = newUserProfile;
            console.log("Created new user profile:", currentUserProfile);
        }
        
        authPage.classList.add('hidden');
        appPage.classList.remove('hidden');
        navigateTo('home');
        fetchAndDisplayServices();
        
    } else {
        // User is logged out
        console.log("Auth state changed: User signed out.");
        appPage.classList.add('hidden');
        authPage.classList.remove('hidden');
        
        currentUserProfile = null;
        servicesGrid.innerHTML = '';
        if (unsubscribeServices) unsubscribeServices();
    }
});

// --- Handle Sign Up ---
const signupForm = document.getElementById('signup-form');
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    authError.textContent = '';

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        // Set display name in auth, the onAuthStateChanged listener will handle profile creation in Firestore
        console.log("User signed up:", userCredential.user.uid);
        signupForm.reset();
        // onAuthStateChanged will handle the rest
    } catch (error) {
        console.error("Signup error:", error);
        authError.textContent = error.message;
    }
});

// --- Handle Login ---
const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    authError.textContent = '';

    try {
        await signInWithEmailAndPassword(auth, email, password);
        loginForm.reset();
        // onAuthStateChanged will handle the rest
    } catch (error) {
        console.error("Login error:", error);
        authError.textContent = error.message;
    }
});

// --- Handle Logout ---
logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// =======================================================
//  PROFILE PAGE LOGIC
// =======================================================
const loadProfilePage = async (userId) => {
    console.log("Loading profile for user:", userId);
    profilePage.innerHTML = `<div class="loader mx-auto mt-10"></div>`; // Show loader
    
    try {
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            profilePage.innerHTML = `<p class="text-center text-primary-red">Error: User profile not found.</p>`;
            return;
        }

        const profile = userDocSnap.data();
        const isCurrentUser = auth.currentUser.uid === userId;
        
        // Calculate average rating
        const numRatings = profile.ratings.length;
        const avgRatingText = numRatings > 0 ? `${profile.avgRating.toFixed(1)} ★` : 'No Ratings';
        const ratingCountText = numRatings === 1 ? `(1 rating)` : `(${numRatings} ratings)`;

        // Check if current user has already rated this person
        const existingRating = profile.ratings.find(r => r.raterId === auth.currentUser.uid);
        
        profilePage.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- Left Column: Profile Card -->
                <div class="lg:col-span-1 space-y-6">
                    <div class="card-dark rounded-lg p-6 shadow-lg text-center">
                        <img src="${profile.photoURL}" alt="${profile.name}" class="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-muted-gray">
                        <h2 class="text-2xl font-bold text-white">${profile.name}</h2>
                        <p class="text-text-muted">${profile.email}</p>
                        <div class="mt-2">
                            <span class="text-lg font-bold text-warning">${avgRatingText}</span>
                            <span class="text-sm text-text-muted ml-1">${ratingCountText}</span>
                        </div>
                        
                        <div class="mt-4 text-left space-y-2">
                            <h4 class="text-sm font-semibold text-text-muted uppercase">Links</h4>
                            <p class="text-sm"><i data-lucide="smartphone" class="inline w-4 h-4 mr-2"></i> ${profile.links.mobile || 'Not set'}</p>
                            <p class="text-sm"><i data-lucide="linkedin" class="inline w-4 h-4 mr-2"></i> ${profile.links.linkedin || 'Not set'}</p>
                            <p class="text-sm"><i data-lucide="github" class="inline w-4 h-4 mr-2"></i> ${profile.links.github || 'Not set'}</p>
                            <p class="text-sm"><i data-lucide="instagram" class="inline w-4 h-4 mr-2"></i> ${profile.links.instagram || 'Not set'}</p>
                        </div>
                    </div>
                    
                    <!-- Dashboard (Only on own profile) -->
                    ${isCurrentUser ? `
                    <div class="card-dark rounded-lg p-6 shadow-lg">
                        <h3 class="text-xl font-bold text-white mb-4">Site Dashboard</h3>
                        <div class="space-y-3" id="dashboard-content">
                            <p class="text-text-muted">Loading stats...</p>
                        </div>
                    </div>` : ''}
                </div>

                <!-- Right Column: Details & Actions -->
                <div class="lg:col-span-2 space-y-6">
                    <!-- Description -->
                    <div class="card-dark rounded-lg p-6 shadow-lg">
                        <div class="flex justify-between items-center mb-2">
                            <h3 class="text-xl font-bold text-white">About Me</h3>
                            ${isCurrentUser ? `<button id="edit-profile-btn" class="btn btn-outline">
                                                    <i data-lucide="edit-2" class="btn-icon"></i>Edit
                                                </button>` : ''}
                        </div>
                        <p id="profile-description" class="text-text-muted">${profile.description.replace(/\n/g, '<br>')}</p>
                        <!-- Edit Form (Hidden) -->
                        <form id="profile-edit-form" class="hidden space-y-4 mt-4">
                            <div>
                                <label class="block text-sm font-medium text-text-muted">Description</label>
                                <textarea id="edit-description" class="form-input" rows="4">${profile.description}</textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-text-muted">Mobile</label>
                                <input type="text" id="edit-mobile" class="form-input" value="${profile.links.mobile}">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-text-muted">LinkedIn Username</label>
                                <input type="text" id="edit-linkedin" class="form-input" value="${profile.links.linkedin}">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-text-muted">GitHub Username</label>
                                <input type="text" id="edit-github" class="form-input" value="${profile.links.github}">
                            </div>
                             <div>
                                <label class="block text-sm font-medium text-text-muted">Instagram Username</label>
                                <input type="text" id="edit-instagram" class="form-input" value="${profile.links.instagram}">
                            </div>
                            <div class="flex space-x-2">
                                <button type="submit" id="save-profile-btn" class="btn btn-primary">
                                    <i data-lucide="check" class="btn-icon"></i>Save
                                </button>
                                <button type="button" id="cancel-edit-btn" class="btn btn-outline">
                                    <i data-lucide="x" class="btn-icon"></i>Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                    
                    <!-- Leave a Rating (Only on others' profiles) -->
                    ${!isCurrentUser ? `
                    <div class="card-dark rounded-lg p-6 shadow-lg">
                        <h3 class="text-xl font-bold text-white mb-4">${existingRating ? 'Update Your Rating' : 'Leave a Rating'}</h3>
                        <form id="rating-form" data-profile-id="${userId}">
                            <div class="star-rating mb-4">
                                <input type="radio" id="5-stars" name="rating" value="5" ${existingRating?.rating == 5 ? 'checked' : ''} /><label for="5-stars">★</label>
                                <input type="radio" id="4-stars" name="rating" value="4" ${existingRating?.rating == 4 ? 'checked' : ''} /><label for="4-stars">★</label>
                                <input type="radio" id="3-stars" name="rating" value="3" ${existingRating?.rating == 3 ? 'checked' : ''} /><label for="3-stars">★</label>
                                <input type="radio" id="2-stars" name="rating" value="2" ${existingRating?.rating == 2 ? 'checked' : ''} /><label for="2-stars">★</label>
                                <input type="radio" id="1-star" name="rating" value="1" ${existingRating?.rating == 1 ? 'checked' : ''} /><label for="1-star">★</label>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-text-muted">Your Comment</label>
                                <textarea id="rating-comment" class="form-input" rows="3" placeholder="Share your experience...">${existingRating?.comment || ''}</textarea>
                            </div>
                            <button type="submit" class="btn btn-primary mt-4">
                                <i data-lucide="star" class="btn-icon"></i>Submit Rating
                            </button>
                        </form>
                    </div>` : ''}
                    
                    <!-- Ratings List -->
                    <div class="card-dark rounded-lg p-6 shadow-lg">
                        <h3 class="text-xl font-bold text-white mb-4">What people are saying</h3>
                        <div id="ratings-list" class="space-y-4 max-h-64 overflow-y-auto">
                            ${profile.ratings.length === 0 ? '<p class="text-text-muted">No ratings yet.</p>' :
                                profile.ratings.map(r => `
                                    <div class="border-b border-muted-gray pb-2">
                                        <div class="flex justify-between items-center">
                                            <span class="font-semibold text-white">${r.raterName || 'Anonymous'}</span>
                                            <span class="text-warning">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                                        </div>
                                        <p class="text-sm text-text-muted mt-1">${r.comment}</p>
                                    </div>
                                `).join('')
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        } else {
            console.error("Lucide is not loaded, cannot create icons.");
        }
        
        // Add event listeners for this dynamically generated content
        if (isCurrentUser) {
            addProfileEditListeners();
            updateDashboard(); // Load dashboard stats
        } else {
            addRatingFormListener(userId);
        }

    } catch (error) {
        console.error("Error loading profile:", error);
        profilePage.innerHTML = `<p class="text-center text-primary-red">Error: Could not load profile.</p>`;
    }
};

// --- Profile Edit Listeners ---
const addProfileEditListeners = () => {
    const editBtn = document.getElementById('edit-profile-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const editForm = document.getElementById('profile-edit-form');
    const descriptionP = document.getElementById('profile-description');

    // Handle null elements if profile failed to render
    if (!editBtn || !cancelBtn || !editForm || !descriptionP) return;

    editBtn.addEventListener('click', () => {
        editForm.classList.remove('hidden');
        descriptionP.classList.add('hidden');
        editBtn.classList.add('hidden');
    });

    cancelBtn.addEventListener('click', () => {
        editForm.classList.add('hidden');
        descriptionP.classList.remove('hidden');
        editBtn.classList.remove('hidden');
    });

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newDesc = document.getElementById('edit-description').value;
        const newLinks = {
            mobile: document.getElementById('edit-mobile').value,
            linkedin: document.getElementById('edit-linkedin').value,
            github: document.getElementById('edit-github').value,
            instagram: document.getElementById('edit-instagram').value,
        };

        try {
            const userDocRef = doc(db, "users", auth.currentUser.uid);
            await updateDoc(userDocRef, {
                description: newDesc,
                links: newLinks
            });
            
            // Update local cache
            currentUserProfile.description = newDesc;
            currentUserProfile.links = newLinks;
            
            // Reload profile page to show changes
            loadProfilePage(auth.currentUser.uid);
            showToast("Profile updated successfully!");

        } catch (error) {
            console.error("Error updating profile:", error);
            showToast("Failed to update profile.", true);
        }
    });
};

// --- Rating Form Listener ---
const addRatingFormListener = (profileUserId) => {
    const ratingForm = document.getElementById('rating-form');
    
    // Handle null element
    if (!ratingForm) return;

    ratingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rating = ratingForm.elements.rating.value;
        const comment = document.getElementById('rating-comment').value;

        if (!rating) {
            showToast("Please select a star rating.", true);
            return;
        }

        const raterId = auth.currentUser.uid;
        const raterName = currentUserProfile.name;
        
        const newRating = {
            raterId,
            raterName,
            rating: parseInt(rating),
            comment,
            createdAt: serverTimestamp()
        };

        try {
            const userDocRef = doc(db, "users", profileUserId);
            const userDocSnap = await getDoc(userDocRef);
            const userData = userDocSnap.data();
            
            // Check if user already rated, remove old rating if so
            const existingRatings = userData.ratings.filter(r => r.raterId !== raterId);
            const updatedRatings = [...existingRatings, newRating];
            
            // Recalculate average rating
            const totalRating = updatedRatings.reduce((sum, r) => sum + r.rating, 0);
            const newAvgRating = totalRating / updatedRatings.length;

            await updateDoc(userDocRef, {
                ratings: updatedRatings,
                avgRating: newAvgRating
            });

            showToast("Rating submitted!");
            loadProfilePage(profileUserId); // Refresh profile to show new rating

        } catch (error) {
            console.error("Error submitting rating:", error);
            showToast("Failed to submit rating.", true);
        }
    });
};

// --- Dashboard Logic ---
const updateDashboard = async () => {
    const dashboardContent = document.getElementById('dashboard-content');
    
    // Handle null element
    if (!dashboardContent) return;

    try {
        // 1. Total Users
        const usersSnapshot = await getCountFromServer(usersCollection);
        const totalUsers = usersSnapshot.data().count;

        // 2. Total Freelancers (users who posted > 0 services)
        // We use the `allServices` cache for this
        const freelancerIds = new Set(allServices.map(doc => doc.data().userId));
        const totalFreelancers = freelancerIds.size;

        // 3. Breakdown per category
        const domainCounts = {};
        allServices.forEach(doc => {
            const domain = doc.data().domain;
            domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        });

        dashboardContent.innerHTML = `
            <div class="flex justify-between text-white"><span>Total Users:</span> <span class="font-bold">${totalUsers}</span></div>
            <div class="flex justify-between text-white"><span>Total Freelancers:</span> <span class="font-bold">${totalFreelancers}</span></div>
            <hr class="border-muted-gray my-2">
            <h4 class="text-sm font-semibold text-text-muted uppercase mb-2">Services Posted</h4>
            ${Object.entries(domainCounts).map(([domain, count]) => `
                <div class="flex justify-between text-sm text-text-light"><span>${domain}:</span> <span class="font-bold">${count}</span></div>
            `).join('') || '<p class="text-sm text-text-muted">No services posted yet.</p>'}
        `;

    } catch (error) {
        console.error("Error updating dashboard:", error);
        dashboardContent.innerHTML = `<p class="text-primary-red">Could not load stats.</p>`;
    }
};

// =======================================================
//  HOME PAGE LOGIC (SERVICES)
// =======================================================

// --- Render a single service card ---
const renderService = (doc) => {
    const data = doc.data();
    const card = document.createElement('div');
    card.dataset.id = doc.id; 
    card.className = 'card-dark rounded-lg shadow-lg overflow-hidden service-card';
    card.dataset.domain = data.domain; // For filtering
    
    const timestamp = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
    const isOwner = auth.currentUser && auth.currentUser.uid === data.userId;
    
    card.innerHTML = `
        <div class="p-6">
            <div class="flex items-start justify-between">
                 <span class="inline-block bg-muted-gray/50 text-text-muted text-xs font-semibold px-2.5 py-0.5 rounded-full">${data.domain}</span>
                 <span class="text-xs text-text-muted">${timestamp.toLocaleDateString()}</span>
            </div>
            <h3 class_B"text-lg font-bold mt-4 text-white">${data.title}</h3>
            <p class="mt-2 text-text-muted text-sm line-clamp-3">${data.description}</p>
            <div class="mt-6 pt-4 border-t border-muted-gray flex items-center justify-between">
                <div>
                    <p class="text-sm font-medium text-white">${data.userName || "Freelancer"}</p>
                    <p class="text-xs text-text-muted">${data.userEmail}</p>
                </div>
                <div class="flex space-x-2">
                    <button class="view-profile-btn btn btn-outline" data-user-id="${data.userId}">
                        <i data-lucide="user" class="btn-icon"></i>Profile
                    </button>
                    ${isOwner 
                        ? `<button class="delete-btn btn btn-danger-sm" data-doc-id="${doc.id}">
                                <i data-lucide="trash-2" class="btn-icon"></i>Delete
                           </button>`
                        : `<a href="mailto:${data.userEmail}?subject=Inquiry about your service: ${data.title}" class="btn btn-primary-sm">
                                <i data-lucide="mail" class="btn-icon"></i>Connect
                           </a>`
                    }
                </div>
            </div>
        </div>
    `;
    servicesGrid.appendChild(card);
}
        
// --- Fetch and display all services in real-time ---
const fetchAndDisplayServices = () => {
    if (unsubscribeServices) unsubscribeServices(); // Stop old listener
    console.log("Setting up new snapshot listener for services...");
    
    // We fetch *without* ordering to avoid needing a Firestore Index
    const q = query(servicesCollection);
    
    unsubscribeServices = onSnapshot(q, (snapshot) => {
        console.log("Received services snapshot. Docs count:", snapshot.docs.length);
        servicesGrid.innerHTML = ''; // Clear existing grid
        
        allServices = snapshot.docs.sort((a, b) => {
            const dateA = a.data().createdAt?.toDate ? a.data().createdAt.toDate() : new Date(0);
            const dateB = b.data().createdAt?.toDate ? b.data().createdAt.toDate() : new Date(0);
            return dateB - dateA; // Sort descending (newest first)
        });
        
        if(allServices.length === 0) {
            noServicesMsg.classList.remove('hidden');
        } else {
            noServicesMsg.classList.add('hidden');
            // Re-apply current filter
             const activeFilter = document.querySelector('.btn-filter.active').dataset.filter;
             filterServices(activeFilter);
        }
    }, (error) => {
        console.error("Error fetching services: ", error);
        servicesGrid.innerHTML = `<p class="text-primary-red col-span-full text-center">Error: ${error.message}</p>`;
    });
}

// --- Service Card Button Listeners (Delete & View Profile) ---
servicesGrid.addEventListener('click', async (e) => {
    // Handle Delete
    const deleteButton = e.target.closest('.delete-btn');
    if (deleteButton) {
        const docId = deleteButton.dataset.docId;
        if (confirm("Are you sure you want to remove this service?")) {
            try {
                await deleteDoc(doc(db, "services", docId));
                showToast("Service removed successfully.");
                // onSnapshot will handle the UI update
            } catch (error) {
                console.error("Error removing document: ", error);
                showToast("Failed to remove service.", true);
            }
        }
    }
    
    // Handle View Profile
    const profileButton = e.target.closest('.view-profile-btn');
    if (profileButton) {
        const userId = profileButton.dataset.userId;
        loadProfilePage(userId);
        navigateTo('profile');
    }
});


// =======================================================
//  MODAL LOGIC
// =======================================================
openModalBtn.addEventListener('click', () => modal.classList.remove('hidden'));
closeModalBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    serviceForm.reset();
    modalError.textContent = '';
});

// --- Handle new service form submission ---
serviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserProfile) {
        modalError.textContent = "You must be logged in to post a service.";
        return;
    }
    
    const title = document.getElementById('service-title').value;
    const description = document.getElementById('service-description').value;
    const domain = document.getElementById('service-domain').value;

    try {
        await addDoc(servicesCollection, {
            title,
            description,
            domain,
            userId: currentUserProfile.uid,
            userName: currentUserProfile.name,
            userEmail: currentUserProfile.email,
            createdAt: serverTimestamp()
        });
        closeModalBtn.click();
        showToast("Service posted successfully!");
    } catch (error) {
        console.error("Error adding document: ", error);
        modalError.textContent = `Failed to post service: ${error.message}`;
    }
});

// =======================================================
//  FILTERING LOGIC
// =======================================================
const filterServices = (filterValue) => {
    servicesGrid.innerHTML = ''; // Clear grid
    
    const filteredServices = filterValue === 'all'
        ? allServices 
        : allServices.filter(doc => doc.data().domain === filterValue);
    
    if (filteredServices.length > 0) {
        noServicesMsg.classList.add('hidden');
        filteredServices.forEach(doc => renderService(doc));
    } else {
        noServicesMsg.classList.add('hidden'); // Show grid, but renderService won't run
        noServicesMsg.classList.remove('hidden'); // Show no services message
    }
    
    // Re-render icons after filtering
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    } else {
        console.error("Lucide is not loaded, cannot create icons.");
    }
}

filterContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-filter')) {
        // Update active button style
        filterContainer.querySelectorAll('.btn-filter').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.classList.add('active');

        // Perform filtering
        const filterValue = e.target.dataset.filter;
        filterServices(filterValue);
    }
});

