// =======================================================
//  IMPORTS
// =======================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
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
    orderBy, 
    doc, 
    setDoc, 
    getDoc, 
    deleteDoc, 
    updateDoc, 
    arrayUnion, 
    arrayRemove, 
    getDocs,
    where,
    limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =======================================================
//  FIREBASE CONFIGURATION
// =======================================================
// --- Use the config you provided ---
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
console.log(`Firebase Initialized with Project ID: ${firebaseConfig.projectId}`);

// =======================================================
//  FIRESTORE COLLECTIONS
// =======================================================
const servicesCollection = collection(db, 'services');
const usersCollection = collection(db, 'users');

// =======================================================
//  GLOBAL STATE
// =======================================================
let currentAuthUser = null; // Holds the auth object for the logged-in user
let currentUserProfile = null; // Holds the profile data from 'users' collection
let allServices = []; // Local cache for filtering services
let currentUnsubscribe = null; // Holds the listener for services to stop it

// =======================================================
//  DOM ELEMENT REFERENCES
// =======================================================
const loader = document.getElementById('loader');
const authPage = document.getElementById('auth-page');
const appPage = document.getElementById('app-page');
const authError = document.getElementById('auth-error');

// --- Auth Tabs ---
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginTab = document.getElementById('auth-tab-login');
const signupTab = document.getElementById('auth-tab-signup');

// --- Pages ---
const homePage = document.getElementById('home-page');
const profilePage = document.getElementById('profile-page');
const allPages = [homePage, profilePage];

// --- Nav Buttons ---
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
//  AUTH TAB SWITCHING (FIX)
// =======================================================
loginTab.addEventListener('click', () => {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    loginTab.classList.add('border-primary-red', 'text-primary-red');
    loginTab.classList.remove('border-transparent', 'text-text-muted');
    signupTab.classList.add('border-transparent', 'text-text-muted');
    signupTab.classList.remove('border-primary-red', 'text-primary-red');
    authError.textContent = '';
});

signupTab.addEventListener('click', () => {
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    signupTab.classList.add('border-primary-red', 'text-primary-red');
    signupTab.classList.remove('border-transparent', 'text-text-muted');
    loginTab.classList.add('border-transparent', 'text-text-muted');
    loginTab.classList.remove('border-primary-red', 'text-primary-red');
    authError.textContent = '';
});

// =======================================================
//  TOAST NOTIFICATION
// =======================================================
const showToast = (message, isSuccess = true) => {
    toast.textContent = message;
    toast.classList.remove('hidden', 'bg-success', 'bg-danger');
    toast.classList.add(isSuccess ? 'bg-success' : 'bg-danger');
    
    // Show and then hide after 3 seconds
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
};

// =======================================================
//  PAGE NAVIGATION
// =======================================================
const navigateTo = (pageId) => {
    allPages.forEach(page => {
        if (page.id === pageId) {
            page.classList.remove('hidden');
        } else {
            page.classList.add('hidden');
        }
    });
    // Special case: Profile page needs data, Home page needs to fetch services
    if (pageId === 'home-page') {
        filterServices('all'); // Re-filter to 'all' when returning home
    }
};

navHomeBtn.addEventListener('click', () => navigateTo('home-page'));
navProfileBtn.addEventListener('click', () => {
    navigateTo('profile-page');
    loadProfilePage(currentAuthUser.uid); // Load *my* profile
});

// =======================================================
//  AUTH LOGIC
// =======================================================

