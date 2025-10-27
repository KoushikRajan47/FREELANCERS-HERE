// =======================================================
//  IMPORTS
// =======================================================
// We are using the CDN ESM modules
// This fixes the 'setLogLevel' error by importing it from 'firebase-app.js'
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
    orderBy,
    deleteDoc,  // <-- Import deleteDoc
    doc         // <-- Import doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =======================================================
//  FIREBASE CONFIGURATION
// =======================================================
// Using the exact config you provided
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

// Enable debug logging for Firebase
setLogLevel('debug');
console.log("Firebase Initialized with Project ID:", firebaseConfig.projectId);

// =======================================================
//  DOM ELEMENT REFERENCES
// =======================================================
const loader = document.getElementById('loader');
const authPage = document.getElementById('auth-page');
const appPage = document.getElementById('app-page');
const authError = document.getElementById('auth-error');
const userGreeting = document.getElementById('user-greeting');
const servicesGrid = document.getElementById('services-grid');
const noServicesMsg = document.getElementById('no-services-message');

// --- Auth UI ---
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginTab = document.getElementById('auth-tab-login');
const signupTab = document.getElementById('auth-tab-signup');

// --- Modal UI ---
const modal = document.getElementById('post-service-modal');
const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const serviceForm = document.getElementById('service-form');
const modalError = document.getElementById('modal-error');

// --- Filter UI ---
const filterContainer = document.getElementById('filter-container');

// =======================================================
//  AUTH UI & LOGIC
// =======================================================

// --- Tab switching logic ---
loginTab.addEventListener('click', () => {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    loginTab.classList.add('border-blue-500', 'text-blue-600');
    loginTab.classList.remove('border-transparent', 'text-gray-500');
    signupTab.classList.add('border-transparent', 'text-gray-500');
    signupTab.classList.remove('border-blue-500', 'text-blue-600');
    authError.textContent = '';
});

signupTab.addEventListener('click', () => {
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    signupTab.classList.add('border-blue-500', 'text-blue-600');
    signupTab.classList.remove('border-transparent', 'text-gray-500');
    loginTab.classList.add('border-transparent', 'text-gray-500');
    loginTab.classList.remove('border-blue-500', 'text-blue-600');
    authError.textContent = '';
});

// --- Auth state listener ---
onAuthStateChanged(auth, user => {
    loader.classList.add('hidden'); // Hide loader once auth state is determined
    if (user) {
        // User is logged in
        console.log("Auth state changed: User signed in:", user.uid);
        authPage.classList.add('hidden');
        appPage.classList.remove('hidden');
        userGreeting.textContent = `Hello, ${user.displayName || user.email}!`;
        fetchAndDisplayServices(); // Fetch services for the logged-in user
    } else {
        // User is logged out
        console.log("Auth state changed: User signed out.");
        appPage.classList.add('hidden');
        authPage.classList.remove('hidden');
        userGreeting.textContent = '';
        
        // Clear services and stop listener if logged out
        servicesGrid.innerHTML = '';
        if(unsubscribe) unsubscribe();
    }
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
        await updateProfile(userCredential.user, { displayName: name });
        console.log("User signed up:", userCredential.user.uid);
        // onAuthStateChanged will handle fetching services
        signupForm.reset();
    } catch (error) {
        console.error("Signup error:", error);
        authError.textContent = error.message;
    }
});

// --- Handle Login ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    authError.textContent = '';

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("User logged in:", userCredential.user.uid);
        // onAuthStateChanged will handle fetching services
        loginForm.reset();
    } catch (error) {
        console.error("Login error:", error);
        authError.textContent = error.message;
    }
});

// --- Handle Logout ---
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth);
});

// =======================================================
//  FIRESTORE & APP LOGIC
// =======================================================
// Using the simple "services" collection path
const servicesCollection = collection(db, "services");

let allServices = []; // Cache for filtering
let unsubscribe = null; // To store the listener

// --- Render a single service card ---
const renderService = (doc) => {
    const data = doc.data();
    const card = document.createElement('div');
    // We add the service doc.id to the card's dataset for easy access
    card.dataset.id = doc.id; 
    card.className = 'bg-white rounded-lg shadow-md overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 service-card';
    card.dataset.domain = data.domain; // For filtering
    
    const timestamp = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
    
    // Check if the logged-in user is the author of this service
    const isOwner = auth.currentUser && auth.currentUser.uid === data.userId;
    
    // Create the "Remove" button only if the user is the owner
    const ownerButton = isOwner 
        ? `<button class="delete-btn bg-red-500 text-white px-3 py-1 rounded-md text-xs font-semibold hover:bg-red-600 transition">Remove</button>`
        : `<a href="mailto:${data.userEmail}?subject=Inquiry about your service: ${data.title}" class="bg-green-500 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-green-600 transition">Connect</a>`;

    card.innerHTML = `
        <div class="p-6">
            <div class="flex items-start justify-between">
                 <span class="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">${data.domain}</span>
                 <span class="text-xs text-gray-500">${timestamp.toLocaleDateString()}</span>
            </div>
            <h3 class="text-lg font-bold mt-4 text-gray-900">${data.title}</h3>
            <p class="mt-2 text-gray-600 text-sm line-clamp-3">${data.description}</p>
            <div class="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
                <div>
                    <p class="text-sm font-medium text-gray-800">${data.userName || "Freelancer"}</p>
                    <p class="text-xs text-gray-500">${data.userEmail}</p>
                </div>
                <!-- This will be either the 'Connect' or 'Remove' button -->
                ${ownerButton}
            </div>
        </div>
    `;
    servicesGrid.appendChild(card);
}
        
