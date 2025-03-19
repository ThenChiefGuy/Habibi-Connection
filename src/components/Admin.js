import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase/firebase"; // auth wird verwendet
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

function Admin() {
  const [users, setUsers] = useState([]); // Liste aller Benutzer
  const [messages, setMessages] = useState([]); // Liste aller Nachrichten
  const [selectedUser, setSelectedUser] = useState(null); // Ausgewählter Benutzer für privaten Chat
  const [error, setError] = useState(""); // Fehlermeldung
  const navigate = useNavigate();

  // Lade alle Benutzer
  useEffect(() => {
    const loadUsers = async () => {
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);
      const usersList = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersList);
    };

    loadUsers();
  }, []);

  // Lade alle Nachrichten
  useEffect(() => {
    const loadMessages = async () => {
      const messagesCollection = collection(db, "messages");
      const messagesSnapshot = await getDocs(messagesCollection);
      const messagesList = messagesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(messagesList);
    };

    loadMessages();
  }, []);

  // Funktion zum Löschen eines Benutzers
  const deleteUser = async (userId) => {
    try {
      await deleteDoc(doc(db, "users", userId));
      alert("Benutzer erfolgreich gelöscht!");
      setUsers(users.filter((user) => user.id !== userId)); // Aktualisiere die Benutzerliste
    } catch (error) {
      setError("Fehler beim Löschen des Benutzers: " + error.message);
    }
  };

  // Funktion zum Löschen einer Nachricht
  const deleteMessage = async (messageId) => {
    try {
      await deleteDoc(doc(db, "messages", messageId));
      alert("Nachricht erfolgreich gelöscht!");
      setMessages(messages.filter((message) => message.id !== messageId)); // Aktualisiere die Nachrichtenliste
    } catch (error) {
      setError("Fehler beim Löschen der Nachricht: " + error.message);
    }
  };

  // Verwende auth, um den aktuellen Benutzer anzuzeigen
  const currentUser = auth.currentUser;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-blue-500 to-purple-600">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">Admin Dashboard</h1>

        {/* Zeige den aktuellen Benutzer an */}
        {currentUser && (
          <p className="text-center mb-4">
            Angemeldet als: <strong>{currentUser.email}</strong>
          </p>
        )}

        {/* Zeige Fehlermeldungen an */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Benutzerliste für privaten Chat */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Benutzer auswählen</h2>
          <div className="flex flex-wrap gap-2">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`p-2 rounded-lg ${
                  selectedUser?.id === user.id ? "bg-blue-600 text-white" : "bg-gray-200"
                }`}
              >
                {user.name}
              </button>
            ))}
          </div>
        </div>

        {/* Benutzer verwalten */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Benutzer verwalten</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 border-b">Name</th>
                  <th className="px-4 py-2 border-b">E-Mail</th>
                  <th className="px-4 py-2 border-b">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-2 border-b">{user.name}</td>
                    <td className="px-4 py-2 border-b">{user.email}</td>
                    <td className="px-4 py-2 border-b">
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition duration-300"
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nachrichten verwalten */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Nachrichten verwalten</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 border-b">Absender</th>
                  <th className="px-4 py-2 border-b">Nachricht</th>
                  <th className="px-4 py-2 border-b">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <tr key={message.id}>
                    <td className="px-4 py-2 border-b">{message.senderName || "Unbekannt"}</td>
                    <td className="px-4 py-2 border-b">{message.text}</td>
                    <td className="px-4 py-2 border-b">
                      <button
                        onClick={() => deleteMessage(message.id)}
                        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition duration-300"
                      >
                        Löschen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Zurück zum Chat */}
        <button
          onClick={() => navigate("/chat")}
          className="w-full bg-gray-600 text-white p-3 mt-8 rounded-lg hover:bg-gray-700 transition duration-300"
        >
          Zurück zum Chat
        </button>
      </div>
    </div>
  );
}

export default Admin;