onAuthStateChanged(auth, async (user) => {
    loader.classList.add('hidden'); // Hide loader once auth state is known
    
    if (user) {
        // User is logged in
        currentAuthUser = user;
        console.log('Auth state changed: User signed in:', user.uid);
        
        // Fetch or create their profile
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            currentUserProfile = userDocSnap.data();
            console.log('Fetched user profile:', currentUserProfile);
        } else {
            console.log('No profile found, creating new one...');
            // Create a new profile
            const newProfile = {
                uid: user.uid,
                name: user.displayName || document.getElementById('signup-name').value || 'New User',
                email: user.email,
                photoURL: user.photoURL || `https://placehold.co/100x100/0e1224/9fb1d9?text=${user.displayName ? user.displayName.charAt(0) : 'U'}`,
                description: '',
                linkedin: '',
                github: '',
                ratings: [], // Array to hold rating objects
                createdAt: serverTimestamp()
            };
            await setDoc(userDocRef, newProfile);
            currentUserProfile = newProfile;
            console.log('Created new user profile:', currentUserProfile);
        }
        
        authPage.classList.add('hidden');
        appPage.classList.remove('hidden');
        navigateTo('home-page'); // Default to home page on login
        attachServiceListener(); // Start listening for services
        
    } else {
        // User is logged out
        console.log('Auth state changed: User signed out.');
        currentAuthUser = null;
        currentUserProfile = null;
        
        appPage.classList.add('hidden');
        authPage.classList.remove('hidden');
        
        // Stop listening to services when logged out
        if (currentUnsubscribe) {
            currentUnsubscribe();
            currentUnsubscribe = null;
        }
    }
    // Call createIcons *after* the correct page is shown
    lucide.createIcons();
});

// --- Handle Sign Up ---
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    authError.textContent = '';

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Update auth profile
        await updateProfile(userCredential.user, { 
            displayName: name,
            photoURL: `https://placehold.co/100x100/0e1224/9fb1d9?text=${name.charAt(0)}`
        });
        
        // The onAuthStateChanged listener will handle creating the Firestore profile
        signupForm.reset();
    } catch (error) {
        authError.textContent = error.message;
        console.error('Sign up error:', error);
    }
});

