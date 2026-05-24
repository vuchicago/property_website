// Firebase Authentication Logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
        // Explicitly set persistence to local (it keeps the user logged in even after browser restart)
        setPersistence(auth, browserLocalPersistence).catch(error => {
                console.error("Firebase persistence error:", error);
        });
        analytics = getAnalytics(app);
} catch (error) {
        console.error("Firebase initialization failed:", error);
}

export { app, auth };

function emailVerificationActionSettings() {
        if (typeof window === 'undefined') {
                return undefined;
        }

        return {
                url: `${window.location.origin}/login.html?verified=1`,
                handleCodeInApp: false
        };
}

// Authentication Functions
export const loginUser = async (email, password) => {
        try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                if (!userCredential.user.emailVerified) {
                        await sendEmailVerification(userCredential.user, emailVerificationActionSettings()).catch(() => { });
                }
                return { success: true, user: userCredential.user };
        } catch (error) {
                return { success: false, code: error.code, error: getFriendlyAuthError(error, email) };
        }
};

export const registerUser = async (email, password) => {
        try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                try {
                        await sendEmailVerification(userCredential.user, emailVerificationActionSettings());
                        return {
                                success: true,
                                user: userCredential.user,
                                emailVerificationSent: true
                        };
                } catch (verificationError) {
                        return {
                                success: true,
                                user: userCredential.user,
                                emailVerificationSent: false,
                                warning: 'Account created, but the verification email could not be sent.'
                        };
                }
        } catch (error) {
                return { success: false, code: error.code, error: getFriendlyAuthError(error, email) };
        }
};

export const resetPasswordForEmail = async (email) => {
        try {
                await sendPasswordResetEmail(auth, email, {
                        url: `${window.location.origin}/login.html`,
                        handleCodeInApp: false
                });
                return { success: true };
        } catch (error) {
                return { success: false, code: error.code, error: getFriendlyAuthError(error, email) };
        }
};

function getFriendlyAuthError(error, email = '') {
        const cleanEmail = String(email || '').trim();
        const quotedEmail = cleanEmail || 'that email';

        switch (error?.code) {
                case 'auth/invalid-credential':
                case 'auth/user-not-found':
                        return `Account not found. We can't find an email with ${quotedEmail}. Please double check it and sign in again.`;
                case 'auth/wrong-password':
                        return 'That password does not match this account. Please try again or reset your password.';
                case 'auth/too-many-requests':
                        return 'Too many unsuccessful sign-in attempts. Please reset your password using the email link below, then try signing in again.';
                case 'auth/invalid-email':
                        return 'Please enter a valid email address.';
                case 'auth/email-already-in-use':
                        return 'An account already exists for this email. Please sign in instead.';
                case 'auth/weak-password':
                        return 'Please use a stronger password with at least 6 characters.';
                default:
                        return error?.message || 'Something went wrong. Please try again.';
        }
}

export const sendCurrentUserVerificationEmail = async () => {
        try {
                if (!auth.currentUser) {
                        throw new Error('Please sign in before requesting a verification email.');
                }
                await sendEmailVerification(auth.currentUser, emailVerificationActionSettings());
                return { success: true };
        } catch (error) {
                return { success: false, error: error.message };
        }
};

export const refreshCurrentUser = async () => {
        try {
                if (!auth.currentUser) {
                        return { success: false, error: 'No signed-in user.' };
                }
                await auth.currentUser.reload();
                return { success: true, user: auth.currentUser };
        } catch (error) {
                return { success: false, error: error.message };
        }
};

export const signInWithGoogle = async () => {
        try {
                const provider = new GoogleAuthProvider();
                provider.setCustomParameters({ prompt: 'select_account' });
                const userCredential = await signInWithPopup(auth, provider);
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

export const onAuthUserChanged = (callback) => {
        if (!auth) return () => { };
        return onAuthStateChanged(auth, callback);
};

export const waitForAuthUser = async () => {
        if (!auth) {
                throw new Error('Authentication is not initialized.');
        }

        if (auth.currentUser) {
                if (!auth.currentUser.emailVerified) {
                        await signOut(auth).catch(() => { });
                        throw new Error('Please verify your email address before continuing.');
                }
                return auth.currentUser;
        }

        return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                        unsubscribe();
                        reject(new Error('Please log in again before continuing.'));
                }, 8000);

                const unsubscribe = onAuthStateChanged(auth, (user) => {
                        if (!user) return;
                        if (!user.emailVerified) {
                                clearTimeout(timeout);
                                unsubscribe();
                                signOut(auth).catch(() => { });
                                reject(new Error('Please verify your email address before continuing.'));
                                return;
                        }
                        clearTimeout(timeout);
                        unsubscribe();
                        resolve(user);
                }, (error) => {
                        clearTimeout(timeout);
                        unsubscribe();
                        reject(error);
                });
        });
};

