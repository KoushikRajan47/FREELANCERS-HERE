rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
  
    // Public services collection
    match /services/{document=**} {
      // Allow 'get' (single doc) and 'list' (collection query) for everyone
      allow get, list: if true; 
      
      // Allow 'create' (addDoc) for logged-in users
      allow create: if request.auth != null;
      
      // Allow 'delete' only if you are the user who created it
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // User profile data
    match /users/{userId} {
      // Allow 'get' (read single profile) for everyone
      allow get: if true;
      
      // Allow 'list' (querying users) for logged-in users
      allow list: if request.auth != null;
      
      // Allow 'create' only if the user is creating their *own* profile
      allow create: if request.auth != null && request.auth.uid == userId;
      
      // Allow 'update' if:
      // 1. You are logged in AND
      // 2. You are updating your *own* profile (e.g., description, links)
      // 3. OR you are updating *someone else's* profile (e.g., adding a rating)
      allow update: if request.auth != null;
    }
  }
}