// --- Handle Login ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    authError.textContent = '';

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle the rest
        loginForm.reset();
    } catch (error) {
        authError.textContent = "Error: Invalid email or password.";
        console.error('Login error:', error);
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
    console.log(`Loading profile for user: ${userId}`);
    profilePage.innerHTML = `<div class="loader mx-auto"></div>`; // Show loader

    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
        console.error('Error loading profile: User not found');
        profilePage.innerHTML = `<p class="text-center text-primary-red">Error: Could not load profile.</p>`;
        return;
    }
    
    const profileData = userDocSnap.data();
    const isMyProfile = currentAuthUser.uid === userId;
    
    // Calculate average rating
    let avgRating = 0;
    let totalRatings = profileData.ratings.length;
    if (totalRatings > 0) {
        const sum = profileData.ratings.reduce((acc, r) => acc + r.rating, 0);
        avgRating = (sum / totalRatings).toFixed(1);
    }

    // --- Dashboard Data Fetch ---
    let dashboardHtml = '';
    if (isMyProfile) {
        const totalUsersSnap = await getDocs(query(usersCollection, limit(100))); // Cap at 100 for performance
        const servicesSnap = await getDocs(query(servicesCollection, limit(500))); // Cap at 500
        
        const totalUsers = totalUsersSnap.size;
        const serviceData = servicesSnap.docs.map(doc => doc.data());
        
        const totalFreelancers = new Set(serviceData.map(s => s.userId)).size;
        
        const categoryCounts = {
            'Coding': 0,
            'Content Writing': 0,
            'Project Making': 0,
            'Video Editing': 0,
            'Photography': 0,
            'Presentations': 0
        };
        
        serviceData.forEach(s => {
            if (categoryCounts.hasOwnProperty(s.domain)) {
                categoryCounts[s.domain]++;
            }
        });

        dashboardHtml = `
            <div class="card-dark p-6 rounded-lg mb-8">
                <h3 class="text-xl font-bold text-primary-red mb-6">Dashboard</h3>
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <!-- Stat Card: Total Users -->
                    <div class="bg-dark p-4 rounded-lg border border-muted-gray text-center">
                        <p class="text-3xl font-bold">${totalUsers}</p>
                        <p class="text-sm text-text-muted">Total Users</p>
                    </div>
                    <!-- Stat Card: Total Freelancers -->
                    <div class="bg-dark p-4 rounded-lg border border-muted-gray text-center">
                        <p class="text-3xl font-bold">${totalFreelancers}</p>
                        <p class="text-sm text-text-muted">Active Freelancers</p>
                    </div>
                    <!-- Stat Card: Total Services -->
                    <div class="bg-dark p-4 rounded-lg border border-muted-gray text-center">
                        <p class="text-3xl font-bold">${serviceData.length}</p>
                        <p class="text-sm text-text-muted">Total Services</p>
                    </div>
                    <!-- Stat Card: My Services -->
                    <div class="bg-dark p-4 rounded-lg border border-muted-gray text-center">
                        <p class="text-3xl font-bold">${serviceData.filter(s => s.userId === currentAuthUser.uid).length}</p>
                        <p class="text-sm text-text-muted">My Services</p>
                    </div>
                </div>
                <h4 class="text-lg font-semibold text-white mt-8 mb-4">Services by Category</h4>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    ${Object.entries(categoryCounts).map(([domain, count]) => `
                        <div class="bg-dark p-3 rounded-lg border border-muted-gray">
                            <span class="text-xl font-bold">${count}</span>
                            <p class="text-xs text-text-muted truncate">${domain}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // --- Main Profile HTML ---
    profilePage.innerHTML = `
        ${dashboardHtml}
        
        <div class="card-dark p-6 rounded-lg">
            <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <img src="${profileData.photoURL}" alt="${profileData.name}" class="w-32 h-32 rounded-full border-4 border-muted-gray flex-shrink-0">
                <div class="flex-grow w-full text-center sm:text-left">
                    <div class="flex flex-col sm:flex-row justify-between sm:items-center">
                        <h2 class="text-3xl font-bold text-white">${profileData.name}</h2>
                        ${isMyProfile ? `
                            <button id="edit-profile-btn" class="btn btn-outline mt-4 sm:mt-0">
                                <i data-lucide="edit-2" class="btn-icon"></i>
                                Edit Profile
                            </button>
                        ` : ''}
                    </div>
                    <p class="text-lg text-text-muted">${profileData.email}</p>
                    <div class="flex items-center justify-center sm:justify-start gap-2 my-2">
                        <i data-lucide="star" class="text-warning w-5 h-5" fill="currentColor"></i>
                        <span class="text-2xl font-bold text-white">${avgRating}</span>
                        <span class="text-text-muted">(${totalRatings} ratings)</span>
                    </div>
                    
                    <!-- Profile Form (for editing) -->
                    <form id="profile-edit-form" class="${isMyProfile ? '' : 'hidden'}">
                        <div class="mt-4 space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-text-muted">Description</label>
                                <textarea id="profile-desc" class="form-input" rows="3" placeholder="Tell everyone about your skills...">${profileData.description}</textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-text-muted">LinkedIn URL</label>
                                <input type="url" id="profile-linkedin" class="form-input" placeholder="https://linkedin.com/in/..." value="${profileData.linkedin || ''}">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-text-muted">GitHub URL</label>
                                <input type="url" id="profile-github" class="form-input" placeholder="https://github.com/..." value="${profileData.github || ''}">
                            </div>
                            <div id="profile-display" class="${isMyProfile ? 'hidden' : 'block'}">
                                <!-- This block is just for non-edit mode, but we hide the form instead -->
                            </div>
                            <div class_="${isMyProfile ? '' : 'hidden'}">
                                <button type="submit" id="save-profile-btn" class="btn btn-primary-sm hidden">
                                    <i data-lucide="save" class="btn-icon"></i>
                                    Save Changes
                                </button>
                                <button type="button" id="cancel-edit-btn" class="btn btn-ghost hidden">Cancel</button>
                            </div>
                        </div>
                    </form>
                    
                    <!-- Profile Display (for viewing) -->
                    <div id="profile-display-section" class="mt-4 space-y-4 ${isMyProfile ? 'block' : 'block'}">
                        <p class="text-white">${profileData.description || 'No description provided.'}</p>
                        <div class="flex flex-wrap gap-4">
                            ${profileData.linkedin ? `<a href="${profileData.linkedin}" target="_blank" class="btn btn-ghost"><i data-lucide="linkedin" class="btn-icon"></i> LinkedIn</a>` : ''}
                            ${profileData.github ? `<a href="${profileData.github}" target="_blank" class="btn btn-ghost"><i data-lucide="github" class="btn-icon"></i> GitHub</a>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Rating Section -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <!-- Leave a Rating Form -->
            <div id="rating-form-container" class="card-dark p-6 rounded-lg ${isMyProfile ? 'hidden' : ''}">
                <h3 class="text-xl font-bold text-white mb-4">Leave a Rating</h3>
                <form id="rating-form">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-text-muted mb-2">Your Rating</label>
                        <div class="star-rating">
                            <input type="radio" id="5-stars" name="rating" value="5" /><label for="5-stars">&#9733;</label>
                            <input type="radio" id="4-stars" name="rating" value="4" /><label for="4-stars">&#9733;</label>
                            <input type="radio" id="3-stars" name="rating" value="3" /><label for="3-stars">&#9733;</label>
                            <input type="radio" id="2-stars" name="rating" value="2" /><label for="2-stars">&#9733;</label>
                            <input type="radio" id="1-star" name="rating" value="1" required /><label for="1-star">&#9733;</label>
                        </div>
                    </div>
                    <div class="mb-4">
                        <label for="rating-comment" class="block text-sm font-medium text-text-muted">Your Review</label>
                        <textarea id="rating-comment" class="form-input" rows="3" placeholder="Share your experience..."></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">
                        <i data-lucide="star" class="btn-icon"></i>
                        Submit Rating
                    </button>
                </form>
            </div>
            
            <!-- Existing Reviews -->
            <div class="card-dark p-6 rounded-lg ${isMyProfile ? 'lg:col-span-2' : ''}">
                <h3 class="text-xl font-bold text-white mb-6">Reviews (${totalRatings})</h3>
                <div id="reviews-list" class="space-y-6 max-h-96 overflow-y-auto pr-2">
                    ${totalRatings > 0 ? profileData.ratings.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate()).map(review => `
                        <div class="flex gap-4">
                            <img src="${review.raterPhotoURL || `https://placehold.co/40x40/0e1224/9fb1d9?text=${review.raterName.charAt(0)}`}" alt="${review.raterName}" class="w-10 h-10 rounded-full flex-shrink-0">
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="font-semibold text-white">${review.raterName}</span>
                                    <span class="flex items-center text-sm text-warning">
                                        <i data-lucide="star" class="w-4 h-4" fill="currentColor"></i> ${review.rating}
                                    </span>
                                </div>
                                <p class="text-sm text-text-muted">${new Date(review.createdAt.toDate()).toLocaleDateString()}</p>
                                <p class="text-white mt-2">${review.comment}</p>
                            </div>
                        </div>
                    `).join('') : '<p class="text-text-muted">No reviews yet.</p>'}
                </div>
            </div>
        </div>
    `;

    // Add event listeners for this new dynamic content
    addProfileEventListeners(userId, profileData);
    lucide.createIcons(); // Re-draw icons
};

// --- Add Listeners for Profile Page ---
const addProfileEventListeners = (userId, profileData) => {
    const editBtn = document.getElementById('edit-profile-btn');
    const saveBtn = document.getElementById('save-profile-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const editForm = document.getElementById('profile-edit-form');
    const displaySection = document.getElementById('profile-display-section');
    
    // Edit/Save/Cancel logic for *my* profile
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            editForm.classList.remove('hidden');
            displaySection.classList.add('hidden');
            saveBtn.classList.remove('hidden');
            cancelBtn.classList.remove('hidden');
            editBtn.classList.add('hidden');
        });

        cancelBtn.addEventListener('click', () => {
            editForm.classList.add('hidden');
            displaySection.classList.remove('hidden');
            saveBtn.classList.add('hidden');
            cancelBtn.classList.add('hidden');
            editBtn.classList.remove('hidden');
            // Reset form to original data
            document.getElementById('profile-desc').value = profileData.description;
            document.getElementById('profile-linkedin').value = profileData.linkedin || '';
            document.getElementById('profile-github').value = profileData.github || '';
        });

        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            
            const updatedData = {
                description: document.getElementById('profile-desc').value,
                linkedin: document.getElementById('profile-linkedin').value,
                github: document.getElementById('profile-github').value,
            };
            
            try {
                const userDocRef = doc(db, 'users', userId);
                await updateDoc(userDocRef, updatedData);
                showToast('Profile updated successfully!', true);
                
                // Manually trigger cancel to reset UI
                cancelBtn.click();
                // Reload profile to show new data
                loadProfilePage(userId);

            } catch (error) {
                console.error("Error updating profile:", error);
                showToast('Failed to update profile.', false);
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = `<i data-lucide="save" class="btn-icon"></i> Save Changes`;
                lucide.createIcons();
            }
        });
    }
    
    // Rating form logic for *other* profiles
    const ratingForm = document.getElementById('rating-form');
    if (ratingForm) {
        ratingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ratingInput = document.querySelector('.star-rating input:checked');
            if (!ratingInput) {
                showToast('Please select a star rating.', false);
                return;
            }
            
            const rating = ratingInput.value;
            const comment = document.getElementById('rating-comment').value;
            const raterId = currentAuthUser.uid;
            const raterName = currentUserProfile.name;
            const raterPhotoURL = currentUserProfile.photoURL;

            // This is the new rating object
            const newRating = {
                raterId,
                raterName,
                raterPhotoURL,
                rating: parseInt(rating),
                comment,
                createdAt: new Date() // Replaced serverTimestamp() with new Date()
            };

            try {
                const userDocRef = doc(db, 'users', userId);
                
                // === FIX HERE ===
                // Find any existing rating from this user
                const existingRating = profileData.ratings.find(r => r.raterId === raterId);

                // If an existing rating was found, we must remove it first
                if (existingRating) {
                    await updateDoc(userDocRef, {
                        ratings: arrayRemove(existingRating)
                    });
                }
                // === END FIX ===

                // Then, add the new rating
                await updateDoc(userDocRef, {
                    ratings: arrayUnion(newRating)
                });
                
                showToast('Rating submitted successfully!', true);
                loadProfilePage(userId); // Reload profile to show new rating

            } catch (error) {
                console.error("Error submitting rating:", error);
                showToast('Error submitting rating. Check console.', false);
            }
        });
    }
};