// --- Fetch and display all services in real-time ---
const fetchAndDisplayServices = () => {
    // Unsubscribe from any previous listener
    if (unsubscribe) {
        console.log("Unsubscribing from previous listener.");
        unsubscribe();
    }

    console.log("Setting up new snapshot listener for services...");
    
    // ===================================================================
    // THE FIX:
    // We remove `orderBy('createdAt', 'desc')` from the query, as it
    // requires a manual Firestore Index to be created.
    // const q = query(servicesCollection, orderBy('createdAt', 'desc')); // <-- This was causing the 400 Bad Request error
    
    // Now we fetch *without* ordering.
    const q = query(servicesCollection);
    // ===================================================================
    
    unsubscribe = onSnapshot(q, (snapshot) => {
        console.log("Received services snapshot. Docs count:", snapshot.docs.length);
        servicesGrid.innerHTML = ''; // Clear existing grid
        
        // ===================================================================
        // THE FIX (Part 2):
        // We sort the results here in JavaScript (client-side)
        // to show newest first.
        allServices = snapshot.docs.sort((a, b) => {
            const dateA = a.data().createdAt?.toDate ? a.data().createdAt.toDate() : new Date(0);
            const dateB = b.data().createdAt?.toDate ? b.data().createdAt.toDate() : new Date(0);
            return dateB - dateA; // Sort descending (newest first)
        });
        // ===================================================================
        
        if(allServices.length === 0) {
            noServicesMsg.classList.remove('hidden');
        } else {
            noServicesMsg.classList.add('hidden');
            allServices.forEach(doc => renderService(doc));
        }
        
        // After initial load, apply any active filter
        const activeFilterBtn = document.querySelector('.filter-btn.bg-blue-600');
        if (activeFilterBtn) {
            const activeFilter = activeFilterBtn.dataset.filter;
            if(activeFilter !== 'all') {
                filterServices(activeFilter);
            }
        }

    }, (error) => {
        console.error("Error fetching services: ", error);
        servicesGrid.innerHTML = `<p class="text-red-500 col-span-full text-center">Error: ${error.message}</p>`;
    });
}

// --- Handle Deleting a Service ---
servicesGrid.addEventListener('click', async (e) => {
    // Check if the clicked element is our delete button
    if (e.target.classList.contains('delete-btn')) {
        // Find the parent card and get its data-id
        const card = e.target.closest('.service-card');
        const serviceId = card.dataset.id;
        
        if (!serviceId) {
            console.error("Could not find service ID");
            return;
        }

        // Ask for confirmation (using a simple, non-blocking confirm)
        // We avoid alert() and confirm() in production, but this is a simple demo
        // A custom modal would be better.
        const wantsToDelete = confirm("Are you sure you want to remove this service?");

        if (wantsToDelete) {
            console.log("Deleting service:", serviceId);
            try {
                // Create a document reference
                const serviceDocRef = doc(db, "services", serviceId);
                // Delete the document
                await deleteDoc(serviceDocRef);
                console.log("Service deleted successfully");
                // The onSnapshot listener will automatically re-render the list
            } catch (error) {
                console.error("Error removing document: ", error);
            }
        }
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
    const user = auth.currentUser;
    if (!user) { // Simplified check
        modalError.textContent = "You must be logged in to post a service.";
        console.warn("Post attempt by non-logged-in user.");
        return;
    }
    
    const title = document.getElementById('service-title').value;
    const description = document.getElementById('service-description').value;
    const domain = document.getElementById('service-domain').value;

    try {
        console.log("Attempting to add document as user:", user.uid);
        const docRef = await addDoc(servicesCollection, {
            title: title,
            description: description,
            domain: domain,
            userId: user.uid,
            userName: user.displayName,
            userEmail: user.email,
            createdAt: serverTimestamp()
        });
        console.log("Document written with ID: ", docRef.id);
        // Close and reset modal on success
        closeModalBtn.click();
    } catch (error) {
        console.error("Error adding document: ", error);
        modalError.textContent = `Failed to post service: ${error.message}`;
    }
});

// =======================================================
//  FILTERING LOGIC
// =======================================================

// --- Abstracted filter function ---
const filterServices = (filterValue) => {
    servicesGrid.innerHTML = ''; // Clear grid before re-rendering
    
    const filteredServices = filterValue === 'all'
        ? allServices 
        : allServices.filter(doc => doc.data().domain === filterValue);
    
    if (filteredServices.length > 0) {
        noServicesMsg.classList.add('hidden');
        filteredServices.forEach(doc => renderService(doc));
    } else {
        noServicesMsg.classList.remove('hidden');
    }
}

// --- Filter button click listener ---
filterContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-btn')) {
        // Update active button style
        filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-white', 'text-gray-700');
        });
        e.target.classList.add('bg-blue-600', 'text-white');
        e.target.classList.remove('bg-white', 'text-gray-700');

        // Perform filtering
        const filterValue = e.target.dataset.filter;
        filterServices(filterValue);
    }
});


