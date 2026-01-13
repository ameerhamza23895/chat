import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { FiSend, FiPaperclip, FiSmile, FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import api from '../utils/api';
import EmojiPicker from 'emoji-picker-react';
import ReactPlayer from 'react-player';
import ReactAudioPlayer from 'react-audio-player';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = API_BASE_URL.replace('/api', '');

const ChatWindow = ({ selectedUser }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const socket = getSocket();

  useEffect(() => {
    if (!selectedUser) return;

    fetchMessages();
    
    if (socket) {
      socket.on('receive-message', handleReceiveMessage);
      socket.on('message-sent', handleMessageSent);
      socket.on('user-typing', handleTyping);
      socket.on('message-read', handleMessageRead);
      socket.on('message-error', handleMessageError);
    }

    return () => {
      if (socket) {
        socket.off('receive-message', handleReceiveMessage);
        socket.off('message-sent', handleMessageSent);
        socket.off('user-typing', handleTyping);
        socket.off('message-read', handleMessageRead);
        socket.off('message-error', handleMessageError);
      }
    };
  }, [selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const response = await api.get(`/messages/${selectedUser._id}`);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleReceiveMessage = (message) => {
    // Check if message belongs to current conversation
    const isFromSelectedUser = message.sender._id === selectedUser._id;
    const isToCurrentUser = message.receiver._id === user.id;
    const isFromCurrentUser = message.sender._id === user.id;
    const isToSelectedUser = message.receiver._id === selectedUser._id;
    
    // Add message if it's part of the current conversation
    if ((isFromSelectedUser && isToCurrentUser) || (isFromCurrentUser && isToSelectedUser)) {
      setMessages((prev) => {
        // Check if message already exists to avoid duplicates
        const exists = prev.some((msg) => msg._id === message._id);
        if (exists) return prev;
        return [...prev, message];
      });
    }
  };

  const handleMessageSent = (message) => {
    // Handle message confirmation from server (for sender)
    const isToSelectedUser = message.receiver._id === selectedUser._id;
    const isFromCurrentUser = message.sender._id === user.id;
    
    if (isFromCurrentUser && isToSelectedUser) {
      setMessages((prev) => {
        // Check if message already exists to avoid duplicates
        const exists = prev.some((msg) => msg._id === message._id);
        if (exists) return prev;
        return [...prev, message];
      });
    }
  };

  const handleMessageError = (error) => {
    console.error('Message error:', error);
    alert(error.message || 'Failed to send message');
  };

  const handleTyping = (data) => {
    if (data.userId === selectedUser._id) {
      setIsTyping(data.isTyping);
      setTypingUser(data.username);
      setTimeout(() => {
        setIsTyping(false);
        setTypingUser(null);
      }, 3000);
    }
  };

  const handleMessageRead = (data) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === data.messageId ? { ...msg, isRead: true, readAt: data.readAt } : msg
      )
    );
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !uploading) return;

    const messageData = {
      receiverId: selectedUser._id,
      content: newMessage.trim(),
      messageType: 'text',
    };

    if (socket) {
      socket.emit('send-message', messageData);
      // Clear input immediately for better UX
      setNewMessage('');
      setShowEmojiPicker(false);
    } else {
      alert('Socket connection not available. Please refresh the page.');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/upload/file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const fileData = response.data.file;

      const messageData = {
        receiverId: selectedUser._id,
        content: fileData.fileName,
        messageType: fileData.messageType,
        fileUrl: fileData.url,
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
        mimeType: fileData.mimeType,
      };

      if (socket) {
        socket.emit('send-message', messageData);
      } else {
        alert('Socket connection not available. Please refresh the page.');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleTypingIndicator = () => {
    if (socket && newMessage.trim()) {
      socket.emit('typing', {
        receiverId: selectedUser._id,
        isTyping: true,
      });
    }
  };

  const onEmojiClick = (emojiData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
  };

  const renderMessageContent = (message) => {
    switch (message.messageType) {
      case 'image':
        return (
          <img
            src={`${BASE_URL}${message.fileUrl}`}
            alt={message.fileName || 'Image'}
            className="max-w-xs rounded-lg cursor-pointer"
            onClick={() => window.open(`${BASE_URL}${message.fileUrl}`, '_blank')}
            onError={(e) => {
              console.error('Failed to load image:', message.fileUrl);
              e.target.style.display = 'none';
            }}
          />
        );
      case 'video':
        return (
          <div className="max-w-md">
            <ReactPlayer
              url={`${BASE_URL}${message.fileUrl}`}
              controls
              width="100%"
              height="auto"
              onError={(error) => {
                console.error('Failed to load video:', error);
              }}
            />
          </div>
        );
      case 'audio':
        return (
          <div className="max-w-xs">
            <ReactAudioPlayer
              src={`${BASE_URL}${message.fileUrl}`}
              controls
              className="w-full"
            />
          </div>
        );
      case 'file':
        return (
          <a
            href={`${BASE_URL}${message.fileUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
          >
            <FiPaperclip className="text-primary-400" />
            <div>
              <div className="text-white font-medium">{message.fileName}</div>
              <div className="text-xs text-slate-400">
                {(message.fileSize / 1024).toFixed(2)} KB
              </div>
            </div>
          </a>
        );
      default:
        return <p className="text-white whitespace-pre-wrap break-words">{message.content}</p>;
    }
  };

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900">
        <div className="text-center text-slate-400">
          <p className="text-xl mb-2">Select a chat to start messaging</p>
          <p className="text-sm">Choose a user from the sidebar to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
              {selectedUser.avatar ? (
                <img
                  src={`${BASE_URL}${selectedUser.avatar}`}
                  alt={selectedUser.username}
                  className="w-full h-full rounded-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                selectedUser.username.charAt(0).toUpperCase()
              )}
            </div>
            {selectedUser.isOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800"></div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white">{selectedUser.username}</h3>
            <p className="text-sm text-slate-400">
              {selectedUser.isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isOwn = message.sender._id === user.id;
          
          return (
            <div
              key={message._id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                {!isOwn && (
                  <span className="text-xs text-slate-400 mb-1 px-2">
                    {message.sender.username}
                  </span>
                )}
                <div
                  className={`rounded-2xl px-4 py-2 ${
                    isOwn
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-700 text-white'
                  }`}
                >
                  {renderMessageContent(message)}
                </div>
                <span className="text-xs text-slate-500 mt-1 px-2">
                  {format(new Date(message.createdAt), 'HH:mm')}
                  {isOwn && message.isRead && ' ✓✓'}
                </span>
              </div>
            </div>
          );
        })}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-700 rounded-2xl px-4 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-slate-800 border-t border-slate-700 p-4">
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-4 z-10">
            <div className="relative">
              <EmojiPicker onEmojiClick={onEmojiClick} />
              <button
                onClick={() => setShowEmojiPicker(false)}
                className="absolute top-2 right-2 text-slate-400 hover:text-white"
              >
                <FiX />
              </button>
            </div>
          </div>
        )}
        
        <div className="flex items-end gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,audio/*,video/*,.pdf,.doc,.docx"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Attach file"
          >
            <FiPaperclip size={20} />
          </button>
          
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTypingIndicator();
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none max-h-32"
            />
          </div>
          
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="Add emoji"
          >
            <FiSmile size={20} />
          </button>
          
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() && !uploading}
            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send message"
          >
            <FiSend size={20} />
          </button>
        </div>
        
        {uploading && (
          <div className="mt-2 text-sm text-slate-400">Uploading file...</div>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
