import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import api from '../utils/api';
import { FiSearch, FiMessageCircle } from 'react-icons/fi';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = API_BASE_URL.replace('/api', '');

const ChatList = ({ onSelectChat, selectedChatId }) => {
  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChats();
    fetchUsers();
  }, []);

  const fetchChats = async () => {
    try {
      const response = await api.get('/messages/chats/all');
      setChats(response.data.chats);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/all');
      setUsers(response.data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const getOtherParticipant = (chat) => {
    const currentUserId = JSON.parse(localStorage.getItem('user')).id;
    return chat.participants.find((p) => p._id !== currentUserId) || chat.participants[0];
  };

  const getLastMessagePreview = (chat) => {
    const message = chat.lastMessage;
    if (!message) return 'No messages yet';

    const type = (message.messageType || message.type || '').toLowerCase();

    switch(type) {
      case 'text':
        return message.content || 'Sent a message';
      case 'image':
      case 'img':
        return '📷 Image';
      case 'video':
      case 'vid':
        return '🎥 Video';
      case 'audio':
        return '🎵 Audio';
      case 'file':
        return '📎 File';
      default:
        return 'Sent a message';
    }
};


  const filteredChats = chats.filter((chat) => {
    const otherUser = getOtherParticipant(chat);
    return otherUser.username.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredUsers = users.filter((user) => {
    const existingChat = chats.find((chat) => {
      const otherUser = getOtherParticipant(chat);
      return otherUser._id === user._id;
    });
    return !existingChat && user.username.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-slate-400">Loading chats...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-800 border-r border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search chats or users..."
            className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 && filteredUsers.length === 0 && searchTerm && (
          <div className="p-4 text-center text-slate-400">
            No results found
          </div>
        )}

        {filteredChats.length > 0 && (
          <div className="p-2">
            {filteredChats.map((chat) => {
              const otherUser = getOtherParticipant(chat);
              console.log('Rendering chat with other user:', otherUser);
              // const unreadCount = chat.unreadCount?.get(JSON.parse(localStorage.getItem('user')).id) || 0;
              const currentUserId = JSON.parse(localStorage.getItem('user')).id;
              const unreadCount = chat.unreadCount?.[currentUserId] || 0;

              console.log('Unread count for this chat:', unreadCount);
              
              return (
                <div
                  key={chat._id}
                  onClick={() => onSelectChat(otherUser)}
                  className={`p-3 rounded-lg cursor-pointer mb-2 transition-colors ${
                    selectedChatId === otherUser._id
                      ? 'bg-primary-600'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
                        {otherUser.avatar ? (
                          <img
                            src={`${BASE_URL}${otherUser.avatar}`}
                            alt={otherUser.username}
                            className="w-full h-full rounded-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          otherUser.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      {otherUser.isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white truncate">
                          {otherUser.username}
                        </h3>
                        {chat.lastMessageAt && (
                          <span className="text-xs text-slate-400 ml-2">
                            {formatDistanceToNow(new Date(chat.lastMessageAt), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-slate-400 truncate">
                          {(() => {
                            const lastMessage = chat.lastMessage;
                            if (lastMessage?.messageType === 'image' && lastMessage?.fileUrl) {
                              return (
                                <img
                                  src={`${BASE_URL}${lastMessage.fileUrl}`}
                                  alt="Preview"
                                  className="w-10 h-10 object-cover inline-block rounded"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              );
                            }
                            return getLastMessagePreview(chat);
                          })()}
                        </p>

                        {unreadCount > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {searchTerm && filteredUsers.length > 0 && (
          <div className="p-2 border-t border-slate-700">
            <div className="px-2 py-2 text-xs font-semibold text-slate-400 uppercase">
              Start New Chat
            </div>
            {filteredUsers.map((user) => (
              <div
                key={user._id}
                onClick={() => onSelectChat(user)}
                className="p-3 rounded-lg cursor-pointer mb-2 bg-slate-700 hover:bg-slate-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
                      {user.avatar ? (
                        <img
                          src={`${BASE_URL}${user.avatar}`}
                          alt={user.username}
                          className="w-full h-full rounded-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        user.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    {user.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{user.username}</h3>
                    <p className="text-sm text-slate-400">
                      {user.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                  <FiMessageCircle className="text-primary-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatList;
