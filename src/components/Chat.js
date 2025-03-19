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
} from "firebase/firestore";

function Chat() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessageNotification, setNewMessageNotification] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const loadUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, "users"));
      setUsers(usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    loadUsers();
  }, []);

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getChatId = (userId1, userId2) => [userId1, userId2].sort().join("_");

  useEffect(() => {
    if (!selectedUser) return;

    const chatId = getChatId(auth.currentUser.uid, selectedUser.id);
    const q = query(
      collection(db, "privateMessages"),
      where("chatId", "==", chatId),
      orderBy("timestamp")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const messagesWithNames = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const message = doc.data();
          const userRef = firestoreDoc(db, "users", message.sender);
          const userDoc = await getDoc(userRef);
          return {
            id: doc.id,
            ...message,
            senderName: userDoc.exists() ? userDoc.data().name : "Unknown",
            timestamp: message.timestamp?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
        })
      );
      setMessages(messagesWithNames);
    });

    return () => unsubscribe();
  }, [selectedUser]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const messageData = {
        text: newMessage,
        sender: auth.currentUser.uid,
        timestamp: serverTimestamp(),
      };
      if (selectedUser) {
        const chatId = getChatId(auth.currentUser.uid, selectedUser.id);
        await addDoc(collection(db, "privateMessages"), {
          ...messageData,
          chatId,
        });
      } else {
        await addDoc(collection(db, "messages"), messageData);
      }

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-1/4 bg-white border-r p-4">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border-b"
        />
        <button onClick={() => setSelectedUser(null)} className="w-full p-2 text-left hover:bg-gray-100">
          Public Chat
        </button>
        {filteredUsers.map((user) => (
          <button key={user.id} onClick={() => setSelectedUser(user)} className="w-full p-2 text-left hover:bg-gray-100">
            {user.name}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2>{selectedUser ? `Chat with ${selectedUser.name}` : "Public Chat"}</h2>
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="p-1 border rounded-lg text-sm"
          />
        </div>

        {newMessageNotification && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
            {newMessageNotification}
          </div>
        )}

        <div className="flex-1 p-4 overflow-y-auto">
          {messages
            .filter((msg) => msg.text.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((msg) => (
              <div key={msg.id} className={`p-2 my-2 rounded max-w-xs ${msg.sender === auth.currentUser?.uid ? "bg-blue-500 text-white ml-auto" : "bg-gray-200 mr-auto"}`}>
                <p className="font-bold">{msg.senderName}</p>
                <p>{msg.text}</p>
                <p className="text-xs text-gray-500 ml-2">{msg.timestamp}</p>
              </div>
            ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 p-2 border rounded-lg"
            placeholder="Type a message..."
          />
          <button onClick={sendMessage} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;

