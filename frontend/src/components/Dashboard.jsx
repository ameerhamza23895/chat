import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiLogOut, FiUser } from 'react-icons/fi';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = API_BASE_URL.replace('/api', '');

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [selectedUser, setSelectedUser] = useState(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Top Bar */}
      <div className="bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
            {user?.avatar ? (
              <img
                src={`${BASE_URL}${user.avatar}`}
                alt={user.username}
                className="w-full h-full rounded-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              user?.username?.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{user?.username}</h2>
            <p className="text-sm text-slate-400">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 flex-shrink-0">
          <ChatList
            onSelectChat={setSelectedUser}
            selectedChatId={selectedUser?._id}
          />
        </div>
        <div className="flex-1">
          <ChatWindow selectedUser={selectedUser} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
