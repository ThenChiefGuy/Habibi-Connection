/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  getDoc,
  doc as firestoreDoc,
  getDocs,
  where,
  updateDoc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import EmojiPicker from "emoji-picker-react";

function Chat() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [quotedMessage, setQuotedMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    messageId: null,
    position: { x: 0, y: 0 },
  });
  const [newMessageNotification, setNewMessageNotification] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const messagesEndRef = useRef(null);

  // Lade alle Benutzer
  useEffect(() => {
    const loadUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, "users"));
      setUsers(usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    loadUsers();
  }, []);

  // Erstelle eine eindeutige Chat-ID für private Chats
  const getChatId = (userId1, userId2) => [userId1, userId2].sort().join("_");

  // Lade Nachrichten (öffentlich oder privat)
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
            senderName: userDoc.exists() ? userDoc.data().name : "Unbekannt",
            timestamp: message.timestamp?.toDate().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            reactions: message.reactions || {}, // Standardmäßig leeres Objekt für Reaktionen
          };
        })
      );
      setMessages(messagesWithNames);

      // Benachrichtigung für neue Nachrichten im privaten Chat
      if (selectedUser && messagesWithNames.length > messages.length) {
        const lastMessage = messagesWithNames[messagesWithNames.length - 1];
        if (lastMessage.sender !== auth.currentUser.uid) {
          setNewMessageNotification(`Neue Nachricht von ${selectedUser.name}`);
          setTimeout(() => setNewMessageNotification(null), 3000);
        }
      }
    });

    return () => unsubscribe();
  }, [selectedUser, messages.length]);

  // Reaktion hinzufügen/entfernen
  const handleReaction = async (messageId, emoji) => {
    try {
      const message = messages.find((msg) => msg.id === messageId);
      if (!message) return;

      const collectionName = selectedUser ? "privateMessages" : "messages";
      const messageRef = firestoreDoc(db, collectionName, messageId);

      const reactions = { ...message.reactions };
      const userReactions = reactions[emoji] || [];

      if (userReactions.includes(auth.currentUser.uid)) {
        // Reaktion entfernen
        reactions[emoji] = userReactions.filter((uid) => uid !== auth.currentUser.uid);
        // Wenn keine Benutzer mehr übrig sind, entferne die Reaktion vollständig
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      } else {
        // Reaktion hinzufügen
        reactions[emoji] = [...userReactions, auth.currentUser.uid];
      }

      await updateDoc(messageRef, { reactions });
    } catch (error) {
      console.error("Fehler beim Hinzufügen/Entfernen der Reaktion:", error);
    }
  };

  // Typing indicator logic
  useEffect(() => {
    if (!selectedUser) return;

    const typingStatusRef = firestoreDoc(db, "typingStatus", auth.currentUser.uid);

    // Update typing status when the user starts or stops typing
    const handleTyping = async (isTyping) => {
      await setDoc(typingStatusRef, {
        isTyping,
        timestamp: serverTimestamp(),
      });
    };

    // Set a timeout to reset typing status after 2 seconds of inactivity
    let typingTimeout;
    const onInputChange = () => {
      if (!isTyping) {
        setIsTyping(true);
        handleTyping(true);
      }
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        setIsTyping(false);
        handleTyping(false);
      }, 2000);
    };

    // Listen for input changes
    const input = document.querySelector('input[type="text"]');
    input.addEventListener("input", onInputChange);

    return () => {
      input.removeEventListener("input", onInputChange);
      clearTimeout(typingTimeout);
    };
  }, [selectedUser, isTyping]);

  // Listen for typing status of the other user
  useEffect(() => {
    if (!selectedUser) return;

    const typingStatusRef = firestoreDoc(db, "typingStatus", selectedUser.id);
    const unsubscribe = onSnapshot(typingStatusRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.isTyping) {
          setTypingUser(selectedUser.name);
        } else {
          setTypingUser(null);
        }
      }
    });

    return () => unsubscribe();
  }, [selectedUser]);

  // Nachricht senden (öffentlich oder privat)
  const sendMessage = async () => {
    if (!newMessage.trim() || !auth.currentUser) return;
    try {
      const messageData = {
        text: newMessage,
        sender: auth.currentUser.uid,
        timestamp: serverTimestamp(),
        quotedMessageId: quotedMessage?.id || null,
        reactions: {}, // Standardmäßig leeres Objekt für Reaktionen
      };
      if (selectedUser) {
        const chatId = getChatId(auth.currentUser.uid, selectedUser.id);
        await addDoc(collection(db, "privateMessages"), {
          ...messageData,
          participants: [auth.currentUser.uid, selectedUser.id],
          chatId: chatId,
        });
      } else {
        await addDoc(collection(db, "messages"), messageData);
      }
      setNewMessage("");
      setQuotedMessage(null);
    } catch (error) {
      console.error("Fehler beim Senden der Nachricht:", error);
    }
  };

  // Nachricht löschen
  const deleteMessage = async (messageId) => {
    try {
      const message = messages.find((msg) => msg.id === messageId);
      if (!message || message.sender !== auth.currentUser.uid) return;

      const collectionName = selectedUser ? "privateMessages" : "messages";
      await deleteDoc(firestoreDoc(db, collectionName, messageId));

      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== messageId)
      );
    } catch (error) {
      console.error("Fehler beim Löschen der Nachricht:", error);
    }
  };

  // Scrolle zum Ende der Nachrichten
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Schließe das Kontextmenü, wenn außerhalb geklickt wird
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, messageId: null, position: { x: 0, y: 0 } });
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [contextMenu.visible]);

  return (
    <div className={`flex h-screen ${darkMode ? "bg-gray-900 text-white" : "bg-gray-100"}`}>
      {/* Sidebar */}
      <div className={`w-64 border-r ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white"}`}>
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Benutzer suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full p-2 rounded-lg ${darkMode ? "bg-gray-700 text-white" : "bg-gray-50"}`}
          />
        </div>
        <div className="p-2">
          <button
            onClick={() => setSelectedUser(null)}
            className={`w-full p-3 text-left rounded-lg ${
              !selectedUser ? "bg-blue-100 text-blue-600" : 
              darkMode ? "hover:bg-gray-700" : "hover:bg-gray-50"
            }`}
          >
            Öffentlicher Chat
          </button>
          {users
            .filter((user) => user.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`w-full p-3 text-left rounded-lg ${
                  selectedUser?.id === user.id ? "bg-blue-100 text-blue-600" : 
                  darkMode ? "hover:bg-gray-700 text-white" : "hover:bg-gray-50"
                }`}
              >
                {user.name}
              </button>
            ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${
          darkMode ? "bg-gray-800 border-gray-700" : "bg-white"
        }`}>
          <h2>{selectedUser ? `Chat mit ${selectedUser.name}` : "Öffentlicher Chat"}</h2>
          <input
            type="text"
            placeholder="Nachrichten suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`p-1 border rounded-lg text-sm ${darkMode ? "bg-gray-700 text-white" : "bg-gray-50"}`}
          />
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto">
          {messages
            .filter((msg) => msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((msg) => (
              <div
                key={msg.id}
                className={`p-2 my-2 rounded max-w-xs ${
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
                <p className="font-bold">{msg.senderName}</p>
                <div className="flex justify-between items-end">
                  <p>{msg.text || "Nachricht nicht verfügbar"}</p>
                  {msg.timestamp && <p className="text-xs text-gray-500 ml-2">{msg.timestamp}</p>}
                </div>
                {/* Reaktionen anzeigen (aktualisiert) */}
                <div className="flex flex-wrap mt-1">
                  {Object.entries(msg.reactions || {}).map(([emoji, users]) => (
                    users.length > 0 && ( // Nur anzeigen, wenn Benutzer vorhanden sind
                      <div key={emoji} className="flex items-center mr-2">
                        <span className="text-sm">{emoji}</span>
                        <span className="text-xs text-gray-500 ml-1">{users.length}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            ))}
          {typingUser && (
            <div className="p-2 my-2 rounded max-w-xs bg-gray-200 mr-auto">
              <p className="text-sm text-gray-500">{typingUser} is typing...</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className={`p-4 border-t flex gap-2 ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white"}`}>
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 bg-gray-200 rounded-lg"
          >
            😊
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-16">
              <EmojiPicker
                onEmojiClick={(e) => setNewMessage((prev) => prev + e.emoji)}
                width={300}
                height={400}
              />
            </div>
          )}
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Schreibe eine Nachricht..."
            className={`flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              darkMode ? "bg-gray-700 text-white" : "bg-gray-50"
            }`}
          />
          <button
            onClick={sendMessage}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Senden
          </button>
        </div>

        {/* Notifications */}
        {newMessageNotification && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
            {newMessageNotification}
          </div>
        )}

        {/* Context Menu */}
        {contextMenu.visible && (
          <div
            className="absolute bg-white dark:bg-gray-800 shadow-lg rounded-lg p-2"
            style={{
              top: contextMenu.position.y,
              left: contextMenu.position.x,
            }}
          >
            <div className="flex gap-2">
              {["👍", "❤️", "😂"].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    handleReaction(contextMenu.messageId, emoji);
                    setContextMenu({ visible: false, messageId: null, position: { x: 0, y: 0 } });
                  }}
                  className="p-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const newText = prompt("Neuer Text:", messages.find((msg) => msg.id === contextMenu.messageId).text);
                if (newText) {
                  editMessage(contextMenu.messageId, newText);
                }
              }}
              className="block w-full text-left p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg"
            >
              Bearbeiten
            </button>
            <button
              onClick={() => deleteMessage(contextMenu.messageId)}
              className="block w-full text-left p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg text-red-500"
            >
              Löschen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
