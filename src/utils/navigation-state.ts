import { persistentStorage } from './persistent-storage'

/**
 * Navigation State Manager
 * 
 * Solves the PWA state restoration problem where users lose their navigation context
 * when returning to the app after being away.
 */

interface NavigationState {
    path: string;
    query: Record<string, string>;
    timestamp: number;
    zoneId?: string;
}

interface PageState {
    [key: string]: any;
}

class NavigationStateManager {
    private static instance: NavigationStateManager;
    private readonly STATE_KEY = 'nav_state';
    private readonly PAGE_STATE_PREFIX = 'page_state_';
    private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours
    private isInitialized = false;

    static getInstance(): NavigationStateManager {
        if (!NavigationStateManager.instance) {
            NavigationStateManager.instance = new NavigationStateManager();
        }
        return NavigationStateManager.instance;
    }

    /**
     * Optional explicit initialization to load from IDB
     */
    async init(): Promise<void> {
        if (this.isInitialized) return;
        this.isInitialized = true;

        try {
            // Mirror IDB back to localStorage if localStorage is empty
            const idbState = await persistentStorage.getItem<NavigationState>(this.STATE_KEY);
            if (idbState && !localStorage.getItem(this.STATE_KEY)) {
                localStorage.setItem(this.STATE_KEY, JSON.stringify(idbState));

            }
        } catch (error) {
 console.warn('Failed to init navigation state from IDB:', error);
        }
    }

    /**
     * Save current navigation state
     * Mirrors to IndexedDB for maximum durability
     */
    saveNavigationState(path: string, query: Record<string, string> = {}, zoneId?: string): void {
        const state: NavigationState = {
            path,
            query,
            timestamp: Date.now(),
            zoneId
        };

        try {
            // Sync writes
            sessionStorage.setItem(this.STATE_KEY, JSON.stringify(state));
            localStorage.setItem(this.STATE_KEY, JSON.stringify(state));

            // Async mirror to IndexedDB
            persistentStorage.setItem(this.STATE_KEY, state);
        } catch (error) {
 console.warn('Failed to save navigation state:', error);
        }
    }

    /**
     * Get saved navigation state
     */
    getNavigationState(currentZoneId?: string): NavigationState | null {
        try {
            let stateStr = sessionStorage.getItem(this.STATE_KEY);
            if (!stateStr) {
                stateStr = localStorage.getItem(this.STATE_KEY);
            }

            if (!stateStr) return null;

            const state: NavigationState = JSON.parse(stateStr);

            // Check if expired (24 hours)
            if (Date.now() - state.timestamp > this.TTL) {
                this.clearNavigationState();
                return null;
            }

            // Zone safety
            if (currentZoneId && state.zoneId && state.zoneId !== currentZoneId) {
                return null;
            }

            return state;
        } catch (error) {
 console.warn('Failed to get navigation state:', error);
            return null;
        }
    }

    /**
     * Clear navigation state
     */
    clearNavigationState(): void {
        try {
            sessionStorage.removeItem(this.STATE_KEY);
            localStorage.removeItem(this.STATE_KEY);
            persistentStorage.removeItem(this.STATE_KEY);
        } catch (error) {
 console.warn('Failed to clear navigation state:', error);
        }
    }

    /**
     * Save page-specific state
     */
    savePageState(pageKey: string, state: PageState, zoneId?: string): void {
        const key = `${this.PAGE_STATE_PREFIX}${pageKey}`;
        const data = {
            state,
            timestamp: Date.now(),
            zoneId
        };

        try {
            sessionStorage.setItem(key, JSON.stringify(data));
            localStorage.setItem(key, JSON.stringify(data));
            persistentStorage.setItem(key, data);
        } catch (error) {
 console.warn(`Failed to save page state for ${pageKey}:`, error);
        }
    }

    /**
     * Get page-specific state
     */
    getPageState(pageKey: string, currentZoneId?: string): PageState | null {
        const key = `${this.PAGE_STATE_PREFIX}${pageKey}`;

        try {
            let dataStr = sessionStorage.getItem(key);
            if (!dataStr) {
                dataStr = localStorage.getItem(key);
            }

            if (!dataStr) return null;

            const data = JSON.parse(dataStr);

            // Check expiration
            if (Date.now() - data.timestamp > this.TTL) {
                this.clearPageState(pageKey);
                return null;
            }

            // Zone safety
            if (currentZoneId && data.zoneId && data.zoneId !== currentZoneId) {
                return null;
            }

            return data.state;
        } catch (error) {
 console.warn(`Failed to get page state for ${pageKey}:`, error);
            return null;
        }
    }

    /**
     * Clear page-specific state
     */
    clearPageState(pageKey: string): void {
        const key = `${this.PAGE_STATE_PREFIX}${pageKey}`;
        try {
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
            persistentStorage.removeItem(key);
        } catch (error) {
 console.warn(`Failed to clear page state for ${pageKey}:`, error);
        }
    }

    /**
     * Clear all navigation and page states
     */
    clearAll(): void {
        try {
            this.clearNavigationState();

            // Clear page states from storage
            const keysToRemove: string[] = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key?.startsWith(this.PAGE_STATE_PREFIX)) keysToRemove.push(key);
            }
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(this.PAGE_STATE_PREFIX)) keysToRemove.push(key);
            }

            keysToRemove.forEach(key => {
                sessionStorage.removeItem(key);
                localStorage.removeItem(key);
                persistentStorage.removeItem(key);
            });
        } catch (error) {
 console.warn('Failed to clear all states:', error);
        }
    }

    /**
     * Build full URL from navigation state
     */
    buildUrlFromState(state: NavigationState): string {
        const queryString = Object.entries(state.query)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join('&');

        return queryString ? `${state.path}?${queryString}` : state.path;
    }

    /**
     * Parse URL into navigation state
     */
    parseUrl(url: string, zoneId?: string): NavigationState {
        const [path, queryString] = url.split('?');
        const query: Record<string, string> = {};

        if (queryString) {
            queryString.split('&').forEach(param => {
                const [key, value] = param.split('=');
                if (key && value) {
                    query[key] = decodeURIComponent(value);
                }
            });
        }

        return {
            path,
            query,
            timestamp: Date.now(),
            zoneId
        };
    }
}

export const navigationStateManager = NavigationStateManager.getInstance();

export function useNavigationState() {
    return {
        saveState: (path: string, query: Record<string, string>, zoneId?: string) =>
            navigationStateManager.saveNavigationState(path, query, zoneId),

        getState: (zoneId?: string) =>
            navigationStateManager.getNavigationState(zoneId),

        clearState: () =>
            navigationStateManager.clearNavigationState(),

        savePageState: (pageKey: string, state: PageState, zoneId?: string) =>
            navigationStateManager.savePageState(pageKey, state, zoneId),

        getPageState: (pageKey: string, zoneId?: string) =>
            navigationStateManager.getPageState(pageKey, zoneId),

        clearPageState: (pageKey: string) =>
            navigationStateManager.clearPageState(pageKey),

        buildUrl: (state: NavigationState) =>
            navigationStateManager.buildUrlFromState(state),

        parseUrl: (url: string, zoneId?: string) =>
            navigationStateManager.parseUrl(url, zoneId)
    };
}
