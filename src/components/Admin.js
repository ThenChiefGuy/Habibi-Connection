import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase/firebase";
import { collection, getDocs, deleteDoc, doc, query, orderBy, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { FaTrash, FaUserShield, FaSearch, FaArrowLeft, FaUserEdit, FaEnvelope } from "react-icons/fa";
import { MdMessage, MdAdminPanelSettings } from "react-icons/md";

function Admin() {
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("users");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Load all users
  useEffect(() => {
    const loadUsers = async () => {
      setIsLoading(true);
      try {
        const usersCollection = collection(db, "users");
        const usersSnapshot = await getDocs(usersCollection);
        const usersList = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(usersList);
      } catch (error) {
        setError("Error loading users: " + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsers();
  }, []);

  // Load all messages
  useEffect(() => {
    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const messagesQuery = query(
          collection(db, "messages"),
          orderBy("timestamp", "desc")
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        const messagesList = messagesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate().toLocaleString(),
        }));
        setMessages(messagesList);
      } catch (error) {
        setError("Error loading messages: " + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, []);

  // Delete user
  const deleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    
    try {
      await deleteDoc(doc(db, "users", userId));
      setUsers(users.filter((user) => user.id !== userId));
    } catch (error) {
      setError("Error deleting user: " + error.message);
    }
  };

  // Delete message
  const deleteMessage = async (messageId) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    
    try {
      await deleteDoc(doc(db, "messages", messageId));
      setMessages(messages.filter((message) => message.id !== messageId));
    } catch (error) {
      setError("Error deleting message: " + error.message);
    }
  };

  // Filter users and messages based on search term
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMessages = messages.filter(message =>
    message.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (message.senderName && message.senderName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const currentUser = auth.currentUser;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 p-4 bg-gray-800 rounded-xl shadow-lg">
          <div className="flex items-center">
            <button
              onClick={() => navigate("/chat")}
              className="flex items-center mr-6 bg-gray-700 hover:bg-gray-600 p-3 rounded-lg transition duration-300"
            >
              <FaArrowLeft className="mr-2" />
              Back to Chat
            </button>
            <div className="flex items-center">
              <MdAdminPanelSettings className="text-3xl mr-3 text-purple-400" />
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
                Admin Dashboard
              </h1>
            </div>
          </div>
          {currentUser && (
            <div className="flex items-center bg-gray-700 px-4 py-2 rounded-lg">
              <FaUserShield className="mr-2 text-blue-400" />
              <span className="font-medium">{currentUser.email}</span>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border-l-4 border-red-500 text-red-100 p-4 mb-6 rounded-lg">
            <p>{error}</p>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search users or messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 p-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-6 py-3 font-medium flex items-center ${activeTab === "users" ? "text-purple-400 border-b-2 border-purple-400" : "text-gray-400 hover:text-gray-300"}`}
          >
            <FaUserEdit className="mr-2" />
            User Management
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`px-6 py-3 font-medium flex items-center ${activeTab === "messages" ? "text-purple-400 border-b-2 border-purple-400" : "text-gray-400 hover:text-gray-300"}`}
          >
            <MdMessage className="mr-2" />
            Message Management
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === "users" && !isLoading && (
          <div className="bg-gray-800/50 rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left font-medium">User</th>
                    <th className="px-6 py-4 text-left font-medium">Email</th>
                    <th className="px-6 py-4 text-left font-medium">Status</th>
                    <th className="px-6 py-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-700/50 transition duration-200">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-purple-500 rounded-full flex items-center justify-center">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="font-medium">{user.name}</div>
                              <div className="text-gray-400 text-sm">ID: {user.id.substring(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <FaEnvelope className="mr-2 text-blue-400" />
                            {user.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs ${user.email === "admin@habibi-connections.com" ? "bg-purple-900 text-purple-300" : "bg-green-900 text-green-300"}`}>
                            {user.email === "admin@habibi-connections.com" ? "Admin" : "User"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="flex items-center ml-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition duration-300"
                          >
                            <FaTrash className="mr-2" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-400">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Message Management Tab */}
        {activeTab === "messages" && !isLoading && (
          <div className="bg-gray-800/50 rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left font-medium">Sender</th>
                    <th className="px-6 py-4 text-left font-medium">Message</th>
                    <th className="px-6 py-4 text-left font-medium">Timestamp</th>
                    <th className="px-6 py-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredMessages.length > 0 ? (
                    filteredMessages.map((message) => (
                      <tr key={message.id} className="hover:bg-gray-700/50 transition duration-200">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium">
                            {message.senderName || "Unknown"}
                          </div>
                          <div className="text-gray-400 text-sm">ID: {message.sender.substring(0, 8)}...</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-xs truncate">
                            {message.text}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                          {message.timestamp || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => deleteMessage(message.id)}
                            className="flex items-center ml-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition duration-300"
                          >
                            <FaTrash className="mr-2" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-400">
                        No messages found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stats Footer */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/50 p-6 rounded-xl">
            <h3 className="text-lg font-medium text-purple-400 mb-2">Total Users</h3>
            <p className="text-3xl font-bold">{users.length}</p>
          </div>
          <div className="bg-gray-800/50 p-6 rounded-xl">
            <h3 className="text-lg font-medium text-blue-400 mb-2">Total Messages</h3>
            <p className="text-3xl font-bold">{messages.length}</p>
          </div>
          <div className="bg-gray-800/50 p-6 rounded-xl">
            <h3 className="text-lg font-medium text-green-400 mb-2">Admin Status</h3>
            <p className="text-xl font-bold flex items-center">
              <MdAdminPanelSettings className="mr-2" />
              {currentUser?.email === "admin@habibi-connections.com" ? "Active" : "Restricted"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Admin;