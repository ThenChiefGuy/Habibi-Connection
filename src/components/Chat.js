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
  const [messages, setMessages] = useState([]); // Nachrichten im Chat
  const [newMessage, setNewMessage] = useState(""); // Neue Nachricht, die der Benutzer eingibt
  const [selectedUser, setSelectedUser] = useState(null); // Ausgewählter Benutzer für den privaten Chat
  const [users, setUsers] = useState([]); // Liste aller Benutzer
  const [searchTerm, setSearchTerm] = useState(""); // Suchbegriff für die Benutzersuche
  const [isTyping, setIsTyping] = useState(false); // Typing-Status des aktuellen Benutzers
  const [typingUser, setTypingUser] = useState(null); // Benutzer, der gerade tippt
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); // Emoji-Picker
  const [quotedMessage, setQuotedMessage] = useState(null); // Zitierte Nachricht
  const [searchQuery, setSearchQuery] = useState(""); // Suchbegriff für Nachrichten
  const [contextMenu, setContextMenu] = useState({ visible: false, messageId: null, position: { x: 0, y: 0 } }); // Kontextmenü
  const [newMessageNotification, setNewMessageNotification] = useState(null); // Benachrichtigung für neue Nachrichten
  const messagesEndRef = useRef(null); // Referenz für das Scrollen zum Ende der Nachrichten

  // Lade alle Benutzer
  useEffect(() => {
    const loadUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, "users"));
      setUsers(usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    loadUsers();
  }, []);

  // Filtere Benutzer basierend auf dem Suchbegriff
  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Erstelle eine eindeutige Chat-ID für private Chats
  const getChatId = (userId1, userId2) => {
    return [userId1, userId2].sort().join("_");
  };

  // Lade Nachrichten (öffentlich oder privat)
  useEffect(() => {
    let q;
    if (selectedUser) {
      // Erstelle eine eindeutige Chat-ID für den privaten Chat
      const chatId = getChatId(auth.currentUser.uid, selectedUser.id);

      // Lade private Nachrichten für diesen Chat
      q = query(
        collection(db, "privateMessages"),
        where("chatId", "==", chatId),
        orderBy("timestamp")
      );
    } else {
      // Lade öffentliche Nachrichten
      q = query(collection(db, "messages"), orderBy("timestamp"));
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const messagesWithNames = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const message = doc.data();
          const userRef = firestoreDoc(db, "users", message.sender);
          const userDoc = await getDoc(userRef);
          return {
            id: doc.id,
            ...message,
            senderName: userDoc.exists() ? userDoc.data().name : "Unbekannt",
            timestamp: message.timestamp?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), // Kurzes Zeitformat (Stunde/Minute)
          };
        })
      );
      setMessages(messagesWithNames);

      // Benachrichtigung für neue Nachrichten im privaten Chat (nur für den Empfänger)
      if (selectedUser && messagesWithNames.length > messages.length) {
        const lastMessage = messagesWithNames[messagesWithNames.length - 1];
        if (lastMessage.sender !== auth.currentUser.uid) {
          setNewMessageNotification(`Neue Nachricht von ${selectedUser.name}`);
          setTimeout(() => setNewMessageNotification(null), 3000); // Benachrichtigung nach 3 Sekunden ausblenden
        }
      }
    });

    return () => unsubscribe();
  }, [selectedUser]); // Abhängigkeit von selectedUser

  // Nachricht senden (öffentlich oder privat)
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
        // Erstelle eine eindeutige Chat-ID für den privaten Chat
        const chatId = getChatId(auth.currentUser.uid, selectedUser.id);

        // Sende private Nachricht
        await addDoc(collection(db, "privateMessages"), {
          ...messageData,
          participants: [auth.currentUser.uid, selectedUser.id],
          chatId: chatId, // Füge die Chat-ID hinzu
        });
      } else {
        // Sende öffentliche Nachricht
        await addDoc(collection(db, "messages"), messageData);
      }

      setNewMessage("");
      setQuotedMessage(null);
    } catch (error) {
      console.error("Fehler beim Senden der Nachricht:", error);
    }
  };

  // Scrollen zum Ende der Nachrichten
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Typing-Indicator
  const handleTyping = async (isTyping) => {
    if (selectedUser) {
      await setDoc(firestoreDoc(db, "typingStatus", auth.currentUser.uid), {
        isTyping,
        timestamp: serverTimestamp(),
      });
    }
  };

  // Nachricht löschen
  const deleteMessage = async (messageId) => {
    try {
      const message = messages.find((msg) => msg.id === messageId);
      if (!message) return;

      // Überprüfe, ob der aktuelle Benutzer der Absender der Nachricht ist
      if (message.sender !== auth.currentUser.uid) {
        alert("Du kannst nur deine eigenen Nachrichten löschen.");
        return;
      }

      // Überprüfe, ob die Nachricht in der `messages`- oder `privateMessages`-Sammlung ist
      const collectionName = selectedUser ? "privateMessages" : "messages";
      await deleteDoc(firestoreDoc(db, collectionName, messageId));

      // Aktualisiere die Nachrichtenliste
      setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== messageId));
      setContextMenu({ visible: false, messageId: null, position: { x: 0, y: 0 } });
    } catch (error) {
      console.error("Fehler beim Löschen der Nachricht:", error);
    }
  };

  // Nachricht bearbeiten
  const editMessage = async (messageId, newText) => {
    try {
      const message = messages.find((msg) => msg.id === messageId);
      if (!message) return;

      // Überprüfe, ob der aktuelle Benutzer der Absender der Nachricht ist
      if (message.sender !== auth.currentUser.uid) {
        alert("Du kannst nur deine eigenen Nachrichten bearbeiten.");
        return;
      }

      // Überprüfe, ob die Nachricht in der `messages`- oder `privateMessages`-Sammlung ist
      const collectionName = selectedUser ? "privateMessages" : "messages";
      await updateDoc(firestoreDoc(db, collectionName, messageId), {
        text: newText,
      });

      // Aktualisiere die Nachrichtenliste
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

  // Nachrichten durchsuchen
  const filteredMessages = messages.filter((msg) =>
    msg.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Kontextmenü anzeigen
  const handleContextMenu = (e, messageId) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      messageId,
      position: { x: e.clientX, y: e.clientY },
    });
  };

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
    <div className="flex h-screen bg-gray-100">
      {/* Benutzerliste auf der linken Seite */}
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
        {filteredUsers.map((user) => (
          <button
            key={user.id}
            onClick={() => setSelectedUser(user)}
            className="w-full p-2 text-left hover:bg-gray-100"
          >
            {user.name}
          </button>
        ))}
      </div>

      {/* Chatbereich auf der rechten Seite */}
      <div className="flex-1 flex flex-col">
        {/* Header mit ausgewähltem Benutzer */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2>{selectedUser ? `Chat mit ${selectedUser.name}` : "Öffentlicher Chat"}</h2>
          {/* Nachrichten-Suche */}
          <input
            type="text"
            placeholder="Nachrichten suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="p-1 border rounded-lg text-sm"
          />
        </div>

        {/* Benachrichtigung für neue Nachrichten (wie bei WhatsApp) */}
        {newMessageNotification && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
            {newMessageNotification}
          </div>
        )}

        {/* Nachrichtenbereich */}
        <div className="flex-1 p-4 overflow-y-auto">
          {filteredMessages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 my-2 rounded max-w-xs ${
                msg.sender === auth.currentUser?.uid
                  ? "bg-blue-500 text-white ml-auto"
                  : "bg-gray-200 mr-auto"
              }`}
              onClick={(e) => handleContextMenu(e, msg.id)}
            >
              <p className="font-bold">{msg.senderName}</p>
              <div className="flex justify-between items-end">
                <p>{msg.text}</p>
                {msg.timestamp && <p className="text-xs text-gray-500 ml-2">{msg.timestamp}</p>}
              </div>
              {msg.quotedMessageId && (
                <div className="bg-gray-100 p-2 rounded mt-2">
                  <p className="text-sm text-gray-700">
                    Zitiert: {messages.find((m) => m.id === msg.quotedMessageId)?.text}
                  </p>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Kontextmenü */}
        {contextMenu.visible && (
          <div
            className="absolute bg-white border rounded-lg shadow-lg p-2"
            style={{
              top: contextMenu.position.y,
              left: contextMenu.position.x,
            }}
          >
            <button
              onClick={() => editMessage(contextMenu.messageId, prompt("Neuer Text:"))}
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

        {/* Eingabefeld für Nachrichten */}
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