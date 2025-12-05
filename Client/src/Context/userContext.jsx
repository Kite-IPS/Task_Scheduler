import React, { createContext, useEffect, useState, useCallback } from 'react'
import axiosInstance from '../Utils/axiosInstance';
import { API_PATH } from '../Utils/apiPath';

// Create a UserContext
export const UserContext = createContext({
    user: null,
    updateUser: () => {},
    clearUser: () => {},
    loading: true
});

// Helper functions for persistent storage
const saveUserToStorage = (userData) => {
    if (!userData) return;
    
    // Store essential user data in localStorage for persistence across refreshes
    localStorage.setItem('userData', JSON.stringify({
        id: userData.id,
        email: userData.email,
        role: userData.role,
        full_name: userData.full_name,
        is_superuser: userData.is_superuser,
        department: userData.department
    }));
};

const loadUserFromStorage = () => {
    const userData = localStorage.getItem('userData');
    if (!userData) return null;
    
    try {
        return JSON.parse(userData);
    } catch (e) {
        console.error('Failed to parse user data from storage:', e);
        return null;
    }
};

const UserProvider = ({ children }) => {
    // Try to load initial user state from localStorage
    const initialUser = loadUserFromStorage();
    const [user, setUser] = useState(initialUser);
    const [loading, setLoading] = useState(!initialUser);

    // Use useCallback to memoize clearUser so it doesn't change on every render
    const clearUser = useCallback(() => {
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        sessionStorage.removeItem('token');
        delete axiosInstance.defaults.headers.common['Authorization'];
    }, []);

    // Use useCallback to memoize updateUser
    const updateUser = useCallback((userData) => {
        setUser(userData);
        
        // Save user data to localStorage for persistence
        saveUserToStorage(userData);
        
        if (userData?.token) {
            // Token should already be stored in login, but ensure it's set
            if (!localStorage.getItem('token') && !sessionStorage.getItem('token')) {
                localStorage.setItem('token', userData.token);
            }
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        const fetchUserProfile = async () => {
            // Check both localStorage and sessionStorage
            const accessToken = localStorage.getItem("token") || sessionStorage.getItem("token");
        
            if(!accessToken){
                setLoading(false);
                return;
            }

            try {
                axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
                
                // If we already have user data in state from localStorage,
                // use it immediately while we fetch fresh data from API
                if (user) {
                    setLoading(false);
                }
                
                const response = await axiosInstance.get(API_PATH.AUTH.INFO);
                
                const userData = {
                    ...response.data,
                    token: accessToken
                };
                
                // Log user data for debugging
                console.log('User data from API:', userData);
                
                // Update state and save to localStorage
                setUser(userData);
                saveUserToStorage(userData);
            } catch (error) {
                console.log("Unauthorized", error);
                clearUser();
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, [clearUser]); // Only depends on clearUser now, which is memoized
    
    // Add debug logging to help trace auth issues
    useEffect(() => {
        if (user) {
            console.debug('User context updated:', {
                id: user.id,
                email: user.email,
                role: user.role,
                isAuthenticated: !!user
            });
        }
    }, [user]);
    
    return (
        <UserContext.Provider value={{user, updateUser, clearUser, loading}}>
            {children}
        </UserContext.Provider>
    )
}

export default UserProvider