import React, { useState } from "react";
import { db, auth } from "../firebase/firebase";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

function Profile() {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSaveProfile = async () => {
    if (!name) {
      setError("Bitte gib einen Namen ein.");
      return;
    }

    try {
      const user = auth.currentUser;
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: user.email,
      });
      navigate("/chat");
    } catch (error) {
      setError("Fehler beim Speichern des Profils: " + error.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-blue-500 to-purple-600">
      <div className="bg-white p-8 rounded-lg shadow-lg w-96">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">Profil erstellen</h1>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        <input
          type="text"
          placeholder="Dein Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 mb-6 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSaveProfile}
          className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition duration-300"
        >
          Profil speichern
        </button>
      </div>
    </div>
  );
}

export default Profile;
