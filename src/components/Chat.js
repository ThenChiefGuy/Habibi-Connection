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
  const messagesEndRef = useRef(null);

  // Load all users
  useEffect(() => {
    const loadUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, "users"));
      setUsers(usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    loadUsers();
  }, []);

  // Get unique chat ID for private chats
  const getChatId = (userId1, userId2) => {
    return [userId1, userId2].sort().join("_");
  };

  // Load messages (public or private)
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
          console.log("Message data:", message); // Log message data for debugging
          const userRef = firestoreDoc(db, "users", message.sender);
          const userDoc = await getDoc(userRef);
          return {
            id: doc.id,
            ...message,
            senderName: userDoc.exists() ? userDoc.data().name : "Unbekannt",
            timestamp: message.timestamp?.toDate().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
        })
      );
      setMessages(messagesWithNames);

      // Notification for new messages in private chat
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

  // Send message (public or private)
  const sendMessage = async () => {
    if (!newMessage.trim() || !auth.currentUser) return;
    try {
      const messageData = {
        text: newMessage,
        sender: auth.currentUser.uid,
        timestamp: serverTimestamp(),
        quotedMessageId: quotedMessage?.id || null,
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

  // Scroll to the end of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Typing indicator
  const handleTyping = async (isTyping) => {
    if (selectedUser) {
      await setDoc(firestoreDoc(db, "typingStatus", auth.currentUser.uid), {
        isTyping,
        timestamp: serverTimestamp(),
      });
    }
  };

  // Delete message
  const deleteMessage = async (messageId) => {
    try {
      const message = messages.find((msg) => msg.id === messageId);
      if (!message) return;

      // Check if the current user is the sender of the message
      if (message.sender !== auth.currentUser.uid) {
        alert("Du kannst nur deine eigenen Nachrichten löschen.");
        return;
      }

      // Check if the message is in the `messages` or `privateMessages` collection
      const collectionName = selectedUser ? "privateMessages" : "messages";
      await deleteDoc(firestoreDoc(db, collectionName, messageId));

      // Update the messages list
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== messageId)
      );
      setContextMenu({ visible: false, messageId: null, position: { x: 0, y: 0 } });
    } catch (error) {
      console.error("Fehler beim Löschen der Nachricht:", error);
    }
  };

  // Edit message
  const editMessage = async (messageId, newText) => {
    try {
      const message = messages.find((msg) => msg.id === messageId);
      if (!message) return;

      // Check if the current user is the sender of the message
      if (message.sender !== auth.currentUser.uid) {
        alert("Du kannst nur deine eigenen Nachrichten bearbeiten.");
        return;
      }

      // Check if the message is in the `messages` or `privateMessages` collection
      const collectionName = selectedUser ? "privateMessages" : "messages";
      await updateDoc(firestoreDoc(db, collectionName, messageId), {
        text: newText,
      });

      // Update the messages list
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId ? { ...msg, text: newText } : msg
        )
      );
      setContextMenu({ visible: false, messageId: null, position: { x: 0, y: 0 } });
    } catch (error) {
      console.error("Fehler beim Bearbeiten der Nachricht:", error);
    }
  };

  // Filter messages based on search query
  const filteredMessages = messages.filter((msg) =>
    msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show context menu
  const handleContextMenu = (e, messageId) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      messageId,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  // Close context menu when clicking outside
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
    <div className="flex h-screen bg-gray-100">
      {/* User list on the left */}
      <div className="w-1/4 bg-white border-r p-4">
        <input
          type="text"
          placeholder="Benutzer suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border-b"
        />
        <button
          onClick={() => setSelectedUser(null)}
          className="w-full p-2 text-left hover:bg-gray-100"
        >
          Öffentlicher Chat
        </button>
        {users
          .filter((user) =>
            user.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map((user) => (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className="w-full p-2 text-left hover:bg-gray-100"
            >
              {user.name}
            </button>
          ))}
      </div>

      {/* Chat area on the right */}
      <div className="flex-1 flex flex-col">
        {/* Header with selected user */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2>{selectedUser ? `Chat mit ${selectedUser.name}` : "Öffentlicher Chat"}</h2>
          <input
            type="text"
            placeholder="Nachrichten suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="p-1 border rounded-lg text-sm"
          />
        </div>

        {/* New message notification */}
        {newMessageNotification && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
            {newMessageNotification}
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 p-4 overflow-y-auto">
          {filteredMessages.map((msg) => (
            msg.text && (
              <div
                key={msg.id}
                className={`p-2 my-2 rounded max-w-xs ${
                  msg.sender === auth.currentUser?.uid
                    ? "bg-blue-500 text-white ml-auto"
                    : "bg-gray-200 mr-auto"
                }`}
                onContextMenu={(e) => handleContextMenu(e, msg.id)}
              >
                <p className="font-bold">{msg.senderName}</p>
                <div className="flex justify-between items-end">
                  <p>{msg.text}</p>
                  {msg.timestamp && (
                    <p className="text-xs text-gray-500 ml-2">{msg.timestamp}</p>
                  )}
                </div>
                {msg.quotedMessageId && (
                  <div className="bg-gray-100 p-2 rounded mt-2">
                    <p className="text-sm text-gray-700">
                      Zitiert:{" "}
                      {messages.find((m) => m.id === msg.quotedMessageId)?.text}
                    </p>
                  </div>
                )}
              </div>
            )
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Context menu */}
        {contextMenu.visible && (
          <div
            className="absolute bg-white border rounded-lg shadow-lg p-2"
            style={{
              top: contextMenu.position.y,
              left: contextMenu.position.x,
            }}
          >
            <button
              onClick={() =>
                editMessage(contextMenu.messageId, prompt("Neuer Text:"))
              }
              className="block w-full text-left p-1 hover:bg-gray-100"
            >
              Bearbeiten
            </button>
            <button
              onClick={() => deleteMessage(contextMenu.messageId)}
              className="block w-full text-left p-1 hover:bg-gray-100"
            >
              Löschen
            </button>
          </div>
        )}

        {/* Message input field */}
        <div className="p-4 border-t flex gap-2">
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
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping(true);
            }}
            onBlur={() => handleTyping(false)}
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Schreibe eine Nachricht..."
          />
          <button
            onClick={sendMessage}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Senden
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
