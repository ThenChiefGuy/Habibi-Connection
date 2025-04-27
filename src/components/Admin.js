// Admin.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase/firebase";
import { collection, getDocs, deleteDoc, doc, query, orderBy, limit, startAfter } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { FaTrash, FaUserShield, FaSearch, FaArrowLeft, FaUserEdit, FaEnvelope, FaSpinner } from "react-icons/fa";
import { MdMessage, MdAdminPanelSettings } from "react-icons/md";
import { debounce } from "lodash";

function Admin() {
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("users");
  const [isLoading, setIsLoading] = useState(false);
  const [lastUser, setLastUser] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();

  const loadMoreUsers = async () => {
    if (!hasMoreUsers) return;
    setIsLoading(true);
    try {
      let q = query(collection(db, "users"), orderBy("name"), limit(10));
      if (lastUser) {
        q = query(q, startAfter(lastUser));
      }
      const usersSnapshot = await getDocs(q);
      const newUsers = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(prev => [...prev, ...newUsers]);
      setLastUser(usersSnapshot.docs[usersSnapshot.docs.length - 1]);
      setHasMoreUsers(newUsers.length === 10);
    } catch (error) {
      setError("Error loading users: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!hasMoreMessages) return;
    setIsLoading(true);
    try {
      let q = query(collection(db, "messages"), orderBy("timestamp", "desc"), limit(10));
      if (lastMessage) {
        q = query(q, startAfter(lastMessage));
      }
      const messagesSnapshot = await getDocs(q);
      const newMessages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate().toLocaleString(),
      }));
      setMessages(prev => [...prev, ...newMessages]);
      setLastMessage(messagesSnapshot.docs[messagesSnapshot.docs.length - 1]);
      setHasMoreMessages(newMessages.length === 10);
    } catch (error) {
      setError("Error loading messages: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = debounce((term) => {
    setSearchTerm(term);
  }, 300);

  const deleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user and all their data?")) return;
    
    setDeletingId(userId);
    try {
      await deleteDoc(doc(db, "users", userId));
      setUsers(users.filter((user) => user.id !== userId));
    } catch (error) {
      setError("Error deleting user: " + error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm("Are you sure you want to permanently delete this message?")) return;
    
    setDeletingId(messageId);
    try {
      await deleteDoc(doc(db, "messages", messageId));
      setMessages(messages.filter((message) => message.id !== messageId));
    } catch (error) {
      setError("Error deleting message: " + error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMessages = messages.filter(message =>
    message.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (message.senderName && message.senderName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const currentUser = auth.currentUser;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 p-4 bg-gray-800 rounded-xl shadow-lg gap-4">
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

        {error && (
          <div className="bg-red-900/50 border-l-4 border-red-500 text-red-100 p-4 mb-6 rounded-lg">
            <p>{error}</p>
          </div>
        )}

        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search users or messages..."
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 p-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex border-b border-gray-700 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-6 py-3 font-medium flex items-center whitespace-nowrap ${
              activeTab === "users" 
                ? "text-purple-400 border-b-2 border-purple-400" 
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <FaUserEdit className="mr-2" />
            User Management
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`px-6 py-3 font-medium flex items-center whitespace-nowrap ${
              activeTab === "messages" 
                ? "text-purple-400 border-b-2 border-purple-400" 
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <MdMessage className="mr-2" />
            Message Management
          </button>
        </div>

        {isLoading && activeTab === "users" && users.length === 0 && (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        )}

        {activeTab === "users" && (
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
                              {user.name?.charAt(0).toUpperCase() || "?"}
                            </div>
                            <div className="ml-4">
                              <div className="font-medium">{user.name || "No name"}</div>
                              <div className="text-gray-400 text-sm">ID: {user.id.substring(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <FaEnvelope className="mr-2 text-blue-400" />
                            {user.email || "No email"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            user.email === "admin@habibi-connections.com" 
                              ? "bg-purple-900 text-purple-300" 
                              : "bg-green-900 text-green-300"
                          }`}>
                            {user.email === "admin@habibi-connections.com" ? "Admin" : "User"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => deleteUser(user.id)}
                            disabled={deletingId === user.id}
                            className={`flex items-center ml-auto px-4 py-2 rounded-lg transition duration-300 ${
                              deletingId === user.id
                                ? "bg-gray-600 cursor-not-allowed"
                                : "bg-red-600 hover:bg-red-700 text-white"
                            }`}
                          >
                            {deletingId === user.id ? (
                              <FaSpinner className="animate-spin mr-2" />
                            ) : (
                              <FaTrash className="mr-2" />
                            )}
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-400">
                        {searchTerm ? "No matching users found" : "No users available"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {hasMoreUsers && (
              <div className="p-4 text-center">
                <button
                  onClick={loadMoreUsers}
                  disabled={isLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white"
                >
                  {isLoading ? "Loading..." : "Load More Users"}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "messages" && (
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
                          <div className="text-gray-400 text-sm">ID: {message.sender?.substring(0, 8) || "N/A"}...</div>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="truncate">
                            {message.text || "[No text content]"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                          {message.timestamp || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => deleteMessage(message.id)}
                            disabled={deletingId === message.id}
                            className={`flex items-center ml-auto px-4 py-2 rounded-lg transition duration-300 ${
                              deletingId === message.id
                                ? "bg-gray-600 cursor-not-allowed"
                                : "bg-red-600 hover:bg-red-700 text-white"
                            }`}
                          >
                            {deletingId === message.id ? (
                              <FaSpinner className="animate-spin mr-2" />
                            ) : (
                              <FaTrash className="mr-2" />
                            )}
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-400">
                        {searchTerm ? "No matching messages found" : "No messages available"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {hasMoreMessages && (
              <div className="p-4 text-center">
                <button
                  onClick={loadMoreMessages}
                  disabled={isLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white"
                >
                  {isLoading ? "Loading..." : "Load More Messages"}
                </button>
              </div>
            )}
          </div>
        )}

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