export const getCurrentUserToken = async () => {
        const user = await waitForAuthUser();
        await user.reload();
        const refreshedUser = auth.currentUser || user;
        const token = await refreshedUser.getIdToken(true);

        if (!token) {
                throw new Error('Could not verify your login. Please log in again.');
        }

        return token;
};

export const authFetch = async (url, options = {}) => {
        const token = await getCurrentUserToken();
        const headers = new Headers(options.headers || {});
        headers.set('Authorization', `Bearer ${token}`);
        headers.set('X-Firebase-Auth', token);

        return fetch(url, {
                ...options,
                headers
        });
};

// UI State Management
export const initAuthUI = () => {
        if (!auth) return;

        onAuthStateChanged(auth, (user) => {
                const verifiedUser = user && user.emailVerified ? user : null;
                updateNavigation(verifiedUser);
                if (user && !user.emailVerified) {
                        signOut(auth).catch(error => console.error('Failed to sign out unverified user:', error));
                }
        });
};

const updateNavigation = (user) => {
        // Desktop Nav Action Button
        const desktopContainer = document.getElementById('auth-action-container');
        if (desktopContainer) {
                updateAuthButton(desktopContainer, user);
        }

        // Mobile Nav
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu) {
                const mobileNavLinks = mobileMenu.querySelector('ul');
                updateMobileMenu(mobileNavLinks, user);
        }

        // Dashboard Visibility
        const dashboard = document.getElementById('user-dashboard');
        if (dashboard) {
                if (user) {
                        dashboard.style.display = 'block';
                        // Load history
                        import('./history.js?v=20260524-login-user-pass').then(module => {
                                module.loadAppealHistory(user);
                        }).catch(err => console.error("Failed to load history module:", err));
                } else {
                        dashboard.style.display = 'none';
                }
        }
};

const updateAuthButton = (container, user) => {
        container.innerHTML = ''; // Clear current

        if (user) {
                // User is logged in
                import('./appeal.js?v=20260521-address-suggestions').then(module => {
                        window.openAppealModal = module.openAppealModal;
                });

                // Create Appeal Button
                const appealBtn = document.createElement('a');
                appealBtn.href = "#";
                appealBtn.className = "cta-btn"; // Use same style as original "Get Started"
                appealBtn.style.marginRight = "10px";
                appealBtn.innerHTML = `
            <span>Appeal Now</span>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
                appealBtn.onclick = (e) => {
                        e.preventDefault();
                        if (window.openAppealModal) window.openAppealModal();
                };

                // Create Account History Button
                const historyBtn = document.createElement('a');
                historyBtn.href = "login.html";
                historyBtn.className = "btn btn-sm btn-secondary";
                historyBtn.style.marginLeft = "0.5rem";
                historyBtn.textContent = "My Account";
                historyBtn.onclick = (e) => {
                        const dashboard = document.getElementById('user-dashboard');
                        if (dashboard) {
                                e.preventDefault();
                                dashboard.scrollIntoView({ behavior: 'smooth' });
                        }
                };

                // Create Logout Button (smaller or icon?)
                const logoutBtn = document.createElement('a');
                logoutBtn.href = "#";
                logoutBtn.className = "btn btn-sm btn-secondary";
                logoutBtn.style.marginLeft = "0.5rem";
                logoutBtn.textContent = "Logout";
                logoutBtn.onclick = (e) => window.handleLogout(e);

                container.style.display = 'flex';
                container.style.alignItems = 'center';

                container.appendChild(appealBtn);
                container.appendChild(historyBtn);
                container.appendChild(logoutBtn);

        } else {
                // User is logged out - Show "Login" (formerly Get Started functionality)
                container.innerHTML = `
            <a href="login.html" class="cta-btn">
                <span>Login</span>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </a>
        `;
        }
};

const updateMobileMenu = (ulElement, user) => {
        if (!ulElement) return;
        let li = document.getElementById('mobile-auth-link');
        if (!li) {
                li = document.createElement('li');
                li.id = 'mobile-auth-link';
                ulElement.appendChild(li);
        }

        li.innerHTML = '';
        if (user) {
                li.innerHTML = `<a href="#" onclick="window.handleLogout(event)">Logout (${user.email})</a>`;
                // Add appeal link to mobile menu too if desired
                const appealLi = document.createElement('li');
                appealLi.innerHTML = `<a href="#" onclick="import('./appeal.js?v=20260521-address-suggestions').then(m=>m.openAppealModal())">Appeal Now</a>`;
                ulElement.insertBefore(appealLi, li);
        } else {
                li.innerHTML = `<a href="login.html">Login</a>`;
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
