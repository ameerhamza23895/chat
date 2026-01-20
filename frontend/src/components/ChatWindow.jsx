import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { FiSend, FiPaperclip, FiSmile, FiX, FiArrowLeft, FiFile, FiFileText, FiImage, FiVideo, FiMusic, FiDownload, FiPhone, FiVideoOff, FiPhoneOff, FiClock, FiEye } from 'react-icons/fi';
import CallWindow from './CallWindow';
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
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (isLocalhost) {
    // Use current origin - Vite proxy will handle /api routes
    const baseUrl = window.location.origin;
    console.log('[ChatWindow] Localhost detected - Using current origin (via Vite proxy):', baseUrl);
    return baseUrl;
  }
  
  // We're accessing from network (IP address), connect directly to backend
  // Use HTTP (not HTTPS) because backend runs on HTTP
  const baseUrl = `http://${hostname}:5000`;
  console.log('[ChatWindow] Network access detected (IP:', hostname, ') - Connecting directly to backend:', baseUrl);
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
  const [callState, setCallState] = useState(null); // { type: 'video'|'audio', isIncoming: boolean, caller: user, receiver: user }
  const [userOnlineStatus, setUserOnlineStatus] = useState(null); // Track online status separately
  const [isDisappearingMessage, setIsDisappearingMessage] = useState(false); // Disappearing message toggle
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const filePreviewRef = useRef(null); // Ref to track preview for cleanup
  const socket = getSocket();
  
  // Get effective online status (from prop or state)
  const effectiveSelectedUser = selectedUser ? {
    ...selectedUser,
    isOnline: userOnlineStatus !== null ? userOnlineStatus : selectedUser.isOnline
  } : null;
  
  // Debug socket connection
  useEffect(() => {
    if (socket) {
      console.log('[ChatWindow] Socket instance:', socket);
      console.log('[ChatWindow] Socket connected:', socket.connected);
      console.log('[ChatWindow] Socket ID:', socket.id);
      
      socket.on('connect', () => {
        console.log('[ChatWindow] Socket connected event fired');
      });
      
      socket.on('disconnect', () => {
        console.log('[ChatWindow] Socket disconnected');
      });
    } else {
      console.warn('[ChatWindow] No socket instance available');
    }
  }, [socket]);

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

  // Define call handlers BEFORE using them in useEffect
  const handleIncomingCall = useCallback((data) => {
    console.log('[ChatWindow] ========== INCOMING CALL RECEIVED ==========');
    console.log('[ChatWindow] Call data:', JSON.stringify(data, null, 2));
    console.log('[ChatWindow] Current user:', JSON.stringify(user, null, 2));
    
    // Verify the call is for the current user (not from themselves)
    if (!user) {
      console.error('[ChatWindow] ❌ No user logged in, cannot receive call');
      return;
    }
    
    const currentUserId = String(user._id || user.id || '');
    const callerId = String(data.callerId || '');
    
    console.log('[ChatWindow] Current user ID:', currentUserId, '(type:', typeof currentUserId, ')');
    console.log('[ChatWindow] Caller ID:', callerId, '(type:', typeof callerId, ')');
    
    // Don't ignore if it's from self - might be testing
    // Just log it but still process
    if (currentUserId === callerId) {
      console.warn('[ChatWindow] ⚠️ Received call from self, but processing anyway');
    }
    
    // This is an incoming call for the current user
    console.log('[ChatWindow] ✅ Setting call state for incoming call');
    console.log('[ChatWindow] Call type:', data.callType);
    console.log('[ChatWindow] Caller:', data.caller);
    
    setCallState({
      type: data.callType,
      isIncoming: true,
      caller: data.caller,
      receiver: user,
    });
    
    console.log('[ChatWindow] ✅ Call state set successfully');
    console.log('[ChatWindow] ============================================');
  }, [user]);

  const handleCallRejected = useCallback(() => {
    setCallState(null);
    alert('Call was rejected');
  }, []);

  const handleCallEnded = useCallback(() => {
    setCallState(null);
  }, []);

  // Define message handlers BEFORE using them in useEffect
  const handleReceiveMessage = useCallback((message) => {
    console.log('[ChatWindow] 📨 Received message:', message);
    console.log('[ChatWindow] Message sender:', message.sender?._id || message.sender?.id);
    console.log('[ChatWindow] Message receiver:', message.receiver?._id || message.receiver?.id);
    console.log('[ChatWindow] Current user:', user?.id || user?._id);
    console.log('[ChatWindow] Selected user:', selectedUser?._id || selectedUser?.id);
    console.log('[ChatWindow] Message type:', message.messageType);
    
    // Check if message belongs to current conversation
    const senderId = String(message.sender?._id || message.sender?.id || '');
    const receiverId = String(message.receiver?._id || message.receiver?.id || '');
    const currentUserId = String(user?.id || user?._id || '');
    const selectedUserId = String(selectedUser?._id || selectedUser?.id || '');
    
    // Check if this message is between current user and selected user
    const isRelevantMessage = (senderId === currentUserId && receiverId === selectedUserId) ||
                               (senderId === selectedUserId && receiverId === currentUserId);
    
    console.log('[ChatWindow] Message match check:', {
      senderId,
      receiverId,
      currentUserId,
      selectedUserId,
      isRelevantMessage,
      hasSelectedUser: !!selectedUser
    });
    
    // Add message if it's part of the current conversation
    if (selectedUser && isRelevantMessage) {
      console.log('[ChatWindow] ✅ Message is relevant, adding to state');
      setMessages((prev) => {
        // Check if message already exists to avoid duplicates
        const exists = prev.some((msg) => msg._id === message._id);
        if (exists) {
          console.log('[ChatWindow] Received message already exists, skipping');
          return prev;
        }
        console.log('[ChatWindow] Adding received message to state');
        // Add message and sort by createdAt to maintain chronological order
        const newMessages = [...prev, message];
        return newMessages.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.timestamp || 0);
          const dateB = new Date(b.createdAt || b.timestamp || 0);
          return dateA - dateB; // Sort ascending (oldest first)
        });
      });
    } else {
      console.log('[ChatWindow] ⚠️ Message not for current conversation - sender:', senderId, 'receiver:', receiverId, 'selected:', selectedUserId, 'current:', currentUserId);
    }
  }, [user, selectedUser]);

  const handleMessageSent = useCallback((message) => {
    console.log('[ChatWindow] Message sent confirmed:', message);
    // Handle message confirmation from server (for sender)
    const isToSelectedUser = message.receiver._id === selectedUser?._id;
    const isFromCurrentUser = message.sender._id === user?.id || message.sender._id === user?._id;
    
    if (selectedUser && isFromCurrentUser && isToSelectedUser) {
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
          // Sort to maintain chronological order after replacement
          return newMessages.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.timestamp || 0);
            const dateB = new Date(b.createdAt || b.timestamp || 0);
            return dateA - dateB; // Sort ascending (oldest first)
          });
        }
        
        // Check if message already exists to avoid duplicates
        const exists = prev.some((msg) => msg._id === message._id);
        if (exists) {
          console.log('[ChatWindow] Message already exists, skipping');
          return prev;
        }
        console.log('[ChatWindow] Adding message to state');
        // Add message and sort by createdAt to maintain chronological order
        const newMessages = [...prev, message];
        return newMessages.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.timestamp || 0);
          const dateB = new Date(b.createdAt || b.timestamp || 0);
          return dateA - dateB; // Sort ascending (oldest first)
        });
      });
    }
  }, [user, selectedUser]);

  const handleMessageError = useCallback((error) => {
    console.error('Message error:', error);
    alert(error.message || 'Failed to send message');
  }, []);

  const handleTyping = useCallback((data) => {
    if (selectedUser && data.userId === selectedUser._id) {
      setIsTyping(data.isTyping);
      setTypingUser(data.username);
      setTimeout(() => {
        setIsTyping(false);
        setTypingUser(null);
      }, 3000);
    }
  }, [selectedUser]);

  const handleMessageRead = useCallback((data) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === data.messageId ? { ...msg, isRead: true, readAt: data.readAt } : msg
      )
    );
  }, []);

  const handleMessageDeleted = useCallback((data) => {
    console.log('[ChatWindow] 📨 Message deleted event received:', data);
    setMessages((prev) => {
      const beforeCount = prev.length;
      const filtered = prev.filter(msg => {
        // Compare both string and ObjectId formats
        const msgId = msg._id?.toString() || msg._id;
        const deletedId = data.messageId?.toString() || data.messageId;
        const shouldKeep = msgId !== deletedId;
        if (!shouldKeep) {
          console.log('[ChatWindow] ✅ Removing deleted message:', msgId);
        }
        return shouldKeep;
      });
      const afterCount = filtered.length;
      console.log('[ChatWindow] Messages before:', beforeCount, 'after:', afterCount, 'removed:', beforeCount - afterCount);
      return filtered;
    });
  }, []);

  // Register call handlers globally (not dependent on selectedUser)
  // This ensures calls can be received even when no chat is selected
  useEffect(() => {
    if (!socket) {
      console.warn('[ChatWindow] ⚠️ No socket available for call handlers');
      return;
    }

    const registerCallHandlers = () => {
      console.log('[ChatWindow] ✅ Registering global call event listeners');
      console.log('[ChatWindow] Socket connected:', socket.connected);
      console.log('[ChatWindow] Socket ID:', socket.id);
      
      // Remove any existing listeners first to avoid duplicates
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
      
      // Register handlers
      socket.on('incoming-call', handleIncomingCall);
      socket.on('call-rejected', handleCallRejected);
      socket.on('call-ended', handleCallEnded);
      
      // Also listen to broadcast for debugging
      socket.on('incoming-call-broadcast', (data) => {
        console.log('[ChatWindow] 🔔🔔🔔 BROADCAST call received:', data);
        // Check if this call is for us
        const currentUserId = String(user?._id || user?.id || '');
        const targetReceiverId = String(data.receiverId || '');
        if (currentUserId === targetReceiverId) {
          console.log('[ChatWindow] ✅ This broadcast call is for us! Processing...');
          handleIncomingCall(data);
        } else {
          console.log('[ChatWindow] ⚠️ Broadcast call is not for us (we are:', currentUserId, ', target:', targetReceiverId, ')');
        }
      });
      
      console.log('[ChatWindow] ✅ Call handlers registered');
      
      // Test listener to verify ALL events are being received
      const testListener = (eventName, ...args) => {
        if (eventName === 'incoming-call' || eventName === 'incoming-call-broadcast') {
          console.log('[ChatWindow] 🔔🔔🔔 Raw call event received via onAny:', eventName, args);
        }
      };
      socket.onAny(testListener);
      
      // Store test listener for cleanup
      socket._callTestListener = testListener;
    };

    if (socket.connected) {
      // Socket already connected, register immediately
      registerCallHandlers();
    } else {
      // Wait for connection
      console.warn('[ChatWindow] ⚠️ Socket not connected, waiting for connection...');
      const onConnect = () => {
        console.log('[ChatWindow] ✅ Socket connected, registering call handlers');
        registerCallHandlers();
      };
      socket.once('connect', onConnect);
      
      return () => {
        socket.off('connect', onConnect);
      };
    }

    return () => {
      if (socket) {
        console.log('[ChatWindow] Cleaning up call event listeners');
        socket.off('incoming-call', handleIncomingCall);
        socket.off('call-rejected', handleCallRejected);
        socket.off('call-ended', handleCallEnded);
        if (socket._callTestListener) {
          socket.offAny(socket._callTestListener);
          delete socket._callTestListener;
        }
      }
    };
  }, [socket, handleIncomingCall, handleCallRejected, handleCallEnded, user]); // Include all handlers in dependencies

  // Global message listener (always active to catch call history and other messages)
  useEffect(() => {
    if (!socket) return;

    console.log('[ChatWindow] Setting up global message listeners');
    socket.on('receive-message', handleReceiveMessage);
    socket.on('message-sent', handleMessageSent);
    socket.on('user-typing', handleTyping);
    socket.on('message-read', handleMessageRead);
    socket.on('message-error', handleMessageError);
    socket.on('message-deleted', handleMessageDeleted);

    return () => {
      if (socket) {
        console.log('[ChatWindow] Cleaning up global message listeners');
        socket.off('receive-message', handleReceiveMessage);
        socket.off('message-sent', handleMessageSent);
        socket.off('user-typing', handleTyping);
        socket.off('message-read', handleMessageRead);
        socket.off('message-error', handleMessageError);
        socket.off('message-deleted', handleMessageDeleted);
      }
    };
  }, [socket, handleReceiveMessage]);

  useEffect(() => {
    if (!selectedUser) return;

    // Reset state when switching users
    setMessages([]);
    setHasMoreMessages(true);
    setLoadingOlderMessages(false);
    
    fetchMessages();
  }, [selectedUser]);

  // Reset online status when selectedUser changes
  useEffect(() => {
    if (selectedUser) {
      setUserOnlineStatus(selectedUser.isOnline !== undefined ? selectedUser.isOnline : null);
    } else {
      setUserOnlineStatus(null);
    }
  }, [selectedUser]);

  // Listen for user online/offline events to update selectedUser status
  useEffect(() => {
    if (!socket || !selectedUser) return;

    const handleUserOnline = (data) => {
      const { userId } = data;
      if (selectedUser._id === userId || selectedUser.id === userId) {
        console.log('[ChatWindow] Selected user came online:', selectedUser.username);
        setUserOnlineStatus(true);
      }
    };

    const handleUserOffline = (data) => {
      const { userId } = data;
      if (selectedUser._id === userId || selectedUser.id === userId) {
        console.log('[ChatWindow] Selected user went offline:', selectedUser.username);
        setUserOnlineStatus(false);
      }
    };

    socket.on('user-online', handleUserOnline);
    socket.on('user-offline', handleUserOffline);

    return () => {
      socket.off('user-online', handleUserOnline);
      socket.off('user-offline', handleUserOffline);
    };
  }, [socket, selectedUser]);

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
    if (!selectedUser) {
      console.warn('[ChatWindow] No selected user, cannot fetch messages');
      return [];
    }
    
    try {
      const userId = selectedUser._id || selectedUser.id;
      console.log('[ChatWindow] Fetching messages for user:', userId);
      console.log('[ChatWindow] Selected user object:', selectedUser);
      
      const params = beforeDate ? { beforeDate: beforeDate.toISOString() } : {};
      const response = await api.get(`/messages/${userId}`, { params });
      
      console.log('[ChatWindow] Messages response:', response.data);
      console.log('[ChatWindow] Response success:', response.data.success);
      console.log('[ChatWindow] Messages array:', response.data.messages);
      
      const newMessages = response.data.messages || [];
      console.log('[ChatWindow] Received messages:', newMessages.length);
      
      if (newMessages.length === 0) {
        console.warn('[ChatWindow] No messages received! Check backend logs.');
      }
      
      if (beforeDate) {
        // Loading older messages - prepend to existing messages
        const combined = [...newMessages, ...prev];
        // Sort by createdAt to ensure proper chronological order
        const sorted = combined.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.timestamp || 0);
          const dateB = new Date(b.createdAt || b.timestamp || 0);
          return dateA - dateB; // Sort ascending (oldest first)
        });
        setMessages(sorted);
        setHasMoreMessages(response.data.hasMore || false);
      } else {
        // Initial load - replace all messages and ensure they're sorted
        const sorted = newMessages.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.timestamp || 0);
          const dateB = new Date(b.createdAt || b.timestamp || 0);
          return dateA - dateB; // Sort ascending (oldest first)
        });
        setMessages(sorted);
        setHasMoreMessages(response.data.hasMore !== false);
        // Scroll to bottom after initial load
        setTimeout(() => {
          scrollToBottom();
        }, 200);
      }
      
      return newMessages;
    } catch (error) {
      console.error('[ChatWindow] ❌ Error fetching messages:', error);
      console.error('[ChatWindow] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
      });
      
      // Show user-friendly error
      if (error.response?.status === 404) {
        console.warn('[ChatWindow] User not found or no messages');
      } else if (error.response?.status === 401) {
        console.error('[ChatWindow] Unauthorized - token may be invalid');
      } else {
        console.error('[ChatWindow] Server error:', error.response?.data);
      }
      
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


  const initiateCall = (callType) => {
    console.log('[ChatWindow] initiateCall called with type:', callType);
    console.log('[ChatWindow] selectedUser:', selectedUser);
    console.log('[ChatWindow] user:', user);
    console.log('[ChatWindow] socket:', socket);
    console.log('[ChatWindow] socket connected:', socket?.connected);
    console.log('[ChatWindow] current callState:', callState);
    
    if (!selectedUser) {
      console.error('[ChatWindow] No selectedUser, cannot initiate call');
      alert('Please select a user to call');
      return;
    }
    
    if (!user) {
      console.error('[ChatWindow] No user, cannot initiate call');
      alert('User not authenticated');
      return;
    }
    
    if (!socket) {
      console.error('[ChatWindow] No socket instance available');
      alert('Socket not initialized. Please refresh the page.');
      return;
    }
    
    if (!socket.connected) {
      console.error('[ChatWindow] Socket not connected. Connection state:', socket.connected);
      alert('Not connected to server. Please check your connection and refresh the page.');
      return;
    }
    
    const receiverId = selectedUser._id || selectedUser.id;
    if (!receiverId) {
      console.error('[ChatWindow] No receiverId found in selectedUser');
      alert('Invalid user selected');
      return;
    }
    
    const newCallState = {
      type: callType,
      isIncoming: false,
      caller: user,
      receiver: selectedUser,
    };
    
    console.log('[ChatWindow] Setting call state to:', newCallState);
    setCallState(newCallState);
    console.log('[ChatWindow] Call state set, component should re-render');

    console.log('[ChatWindow] Emitting initiate-call event');
    console.log('[ChatWindow] Call data:', { receiverId, callType });
    
    socket.emit('initiate-call', {
      receiverId: receiverId,
      callType,
    }, (response) => {
      // Optional acknowledgment callback
      if (response && response.error) {
        console.error('[ChatWindow] Call initiation error:', response.error);
        alert('Failed to initiate call: ' + response.error);
        setCallState(null);
      } else {
        console.log('[ChatWindow] Call initiation acknowledged');
      }
    });
  };
  
  // Debug effect to log callState changes
  useEffect(() => {
    console.log('[ChatWindow] callState changed:', callState);
  }, [callState]);

  const endCall = () => {
    if (socket && callState) {
      if (callState.isIncoming) {
        socket.emit('reject-call', { callerId: callState.caller._id });
      } else {
        socket.emit('end-call', { receiverId: callState.receiver._id });
      }
    }
    setCallState(null);
  };

  const answerCall = () => {
    // CallWindow will handle the actual answering logic
    // This just updates the state
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
      isDisappearing: isDisappearingMessage,
      disappearAfterRead: isDisappearingMessage, // Delete after read (like WhatsApp)
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
        isDisappearing: isDisappearingMessage,
        disappearAfterRead: isDisappearingMessage,
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
        // Use relative URL if it starts with /, otherwise construct full URL
        const imageUrl = message.fileUrl?.startsWith('http') 
          ? message.fileUrl 
          : message.fileUrl?.startsWith('/')
          ? message.fileUrl  // Relative URL - will go through Vite proxy
          : `${BASE_URL}${message.fileUrl}`;
        
        return (
          <img
            src={imageUrl}
            alt={message.fileName || 'Image'}
            className="w-full h-auto cursor-pointer object-contain"
            style={{ maxHeight: '400px', minHeight: '150px' }}
            onClick={() => window.open(imageUrl, '_blank')}
            onError={(e) => {
              console.error('[ChatWindow] Failed to load image:', imageUrl, 'Original fileUrl:', message.fileUrl);
              console.error('[ChatWindow] BASE_URL:', BASE_URL);
              console.error('[ChatWindow] Current origin:', window.location.origin);
              // Show error message instead of hiding
              e.target.style.display = 'none';
              const errorDiv = document.createElement('div');
              errorDiv.className = 'text-red-400 text-xs p-2';
              errorDiv.textContent = 'Failed to load image';
              e.target.parentNode?.appendChild(errorDiv);
            }}
            onLoad={() => {
              console.log('[ChatWindow] Image loaded successfully:', imageUrl);
            }}
          />
        );
      case 'video':
        // Use relative URL if it starts with /, otherwise construct full URL
        const videoUrl = message.fileUrl?.startsWith('http') 
          ? message.fileUrl 
          : message.fileUrl?.startsWith('/')
          ? message.fileUrl  // Relative URL - will go through Vite proxy
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
                console.error('[ChatWindow] Failed to load video:', videoUrl, 'Original fileUrl:', message.fileUrl);
                console.error('[ChatWindow] BASE_URL:', BASE_URL);
              }}
            />
          </div>
        );
      case 'audio':
        // Use relative URL if it starts with /, otherwise construct full URL
        const audioUrl = message.fileUrl?.startsWith('http') 
          ? message.fileUrl 
          : message.fileUrl?.startsWith('/')
          ? message.fileUrl  // Relative URL - will go through Vite proxy
          : `${BASE_URL}${message.fileUrl}`;
        return (
          <div className="max-w-[280px] sm:max-w-xs">
            <ReactAudioPlayer
              src={audioUrl}
              controls
              className="w-full"
              onError={(e) => {
                console.error('[ChatWindow] Failed to load audio:', audioUrl, 'Original fileUrl:', message.fileUrl);
                console.error('[ChatWindow] BASE_URL:', BASE_URL);
              }}
            />
          </div>
        );
      case 'file':
        // Use relative URL if it starts with /, otherwise construct full URL
        const fileUrl = message.fileUrl?.startsWith('http') 
          ? message.fileUrl 
          : message.fileUrl?.startsWith('/')
          ? message.fileUrl  // Relative URL - will go through Vite proxy
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
      case 'call-video-ended':
      case 'call-audio-ended':
      case 'call-missed':
        const isVideoCall = message.messageType === 'call-video-ended';
        const CallIcon = isVideoCall ? FiVideo : FiPhone;
        return (
          <div className="flex items-center gap-2 px-3 py-2">
            <CallIcon className="text-white flex-shrink-0" size={18} />
            <span className="text-white text-sm md:text-base">{message.content || 'Call ended'}</span>
          </div>
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
                  src={selectedUser.avatar?.startsWith('/') ? selectedUser.avatar : `${BASE_URL}${selectedUser.avatar}`}
                  alt={selectedUser.username}
                  className="w-full h-full rounded-full object-cover"
                  onError={(e) => {
                    console.error('[ChatWindow] Failed to load avatar:', selectedUser.avatar);
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                selectedUser.username.charAt(0).toUpperCase()
              )}
            </div>
            {effectiveSelectedUser?.isOnline && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 rounded-full border-2 border-slate-800"></div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm md:text-base truncate">{selectedUser.username}</h3>
            <p className="text-xs md:text-sm text-slate-400">
              {effectiveSelectedUser?.isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
          
          {/* Call Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[ChatWindow] Video call button clicked');
                console.log('[ChatWindow] selectedUser?.isOnline:', effectiveSelectedUser?.isOnline);
                console.log('[ChatWindow] callState:', callState);
                // Allow calls if isOnline is undefined/null (not explicitly false) and no call in progress
                const canCall = (effectiveSelectedUser?.isOnline !== false && !callState);
                if (canCall) {
                  initiateCall('video');
                } else {
                  console.warn('[ChatWindow] Call button disabled - user offline or call in progress');
                }
              }}
              className="p-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              title={effectiveSelectedUser?.isOnline === false ? "User is offline" : "Video call"}
              style={{ 
                opacity: (effectiveSelectedUser?.isOnline === false || !!callState) ? 0.5 : 1,
                cursor: (effectiveSelectedUser?.isOnline === false || !!callState) ? 'not-allowed' : 'pointer'
              }}
            >
              <FiVideo size={20} />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[ChatWindow] Audio call button clicked');
                console.log('[ChatWindow] selectedUser?.isOnline:', effectiveSelectedUser?.isOnline);
                console.log('[ChatWindow] callState:', callState);
                // Allow calls if isOnline is undefined/null (not explicitly false) and no call in progress
                const canCall = (effectiveSelectedUser?.isOnline !== false && !callState);
                if (canCall) {
                  initiateCall('audio');
                } else {
                  console.warn('[ChatWindow] Call button disabled - user offline or call in progress');
                }
              }}
              className="p-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              title={effectiveSelectedUser?.isOnline === false ? "User is offline" : "Audio call"}
              style={{ 
                opacity: (effectiveSelectedUser?.isOnline === false || !!callState) ? 0.5 : 1,
                cursor: (effectiveSelectedUser?.isOnline === false || !!callState) ? 'not-allowed' : 'pointer'
              }}
            >
              <FiPhone size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Call Window */}
      {callState && (
        <>
          {console.log('[ChatWindow] Rendering CallWindow with state:', callState)}
          <CallWindow
            callType={callState.type}
            caller={callState.caller}
            receiver={callState.receiver}
            isIncoming={callState.isIncoming}
            onEndCall={endCall}
            onAnswer={answerCall}
            socket={socket}
          />
        </>
      )}

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

        {/* Debug: Show message count */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-slate-500 px-2">
            Debug: {messages.length} messages loaded
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !loadingOlderMessages && selectedUser && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <p className="text-slate-400 mb-2">No messages yet</p>
            <p className="text-xs text-slate-500">Start a conversation by sending a message</p>
          </div>
        )}
        
        {messages.map((message) => {
          if (!message || !message.sender) {
            console.warn('[ChatWindow] Invalid message:', message);
            return null;
          }
          
          const isOwn = (message.sender._id || message.sender.id) === (user.id || user._id);
          const isMedia = ['image', 'video', 'audio', 'file'].includes(message.messageType);
          const isCallHistory = ['call-video-ended', 'call-audio-ended', 'call-missed'].includes(message.messageType);
          const isDisappearing = message.isDisappearing || false;
          
          // Call history messages are centered
          if (isCallHistory) {
            return (
              <div
                key={message._id}
                className="flex justify-center"
              >
                <div className="max-w-[85%] sm:max-w-[75%] md:max-w-[70%] flex flex-col items-center">
                  <div className="rounded-2xl bg-slate-700/50 text-slate-300 px-3 py-1.5 md:px-4 md:py-2">
                    {renderMessageContent(message)}
                  </div>
                  <span className="text-xs text-slate-500 mt-1">
                    {format(new Date(message.createdAt), 'HH:mm')}
                  </span>
                </div>
              </div>
            );
          }
          
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
                <span className="text-xs text-slate-500 mt-1 px-2 flex items-center gap-1">
                  {format(new Date(message.createdAt), 'HH:mm')}
                  {isDisappearing && (
                    <FiClock className="text-slate-400" size={12} title="Disappearing message" />
                  )}
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
          
          <button
            onClick={() => setIsDisappearingMessage(!isDisappearingMessage)}
            className={`p-1.5 md:p-2 transition-colors flex-shrink-0 ${
              isDisappearingMessage 
                ? 'text-primary-400 hover:text-primary-300' 
                : 'text-slate-400 hover:text-white'
            }`}
            title={isDisappearingMessage ? "Disappearing message enabled - Click to disable" : "Send disappearing message (like WhatsApp)"}
          >
            <FiEye size={18} className="md:w-5 md:h-5" />
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
              placeholder={isDisappearingMessage ? "Type a disappearing message..." : "Type a message..."}
              rows={1}
              className={`w-full px-3 md:px-4 py-1.5 md:py-2 text-sm md:text-base bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 resize-none max-h-24 md:max-h-32 ${
                isDisappearingMessage 
                  ? 'border-primary-500 focus:ring-primary-500' 
                  : 'border-slate-600 focus:ring-primary-500'
              }`}
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
