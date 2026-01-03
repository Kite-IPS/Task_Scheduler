import React, { useContext, useEffect } from 'react'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './Pages/Login';
import HodDashboard from './Pages/Hod/HodDashboard';
import FacultyDashboard from './Pages/Faculty/FacultyDashboard';
import AdminDashboard from './Pages/Admin/AdminDashboard';
import PrivateRoute from './Routes/PrivateRoute';
import Assignment from './Pages/Faculty/Assignment';
import Users from './Pages/Admin/Users';
import UserProvider, { UserContext } from './Context/userContext';

// Component to redirect to Django admin
const AdminRedirect = () => {
  useEffect(() => {
    window.location.href = '/api/admin/';
  }, []);
  
  return <div>Redirecting to Django Admin...</div>;
};

const App = () => {
  return (
    <UserProvider>
      <Router>
        <Routes>
          {/* Special route for Django admin */}
          <Route path="/admin" element={<AdminRedirect />} />
          <Route path="/admin/*" element={<AdminRedirect />} />
          
          <Route path='/' element={<Root />} />
          <Route path='/login' element={<Login />} />
          
          {/* Hod Routes */}
          <Route element={<PrivateRoute allowedRoles={["Head of Department", "head of department","hod"]} />}>
            <Route path='/hod/dashboard' element={<HodDashboard />} />
          </Route>
          
          {/* Admin Routes - Also accessible by Staff */}
          <Route element={<PrivateRoute allowedRoles={["Admin", "admin", "Staff", "staff"]} />}>
            <Route path='/admin-panel/dashboard' element={<AdminDashboard />} />
            <Route path='/admin-panel/users' element={<Users />} />
          </Route>
          
          {/* Faculty Routes - Also accessible by Admin */}
          <Route element={<PrivateRoute allowedRoles={["staff", "Staff", "admin", "Admin"]} />}>
            <Route path='/faculty/dashboard' element={<FacultyDashboard />} />
            <Route path='/faculty/assign' element={<Assignment />} />
          </Route>

          {/* Admin/Staff Task Management Routes */}
          <Route element={<PrivateRoute allowedRoles={["admin", "Admin", "staff", "Staff"]} />}>
            <Route path='/admin-panel/tasks' element={<Assignment />} />
            <Route path='/admin-panel/create-task' element={<FacultyDashboard />} />
          </Route>
        </Routes>
      </Router>
    </UserProvider>
  )
}

export default App

const Root = () => {
  const { user, loading } = useContext(UserContext);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading...</p>
      </div>
    );
  }

  // If no user, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to appropriate dashboard based on role
  const userRole = user.role ? user.role.toLowerCase() : '';

  if (userRole === 'hod') {
    return <Navigate to="/hod/dashboard" replace />;
  } else if (userRole === 'admin' || userRole === 'staff') {
    return <Navigate to="/admin-panel/dashboard" replace />;
  }

  // Fallback - unknown role, redirect to login
  console.warn(`Unknown user role: ${userRole}`);
  return <Navigate to="/login" replace />;
}

const styles = {
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255, 255, 255, 0.3)',
    borderTop: '3px solid #ffffff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '1rem',
    fontSize: '1rem',
    color: 'rgba(255, 255, 255, 0.7)',
  },
};

// Add keyframes for spinner animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  if (!document.querySelector('style[data-app-styles]')) {
    style.setAttribute('data-app-styles', 'true');
    document.head.appendChild(style);
  }
}