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
let persistenceReady = Promise.resolve();

try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        // Explicitly set persistence to local (it keeps the user logged in even after browser restart)
        persistenceReady = setPersistence(auth, browserLocalPersistence).catch(error => {
                console.error("Firebase persistence error:", error);
        });
        analytics = getAnalytics(app);
} catch (error) {
        console.error("Firebase initialization failed:", error);
}

export { app, auth };

// Do not treat the initial empty currentUser as a signed-out session.
const authReady = persistenceReady.then(async () => {
        if (!auth) throw new Error('Authentication is not initialized. Please reload the page.');
        await auth.authStateReady();
});

async function refreshVerification(user) {
        if (!user || user.emailVerified) return user;
        await user.reload();
        const refreshed = auth.currentUser;
        if (refreshed?.uid !== user.uid) return null;
        if (refreshed.emailVerified) await refreshed.getIdToken(true);
        return refreshed;
}

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
                await authReady;
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
                await authReady;
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
                await authReady;
                if (!auth.currentUser) {
                        return { success: false, error: 'No signed-in user.' };
                }
                await auth.currentUser.reload();
                await auth.currentUser?.getIdToken(true);
                return { success: true, user: auth.currentUser };
        } catch (error) {
                return { success: false, error: error.message };
        }
};

export const signInWithGoogle = async () => {
        try {
                await authReady;
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

export const onAuthUserChanged = (callback, onError = error => console.error('Could not restore your session:', error)) => {
        let stopped = false;
        let unsubscribe = () => { };
        let revision = 0;
        authReady.then(() => {
                if (stopped) return;
                unsubscribe = onAuthStateChanged(auth, async user => {
                        const observedRevision = ++revision;
                        let confirmed = user;
                        try { confirmed = await refreshVerification(user); }
                        catch (error) { console.warn('Could not refresh email verification:', error); }
                        if (!stopped && observedRevision === revision) callback(confirmed);
                });
        }).catch(error => { if (!stopped) onError(error); });
        return () => { stopped = true; unsubscribe(); };
};

export const waitForAuthUser = async () => {
        await authReady;
        const user = await refreshVerification(auth.currentUser);
        if (!user) throw new Error('Please sign in to continue.');
        if (!user.emailVerified) throw new Error('Please verify your email address before continuing.');
        return user;
};

export const getCurrentUserToken = async () => {
        const user = await waitForAuthUser();
        // Let Firebase refresh expired tokens without reloading the account for
        // every API request.
        const token = await user.getIdToken();

        if (!token || auth.currentUser?.uid !== user.uid) {
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

        onAuthUserChanged((user) => {
                const verifiedUser = user && user.emailVerified ? user : null;
                updateNavigation(verifiedUser);
        });
};

const updateNavigation = (user) => {
        updateAiSalesVisibility(user);

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
                        import('./history.js?v=20261103-session').then(module => {
                                module.loadAppealHistory(user);
                        }).catch(err => console.error("Failed to load history module:", err));
                } else {
                        dashboard.style.display = 'none';
                }
        }
};

const updateAiSalesVisibility = (user) => {
        document.getElementById('admin-ai-sales-link')?.remove();

        if (String(user?.email || '').trim().toLowerCase() !== 'vuchicago@gmail.com') {
                return;
        }

        const toolsGrid = document.querySelector('#tools-preview .tool-link-grid');
        if (!toolsGrid) return;

        const aiSalesLink = document.createElement('a');
        aiSalesLink.id = 'admin-ai-sales-link';
        aiSalesLink.href = 'ai-sales/';
        aiSalesLink.className = 'dashboard-card tool-link-card';
        aiSalesLink.innerHTML = `
                <span class="section-badge">Private AI Sales</span>
                <h3>Sales Trainer Avatar</h3>
                <p>Practice discovery-call responses with the private real-time 3D sales trainer.</p>
                <span class="feature-link">Open Sales Trainer →</span>
        `;
        toolsGrid.appendChild(aiSalesLink);
};

const updateAuthButton = (container, user) => {
        container.replaceChildren();
        if (!user) {
                container.innerHTML = '<a href="login.html" class="header-login">Sign in</a>';
                return;
        }
        const menu = document.createElement('div');
        menu.className = 'nav-dropdown account-menu';
        menu.innerHTML = `<button type="button" class="nav-dropdown-trigger account-trigger" aria-haspopup="true" aria-expanded="false" aria-controls="account-menu-links" aria-label="Account menu"><span class="account-avatar" aria-hidden="true">${escapeHtml((user.email || 'A').charAt(0).toUpperCase())}</span><span>Account</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button><div class="nav-dropdown-menu" id="account-menu-links"><a href="index.html#user-dashboard">My Account</a><a href="#" data-sign-out>Logout</a></div>`;
        menu.querySelector('[data-sign-out]').addEventListener('click', event => window.handleLogout(event));
        container.append(menu);
        appendWorkspaceButtonForRole(menu, user);
};

async function appendWorkspaceButtonForRole(menu, user) {
        const links = menu.querySelector('.nav-dropdown-menu');
        if (String(user.email || '').trim().toLowerCase() === 'vuchicago@gmail.com') {
                links.querySelector('[data-sign-out]').insertAdjacentHTML('beforebegin', '<a href="admin.html" data-role-workspace>Admin</a>');
                return;
        }
        try {
                const response = await authFetch('/api/admin/roles?checkRoleOnly=true');
                if (!response.ok || !menu.isConnected) return;
                const data = await response.json();
                if (!data.role || links.querySelector('[data-role-workspace]')) return;
                const link = document.createElement('a');
                link.href = 'admin.html';
                link.dataset.roleWorkspace = 'true';
                link.textContent = data.role === 'partner' ? 'Partner Inbox' : 'Admin';
                links.querySelector('[data-sign-out]').before(link);
        } catch (error) {
                console.warn('Could not load account role:', error);
        }
}

function escapeHtml(value) {
        return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
}

const updateMobileMenu = (ulElement, user) => {
        if (!ulElement) return;
        ulElement.querySelectorAll('.mobile-auth-item').forEach(item => item.remove());
        if (!user) {
                ulElement.insertAdjacentHTML('beforeend', '<li class="mobile-auth-item"><a href="login.html">Sign in</a></li>');
                return;
        }
        ulElement.insertAdjacentHTML('beforeend', `<li class="mobile-auth-item mobile-account-heading">Account</li><li class="mobile-auth-item"><a href="index.html#user-dashboard">My Account</a></li><li class="mobile-auth-item" data-mobile-workspace></li><li class="mobile-auth-item"><a href="#" data-mobile-logout>Logout</a></li>`);
        ulElement.querySelector('[data-mobile-logout]')?.addEventListener('click', event => window.handleLogout(event));
        const workspace = ulElement.querySelector('[data-mobile-workspace]');
        const primary = String(user.email || '').trim().toLowerCase() === 'vuchicago@gmail.com';
        if (primary) workspace.innerHTML = '<a href="admin.html">Admin</a>';
        else {
                authFetch('/api/admin/roles?checkRoleOnly=true').then(async response => {
                        if (!response.ok || !workspace.isConnected) return;
                        const data = await response.json();
                        if (data.role) { workspace.innerHTML = `<a href="admin.html">${data.role === 'partner' ? 'Partner Inbox' : 'Admin'}</a>`; workspace.hidden = false; }
                }).catch(error => console.warn('Could not load mobile account role:', error));
        }
        if (!primary) workspace.hidden = true;
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
