import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiUpload, FiUser } from 'react-icons/fi';
import api from '../utils/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = API_BASE_URL.replace('/api', '');

const Profile = () => {
  const { user, logout } = useAuth();
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await api.post('/users/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setAvatar(response.data.user.avatar);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      window.location.reload();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Failed to upload avatar');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-2xl mx-auto p-6">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <FiArrowLeft />
          Back to Chat
        </button>

        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
          <h1 className="text-3xl font-bold text-white mb-8">Profile</h1>

          <div className="space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative mb-4">
                <div className="w-32 h-32 rounded-full bg-primary-600 flex items-center justify-center text-white text-4xl font-semibold overflow-hidden">
                  {avatar ? (
                    <img
                      src={`${BASE_URL}${avatar}`}
                      alt={user?.username}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    user?.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 p-2 bg-primary-600 rounded-full hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  <FiUpload className="text-white" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                  className="hidden"
                  accept="image/*"
                />
              </div>
              {uploading && (
                <p className="text-sm text-slate-400">Uploading...</p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Username
                </label>
                <div className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg">
                  <FiUser className="text-slate-400" />
                  <span className="text-white">{user?.username}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <div className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg">
                  <FiUser className="text-slate-400" />
                  <span className="text-white">{user?.email}</span>
                </div>
              </div>
            </div>

            <button
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
