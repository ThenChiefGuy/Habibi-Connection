import React, { useState, useEffect, useRef } from "react";
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
  FaEdit, FaTrash
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
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  // Check authentication
  useEffect(() => {
    if (!auth.currentUser) {
      navigate("/login");
    }
  }, [navigate]);

  // Load all users
  useEffect(() => {
    const loadUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, "users"));
      setUsers(usersSnapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data(),
        color: `hsl(${parseInt(doc.id.slice(0, 8), 16) % 360}, 70%, 60%)`
      })));
    };
    loadUsers();
  }, []);

  // Track online status
  useEffect(() => {
    const onlineStatusRef = collection(db, "onlineStatus");
    const unsubscribe = onSnapshot(onlineStatusRef, (snapshot) => {
      const status = {};
      snapshot.docs.forEach((doc) => {
        status[doc.id] = doc.data().isOnline;
      });
      setOnlineStatus(status);
    });
    return () => unsubscribe();
  }, []);

  // Set user online status
  useEffect(() => {
    if (!auth.currentUser) return;
    const onlineStatusRef = firestoreDoc(db, "onlineStatus", auth.currentUser.uid);
    const setOnline = async () => {
      await setDoc(onlineStatusRef, { isOnline: true });
    };
    setOnline();
    window.addEventListener("beforeunload", async () => {
      await setDoc(onlineStatusRef, { isOnline: false });
    });
    return () => {
      window.removeEventListener("beforeunload", () => {});
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
            timestamp: message.timestamp?.toDate().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
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
  }, [selectedUser, messages.length]);

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
      await setDoc(typingStatusRef, {
        isTyping,
        timestamp: serverTimestamp(),
      });
    };

    const inputHandler = () => {
      handleTyping(true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => handleTyping(false), 2000);
    };

    const input = document.querySelector('input[type="text"]');
    input.addEventListener("input", inputHandler);
    return () => {
      input.removeEventListener("input", inputHandler);
      clearTimeout(typingTimeout);
    };
  }, [selectedUser]);

  // Listen for typing status
  useEffect(() => {
    if (!selectedUser) return;
    const typingStatusRef = firestoreDoc(db, "typingStatus", selectedUser.id);
    const unsubscribe = onSnapshot(typingStatusRef, (doc) => {
      if (doc.exists()) {
        setTypingUser(doc.data().isTyping ? selectedUser.name : null);
      }
    });
    return () => unsubscribe();
  }, [selectedUser]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !auth.currentUser) return;
    try {
      const messageData = {
        text: newMessage,
        sender: auth.currentUser.uid,
        timestamp: serverTimestamp(),
        reactions: {},
        isRead: false,
      };

      if (selectedUser) {
        const chatId = getChatId(auth.currentUser.uid, selectedUser.id);
        await addDoc(collection(db, "privateMessages"), {
          ...messageData,
          participants: [auth.currentUser.uid, selectedUser.id],
          chatId,
        });
      } else {
        await addDoc(collection(db, "messages"), messageData);
      }
      setNewMessage("");
      setShowEmojiPicker(false);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

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

  return (
    <div className={`flex h-screen ${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      {/* Sidebar */}
      <div className={`w-80 border-r flex flex-col ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="text-xl font-bold">Habibi Connections</h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-full ${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"}`}
          >
            {darkMode ? <FaSun className="text-yellow-300" /> : <FaMoon />}
          </button>
        </div>
        
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
            onClick={() => setSelectedUser(null)}
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
          
          {users
            .filter((user) => user.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
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
                    {onlineStatus[user.id] ? "Online" : "Offline"}
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
                    {onlineStatus[selectedUser.id] ? "Online" : "Offline"}
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

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto">
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
                .filter((msg) => msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 my-2 rounded-lg max-w-xs lg:max-w-md relative ${
                      msg.sender === auth.currentUser?.uid
                        ? "bg-blue-500 text-white ml-auto"
                        : darkMode
                        ? "bg-gray-700 text-white mr-auto"
                        : "bg-gray-200 mr-auto"
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
                    <div className="flex justify-between items-end">
                      <p className="break-words">{msg.text || "Message not available"}</p>
                      <div className="flex items-center ml-2">
                        {msg.timestamp && (
                          <p className={`text-xs ${msg.sender === auth.currentUser?.uid ? "text-blue-100" : "text-gray-500"}`}>
                            {msg.timestamp}
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
                          >
                            {emoji} {users.length}
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              {typingUser && (
                <div className={`p-3 my-2 rounded-lg max-w-xs mr-auto ${
                  darkMode ? "bg-gray-700" : "bg-gray-200"
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

        {/* Message Input */}
        <div className={`p-4 border-t ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2 rounded-full ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
            >
              <FaSmile className="text-xl" />
            </button>
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
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message..."
              className={`flex-1 p-3 rounded-full focus:outline-none ${
                darkMode ? "bg-gray-700 placeholder-gray-400" : "bg-gray-100 placeholder-gray-500"
              }`}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className={`p-2 rounded-full ${newMessage.trim() ? "bg-blue-500 text-white hover:bg-blue-600" : 
                darkMode ? "bg-gray-700 text-gray-500" : "bg-gray-200 text-gray-400"}`}
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
            {messages.find((msg) => msg.id === contextMenu.messageId)?.sender === auth.currentUser?.uid && (
              <>
                <button
                  onClick={() => {
                    const newText = prompt("Edit message:", messages.find((msg) => msg.id === contextMenu.messageId).text);
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
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
