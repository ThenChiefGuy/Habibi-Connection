import React, { useState, useEffect, useRef, useCallback } from "react";
import { db, auth, storage } from "../firebase/firebase";
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
  FaDownload, FaPoll, FaBell, FaUser,
  FaCog, FaSignOutAlt
} from "react-icons/fa";
import { IoMdSend } from "react-icons/io";
import { motion } from "framer-motion";

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
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionPosition, setMentionPosition] = useState(0);
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveyQuestion, setSurveyQuestion] = useState("");
  const [surveyOptions, setSurveyOptions] = useState(["", ""]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [linkPreviews, setLinkPreviews] = useState({});
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandPosition, setCommandPosition] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const mentionRef = useRef(null);
  const commandRef = useRef(null);
  const userMenuRef = useRef(null);
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

  // Commands configuration
  const commands = [
    { name: "me", description: "Send an action message (e.g., /me is typing)" },
    { name: "gif", description: "Search for a GIF (e.g., /gif cat)" },
    { name: "status", description: "Set your status (e.g., /status Busy)" },
    { name: "poll", description: "Create a poll (e.g., /poll Question? Option1 Option2)" },
    { name: "clear", description: "Clear the chat history" },
    { name: "help", description: "Show available commands" }
  ];

  // Get current theme colors
  const currentTheme = themes[theme][darkMode ? "dark" : "light"];

  // Load user profile
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!auth.currentUser) return;
      const docRef = firestoreDoc(db, "users", auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      }
    };
    loadUserProfile();
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // User Avatar component
  const UserAvatar = ({ user, size = 10, showStatus = false, onClick }) => {
    const bgColor = user.color || `hsl(${parseInt(user.id.slice(0, 8), 16) % 360}, 70%, 60%)`;
    
    return (
      <div className="relative" onClick={onClick}>
        {user.photoURL ? (
          <img 
            src={user.photoURL} 
            alt={user.name} 
            className={`w-${size} h-${size} rounded-full object-cover border-2 ${darkMode ? "border-gray-700" : "border-gray-200"}`}
          />
        ) : (
          <div 
            className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-bold text-xs`}
            style={{ backgroundColor: bgColor }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        {showStatus && onlineStatus[user.id] && (
          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${
            userStatuses[user.id] === "Busy" ? "bg-red-500" :
            userStatuses[user.id] === "Away" ? "bg-yellow-500" :
            "bg-green-500"
          } ${darkMode ? "border-gray-800" : "border-white"}`}></div>
        )}
      </div>
    );
  };

  // User Menu component
  const UserMenu = () => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        ref={userMenuRef}
        className={`absolute right-4 top-16 w-48 rounded-lg shadow-lg z-50 ${darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}
      >
        <div className="p-4 border-b flex items-center">
          <UserAvatar user={{ 
            id: auth.currentUser?.uid, 
            name: auth.currentUser?.displayName || "User",
            photoURL: userProfile?.photoURL
          }} size={10} />
          <div className="ml-3">
            <p className="font-medium">{auth.currentUser?.displayName || "User"}</p>
            <p className="text-xs text-gray-500">
              {userStatuses[auth.currentUser?.uid] || "Available"}
            </p>
          </div>
        </div>
        <div className="p-1">
          <button
            onClick={() => {
              navigate("/profile");
              setShowUserMenu(false);
            }}
            className={`w-full text-left px-4 py-2 text-sm flex items-center ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
          >
            <FaUser className="mr-2" /> Profile
          </button>
          <button
            onClick={() => {
              setDarkMode(!darkMode);
              setShowUserMenu(false);
            }}
            className={`w-full text-left px-4 py-2 text-sm flex items-center ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
          >
            {darkMode ? <FaSun className="mr-2" /> : <FaMoon className="mr-2" />}
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            onClick={() => {
              setShowThemePicker(!showThemePicker);
              setShowUserMenu(false);
            }}
            className={`w-full text-left px-4 py-2 text-sm flex items-center ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
          >
            <FaPalette className="mr-2" /> Change Theme
          </button>
          <button
            onClick={() => {
              auth.signOut();
              navigate("/login");
            }}
            className={`w-full text-left px-4 py-2 text-sm flex items-center ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
          >
            <FaSignOutAlt className="mr-2" /> Logout
          </button>
        </div>
      </motion.div>
    );
  };

  // Export chat history
  const exportChatHistory = async () => {
    try {
      const chatData = messages.map(msg => ({
        sender: msg.senderName,
        timestamp: msg.timestamp?.toLocaleString(),
        text: msg.text,
        isPinned: msg.isPinned || false
      }));

      const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat_history_${selectedUser ? selectedUser.name : 'public'}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting chat history:", error);
      alert("Failed to export chat history");
    }
  };

  // Handle voting on surveys
  const handleVote = async (surveyId, optionIndex) => {
    try {
      const surveyRef = firestoreDoc(db, "messages", surveyId);
      const surveyDoc = await getDoc(surveyRef);
      
      if (surveyDoc.exists()) {
        const survey = surveyDoc.data();
        const options = [...survey.options];
        
        // Remove existing vote if user already voted
        options.forEach(option => {
          if (option.votes?.includes(auth.currentUser.uid)) {
            option.votes = option.votes.filter(uid => uid !== auth.currentUser.uid);
          }
        });
        
        // Add new vote
        if (!options[optionIndex].votes) {
          options[optionIndex].votes = [];
        }
        options[optionIndex].votes.push(auth.currentUser.uid);
        
        await updateDoc(surveyRef, { options });
      }
    } catch (error) {
      console.error("Error voting on survey:", error);
    }
  };

  // Send survey message
  const sendSurvey = async () => {
    if (!surveyQuestion.trim() || surveyOptions.some(opt => !opt.trim())) {
      alert("Please fill in all survey fields");
      return;
    }

    try {
      const surveyData = {
        type: 'survey',
        sender: auth.currentUser.uid,
        timestamp: serverTimestamp(),
        question: surveyQuestion,
        options: surveyOptions.map(opt => ({
          text: opt,
          votes: []
        }))
      };

      const collectionName = selectedUser ? "privateMessages" : "messages";
      if (selectedUser) {
        const chatId = getChatId(auth.currentUser.uid, selectedUser.id);
        surveyData.participants = [auth.currentUser.uid, selectedUser.id];
        surveyData.chatId = chatId;
      }

      await addDoc(collection(db, collectionName), surveyData);
      setShowSurvey(false);
      setSurveyQuestion("");
      setSurveyOptions(["", ""]);
    } catch (error) {
      console.error("Error sending survey:", error);
      alert("Failed to send survey");
    }
  };

  // Scroll handler
  useEffect(() => {
    const handleScroll = () => {
      const container = messagesContainerRef.current;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const atBottom = scrollHeight - scrollTop <= clientHeight + 50;
        setIsAtBottom(atBottom);
        setShowScrollButton(!atBottom);
      }
    };

    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll();
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

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
      
      if (isAtBottom) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        setShowScrollButton(true);
      }
    });

    return () => unsubscribe();
  }, [selectedUser, messages.length, isAtBottom]);

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
        await updateDoc(doc.ref, { isRead: true, readAt: serverTimestamp() });
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

  // Enhanced formatText function with Markdown support
  const formatText = (text) => {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code class='bg-gray-200 dark:bg-gray-600 px-1 rounded'>$1</code>")
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-blue-500 hover:underline">$1</a>');
  };

  // Update status
  const updateStatus = async (status) => {
    try {
      const statusRef = firestoreDoc(db, "userStatus", auth.currentUser.uid);
      await updateDoc(statusRef, {
        status,
        lastUpdated: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  // Handle link previews
  useEffect(() => {
    const fetchLinkPreviews = async () => {
      const newPreviews = {};
      for (const msg of messages) {
        const urlMatch = msg.text?.match(/https?:\/\/[^\s]+/)?.[0];
        if (urlMatch && !linkPreviews[msg.id]) {
          try {
            // Simple link preview - in a real app you'd use a proper API
            const url = new URL(urlMatch);
            newPreviews[msg.id] = {
              url: urlMatch,
              title: url.hostname,
              description: `Visit ${url.hostname}`,
              domain: url.hostname.replace('www.', '')
            };
          } catch (error) {
            console.error("Error creating link preview:", error);
          }
        }
      }
      if (Object.keys(newPreviews).length > 0) {
        setLinkPreviews(prev => ({ ...prev, ...newPreviews }));
      }
    };

    fetchLinkPreviews();
  }, [messages]);

  // Handle input changes for mentions and commands
  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    
    // Handle mentions
    if (value.lastIndexOf('@') > value.lastIndexOf(' ')) {
      const pos = value.lastIndexOf('@');
      setMentionQuery(value.slice(pos + 1));
      setMentionPosition(pos);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
    
    // Handle commands
    if (value.startsWith('/') && (value.match(/\//g) || []).length === 1) {
      setCommandPosition(1);
      setShowCommandSuggestions(true);
    } else if (value.includes(' ')) {
      setShowCommandSuggestions(false);
    }
    
    localStorage.setItem(`draft_${selectedUser?.id || 'public'}`, value);
  };

  // Send message with useCallback to prevent re-renders
  const sendMessage = useCallback(async () => {
    if ((!newMessage.trim() && !mediaPreview) || !auth.currentUser) return;
    
    // Process commands
    let processedMessage = newMessage;
    if (newMessage.startsWith("/me ")) {
      processedMessage = `<em>${auth.currentUser.displayName} ${newMessage.slice(4)}</em>`;
    } else if (newMessage.startsWith("/gif ")) {
      processedMessage = `<div class="italic">[GIF: ${newMessage.slice(5)}]</div>`;
    } else if (newMessage.startsWith("/status ")) {
      const status = newMessage.slice(7).trim();
      await updateStatus(status);
      setNewMessage("");
      return;
    } else {
      // Process mentions
      const mentionRegex = /@(\w+)/g;
      let match;
      const mentionedUsers = new Set();
      
      while ((match = mentionRegex.exec(newMessage)) !== null) {
        const username = match[1];
        if (username === 'everyone') {
          mentionedUsers.add('everyone');
          processedMessage = processedMessage.replace(
            `@${username}`,
            `<span class="text-blue-500 font-medium">@${username}</span>`
          );
        } else {
          const user = users.find(u => u.name === username);
          if (user) {
            mentionedUsers.add(user.id);
            processedMessage = processedMessage.replace(
              `@${username}`,
              `<span class="text-blue-500 font-medium">@${username}</span>`
            );
          }
        }
      }
    }

    try {
      const messageData = {
        sender: auth.currentUser.uid,
        timestamp: serverTimestamp(),
        isRead: false,
        replyTo: replyingTo?.id || null,
        replyText: replyingTo?.text ? `${replyingTo.text.substring(0, 30)}${replyingTo.text.length > 30 ? "..." : ""}` : null,
        replySender: replyingTo?.senderName || null,
        text: processedMessage
      };

      // Add image if available
      if (mediaPreview) {
        messageData.image = mediaPreview;
        if (!newMessage.trim()) {
          messageData.text = "<span class='text-blue-500'>[Image]</span>";
        }
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

      // Send notifications
      if (newMessage.includes('@everyone') && !selectedUser) {
        users.forEach(user => {
          if (user.id !== auth.currentUser.uid) {
            showNotification(auth.currentUser.displayName, `@everyone: ${newMessage}`);
          }
        });
      }

      setNewMessage("");
      setMediaPreview(null);
      setReplyingTo(null);
      setShowEmojiPicker(false);
      localStorage.removeItem(`draft_${selectedUser?.id || 'public'}`);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }, [newMessage, mediaPreview, replyingTo, selectedUser, users]);

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
      if ((e.ctrlKey && e.key === "Enter") || e.key === "Enter") {
        e.preventDefault();
        sendMessage();
      }
      // Escape to close menus
      if (e.key === "Escape") {
        setShowEmojiPicker(false);
        setShowMentions(false);
        setShowCommandSuggestions(false);
        setShowStatusPicker(false);
      }
      // Arrow keys for suggestions
      if (showMentions || showCommandSuggestions) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          // Implement arrow navigation for suggestions
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sendMessage, showMentions, showCommandSuggestions]);

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

  return (
    <div className={`flex h-screen ${currentTheme.bg} ${currentTheme.text}`}>
      {/* Sidebar */}
      <div className={`w-80 border-r flex flex-col ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
        {/* Sidebar header with user menu */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-bold">Habibi Connections</h1>
            {Object.values(unreadCounts).reduce((a, b) => a + b, 0) > 0 && (
              <div className="ml-2 flex items-center justify-center h-5 w-5 rounded-full bg-green-500 text-white text-xs">
                {Object.values(unreadCounts).reduce((a, b) => a + b, 0)}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <UserAvatar 
                  user={{ 
                    id: auth.currentUser?.uid, 
                    name: auth.currentUser?.displayName || "User",
                    photoURL: userProfile?.photoURL
                  }} 
                  size={8} 
                />
              </button>
              {showUserMenu && <UserMenu />}
            </div>
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
                {!selectedUser && unreadCounts['public'] > 0 && (
                  <div className="flex items-center justify-center h-5 w-5 rounded-full bg-green-500 text-white text-xs">
                    {unreadCounts['public']}
                  </div>
                )}
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
                className={`w-full p-4 text-left flex items-center relative ${
                  selectedUser?.id === user.id ? (darkMode ? "bg-gray-700" : "bg-blue-50 text-blue-600") : 
                  darkMode ? "hover:bg-gray-700" : "hover:bg-gray-50"
                }`}
              >
                <UserAvatar user={user} size={10} showStatus />
                <div className="flex-1 ml-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">{user.name}</h3>
                    {unreadCounts[user.id] > 0 && (
                      <div className="flex items-center justify-center h-5 w-5 rounded-full bg-green-500 text-white text-xs">
                        {unreadCounts[user.id]}
                      </div>
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
                    {typingUser && (
                      <span className="italic ml-2">{typingUser} is typing...</span>
                    )}
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
          ref={messagesContainerRef}
          className="flex-1 p-4 overflow-y-auto"
          style={{ scrollBehavior: 'smooth' }}
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
                      
                      {msg.type === 'survey' ? (
                        <div className={`p-4 rounded-lg ${darkMode ? "bg-gray-600" : "bg-gray-200"}`}>
                          <h4 className="font-bold mb-2">{msg.question}</h4>
                          {msg.options.map((option, index) => (
                            <div 
                              key={index}
                              className="mb-2 p-2 rounded cursor-pointer hover:bg-gray-400/20"
                              onClick={() => handleVote(msg.id, index)}
                            >
                              <div className="flex justify-between">
                                <span>{option.text}</span>
                                <span>{option.votes?.length || 0}</span>
                              </div>
                              <div className="h-1 bg-gray-300 rounded">
                                <div 
                                  className="h-full bg-blue-500 rounded"
                                  style={{ width: `${((option.votes?.length || 0) / Math.max(...msg.options.map(o => o.votes?.length || 0)))*100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          className={`p-3 my-2 rounded-lg max-w-xs lg:max-w-md relative ${
                            msg.sender === auth.currentUser?.uid
                              ? "bg-blue-500 text-white ml-auto"
                              : darkMode
                              ? "bg-gray-700 text-white mr-auto"
                              : currentTheme.message + " mr-auto"
                          }`}
                          onMouseEnter={() => setHoveredMessageId(msg.id)}
                          onMouseLeave={() => setHoveredMessageId(null)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({
                              visible: true,
                              messageId: msg.id,
                              position: { x: e.clientX, y: e.clientY },
                            });
                          }}
                        >
                          {/* Quick reactions on hover */}
                          {hoveredMessageId === msg.id && (
                            <div className={`absolute -top-3 right-2 flex gap-1 p-1 rounded-full shadow ${
                              darkMode ? "bg-gray-700" : "bg-white"
                            }`}>
                              {["👍", "❤️", "😂", "😮"].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReaction(msg.id, emoji);
                                  }}
                                  className="text-sm hover:scale-125 transition-transform"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                          
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
                          
                          {/* Link preview */}
                          {linkPreviews[msg.id] && (
                            <div className={`mt-2 p-2 rounded-lg border ${
                              darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-100 border-gray-200"
                            }`}>
                              <a 
                                href={linkPreviews[msg.id].url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <p className="font-bold text-sm">{linkPreviews[msg.id].title}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {linkPreviews[msg.id].description}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                  {linkPreviews[msg.id].domain}
                                </p>
                              </a>
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
                      )}
                    </React.Fragment>
                  );
                })}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* WhatsApp-style scroll-to-bottom button */}
        {showScrollButton && (
          <button
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              setIsAtBottom(true);
              setShowScrollButton(false);
            }}
            className={`fixed bottom-24 right-6 p-3 rounded-full shadow-lg z-10 ${
              darkMode ? "bg-gray-700 text-white hover:bg-gray-600" 
                      : "bg-white text-gray-800 hover:bg-gray-100"
            } transition-colors duration-200 flex items-center justify-center`}
            title="Scroll to bottom"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 15l7-7 7 7" 
              />
            </svg>
          </button>
        )}

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
            
            <button
              onClick={() => setShowSurvey(true)}
              className={`p-2 rounded-full ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
              title="Create survey"
            >
              <FaPoll className="text-xl" />
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

            {showMentions && (
              <div 
                ref={mentionRef}
                className={`absolute bottom-16 left-4 z-30 w-48 max-h-40 overflow-y-auto rounded-lg shadow-lg ${
                  darkMode ? "bg-gray-700" : "bg-white"
                }`}
              >
                {['everyone', ...users.map(u => u.name)]
                  .filter(name => name.toLowerCase().includes(mentionQuery.toLowerCase()))
                  .map(name => (
                    <div
                      key={name}
                      onClick={() => {
                        const newText = newMessage.slice(0, mentionPosition + 1) + name + ' ' + 
                                      newMessage.slice(mentionPosition + 1 + mentionQuery.length);
                        setNewMessage(newText);
                        setShowMentions(false);
                      }}
                      className={`p-2 cursor-pointer ${darkMode ? "hover:bg-gray-600" : "hover:bg-gray-100"}`}
                    >
                      {name === 'everyone' ? (
                        <>
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center mr-2">
                            <span className="text-white text-sm">@</span>
                          </div>
                          <span>Everyone</span>
                        </>
                      ) : (
                        <div className="flex items-center">
                          <UserAvatar user={users.find(u => u.name === name)} size={6} />
                          <span className="ml-2">{name}</span>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {showCommandSuggestions && (
              <div 
                ref={commandRef}
                className={`absolute bottom-16 left-4 z-30 w-64 max-h-60 overflow-y-auto rounded-lg shadow-lg ${
                  darkMode ? "bg-gray-700" : "bg-white"
                }`}
              >
                {commands.map((cmd) => (
                  <div
                    key={cmd.name}
                    onClick={() => {
                      const newText = '/' + cmd.name + ' ';
                      setNewMessage(newText);
                      setShowCommandSuggestions(false);
                    }}
                    className={`p-2 cursor-pointer ${darkMode ? "hover:bg-gray-600" : "hover:bg-gray-100"}`}
                  >
                    <div className="font-medium">/{cmd.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{cmd.description}</div>
                  </div>
                ))}
              </div>
            )}
            
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
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

        {/* Survey Creation Modal */}
        {showSurvey && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg w-96 ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <h3 className="text-lg font-bold mb-4">Create Survey</h3>
              <input
                type="text"
                placeholder="Survey question"
                value={surveyQuestion}
                onChange={(e) => setSurveyQuestion(e.target.value)}
                className={`w-full p-2 mb-4 rounded ${darkMode ? "bg-gray-700" : "bg-gray-100"}`}
              />
              {surveyOptions.map((opt, index) => (
                <input
                  key={index}
                  type="text"
                  placeholder={`Option ${index + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const newOptions = [...surveyOptions];
                    newOptions[index] = e.target.value;
                    setSurveyOptions(newOptions);
                  }}
                  className={`w-full p-2 mb-2 rounded ${darkMode ? "bg-gray-700" : "bg-gray-100"}`}
                />
              ))}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowSurvey(false)}
                  className="px-4 py-2 rounded-lg bg-gray-500 text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={sendSurvey}
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

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
                {["👍", "❤️", "😂", "😮", "😢", "👎"].map((emoji) => (
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