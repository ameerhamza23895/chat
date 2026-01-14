import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { FiSend, FiPaperclip, FiSmile, FiX, FiArrowLeft, FiFile, FiFileText, FiImage, FiVideo, FiMusic, FiDownload } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../utils/socket';
import api from '../utils/api';
import EmojiPicker from 'emoji-picker-react';
import ReactPlayer from 'react-player';
import ReactAudioPlayer from 'react-audio-player';

// Dynamic BASE_URL detection for network access (same logic as api.js)
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  // If VITE_API_URL is set, use it
  if (envUrl) {
    console.log('[ChatWindow] Using VITE_API_URL from env:', envUrl);
    return envUrl.replace('/api', '');
  }
  
  // Auto-detect if accessing from network (not localhost)
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // We're accessing from network, use the same hostname with port 5000
  const protocol = window.location.protocol;
  const baseUrl = `${protocol}//${hostname}:5000`;
  console.log('[ChatWindow] Network access detected, using BASE_URL:', baseUrl);
  return baseUrl;
};

const BASE_URL = getBaseUrl();
console.log('[ChatWindow] Final BASE_URL:', BASE_URL);

const ChatWindow = ({ selectedUser, onBack }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filePreview, setFilePreview] = useState(null); // { file, preview, type, size, name }
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [screenSize, setScreenSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const filePreviewRef = useRef(null); // Ref to track preview for cleanup
  const socket = getSocket();

  // Track screen size for responsive preview
  useEffect(() => {
    const handleResize = () => {
      setScreenSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when chat is open
  useEffect(() => {
    if (selectedUser) {
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [selectedUser]);
  
  // Sync ref with state
  useEffect(() => {
    filePreviewRef.current = filePreview;
  }, [filePreview]);

  useEffect(() => {
    if (!selectedUser) return;

    // Reset state when switching users
    setMessages([]);
    setHasMoreMessages(true);
    setLoadingOlderMessages(false);
    
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

  // Add scroll listener for infinite scroll
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [messages, hasMoreMessages, loadingOlderMessages]);

  useEffect(() => {
    // Only auto-scroll to bottom on initial load or when new messages arrive
    // Don't scroll if user is viewing older messages
    const container = messagesContainerRef.current;
    if (container && messages.length > 0) {
      // Check if user is near bottom (within 150px)
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      // Only scroll if near bottom (user hasn't scrolled up to view older messages)
      if (isNearBottom) {
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
    }
  }, [messages]);

  const fetchMessages = async (beforeDate = null) => {
    try {
      const params = beforeDate ? { beforeDate: beforeDate.toISOString() } : {};
      const response = await api.get(`/messages/${selectedUser._id}`, { params });
      const newMessages = response.data.messages || [];
      
      if (beforeDate) {
        // Loading older messages - prepend to existing messages
        setMessages((prev) => [...newMessages, ...prev]);
        setHasMoreMessages(response.data.hasMore || false);
      } else {
        // Initial load - replace all messages
        setMessages(newMessages);
        setHasMoreMessages(response.data.hasMore !== false);
        // Scroll to bottom after initial load
        setTimeout(() => {
          scrollToBottom();
        }, 200);
      }
      
      return newMessages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  };

  const loadOlderMessages = async () => {
    if (loadingOlderMessages || !hasMoreMessages || messages.length === 0) return;

    setLoadingOlderMessages(true);
    
    // Get the oldest message date
    const oldestMessage = messages[0];
    const beforeDate = new Date(oldestMessage.createdAt);
    
    // Store current scroll position
    const container = messagesContainerRef.current;
    const previousScrollHeight = container?.scrollHeight || 0;
    
    try {
      await fetchMessages(beforeDate);
      
      // Restore scroll position after loading
      setTimeout(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          const scrollDifference = newScrollHeight - previousScrollHeight;
          container.scrollTop = scrollDifference;
        }
      }, 50);
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Load more when scrolled near the top (within 200px)
    if (container.scrollTop < 200 && hasMoreMessages && !loadingOlderMessages) {
      loadOlderMessages();
    }
  };

  const handleReceiveMessage = (message) => {
    console.log('[ChatWindow] Received message:', message);
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
        if (exists) {
          console.log('[ChatWindow] Received message already exists, skipping');
          return prev;
        }
        console.log('[ChatWindow] Adding received message to state');
        return [...prev, message];
      });
    }
  };

  const handleMessageSent = (message) => {
    console.log('[ChatWindow] Message sent confirmed:', message);
    // Handle message confirmation from server (for sender)
    const isToSelectedUser = message.receiver._id === selectedUser._id;
    const isFromCurrentUser = message.sender._id === user.id;
    
    if (isFromCurrentUser && isToSelectedUser) {
      setMessages((prev) => {
        // Replace optimistic message with real message from server
        const optimisticIndex = prev.findIndex(msg => msg.isOptimistic && 
          msg.messageType === message.messageType && 
          msg.fileName === message.fileName
        );
        
        if (optimisticIndex !== -1) {
          // Replace optimistic message with real one
          console.log('[ChatWindow] Replacing optimistic message with confirmed message');
          const newMessages = [...prev];
          newMessages[optimisticIndex] = message;
          return newMessages;
        }
        
        // Check if message already exists to avoid duplicates
        const exists = prev.some((msg) => msg._id === message._id);
        if (exists) {
          console.log('[ChatWindow] Message already exists, skipping');
          return prev;
        }
        console.log('[ChatWindow] Adding message to state');
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
    // If there's a file preview, send the file instead
    if (filePreview) {
      await handleFileUpload();
      return;
    }

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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Create preview based on file type
    const fileType = file.type;
    let preview = null;
    let type = 'file';

    if (fileType.startsWith('image/')) {
      type = 'image';
      preview = URL.createObjectURL(file);
    } else if (fileType.startsWith('video/')) {
      type = 'video';
      preview = URL.createObjectURL(file);
    } else if (fileType.startsWith('audio/')) {
      type = 'audio';
      preview = URL.createObjectURL(file);
    } else if (fileType === 'application/pdf') {
      type = 'pdf';
    } else if (fileType.includes('document') || fileType.includes('word') || fileType.includes('text')) {
      type = 'document';
    }

    const previewData = {
      file,
      preview,
      type,
      name: file.name,
      size: file.size,
      mimeType: fileType,
    };
    
    console.log('[ChatWindow] File selected:', previewData);
    setFilePreview(previewData);

    // Clear file input to allow selecting same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFilePreview = () => {
    if (filePreview?.preview) {
      URL.revokeObjectURL(filePreview.preview);
    }
    setFilePreview(null);
  };

  const handleFileUpload = async () => {
    if (!filePreview) return;

    setUploading(true);
    const currentPreview = filePreview; // Keep reference to preview

    try {
      const formData = new FormData();
      formData.append('file', filePreview.file);

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

      // Create optimistic message immediately (like WhatsApp)
      const tempMessageId = `temp_${Date.now()}_${Math.random()}`;
      const optimisticMessage = {
        _id: tempMessageId,
        sender: { _id: user.id, username: user.username, avatar: user.avatar },
        receiver: { _id: selectedUser._id, username: selectedUser.username },
        content: fileData.fileName,
        messageType: fileData.messageType,
        fileUrl: fileData.url, // Use uploaded file URL
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
        mimeType: fileData.mimeType,
        createdAt: new Date().toISOString(),
        isRead: false,
        isOptimistic: true, // Flag to identify optimistic messages
      };

      // Add optimistic message to chat immediately and scroll to bottom
      setMessages((prev) => {
        const newMessages = [...prev, optimisticMessage];
        // Scroll to bottom after state update
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        return newMessages;
      });
      
      // Clear preview from input area immediately (like WhatsApp)
      removeFilePreview();

      if (socket) {
        socket.emit('send-message', messageData);
      } else {
        alert('Socket connection not available. Please refresh the page.');
        // Remove optimistic message on error
        setMessages((prev) => prev.filter(msg => msg._id !== tempMessageId));
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file: ' + (error.response?.data?.message || error.message));
      // Keep preview on error so user can retry
    } finally {
      setUploading(false);
    }
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (filePreview?.preview) {
        URL.revokeObjectURL(filePreview.preview);
      }
    };
  }, [filePreview]);

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
    if (!message.messageType) {
      // Fallback to text if no messageType
      return <p className="text-white whitespace-pre-wrap break-words text-sm md:text-base">{message.content}</p>;
    }
    
    switch (message.messageType) {
      case 'image':
        const imageUrl = message.fileUrl?.startsWith('http') 
          ? message.fileUrl 
          : `${BASE_URL}${message.fileUrl}`;
        
        return (
          <img
            src={imageUrl}
            alt={message.fileName || 'Image'}
            className="w-full h-auto cursor-pointer object-contain"
            style={{ maxHeight: '400px', minHeight: '150px' }}
            onClick={() => window.open(imageUrl, '_blank')}
            onError={(e) => {
              console.error('Failed to load image:', imageUrl, 'Original fileUrl:', message.fileUrl);
              console.error('BASE_URL:', BASE_URL);
              // Show error message instead of hiding
              e.target.style.display = 'none';
              const errorDiv = document.createElement('div');
              errorDiv.className = 'text-red-400 text-xs p-2';
              errorDiv.textContent = 'Failed to load image';
              e.target.parentNode?.appendChild(errorDiv);
            }}
            onLoad={() => {
              console.log('Image loaded successfully:', imageUrl);
            }}
          />
        );
      case 'video':
        const videoUrl = message.fileUrl?.startsWith('http') 
          ? message.fileUrl 
          : `${BASE_URL}${message.fileUrl}`;
        return (
          <div className="w-full bg-black rounded-lg overflow-hidden" style={{ maxHeight: '400px' }}>
            <ReactPlayer
              url={videoUrl}
              controls
              width="100%"
              height="100%"
              style={{ maxHeight: '400px' }}
              onError={(error) => {
                console.error('Failed to load video:', videoUrl, 'Original fileUrl:', message.fileUrl);
                console.error('BASE_URL:', BASE_URL);
              }}
            />
          </div>
        );
      case 'audio':
        const audioUrl = message.fileUrl?.startsWith('http') 
          ? message.fileUrl 
          : `${BASE_URL}${message.fileUrl}`;
        return (
          <div className="max-w-[280px] sm:max-w-xs">
            <ReactAudioPlayer
              src={audioUrl}
              controls
              className="w-full"
              onError={(e) => {
                console.error('Failed to load audio:', audioUrl, 'Original fileUrl:', message.fileUrl);
                console.error('BASE_URL:', BASE_URL);
              }}
            />
          </div>
        );
      case 'file':
        const fileUrl = message.fileUrl?.startsWith('http') 
          ? message.fileUrl 
          : `${BASE_URL}${message.fileUrl}`;
        return (
          <a
            href={fileUrl}
            download={message.fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2.5 md:p-3 hover:bg-opacity-80 transition-colors w-full"
          >
            <FiFile className="text-white flex-shrink-0" size={18} />
            <div className="min-w-0 flex-1">
              <div className="text-white font-medium text-sm md:text-base truncate">{message.fileName || 'File'}</div>
              <div className="text-xs text-white opacity-75">
                {message.fileSize ? (message.fileSize > 1024 * 1024 
                  ? `${(message.fileSize / 1024 / 1024).toFixed(2)} MB`
                  : `${(message.fileSize / 1024).toFixed(2)} KB`) : 'Download'}
              </div>
            </div>
            <FiDownload className="text-white flex-shrink-0" size={16} />
          </a>
        );
      default:
        return <p className="text-white whitespace-pre-wrap break-words text-sm md:text-base">{message.content}</p>;
    }
  };

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900">
        <div className="text-center text-slate-400 px-4">
          <p className="text-lg md:text-xl mb-2">Select a chat to start messaging</p>
          <p className="text-xs md:text-sm">Choose a user from the sidebar to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-900 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-3 md:p-4 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Back button for mobile */}
          {onBack && (
            <button
              onClick={onBack}
              className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors"
              title="Back to chats"
            >
              <FiArrowLeft size={20} />
            </button>
          )}
          
          <div className="relative">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm md:text-base">
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
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 rounded-full border-2 border-slate-800"></div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm md:text-base truncate">{selectedUser.username}</h3>
            <p className="text-xs md:text-sm text-slate-400">
              {selectedUser.isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-4 space-y-3 md:space-y-4 min-h-0"
        style={{ 
          paddingBottom: '100px',
          WebkitOverflowScrolling: 'touch' // Smooth scrolling on iOS
        }}
        onTouchStart={(e) => {
          // Prevent body scroll when touching messages area
          e.stopPropagation();
        }}
        onTouchMove={(e) => {
          // Prevent body scroll when scrolling messages
          e.stopPropagation();
        }}
      >
        {/* Loading indicator for older messages */}
        {loadingOlderMessages && (
          <div className="flex justify-center py-2">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading older messages...</span>
            </div>
          </div>
        )}
        
        {messages.map((message) => {
          const isOwn = message.sender._id === user.id;
          const isMedia = ['image', 'video', 'audio', 'file'].includes(message.messageType);
          
          return (
            <div
              key={message._id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] sm:max-w-[75%] md:max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                {!isOwn && (
                  <span className="text-xs text-slate-400 mb-1 px-2">
                    {message.sender.username}
                  </span>
                )}
                <div
                  className={`rounded-2xl overflow-hidden ${
                    isMedia 
                      ? (isOwn ? 'bg-primary-600' : 'bg-slate-700')
                      : (isOwn ? 'bg-primary-600 text-white px-3 py-1.5 md:px-4 md:py-2' : 'bg-slate-700 text-white px-3 py-1.5 md:px-4 md:py-2')
                  }`}
                >
                  {renderMessageContent(message)}
                </div>
                <span className="text-xs text-slate-500 mt-1 px-2">
                  {format(new Date(message.createdAt), 'HH:mm')}
                  {isOwn && message.isRead && !message.isOptimistic && ' ✓✓'}
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
      <div 
        className="bg-slate-800 border-t border-slate-700 p-2 md:p-4 relative flex-shrink-0"
        style={{
          zIndex: 10
        }}
      >
        {showEmojiPicker && (
          <div className="fixed bottom-20 md:absolute md:bottom-full left-2 md:left-4 right-2 md:right-auto mb-2 z-50 max-w-[calc(100vw-1rem)] md:max-w-xs">
            <div className="relative">
              <div className="overflow-hidden rounded-lg shadow-2xl" style={{ maxHeight: '50vh' }}>
                <EmojiPicker 
                  onEmojiClick={onEmojiClick}
                  width="100%"
                  height="400"
                  searchDisabled={false}
                  skinTonesDisabled={true}
                />
              </div>
              <button
                onClick={() => setShowEmojiPicker(false)}
                className="absolute top-2 right-2 p-1 bg-slate-700 rounded-full text-slate-400 hover:text-white z-20"
              >
                <FiX size={18} />
              </button>
            </div>
          </div>
        )}

        {/* File Preview */}
        {filePreview && (
          <div 
            className="mb-2 p-2 bg-slate-700 rounded-lg relative"
            style={{
              maxHeight: 'clamp(80px, 20vh, 150px)',
              overflow: 'hidden',
              minHeight: '60px'
            }}
          >
            <button
              onClick={removeFilePreview}
              className="absolute top-2 right-2 p-1.5 bg-slate-600 hover:bg-slate-500 rounded-full text-white z-10 shadow-lg"
              title="Remove"
            >
              <FiX size={16} />
            </button>

            {filePreview.type === 'image' && (
              <div className="flex gap-2 md:gap-3 items-center">
                {filePreview.preview ? (
                  <div 
                    className="relative flex-shrink-0 bg-slate-800 rounded-lg overflow-hidden"
                    style={{
                      width: 'clamp(60px, 15vw, 80px)',
                      height: 'clamp(60px, 15vw, 80px)',
                      aspectRatio: '1 / 1'
                    }}
                  >
                    <img
                      src={filePreview.preview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Failed to load preview image:', filePreview.preview);
                        e.target.style.display = 'none';
                      }}
                      onLoad={() => {
                        console.log('[ChatWindow] Image preview loaded successfully');
                      }}
                    />
                  </div>
                ) : (
                  <div 
                    className="bg-slate-600 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 'clamp(60px, 15vw, 80px)',
                      height: 'clamp(60px, 15vw, 80px)',
                      aspectRatio: '1 / 1'
                    }}
                  >
                    <FiImage className="text-slate-400" size={20} />
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <FiImage className="text-primary-400 flex-shrink-0" size={14} />
                    <p className="text-xs sm:text-sm text-white font-medium truncate">
                      {filePreview.name}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">
                    {filePreview.size > 1024 * 1024
                      ? `${(filePreview.size / 1024 / 1024).toFixed(2)} MB`
                      : `${(filePreview.size / 1024).toFixed(2)} KB`}
                  </p>
                </div>
              </div>
            )}

            {filePreview.type === 'video' && filePreview.preview && (
              <div className="space-y-2">
                <div className="relative">
                  <video
                    src={filePreview.preview}
                    className="w-full max-h-48 md:max-h-64 rounded-lg bg-black"
                    controls={false}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
                    <div className="w-12 h-12 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                      <FiVideo className="text-slate-800" size={24} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FiVideo className="text-primary-400 flex-shrink-0" size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-base text-white font-medium truncate">{filePreview.name}</p>
                    <p className="text-xs text-slate-400">{(filePreview.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              </div>
            )}

            {filePreview.type === 'audio' && filePreview.preview && (
              <div className="space-y-2">
                <div className="bg-slate-600 rounded-lg p-3">
                  <ReactAudioPlayer
                    src={filePreview.preview}
                    controls
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <FiMusic className="text-primary-400 flex-shrink-0" size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-base text-white font-medium truncate">{filePreview.name}</p>
                    <p className="text-xs text-slate-400">{(filePreview.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
              </div>
            )}

            {(filePreview.type === 'pdf' || filePreview.type === 'document' || filePreview.type === 'file') && (
              <div className="flex gap-3">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  {filePreview.type === 'pdf' ? (
                    <FiFileText className="text-primary-400" size={32} />
                  ) : (
                    <FiFile className="text-primary-400" size={32} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {filePreview.type === 'pdf' ? (
                      <FiFileText className="text-primary-400 flex-shrink-0" size={18} />
                    ) : (
                      <FiFile className="text-primary-400 flex-shrink-0" size={18} />
                    )}
                    <p className="text-sm md:text-base text-white font-medium truncate">{filePreview.name}</p>
                  </div>
                  <p className="text-xs text-slate-400">
                    {filePreview.size > 1024 * 1024
                      ? `${(filePreview.size / 1024 / 1024).toFixed(2)} MB`
                      : `${(filePreview.size / 1024).toFixed(2)} KB`}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-1.5 md:gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1.5 md:p-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
            title="Attach file"
          >
            <FiPaperclip size={18} className="md:w-5 md:h-5" />
          </button>
          
          <div className="flex-1 relative min-w-0">
            <textarea
              ref={(el) => {
                if (el) {
                  // Scroll input into view when focused (for mobile keyboard)
                  el.addEventListener('focus', () => {
                    setTimeout(() => {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      // Also scroll messages container to show input area
                      if (messagesContainerRef.current) {
                        setTimeout(() => {
                          scrollToBottom();
                        }, 300);
                      }
                    }, 100);
                  });
                }
              }}
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
              onFocus={(e) => {
                // Ensure input is visible when keyboard appears
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 300);
              }}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-3 md:px-4 py-1.5 md:py-2 text-sm md:text-base bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none max-h-24 md:max-h-32"
            />
          </div>
          
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1.5 md:p-2 text-slate-400 hover:text-white transition-colors hidden sm:block flex-shrink-0"
            title="Add emoji"
          >
            <FiSmile size={18} className="md:w-5 md:h-5" />
          </button>
          
          <button
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !filePreview) || uploading}
            className={`p-1.5 md:p-2 rounded-lg transition-all flex-shrink-0 min-w-[36px] md:min-w-[40px] h-[36px] md:h-[40px] flex items-center justify-center ${
              (!newMessage.trim() && !filePreview) || uploading
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-60'
                : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg'
            }`}
            title={filePreview ? "Send file" : "Send message"}
          >
            {uploading ? (
              <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <FiSend size={18} className="md:w-5 md:h-5" />
            )}
          </button>
        </div>
        
        {uploading && (
          <div className="mt-2 text-xs md:text-sm text-slate-400 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div>
            Uploading file...
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
