import React, { createContext, useContext, useState, useEffect } from 'react';
import { checkAdminPassword, setAdminSession, isAdminLoggedIn, getCustomerSession, setCustomerSession as saveCustSession, clearCustomerSession } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsAdmin(isAdminLoggedIn());
    setCustomer(getCustomerSession());
    setLoading(false);
  }, []);

  const adminLogin = (password) => {
    if (checkAdminPassword(password)) {
      setAdminSession(true);
      setIsAdmin(true);
      return { success: true };
    }
    return { success: false, error: 'كلمة المرور غير صحيحة' };
  };

  const adminLogout = () => {
    setAdminSession(false);
    setIsAdmin(false);
  };

  const customerLogin = (name, phone) => {
    const session = saveCustSession({ name, phone });
    setCustomer(session);
    return session;
  };

  const customerLogout = () => {
    clearCustomerSession();
    setCustomer(null);
  };

  return (
    <AuthContext.Provider value={{
      isAdmin,
      adminLogin,
      adminLogout,
      customer,
      customerLogin,
      customerLogout,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
