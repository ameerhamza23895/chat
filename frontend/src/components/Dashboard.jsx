import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiLogOut, FiUser, FiMenu } from 'react-icons/fi';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import { useNavigate } from 'react-router-dom';

// Dynamic BASE_URL detection for HTTPS compatibility
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  // If VITE_API_URL is set, use it
  if (envUrl) {
    return envUrl.replace('/api', '');
  }
  
  // Use current origin for HTTPS compatibility (goes through Vite proxy)
  return window.location.origin;
};

const BASE_URL = getBaseUrl();

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [selectedUser, setSelectedUser] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSelectChat = (user) => {
    setSelectedUser(user);
    // Hide sidebar on mobile after selecting a chat
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  const handleBackToChats = () => {
    setSelectedUser(null);
    // Show sidebar on mobile when going back
    if (window.innerWidth < 768) {
      setShowSidebar(true);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      {/* Top Bar */}
      <div className="bg-slate-800 border-b border-slate-700 p-3 md:p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Mobile menu button */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors"
            title="Toggle menu"
          >
            <FiMenu size={20} />
          </button>
          
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm md:text-base">
            {user?.avatar ? (
              <img
                src={user.avatar?.startsWith('/') ? user.avatar : `${BASE_URL}${user.avatar}`}
                alt={user.username}
                className="w-full h-full rounded-full object-cover"
                onError={(e) => {
                  console.error('[Dashboard] Failed to load avatar:', user.avatar);
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              user?.username?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="hidden sm:block">
            <h2 className="text-base md:text-lg font-semibold text-white">{user?.username}</h2>
            <p className="text-xs md:text-sm text-slate-400 hidden md:block">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={() => navigate('/profile')}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="Profile"
          >
            <FiUser size={20} />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-400 transition-colors"
            title="Logout"
          >
            <FiLogOut size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Sidebar - Hidden on mobile when chat is selected */}
        <div
          className={`absolute lg:relative z-30 h-full w-full lg:w-80 flex-shrink-0 transition-transform duration-300 ease-in-out ${
            showSidebar || !selectedUser ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0`}
        >
          <ChatList
            onSelectChat={handleSelectChat}
            selectedChatId={selectedUser?._id}
          />
        </div>

        {/* Overlay for mobile when sidebar is open */}
        {showSidebar && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Chat Window */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
          <ChatWindow 
            selectedUser={selectedUser} 
            onBack={handleBackToChats}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
