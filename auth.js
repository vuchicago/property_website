// Firebase Authentication Logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// Firebase Configuration
const firebaseConfig = {
        apiKey: "AIzaSyC_dBdm2F3zkzlP_540C4QgLAZhnb9a9Sc",
        authDomain: "cookcounty-tax-compare.firebaseapp.com",
        projectId: "cookcounty-tax-compare",
        storageBucket: "cookcounty-tax-compare.firebasestorage.app",
        messagingSenderId: "1078351634043",
        appId: "1:1078351634043:web:4b8dabd97ad2c072e8ccde",
        measurementId: "G-M88E80MJGJ"
};

// Initialize Firebase
let app;
let auth;
let analytics;

try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        analytics = getAnalytics(app);
} catch (error) {
        console.error("Firebase initialization failed:", error);
}

// Authentication Functions
export const loginUser = async (email, password) => {
        try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                return { success: true, user: userCredential.user };
        } catch (error) {
                return { success: false, error: error.message };
        }
};

export const registerUser = async (email, password) => {
        try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                return { success: true, user: userCredential.user };
        } catch (error) {
                return { success: false, error: error.message };
        }
};

export const logoutUser = async () => {
        try {
                await signOut(auth);
                return { success: true };
        } catch (error) {
                return { success: false, error: error.message };
        }
};

// UI State Management
export const initAuthUI = () => {
        if (!auth) return;

        onAuthStateChanged(auth, (user) => {
                updateNavigation(user);
        });
};

const updateNavigation = (user) => {
        // Desktop Nav
        const navLinks = document.getElementById('nav-links');
        updateMenu(navLinks, user, 'desktop-auth-link');

        // Mobile Nav
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu) {
                const mobileNavLinks = mobileMenu.querySelector('ul');
                updateMenu(mobileNavLinks, user, 'mobile-auth-link');
        }
};

const updateMenu = (ulElement, user, elementId) => {
        if (!ulElement) return;

        // Try to find existing auth link OR the static placeholder
        let li = document.getElementById(elementId);
        const placeholder = document.getElementById('auth-link-placeholder');

        // If we have a placeholder and no dynamic link yet, use the placeholder as our li
        if (!li && placeholder) {
                li = placeholder;
                li.id = elementId; // Re-assign ID so we can find it later
        } else if (!li) {
                // Create new if neither exists (fallback)
                li = document.createElement('li');
                li.id = elementId;
                ulElement.appendChild(li);
        }

        li.innerHTML = ''; // Clear current content

        if (user) {
                // User is logged in
                import('./appeal.js').then(module => {
                        window.openAppealModal = module.openAppealModal;
                });

                const appealBtn = document.createElement('a');
                appealBtn.href = "#";
                appealBtn.className = "btn btn-sm btn-primary";
                appealBtn.style.marginRight = "1rem";
                appealBtn.style.padding = "0.5rem 1rem";
                appealBtn.innerHTML = "Appeal my property tax";
                appealBtn.onclick = (e) => {
                        e.preventDefault();
                        if (window.openAppealModal) window.openAppealModal();
                };

                const logoutLink = document.createElement('a');
                logoutLink.href = "#";
                logoutLink.onclick = (e) => window.handleLogout(e);
                logoutLink.textContent = `Logout (${user.email})`;

                li.appendChild(appealBtn);
                li.appendChild(logoutLink);
        } else {
                // User is logged out
                li.innerHTML = `<a href="login.html" class="btn btn-sm btn-primary" style="padding: 0.5rem 1rem; color: white;">Login</a>`;
        }
};

// Global logout handler for onclick attribute
window.handleLogout = async (e) => {
        e.preventDefault();
        const result = await logoutUser();
        if (result.success) {
                window.location.reload();
        } else {
                alert('Logout failed: ' + result.error);
        }
};
