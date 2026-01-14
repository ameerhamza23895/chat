import React, { useState, useEffect, useRef } from 'react';
import { FiVideo, FiVideoOff, FiMic, FiMicOff, FiPhone, FiPhoneOff } from 'react-icons/fi';

const CallWindow = ({ 
  callType, // 'video' or 'audio'
  caller, 
  receiver, 
  isIncoming,
  onEndCall,
  onAnswer,
  socket
}) => {
  console.log('[CallWindow] Component rendered with props:', { callType, caller, receiver, isIncoming, hasSocket: !!socket });
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState(isIncoming ? 'ringing' : 'calling');
  const [callDuration, setCallDuration] = useState(0);
  const [pendingOffer, setPendingOffer] = useState(null);
  const [videoPermission, setVideoPermission] = useState('prompt'); // 'granted', 'denied', 'prompt'
  const [audioPermission, setAudioPermission] = useState('prompt'); // 'granted', 'denied', 'prompt'
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const intervalRef = useRef(null);
  const pendingOfferRef = useRef(null);

  // WebRTC configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Helper function to check permissions
  const checkPermissions = async (video = false, audio = false) => {
    if (!navigator.permissions || !navigator.permissions.query) {
      console.log('[CallWindow] Permissions API not available, will request directly');
      return { video: 'prompt', audio: 'prompt' };
    }

    try {
      const permissions = {};
      
      if (video) {
        try {
          const videoStatus = await navigator.permissions.query({ name: 'camera' });
          permissions.video = videoStatus.state;
          setVideoPermission(videoStatus.state);
          
          // Listen for permission changes
          videoStatus.onchange = () => {
            setVideoPermission(videoStatus.state);
          };
        } catch (e) {
          console.warn('[CallWindow] Could not query camera permission:', e);
          permissions.video = 'prompt';
        }
      }
      
      if (audio) {
        try {
          const audioStatus = await navigator.permissions.query({ name: 'microphone' });
          permissions.audio = audioStatus.state;
          setAudioPermission(audioStatus.state);
          
          // Listen for permission changes
          audioStatus.onchange = () => {
            setAudioPermission(audioStatus.state);
          };
        } catch (e) {
          console.warn('[CallWindow] Could not query microphone permission:', e);
          permissions.audio = 'prompt';
        }
      }
      
      return permissions;
    } catch (error) {
      console.warn('[CallWindow] Error checking permissions:', error);
      return { video: 'prompt', audio: 'prompt' };
    }
  };

  // Helper function to check if HTTPS is required
  const isSecureContext = () => {
    return window.isSecureContext || 
           location.protocol === 'https:' || 
           location.hostname === 'localhost' || 
           location.hostname === '127.0.0.1' ||
           location.hostname === '[::1]' ||
           location.hostname.endsWith('.localhost');
  };

  // Helper function to get getUserMedia with fallback and permission checking
  const getUserMedia = async (constraints) => {
    const needsVideo = constraints.video;
    const needsAudio = constraints.audio;
    
    // Check if we're in a secure context
    if (!isSecureContext()) {
      const error = new Error('Video/audio calls require HTTPS connection (except on localhost). Please access the app via HTTPS.');
      error.name = 'SecurityError';
      throw error;
    }
    
    // Check if getUserMedia is available at all
    const hasModernAPI = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    const getUserMediaFallback = navigator.getUserMedia ||
                                  navigator.webkitGetUserMedia ||
                                  navigator.mozGetUserMedia ||
                                  navigator.msGetUserMedia;
    
    if (!hasModernAPI && !getUserMediaFallback) {
      const error = new Error('Your browser does not support video/audio calls. Please use a modern browser like Chrome, Firefox, Safari, or Edge.');
      error.name = 'NotSupportedError';
      throw error;
    }
    
    // Check current permissions
    const permissions = await checkPermissions(needsVideo, needsAudio);
    
    console.log('[CallWindow] Permission status:', permissions);
    
    // If permission is denied, throw error immediately
    if (needsVideo && permissions.video === 'denied') {
      const error = new Error('Camera permission was denied. Please enable it in your browser settings.');
      error.name = 'NotAllowedError';
      throw error;
    }
    if (needsAudio && permissions.audio === 'denied') {
      const error = new Error('Microphone permission was denied. Please enable it in your browser settings.');
      error.name = 'NotAllowedError';
      throw error;
    }
    
    // If permission is granted, we can proceed (browser may still prompt, but user already granted)
    // If permission is 'prompt', browser will ask user
    
    // Try modern API first
    if (hasModernAPI) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        // If modern API fails and we have a fallback, try that
        if (getUserMediaFallback && error.name !== 'NotAllowedError' && error.name !== 'NotFoundError') {
          console.log('[CallWindow] Modern API failed, trying fallback');
          return new Promise((resolve, reject) => {
            getUserMediaFallback.call(navigator, constraints, resolve, reject);
          });
        }
        throw error;
      }
    }
    
    // Fallback for older browsers
    if (getUserMediaFallback) {
      return new Promise((resolve, reject) => {
        getUserMediaFallback.call(navigator, constraints, resolve, reject);
      });
    }
    
    const error = new Error('getUserMedia is not supported in this browser');
    error.name = 'NotSupportedError';
    throw error;
  };

  // Helper functions
  const startCallTimer = () => {
    if (callStartTimeRef.current) return; // Already started
    callStartTimeRef.current = Date.now();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      setCallDuration(duration);
    }, 1000);
  };

  const cleanup = () => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear refs
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    callStartTimeRef.current = null;
  };

  const handleAnswer = async (data) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        setCallStatus('connected');
        startCallTimer();
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleCallAnswered = () => {
    setCallStatus('connected');
    startCallTimer();
  };

  const handleCallAccepted = () => {
    setCallStatus('connected');
    startCallTimer();
  };

  const handleCallRejected = () => {
    alert('Call rejected');
    onEndCall();
  };

  const handleCallEnded = () => {
    onEndCall();
  };

  const handleIceCandidate = async (data) => {
    try {
      if (peerConnectionRef.current && data.candidate) {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  // Helper function to process offer when answering
  const processOfferForAnswer = async (offerData) => {
    console.log('[CallWindow] Processing offer for answer...', { video: callType === 'video', audio: true });

    // Get user media using helper function
    const stream = await getUserMedia({
      video: callType === 'video',
      audio: true,
    });
    
    console.log('[CallWindow] User media obtained for answer:', stream);
    console.log('[CallWindow] Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
    
    setLocalStream(stream);
    localStreamRef.current = stream;

    // Create peer connection
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;

    // Add local stream tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      setCallStatus('connected');
      startCallTimer();
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          receiverId: offerData.callerId,
        });
      }
    };

    // Set remote description and create answer
    await pc.setRemoteDescription(new RTCSessionDescription(offerData.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('answer-call', {
      callerId: offerData.callerId,
      answer: answer,
    });
    
    console.log('[CallWindow] Answer sent successfully');
  };

  const startCall = async () => {
    try {
      console.log('[CallWindow] Requesting user media...', { video: callType === 'video' && isVideoEnabled, audio: isAudioEnabled });
      
      // Get user media using helper function
      const stream = await getUserMedia({
        video: callType === 'video' && isVideoEnabled,
        audio: isAudioEnabled,
      });
      
      console.log('[CallWindow] User media obtained:', stream);
      console.log('[CallWindow] Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
      
      setLocalStream(stream);
      localStreamRef.current = stream;

      // Create peer connection
      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = pc;

      // Add local stream tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        if (callStatus === 'calling' || callStatus === 'ringing') {
          setCallStatus('connected');
          startCallTimer();
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', {
            candidate: event.candidate,
            receiverId: receiver._id,
          });
        }
      };

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call-user', {
        receiverId: receiver._id,
        callType,
        offer: offer,
      });

    } catch (error) {
      console.error('[CallWindow] Error starting call:', error);
      let errorMessage = '';
      
      if (error.name === 'SecurityError' || (error.message && error.message.includes('HTTPS'))) {
        errorMessage = 'Video/audio calls require a secure connection (HTTPS).\n\n';
        if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
          errorMessage += 'Please access the application using HTTPS.\n';
          errorMessage += `Current URL: ${location.protocol}//${location.host}\n\n`;
          errorMessage += 'To enable HTTPS:\n';
          errorMessage += '1. Use a development server with HTTPS enabled\n';
          errorMessage += '2. Or deploy to a server with SSL certificate\n';
          errorMessage += '3. Or use localhost (which works without HTTPS)';
        } else {
          errorMessage += 'This error should not occur on localhost. Please check your browser settings.';
        }
      } else if (error.name === 'NotSupportedError' || (error.message && error.message.includes('not support'))) {
        errorMessage = 'Your browser does not support video/audio calls.\n\n';
        errorMessage += 'Please use a modern browser:\n';
        errorMessage += '- Google Chrome (recommended)\n';
        errorMessage += '- Mozilla Firefox\n';
        errorMessage += '- Microsoft Edge\n';
        errorMessage += '- Safari (macOS/iOS)';
        if (!isSecureContext()) {
          errorMessage += '\n\nNote: Video/audio calls also require HTTPS (except on localhost).';
        }
      } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Camera/microphone permission was denied.\n\n';
        errorMessage += 'Please allow camera/microphone access:\n';
        errorMessage += '1. Click the lock/camera icon in your browser address bar\n';
        errorMessage += '2. Set Camera and Microphone to "Allow"\n';
        errorMessage += '3. Refresh the page and try again';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera/microphone device found.\n\n';
        errorMessage += 'Please:\n';
        errorMessage += '1. Connect a camera/microphone to your device\n';
        errorMessage += '2. Make sure the device is not being used by another application\n';
        errorMessage += '3. Check your device settings';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Camera/microphone is already in use.\n\n';
        errorMessage += 'Please:\n';
        errorMessage += '1. Close other applications using the camera/microphone\n';
        errorMessage += '2. Or disconnect other browser tabs with video calls\n';
        errorMessage += '3. Try again';
      } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
        errorMessage = 'Camera/microphone does not support the required settings.\n\n';
        errorMessage += 'Please try a different device or adjust your browser settings.';
      } else {
        errorMessage = 'Failed to access camera/microphone.\n\n';
        errorMessage += error.message || 'Unknown error occurred.';
        if (!isSecureContext()) {
          errorMessage += '\n\nNote: This might be due to missing HTTPS connection.';
        }
      }
      
      alert(errorMessage);
      onEndCall();
    }
  };

  const handleOffer = async (data) => {
    try {
      // Only handle offer if this is an incoming call
      if (!isIncoming) return;

      console.log('[CallWindow] Offer received, callStatus:', callStatus);

      // If call is still ringing, store offer for when user answers
      if (callStatus === 'ringing') {
        console.log('[CallWindow] Storing offer for later processing (call is ringing)');
        pendingOfferRef.current = data;
        setPendingOffer(data);
        return;
      }

      // If call is already answering, process the offer immediately
      // (user clicked answer but offer arrived after, or offer wasn't stored)
      if (callStatus === 'answering') {
        console.log('[CallWindow] Processing offer immediately (call is answering)');
        try {
          await processOfferForAnswer(data);
        } catch (error) {
          console.error('[CallWindow] Error processing offer when answering:', error);
          // Error handling is done in processOfferForAnswer, but we catch here to prevent unhandled promise rejection
        }
        return;
      }

      // If call is already connected, ignore new offers
      console.log('[CallWindow] Ignoring offer - call status is:', callStatus);
      return;
    } catch (error) {
      console.error('[CallWindow] Error handling offer:', error);
      let errorMessage = '';
      
      if (error.name === 'SecurityError' || (error.message && error.message.includes('HTTPS'))) {
        errorMessage = 'Video/audio calls require a secure connection (HTTPS).\n\n';
        if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
          errorMessage += 'Please access the application using HTTPS.\n';
          errorMessage += `Current URL: ${location.protocol}//${location.host}\n\n`;
          errorMessage += 'To enable HTTPS:\n';
          errorMessage += '1. Use a development server with HTTPS enabled\n';
          errorMessage += '2. Or deploy to a server with SSL certificate\n';
          errorMessage += '3. Or use localhost (which works without HTTPS)';
        } else {
          errorMessage += 'This error should not occur on localhost. Please check your browser settings.';
        }
      } else if (error.name === 'NotSupportedError' || (error.message && error.message.includes('not support'))) {
        errorMessage = 'Your browser does not support video/audio calls.\n\n';
        errorMessage += 'Please use a modern browser:\n';
        errorMessage += '- Google Chrome (recommended)\n';
        errorMessage += '- Mozilla Firefox\n';
        errorMessage += '- Microsoft Edge\n';
        errorMessage += '- Safari (macOS/iOS)';
        if (!isSecureContext()) {
          errorMessage += '\n\nNote: Video/audio calls also require HTTPS (except on localhost).';
        }
      } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Camera/microphone permission was denied.\n\n';
        errorMessage += 'Please allow camera/microphone access:\n';
        errorMessage += '1. Click the lock/camera icon in your browser address bar\n';
        errorMessage += '2. Set Camera and Microphone to "Allow"\n';
        errorMessage += '3. Refresh the page and try again';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera/microphone device found.\n\n';
        errorMessage += 'Please:\n';
        errorMessage += '1. Connect a camera/microphone to your device\n';
        errorMessage += '2. Make sure the device is not being used by another application\n';
        errorMessage += '3. Check your device settings';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Camera/microphone is already in use.\n\n';
        errorMessage += 'Please:\n';
        errorMessage += '1. Close other applications using the camera/microphone\n';
        errorMessage += '2. Or disconnect other browser tabs with video calls\n';
        errorMessage += '3. Try again';
      } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
        errorMessage = 'Camera/microphone does not support the required settings.\n\n';
        errorMessage += 'Please try a different device or adjust your browser settings.';
      } else {
        errorMessage = 'Failed to access camera/microphone.\n\n';
        errorMessage += error.message || 'Unknown error occurred.';
        if (!isSecureContext()) {
          errorMessage += '\n\nNote: This might be due to missing HTTPS connection.';
        }
      }
      
      alert(errorMessage);
      onEndCall();
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const endCall = () => {
    if (socket && receiver) {
      socket.emit('end-call', { receiverId: receiver._id });
    }
    if (socket && caller && isIncoming) {
      socket.emit('end-call', { receiverId: caller._id });
    }
    onEndCall();
  };

  const answerCall = async () => {
    if (socket && caller) {
      console.log('[CallWindow] Answering call, pendingOffer:', pendingOfferRef.current);
      setCallStatus('answering');
      
      // Accept the call
      socket.emit('accept-call', { callerId: caller._id });
      
      // Process pending offer if available
      if (pendingOfferRef.current) {
        const offerData = pendingOfferRef.current;
        pendingOfferRef.current = null;
        setPendingOffer(null);
        
        try {
          await processOfferForAnswer(offerData);
        } catch (error) {
          console.error('[CallWindow] Error answering call:', error);
          let errorMessage = '';
          
          if (error.name === 'SecurityError' || (error.message && error.message.includes('HTTPS'))) {
            errorMessage = 'Video/audio calls require a secure connection (HTTPS).\n\n';
            if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
              errorMessage += 'Please access the application using HTTPS.\n';
              errorMessage += `Current URL: ${location.protocol}//${location.host}\n\n`;
              errorMessage += 'To enable HTTPS:\n';
              errorMessage += '1. Use a development server with HTTPS enabled\n';
              errorMessage += '2. Or deploy to a server with SSL certificate\n';
              errorMessage += '3. Or use localhost (which works without HTTPS)';
            } else {
              errorMessage += 'This error should not occur on localhost. Please check your browser settings.';
            }
          } else if (error.name === 'NotSupportedError' || (error.message && error.message.includes('not support'))) {
            errorMessage = 'Your browser does not support video/audio calls.\n\n';
            errorMessage += 'Please use a modern browser:\n';
            errorMessage += '- Google Chrome (recommended)\n';
            errorMessage += '- Mozilla Firefox\n';
            errorMessage += '- Microsoft Edge\n';
            errorMessage += '- Safari (macOS/iOS)';
            if (!isSecureContext()) {
              errorMessage += '\n\nNote: Video/audio calls also require HTTPS (except on localhost).';
            }
          } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = 'Camera/microphone permission was denied.\n\n';
            errorMessage += 'Please allow camera/microphone access:\n';
            errorMessage += '1. Click the lock/camera icon in your browser address bar\n';
            errorMessage += '2. Set Camera and Microphone to "Allow"\n';
            errorMessage += '3. Refresh the page and try again';
          } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = 'No camera/microphone device found.\n\n';
            errorMessage += 'Please:\n';
            errorMessage += '1. Connect a camera/microphone to your device\n';
            errorMessage += '2. Make sure the device is not being used by another application\n';
            errorMessage += '3. Check your device settings';
          } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage = 'Camera/microphone is already in use.\n\n';
            errorMessage += 'Please:\n';
            errorMessage += '1. Close other applications using the camera/microphone\n';
            errorMessage += '2. Or disconnect other browser tabs with video calls\n';
            errorMessage += '3. Try again';
          } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
            errorMessage = 'Camera/microphone does not support the required settings.\n\n';
            errorMessage += 'Please try a different device or adjust your browser settings.';
          } else {
            errorMessage = 'Failed to access camera/microphone.\n\n';
            errorMessage += error.message || 'Unknown error occurred.';
            if (!isSecureContext()) {
              errorMessage += '\n\nNote: This might be due to missing HTTPS connection.';
            }
          }
          
          alert(errorMessage);
          onEndCall();
          return;
        }
      }
      
      onAnswer();
    }
  };

  const rejectCall = () => {
    if (socket && caller) {
      socket.emit('reject-call', { callerId: caller._id });
    }
    onEndCall();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Check permissions on mount
  useEffect(() => {
    if (callType === 'video') {
      checkPermissions(true, true);
    } else {
      checkPermissions(false, true);
    }
  }, [callType]);

  // Update local video when stream changes
  useEffect(() => {
    if (localStream && localVideoRef.current && callType === 'video') {
      console.log('[CallWindow] Local stream changed, updating video element');
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(err => {
        console.error('[CallWindow] Error playing local video:', err);
      });
    }
  }, [localStream, callType]);

  // Update remote video when stream changes
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current && callType === 'video') {
      console.log('[CallWindow] Remote stream changed, updating video element');
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(err => {
        console.error('[CallWindow] Error playing remote video:', err);
      });
    }
  }, [remoteStream, callType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('call-answered', handleCallAnswered);
    socket.on('call-rejected', handleCallRejected);
    socket.on('call-ended', handleCallEnded);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('call-accepted', handleCallAccepted);

    // Start call if outgoing
    if (!isIncoming && callStatus === 'calling') {
      startCall();
    }

    return () => {
      socket.off('call-answered', handleCallAnswered);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('call-accepted', handleCallAccepted);
    };
  }, [socket, isIncoming, callStatus]);

  // Note: Pending offer is now handled directly in answerCall function

  const displayUser = isIncoming ? caller : receiver;

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      {/* Remote Video/Audio */}
      <div className="absolute inset-0">
        {callType === 'video' ? (
          remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              onLoadedMetadata={() => {
                console.log('[CallWindow] Remote video metadata loaded');
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.play().catch(err => {
                    console.error('[CallWindow] Error playing remote video on load:', err);
                  });
                }
              }}
              onError={(e) => {
                console.error('[CallWindow] Remote video error:', e);
              }}
              onCanPlay={() => {
                console.log('[CallWindow] Remote video can play');
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-900">
              <div className="text-center text-white">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-primary-600 flex items-center justify-center text-white text-3xl md:text-4xl font-semibold mx-auto mb-4">
                  {displayUser?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <h2 className="text-xl md:text-2xl font-semibold mb-2">
                  {displayUser?.username || 'User'}
                </h2>
                {callStatus === 'connected' && (
                  <p className="text-gray-300 text-lg">{formatDuration(callDuration)}</p>
                )}
                {callStatus !== 'connected' && (
                  <p className="text-gray-400">
                    {isIncoming ? 'Incoming call...' : 'Calling...'}
                  </p>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-primary-600 flex items-center justify-center text-white text-4xl md:text-5xl font-semibold mx-auto mb-4">
                {displayUser?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <h2 className="text-white text-xl md:text-2xl font-semibold mb-2">
                {displayUser?.username || 'User'}
              </h2>
              {callStatus === 'connected' && (
                <p className="text-gray-300 text-lg">{formatDuration(callDuration)}</p>
              )}
              {callStatus !== 'connected' && (
                <p className="text-gray-400">
                  {isIncoming ? 'Incoming call...' : 'Calling...'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Local Video (Picture-in-Picture for video calls) */}
      {callType === 'video' && (
        <div className="absolute top-4 right-4 w-32 md:w-40 h-24 md:h-30 rounded-lg overflow-hidden bg-slate-800 border-2 border-slate-600 z-10">
          {localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              onLoadedMetadata={() => {
                console.log('[CallWindow] Local video metadata loaded');
                if (localVideoRef.current) {
                  localVideoRef.current.play().catch(err => {
                    console.error('[CallWindow] Error playing local video on load:', err);
                  });
                }
              }}
              onError={(e) => {
                console.error('[CallWindow] Local video error:', e);
              }}
              onCanPlay={() => {
                console.log('[CallWindow] Local video can play');
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-700">
              <div className="text-center text-white text-xs">
                <div className="animate-pulse">Loading camera...</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Call Status Overlay */}
      {callStatus !== 'connected' && callType === 'video' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
          <div className="text-center">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-primary-600 flex items-center justify-center text-white text-3xl md:text-4xl font-semibold mx-auto mb-4">
              {displayUser?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <h2 className="text-white text-xl md:text-2xl font-semibold mb-2">
              {displayUser?.username || 'User'}
            </h2>
            <p className="text-gray-400">
              {isIncoming ? 'Incoming call...' : 'Calling...'}
            </p>
            {/* Show permission status if denied */}
            {((callType === 'video' && videoPermission === 'denied') || 
              (audioPermission === 'denied')) && (
              <p className="text-red-400 text-sm mt-2 max-w-xs mx-auto">
                Camera/Microphone permission denied. Please enable in browser settings.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Call Controls */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
        {callStatus === 'ringing' && isIncoming ? (
          <>
            <button
              onClick={rejectCall}
              className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors"
            >
              <FiPhoneOff size={24} />
            </button>
            <button
              onClick={answerCall}
              className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center text-white transition-colors"
            >
              <FiPhone size={24} />
            </button>
          </>
        ) : callStatus === 'connected' ? (
          <>
            {callType === 'video' && (
              <button
                onClick={toggleVideo}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white transition-colors ${
                  isVideoEnabled ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isVideoEnabled ? <FiVideo size={20} /> : <FiVideoOff size={20} />}
              </button>
            )}
            <button
              onClick={toggleAudio}
              className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white transition-colors ${
                isAudioEnabled ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isAudioEnabled ? <FiMic size={20} /> : <FiMicOff size={20} />}
            </button>
            <button
              onClick={endCall}
              className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors"
            >
              <FiPhoneOff size={24} />
            </button>
          </>
        ) : (
          <button
            onClick={endCall}
            className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors"
          >
            <FiPhoneOff size={24} />
          </button>
        )}
      </div>
    </div>
  );
};

export default CallWindow;
