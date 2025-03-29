/* eslint rule disable"*/
import React, { useState, useEffect, useRef, useCallback } from "react";
import { db, auth } from "../firebase/firebase";
import { 
  collection, addDoc, serverTimestamp, query, orderBy, 
  onSnapshot, getDoc, doc as firestoreDoc, getDocs, 
  where, updateDoc, deleteDoc, setDoc
} from "firebase/firestore";
import EmojiPicker from "emoji-picker-react";
import { useNavigate } from "react-router-dom";
import { 
  FaSun, FaMoon, FaSearch, FaSmile,
  FaCheck, FaCheckDouble, FaUserCircle,
  FaEdit, FaTrash, FaPaperclip, FaTimes,
  FaReply, FaThumbtack, FaPalette,
  FaDownload
} from "react-icons/fa";
import { IoMdSend } from "react-icons/io";

function Chat() {
  // State variables
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    messageId: null,
    position: { x: 0, y: 0 },
  });
  const [darkMode, setDarkMode] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [mediaPreview, setMediaPreview] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [userStatuses, setUserStatuses] = useState({});
  const [theme, setTheme] = useState("default");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Themes configuration
  const themes = {
    default: {
      light: { bg: "bg-gray-50", text: "text-gray-900", message: "bg-gray-200" },
      dark: { bg: "bg-gray-900", text: "text-gray-100", message: "bg-gray-700" }
    },
    sunset: {
      light: { bg: "bg-orange-50", text: "text-orange-900", message: "bg-orange-100" },
      dark: { bg: "bg-orange-900", text: "text-orange-100", message: "bg-orange-800" }
    },
    ocean: {
      light: { bg: "bg-blue-50", text: "text-blue-900", message: "bg-blue-100" },
      dark: { bg: "bg-blue-900", text: "text-blue-100", message: "bg-blue-800" }
    },
    forest: {
      light: { bg: "bg-green-50", text: "text-green-900", message: "bg-green-100" },
      dark: { bg: "bg-green-900", text: "text-green-100", message: "bg-green-800" }
    }
  };

  // Get current theme colors
  const currentTheme = themes[theme][darkMode ? "dark" : "light"];

  // Check authentication
  useEffect(() => {
    if (!auth.currentUser) {
      navigate("/login");
    } else {
      const draft = localStorage.getItem(`draft_${selectedUser?.id || 'public'}`);
      if (draft) setNewMessage(draft);
    }
  }, [navigate, selectedUser]);

  // Load all users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        setUsers(usersSnapshot.docs.map((doc) => ({ 
          id: doc.id, 
          ...doc.data(),
          color: `hsl(${parseInt(doc.id.slice(0, 8), 16) % 360}, 70%, 60%)`
        })));
      } catch (error) {
        console.error("Error loading users:", error);
      }
    };
    loadUsers();
  }, []);

  // Track online status and user statuses
  useEffect(() => {
    const onlineStatusRef = collection(db, "onlineStatus");
    const unsubscribeStatus = onSnapshot(onlineStatusRef, (snapshot) => {
      const status = {};
      snapshot.docs.forEach((doc) => {
        status[doc.id] = doc.data().isOnline;
      });
      setOnlineStatus(status);
    });

    const userStatusRef = collection(db, "userStatus");
    const unsubscribeUserStatus = onSnapshot(userStatusRef, (snapshot) => {
      const statuses = {};
      snapshot.docs.forEach((doc) => {
        statuses[doc.id] = doc.data().status || "Available";
      });
      setUserStatuses(statuses);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeUserStatus();
    };
  }, []);

  // Set user online status
  useEffect(() => {
    if (!auth.currentUser) return;
    const onlineStatusRef = firestoreDoc(db, "onlineStatus", auth.currentUser.uid);
    const userStatusRef = firestoreDoc(db, "userStatus", auth.currentUser.uid);
    
    const setOnline = async () => {
      try {
        await setDoc(onlineStatusRef, { 
          isOnline: true,
          lastSeen: serverTimestamp()
        });
        await setDoc(userStatusRef, { 
          status: "Available",
          lastUpdated: serverTimestamp()
        });
      } catch (error) {
        console.error("Error setting online status:", error);
      }
    };
    
    setOnline();
    
    const handleBeforeUnload = async () => {
      try {
        await setDoc(onlineStatusRef, { 
          isOnline: false,
          lastSeen: serverTimestamp()
        });
      } catch (error) {
        console.error("Error setting offline status:", error);
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Get chat ID
  const getChatId = (userId1, userId2) => [userId1, userId2].sort().join("_");

  // Load messages
  useEffect(() => {
    let q;
    if (selectedUser) {
      const chatId = getChatId(auth.currentUser.uid, selectedUser.id);
      q = query(
        collection(db, "privateMessages"),
        where("chatId", "==", chatId),
        orderBy("timestamp")
      );
    } else {
      q = query(collection(db, "messages"), orderBy("timestamp"));
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const messagesWithNames = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const message = doc.data();
          const userDoc = await getDoc(firestoreDoc(db, "users", message.sender));
          return {
            id: doc.id,
            ...message,
            senderName: userDoc.exists() ? userDoc.data().name : "Unknown",
            senderColor: userDoc.exists() ? 
              `hsl(${parseInt(message.sender.slice(0, 8), 16) % 360}, 70%, 60%)` : "#666",
            timestamp: message.timestamp?.toDate(),
            reactions: message.reactions || {},
            isEdited: message.isEdited || false,
            isRead: message.isRead || false,
          };
        })
      );
      setMessages(messagesWithNames);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

      if (selectedUser && messagesWithNames.length > messages.length) {
        const lastMessage = messagesWithNames[messagesWithNames.length - 1];
        if (lastMessage.sender !== auth.currentUser.uid) {
          setUnreadCounts(prev => ({
            ...prev,
            [selectedUser.id]: (prev[selectedUser.id] || 0) + 1
          }));
        }
      }
    });

    return () => unsubscribe();
  }, [selectedUser]);

  // Load pinned messages
  useEffect(() => {
    let q;
    if (selectedUser) {
      const chatId = getChatId(auth.currentUser.uid, selectedUser.id);
      q = query(
        collection(db, "privateMessages"),
        where("chatId", "==", chatId),
        where("isPinned", "==", true),
        orderBy("timestamp", "desc")
      );
    } else {
      q = query(
        collection(db, "messages"),
        where("isPinned", "==", true),
        orderBy("timestamp", "desc")
      );
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const pinned = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const message = doc.data();
            const userDoc = await getDoc(firestoreDoc(db, "users", message.sender));
            return {
              id: doc.id,
              ...message,
              senderName: userDoc.exists() ? userDoc.data().name : "Unknown",
              timestamp: message.timestamp?.toDate(),
            };
          })
        );
        setPinnedMessages(pinned);
      } catch (error) {
        console.error("Error loading pinned messages:", error);
      }
    });

    return () => unsubscribe();
  }, [selectedUser]);

  // Mark messages as read
  useEffect(() => {
    if (!selectedUser) return;
    
    const markMessagesAsRead = async () => {
      const chatId = getChatId(auth.currentUser.uid, selectedUser.id);
      const q = query(
        collection(db, "privateMessages"),
        where("chatId", "==", chatId),
        where("sender", "==", selectedUser.id),
        where("isRead", "==", false)
      );
      
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(async (doc) => {
        await updateDoc(doc.ref, { isRead: true });
      });
      
      setUnreadCounts(prev => ({
        ...prev,
        [selectedUser.id]: 0
      }));
    };
    
    markMessagesAsRead();
  }, [selectedUser]);

  // Show browser notification
  const showNotification = (sender, message) => {
    if (Notification.permission === "granted") {
      new Notification(`New message from ${sender}`, {
        body: message.length > 50 ? `${message.substring(0, 50)}...` : message,
        icon: "/logo192.png"
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification(`New message from ${sender}`, {
            body: message.length > 50 ? `${message.substring(0, 50)}...` : message,
            icon: "/logo192.png"
          });
        }
      });
    }
  };

  // Handle file selection for Base64 images
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Limit to 1MB for Base64
    if (file.size > 1 * 1024 * 1024) {
      alert("Please select an image smaller than 1MB");
      return;
    }

    // Only allow image files
    if (!file.type.match("image.*")) {
      alert("Please select an image file (JPEG, PNG, etc.)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Send message with useCallback to prevent re-renders
  const sendMessage = useCallback(async () => {
    if ((!newMessage.trim() && !mediaPreview) || !auth.currentUser) return;
    
    try {
      const messageData = {
        sender: auth.currentUser.uid,
        timestamp: serverTimestamp(),
        isRead: false,
        replyTo: replyingTo?.id || null,
        replyText: replyingTo?.text ? `${replyingTo.text.substring(0, 30)}${replyingTo.text.length > 30 ? "..." : ""}` : null,
        replySender: replyingTo?.senderName || null
      };

      // Add image if available
      if (mediaPreview) {
        messageData.image = mediaPreview;
        messageData.text = newMessage || "[Image]";
      } else {
        messageData.text = newMessage;
      }

      let collectionName;
      if (selectedUser) {
        collectionName = "privateMessages";
        const chatId = getChatId(auth.currentUser.uid, selectedUser.id);
        messageData.participants = [auth.currentUser.uid, selectedUser.id];
        messageData.chatId = chatId;
      } else {
        collectionName = "messages";
      }

      await addDoc(collection(db, collectionName), messageData);

      setNewMessage("");
      setMediaPreview(null);
      setReplyingTo(null);
      setShowEmojiPicker(false);
      localStorage.removeItem(`draft_${selectedUser?.id || 'public'}`);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }, [newMessage, mediaPreview, replyingTo, selectedUser]);

  // Pin/unpin message
  const togglePinMessage = async (messageId) => {
    try {
      const message = messages.find((msg) => msg.id === messageId);
      if (!message) return;

      const collectionName = selectedUser ? "privateMessages" : "messages";
      const messageRef = firestoreDoc(db, collectionName, messageId);
      await updateDoc(messageRef, { isPinned: !message.isPinned });
    } catch (error) {
      console.error("Error pinning message:", error);
    }
  };

  // Handle reactions
  const handleReaction = async (messageId, emoji) => {
    try {
      const message = messages.find((msg) => msg.id === messageId);
      if (!message) return;

      const collectionName = selectedUser ? "privateMessages" : "messages";
      const messageRef = firestoreDoc(db, collectionName, messageId);
      const reactions = { ...message.reactions };
      const userReactions = reactions[emoji] || [];

      if (userReactions.includes(auth.currentUser.uid)) {
        reactions[emoji] = userReactions.filter((uid) => uid !== auth.currentUser.uid);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...userReactions, auth.currentUser.uid];
      }
      await updateDoc(messageRef, { reactions });
    } catch (error) {
      console.error("Error updating reaction:", error);
    }
  };

  // Typing indicator
  useEffect(() => {
    if (!selectedUser) return;
    const typingStatusRef = firestoreDoc(db, "typingStatus", auth.currentUser.uid);
    
    let typingTimeout;
    const handleTyping = async (isTyping) => {
      try {
        await setDoc(typingStatusRef, {
          isTyping,
          timestamp: serverTimestamp(),
          chatId: selectedUser ? getChatId(auth.currentUser.uid, selectedUser.id) : "public"
        });
      } catch (error) {
        console.error("Error setting typing status:", error);
      }
    };

    const inputHandler = () => {
      handleTyping(true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => handleTyping(false), 2000);
    };

    const input = document.querySelector('input[type="text"]');
    if (input) {
      input.addEventListener("input", inputHandler);
    }
    
    return () => {
      if (input) {
        input.removeEventListener("input", inputHandler);
      }
      clearTimeout(typingTimeout);
    };
  }, [selectedUser]);

  // Listen for typing status
  useEffect(() => {
    if (!selectedUser) return;
    const typingStatusRef = collection(db, "typingStatus");
    const unsubscribe = onSnapshot(typingStatusRef, (snapshot) => {
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.isTyping && 
            (selectedUser && data.chatId === getChatId(auth.currentUser.uid, selectedUser.id))) {
          const typingUserId = doc.id;
          if (typingUserId !== auth.currentUser.uid) {
            const user = users.find(u => u.id === typingUserId);
            setTypingUser(user?.name || "Someone");
          }
        } else {
          setTypingUser(null);
        }
      });
    });
    return () => unsubscribe();
  }, [selectedUser, users]);

  // Delete message
  const deleteMessage = async (messageId) => {
    try {
      const message = messages.find((msg) => msg.id === messageId);
      if (!message || message.sender !== auth.currentUser.uid) return;

      const collectionName = selectedUser ? "privateMessages" : "messages";
      await deleteDoc(firestoreDoc(db, collectionName, messageId));
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  // Edit message
  const editMessage = async (messageId, newText) => {
    try {
      const message = messages.find((msg) => msg.id === messageId);
      if (!message || message.sender !== auth.currentUser.uid) return;

      const collectionName = selectedUser ? "privateMessages" : "messages";
      const messageRef = firestoreDoc(db, collectionName, messageId);
      await updateDoc(messageRef, { text: newText, isEdited: true });
    } catch (error) {
      console.error("Error editing message:", error);
    }
  };

  // Close context menu
  useEffect(() => {
    const clickHandler = () => {
      if (contextMenu.visible) setContextMenu({ visible: false, messageId: null, position: { x: 0, y: 0 } });
    };
    document.addEventListener("click", clickHandler);
    return () => document.removeEventListener("click", clickHandler);
  }, [contextMenu.visible]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Enter to send message
      if (e.ctrlKey && e.key === "Enter") {
        sendMessage();
      }
      // / to focus input
      if (e.key === "/" && !e.target.matches('input, textarea')) {
        e.preventDefault();
        document.querySelector('input[type="text"]')?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sendMessage]);

  // Export chat history
  const exportChatHistory = () => {
    const chatData = {
      meta: {
        type: selectedUser ? "private" : "public",
        with: selectedUser?.name || "Public Chat",
        exportedAt: new Date().toISOString()
      },
      messages: messages.map(msg => ({
        sender: msg.senderName,
        text: msg.text,
        timestamp: msg.timestamp?.toISOString(),
        image: msg.image ? true : false
      }))
    };

    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${selectedUser?.name || "public"}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Format timestamp
  const formatTime = (date) => {
    if (!date) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  };

  // User Avatar component
  const UserAvatar = ({ user, size = 10, showStatus = false }) => {
    const bgColor = user.color || `hsl(${parseInt(user.id.slice(0, 8), 16) % 360}, 70%, 60%)`;
    
    return (
      <div className="relative">
        {user.photoURL ? (
          <img 
            src={user.photoURL} 
            alt={user.name} 
            className={`w-${size} h-${size} rounded-full object-cover border-2 ${darkMode ? "border-gray-700" : "border-gray-200"}`}
          />
        ) : (
          <div 
            className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-bold`}
            style={{ backgroundColor: bgColor }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        {showStatus && onlineStatus[user.id] && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
        )}
      </div>
    );
  };

  // Markdown formatting
  const formatText = (text) => {
    if (!text) return "";
    
    // Simple markdown parsing
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="inline-code">$1</code>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>');
  };

  return (
    <div className={`flex h-screen ${currentTheme.bg} ${currentTheme.text}`}>
      {/* Sidebar */}
      <div className={`w-80 border-r flex flex-col ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="text-xl font-bold">Chat App</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-full ${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"}`}
              title={darkMode ? "Light mode" : "Dark mode"}
            >
              {darkMode ? <FaSun className="text-yellow-300" /> : <FaMoon />}
            </button>
            <button
              onClick={() => setShowThemePicker(!showThemePicker)}
              className={`p-2 rounded-full ${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"}`}
              title="Change theme"
            >
              <FaPalette />
            </button>
          </div>
        </div>
        
        {showThemePicker && (
          <div className={`p-2 border-b ${darkMode ? "bg-gray-700" : "bg-gray-100"}`}>
            <p className="text-sm mb-2">Select Theme:</p>
            <div className="flex gap-2">
              {Object.keys(themes).map((themeKey) => (
                <button
                  key={themeKey}
                  onClick={() => setTheme(themeKey)}
                  className={`w-8 h-8 rounded-full ${themes[themeKey][darkMode ? "dark" : "light"].message} border-2 ${theme === themeKey ? (darkMode ? "border-white" : "border-black") : "border-transparent"}`}
                  title={themeKey.charAt(0).toUpperCase() + themeKey.slice(1)}
                />
              ))}
            </div>
          </div>
        )}
        
        <div className="p-3 border-b">
          <div className={`flex items-center px-3 py-2 rounded-lg ${darkMode ? "bg-gray-700" : "bg-gray-100"}`}>
            <FaSearch className="mr-2 text-gray-500" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full bg-transparent focus:outline-none ${darkMode ? "placeholder-gray-400" : "placeholder-gray-500"}`}
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <button
            onClick={() => {
              setSelectedUser(null);
            }}
            className={`w-full p-4 text-left flex items-center ${
              !selectedUser ? (darkMode ? "bg-gray-700" : "bg-blue-50 text-blue-600") : 
              darkMode ? "hover:bg-gray-700" : "hover:bg-gray-50"
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${darkMode ? "bg-gray-600" : "bg-blue-100"}`}>
              <span className="text-lg">🌐</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Public Chat</h3>
              </div>
              <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                {users.filter(u => onlineStatus[u.id]).length} online
              </p>
            </div>
          </button>
          
          <div className="px-4 py-2">
            <h3 className="font-medium">Direct Messages</h3>
          </div>
          
          {users
            .filter((user) => user.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  setSelectedUser(user);
                }}
                className={`w-full p-4 text-left flex items-center ${
                  selectedUser?.id === user.id ? (darkMode ? "bg-gray-700" : "bg-blue-50 text-blue-600") : 
                  darkMode ? "hover:bg-gray-700" : "hover:bg-gray-50"
                }`}
              >
                <UserAvatar user={user} size={10} showStatus />
                <div className="flex-1 ml-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">{user.name}</h3>
                    {unreadCounts[user.id] > 0 && (
                      <span className="bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCounts[user.id]}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    {onlineStatus[user.id] ? 
                      (userStatuses[user.id] || "Online") : 
                      "Offline"}
                  </p>
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        }`}>
          <div className="flex items-center">
            {selectedUser ? (
              <>
                <UserAvatar user={selectedUser} size={10} showStatus />
                <div className="ml-3">
                  <h2 className="font-semibold">{selectedUser.name}</h2>
                  <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    {onlineStatus[selectedUser.id] ? 
                      (userStatuses[selectedUser.id] || "Online") : 
                      "Offline"}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center mr-3">
                  <span className="text-lg">🌐</span>
                </div>
                <div>
                  <h2 className="font-semibold">Public Chat</h2>
                  <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    {users.filter(u => onlineStatus[u.id]).length} online
                  </p>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={exportChatHistory}
              className={`p-2 rounded-full ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
              title="Export chat history"
            >
              <FaDownload />
            </button>
            <div className={`flex items-center px-3 py-1 rounded-lg ${darkMode ? "bg-gray-700" : "bg-gray-100"}`}>
              <FaSearch className="mr-2 text-gray-500" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`bg-transparent focus:outline-none w-40 ${darkMode ? "placeholder-gray-400" : "placeholder-gray-500"}`}
              />
            </div>
          </div>
        </div>

        {/* Pinned Messages */}
        {pinnedMessages.length > 0 && (
          <div className={`p-2 border-b ${darkMode ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-200"}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium flex items-center">
                <FaThumbtack className="mr-1" /> Pinned Messages
              </h3>
            </div>
            <div className="mt-1 space-y-1">
              {pinnedMessages.map(msg => (
                <div 
                  key={msg.id}
                  className={`text-xs p-2 rounded ${darkMode ? "bg-gray-700" : "bg-gray-200"}`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{msg.senderName}</span>
                    <span>{formatTime(msg.timestamp)}</span>
                  </div>
                  <p className="truncate">{msg.text || "[Image]"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div 
          className="flex-1 p-4 overflow-y-auto"
          ref={messagesContainerRef}
        >
          {messages.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-full ${
              darkMode ? "text-gray-400" : "text-gray-500"
            }`}>
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <FaUserCircle className="text-3xl" />
              </div>
              <h3 className="text-lg font-medium mb-1">No messages yet</h3>
              <p>Start the conversation by sending a message</p>
            </div>
          ) : (
            <>
              {messages
                .filter((msg) => 
                  msg.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  msg.senderName?.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((msg, index) => {
                  // Show date separator if needed
                  const showDateSeparator = index === 0 || 
                    (messages[index - 1].timestamp?.getDate() !== msg.timestamp?.getDate());
                  
                  return (
                    <React.Fragment key={msg.id}>
                      {showDateSeparator && (
                        <div className="text-center my-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${darkMode ? "bg-gray-700" : "bg-gray-200"}`}>
                            {formatDate(msg.timestamp)}
                          </span>
                        </div>
                      )}
                      
                      <div
                        className={`p-3 my-2 rounded-lg max-w-xs lg:max-w-md relative ${
                          msg.sender === auth.currentUser?.uid
                            ? "bg-blue-500 text-white ml-auto"
                            : darkMode
                            ? "bg-gray-700 text-white mr-auto"
                            : currentTheme.message + " mr-auto"
                        }`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            visible: true,
                            messageId: msg.id,
                            position: { x: e.clientX, y: e.clientY },
                          });
                        }}
                      >
                        {/* Reply preview */}
                        {msg.replyTo && (
                          <div className={`mb-2 p-2 rounded text-xs ${darkMode ? "bg-gray-600" : "bg-gray-300"}`}>
                            <p className="font-medium">{msg.replySender || "User"}</p>
                            <p className="truncate">{msg.replyText || "Message"}</p>
                          </div>
                        )}
                        
                        <div className="flex items-center mb-1">
                          {msg.sender !== auth.currentUser?.uid && (
                            <div 
                              className="w-6 h-6 rounded-full mr-2 flex items-center justify-center text-white font-bold text-xs"
                              style={{ backgroundColor: msg.senderColor }}
                            >
                              {msg.senderName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <p className="font-bold text-sm">
                            {msg.sender === auth.currentUser?.uid ? "You" : msg.senderName}
                          </p>
                        </div>
                        
                        {/* Display image if available */}
                        {msg.image && (
                          <div className="mb-2">
                            <img 
                              src={msg.image} 
                              alt="Sent content" 
                              className="max-w-full max-h-60 rounded-lg"
                            />
                          </div>
                        )}
                        
                        <div className="flex justify-between items-end">
                          <p 
                            className="break-words"
                            dangerouslySetInnerHTML={{ __html: formatText(msg.text) || "Message not available" }}
                          />
                          <div className="flex items-center ml-2">
                            {msg.timestamp && (
                              <p className={`text-xs ${msg.sender === auth.currentUser?.uid ? "text-blue-100" : "text-gray-500"}`}>
                                {formatTime(msg.timestamp)}
                              </p>
                            )}
                            {msg.sender === auth.currentUser?.uid && (
                              <span className="ml-1">
                                {msg.isRead ? (
                                  <FaCheckDouble className={darkMode ? "text-blue-300" : "text-blue-700"} />
                                ) : (
                                  <FaCheck className={darkMode ? "text-blue-300" : "text-blue-700"} />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        {msg.isEdited && (
                          <p className={`text-xs italic ${msg.sender === auth.currentUser?.uid ? "text-blue-100" : "text-gray-500"}`}>
                            edited
                          </p>
                        )}
                        <div className="flex flex-wrap mt-1 gap-1">
                          {Object.entries(msg.reactions || {}).map(([emoji, users]) => (
                            users.length > 0 && (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(msg.id, emoji)}
                                className={`text-xs px-1 rounded ${
                                  users.includes(auth.currentUser?.uid) ? 
                                    (darkMode ? "bg-blue-600" : "bg-blue-100") : 
                                    (darkMode ? "bg-gray-600" : "bg-gray-100")
                                }`}
                                title={users.map(uid => {
                                  const user = users.find(u => u.id === uid);
                                  return user?.name || "Unknown";
                                }).join(", ")}
                              >
                                {emoji} {users.length}
                              </button>
                            )
                          ))}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              {typingUser && (
                <div className={`p-3 my-2 rounded-lg max-w-xs mr-auto ${
                  darkMode ? "bg-gray-700" : currentTheme.message
                }`}>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                  </div>
                  <p className="text-xs mt-1">{typingUser} is typing...</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Replying to indicator */}
        {replyingTo && (
          <div className={`p-2 border-t flex items-center justify-between ${
            darkMode ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-200"
          }`}>
            <div className="text-sm">
              <span className="font-medium">Replying to {replyingTo.senderName || "user"}:</span> {replyingTo.text.substring(0, 30)}{replyingTo.text.length > 30 ? "..." : ""}
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <FaTimes />
            </button>
          </div>
        )}

        {/* Message Input */}
        <div className={`p-4 border-t ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
          {/* Image preview */}
          {mediaPreview && (
            <div className="relative mb-2">
              <img 
                src={mediaPreview} 
                alt="Preview" 
                className="max-h-40 rounded-lg"
              />
              <button
                onClick={() => setMediaPreview(null)}
                className="absolute top-1 right-1 bg-gray-800 bg-opacity-70 text-white rounded-full p-1"
              >
                <FaTimes />
              </button>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2 rounded-full ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
              title="Emoji"
            >
              <FaSmile className="text-xl" />
            </button>
            
            {/* File upload button */}
            <button
              onClick={() => fileInputRef.current.click()}
              className={`p-2 rounded-full ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
              title="Attach file"
            >
              <FaPaperclip className="text-xl" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
            
            {showEmojiPicker && (
              <div className="absolute bottom-16 right-4 z-10">
                <EmojiPicker
                  onEmojiClick={(e) => setNewMessage((prev) => prev + e.emoji)}
                  width={300}
                  height={400}
                  theme={darkMode ? "dark" : "light"}
                />
              </div>
            )}
            
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                // Save draft to localStorage
                localStorage.setItem(`draft_${selectedUser?.id || 'public'}`, e.target.value);
              }}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message..."
              className={`flex-1 p-3 rounded-full focus:outline-none ${
                darkMode ? "bg-gray-700 placeholder-gray-400" : "bg-gray-100 placeholder-gray-500"
              }`}
            />
            
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() && !mediaPreview}
              className={`p-2 rounded-full ${(newMessage.trim() || mediaPreview) ? "bg-blue-500 text-white hover:bg-blue-600" : 
                darkMode ? "bg-gray-700 text-gray-500" : "bg-gray-200 text-gray-400"}`}
              title="Send message (Ctrl+Enter)"
            >
              <IoMdSend className="text-xl" />
            </button>
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu.visible && (
          <div
            className={`absolute shadow-lg rounded-lg overflow-hidden z-20 ${darkMode ? "bg-gray-700" : "bg-white"}`}
            style={{
              top: contextMenu.position.y,
              left: contextMenu.position.x,
            }}
          >
            <div className="p-2 border-b dark:border-gray-600">
              <p className="text-xs font-medium dark:text-gray-300">Add Reaction</p>
              <div className="flex gap-1 mt-1">
                {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      handleReaction(contextMenu.messageId, emoji);
                      setContextMenu({ visible: false, messageId: null, position: { x: 0, y: 0 } });
                    }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                const message = messages.find(msg => msg.id === contextMenu.messageId);
                if (message) setReplyingTo(message);
                setContextMenu({ visible: false, messageId: null, position: { x: 0, y: 0 } });
              }}
              className={`block w-full text-left p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${
                darkMode ? "text-gray-200" : "text-gray-800"
              }`}
            >
              <FaReply className="inline mr-2" />
              Reply
            </button>
            {messages.find((msg) => msg.id === contextMenu.messageId)?.sender === auth.currentUser?.uid && (
              <>
                <button
                  onClick={() => {
                    const message = messages.find(msg => msg.id === contextMenu.messageId);
                    const newText = prompt("Edit message:", message.text);
                    if (newText) editMessage(contextMenu.messageId, newText);
                    setContextMenu({ visible: false, messageId: null, position: { x: 0, y: 0 } });
                  }}
                  className={`block w-full text-left p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${
                    darkMode ? "text-gray-200" : "text-gray-800"
                  }`}
                >
                  <FaEdit className="inline mr-2" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    deleteMessage(contextMenu.messageId);
                    setContextMenu({ visible: false, messageId: null, position: { x: 0, y: 0 } });
                  }}
                  className={`block w-full text-left p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${
                    darkMode ? "text-red-400" : "text-red-500"
                  }`}
                >
                  <FaTrash className="inline mr-2" />
                  Delete
                </button>
              </>
            )}
            <button
              onClick={() => {
                togglePinMessage(contextMenu.messageId);
                setContextMenu({ visible: false, messageId: null, position: { x: 0, y: 0 } });
              }}
              className={`block w-full text-left p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${
                darkMode ? "text-gray-200" : "text-gray-800"
              }`}
            >
              <FaThumbtack className="inline mr-2" />
              {messages.find(msg => msg.id === contextMenu.messageId)?.isPinned ? "Unpin" : "Pin"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