// =======================================================
//  HOME PAGE LOGIC (SERVICES)
// =======================================================

// --- Render a single service card ---
const renderService = (doc) => {
    const data = doc.data();
    const isOwner = currentAuthUser && currentAuthUser.uid === data.userId;
    
    const card = document.createElement('div');
    card.className = 'card-dark service-card rounded-lg overflow-hidden'; // Added service-card class
    card.dataset.domain = data.domain; // For filtering
    
    card.innerHTML = `
        <div class="p-6">
            <div class="flex items-start justify-between">
                 <span class="inline-block bg-panel-dark text-primary-red text-xs font-semibold px-2.5 py-0.5 rounded-full border border-primary-red/50">${data.domain}</span>
                 <span class="text-xs text-text-muted">${new Date(data.createdAt?.toDate()).toLocaleDateString()}</span>
            </div>
            <h3 class="text-lg font-bold mt-4 text-white truncate">${data.title}</h3>
            <p class="mt-2 text-text-muted text-sm line-clamp-3">${data.description}</p>
            
            <div class="mt-6 pt-4 border-t border-muted-gray flex items-center justify-between">
                <!-- User Info -->
                <div class="flex items-center gap-2">
                    <img src="${data.userPhotoURL || `https://placehold.co/40x40/0e1224/9fb1d9?text=${data.userName.charAt(0)}`}" alt="${data.userName}" class="w-8 h-8 rounded-full">
                    <div>
                        <p class="text-sm font-medium text-white">${data.userName}</p>
                        <p class="text-xs text-text-muted">${data.userEmail}</p>
                    </div>
                </div>
            </div>
            <div class="mt-4 flex gap-2">
                <!-- View Profile Button -->
                <button class="btn btn-outline flex-1 view-profile-btn" data-userid="${data.userId}">
                    <i data-lucide="user" class="btn-icon"></i>
                    Profile
                </button>
                
                <!-- Connect Button -->
                <a href="mailto:${data.userEmail}?subject=Inquiry about your service: ${data.title}" class="btn btn-primary-sm flex-1">
                    <i data-lucide="mail" class="btn-icon"></i>
                    Connect
                </a>
                
                <!-- Delete Button (Owner only) -->
                ${isOwner ? `
                    <button class="btn btn-danger-sm delete-service-btn" data-docid="${doc.id}">
                        <i data-lucide="trash-2" class="btn-icon"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    servicesGrid.appendChild(card);

    // Add event listeners for dynamic buttons
    card.querySelector('.view-profile-btn')?.addEventListener('click', (e) => {
        const userId = e.currentTarget.dataset.userid;
        navigateTo('profile-page');
        loadProfilePage(userId);
    });

    card.querySelector('.delete-service-btn')?.addEventListener('click', async (e) => {
        const docId = e.currentTarget.dataset.docid;
        if (confirm('Are you sure you want to delete this service?')) {
            try {
                await deleteDoc(doc(db, 'services', docId));
                showToast('Service deleted successfully.', true);
                // The onSnapshot listener will handle removing it from the UI
            } catch (error) {
                console.error("Error deleting service:", error);
                showToast('Failed to delete service.', false);
            }
        }
    });
};

// --- Fetch and display all services in real-time ---
const attachServiceListener = () => {
    console.log('Setting up new snapshot listener for services...');
    const q = query(servicesCollection); // Removed orderBy
    
    // Stop any previous listener
    if (currentUnsubscribe) {
        currentUnsubscribe();
    }

    currentUnsubscribe = onSnapshot(q, (snapshot) => {
        console.log(`Received services snapshot. Docs count: ${snapshot.docs.length}`);
        // Sort docs in JavaScript (descending by date)
        allServices = snapshot.docs.sort((a, b) => 
            (b.data().createdAt?.toDate() || 0) - (a.data().createdAt?.toDate() || 0)
        );
        
        // Re-apply the current filter
        const activeFilter = document.querySelector('.btn-filter.active').dataset.filter;
        filterServices(activeFilter);
        
    }, (error) => {
        console.error("Error fetching services:", error);
        servicesGrid.innerHTML = `<p class="text-center text-primary-red col-span-full">${error.message}. Check console and Firebase Rules.</p>`;
    });
};

// =======================================================
//  MODAL LOGIC
// =======================================================
openModalBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    lucide.createIcons(); // Redraw icons in modal
});
closeModalBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    serviceForm.reset();
    modalError.textContent = '';
});

// --- Handle new service form submission ---
serviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentAuthUser) {
        modalError.textContent = "You must be logged in.";
        return;
    }
    
    const title = document.getElementById('service-title').value;
    const description = document.getElementById('service-description').value;
    const domain = document.getElementById('service-domain').value;

    try {
        const submitBtn = serviceForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';
        
        await addDoc(servicesCollection, {
            title: title,
            description: description,
            domain: domain,
            userId: currentAuthUser.uid,
            userName: currentUserProfile.name,
            userEmail: currentAuthUser.email,
            userPhotoURL: currentUserProfile.photoURL,
            createdAt: serverTimestamp()
        });
        
        closeModalBtn.click(); // Close and reset modal
        showToast('Service posted successfully!', true);

    } catch (error) {
        console.error("Error adding document: ", error);
        modalError.textContent = "Failed to post service. Please try again.";
    } finally {
        const submitBtn = serviceForm.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i data-lucide="send" class="btn-icon"></i> Post Service`;
        lucide.createIcons();
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
        noServicesMsg.classList.remove('hidden');
    }
    
    // Redraw all icons after adding new cards
    lucide.createIcons();
};

filterContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-filter')) {
        // Update active button style
        filterContainer.querySelectorAll('.btn-filter').forEach(btn => {
            btn.classList.remove('active'); // 'active' class handles styling via CSS
        });
        e.target.classList.add('active');

        // Perform filtering
        const filterValue = e.target.dataset.filter;
        filterServices(filterValue);
    }
});

