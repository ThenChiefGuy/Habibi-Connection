import React, { useState, useEffect } from "react";
import { db, auth, storage } from "../firebase/firebase";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import { 
  FaUserCircle, 
  FaCamera, 
  FaArrowLeft, 
  FaSave,
  FaSpinner,
  FaCheck,
  FaTimes,
  FaTrash,
  FaLink,
  FaTwitter,
  FaInstagram,
  FaLinkedin
} from "react-icons/fa";
import { motion } from "framer-motion";
import AvatarEditor from "react-avatar-editor";
import { TwitterPicker } from "react-color";

function Profile() {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editor, setEditor] = useState(null);
  const [scale, setScale] = useState(1);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [socialLinks, setSocialLinks] = useState({
    twitter: "",
    instagram: "",
    linkedin: "",
    website: ""
  });
  const [themeColor, setThemeColor] = useState("#6366f1"); // Default indigo-500
  const [showColorPicker, setShowColorPicker] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) return navigate("/login");

      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || "");
          setBio(data.bio || "");
          setAvatarPreview(data.photoURL || "");
          setSocialLinks({
            twitter: data.socialLinks?.twitter || "",
            instagram: data.socialLinks?.instagram || "",
            linkedin: data.socialLinks?.linkedin || "",
            website: data.socialLinks?.website || ""
          });
          setThemeColor(data.themeColor || "#6366f1");
        }
      } catch (error) {
        setError("Failed to load profile: " + error.message);
      }
    };

    loadProfile();
  }, [navigate]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be less than 2MB");
      return;
    }

    if (!file.type.match("image.*")) {
      setError("Please select an image file (JPEG, PNG)");
      return;
    }

    setSelectedFile(file);
    setShowAvatarEditor(true);
    setError("");
  };

  const handleRemoveAvatar = async () => {
    if (!avatarPreview) return;
    
    try {
      setIsLoading(true);
      const user = auth.currentUser;
      
      // Delete from storage if it's not a default avatar
      if (!avatarPreview.includes("firebasestorage.googleapis.com")) {
        const storageRef = ref(storage, `avatars/${user.uid}`);
        await deleteObject(storageRef);
      }

      // Update Firestore
      await updateDoc(doc(db, "users", user.uid), {
        photoURL: ""
      });

      setAvatarPreview("");
      setSuccess("Avatar removed successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError("Error removing avatar: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAvatar = () => {
    if (editor) {
      const canvas = editor.getImageScaledToCanvas();
      canvas.toBlob(async (blob) => {
        try {
          setUploadProgress(0);
          setIsLoading(true);
          setError("");

          const user = auth.currentUser;
          const storageRef = ref(storage, `avatars/${user.uid}`);
          const uploadTask = uploadBytesResumable(storageRef, blob);

          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
              setUploadProgress(progress);
            },
            (error) => {
              setError("Error uploading image: " + error.message);
              setIsLoading(false);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setAvatarPreview(downloadURL);
              
              // Update Firestore with new photoURL
              await updateDoc(doc(db, "users", user.uid), {
                photoURL: downloadURL,
                lastUpdated: new Date()
              });

              setShowAvatarEditor(false);
              setSuccess("Avatar updated successfully");
              setTimeout(() => setSuccess(""), 3000);
              setIsLoading(false);
              setUploadProgress(0);
            }
          );
        } catch (error) {
          setError("Error processing image: " + error.message);
          setIsLoading(false);
        }
      }, "image/jpeg", 0.9);
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const user = auth.currentUser;
      
      const profileData = {
        name: name.trim(),
        bio: bio.trim(),
        email: user.email,
        photoURL: avatarPreview || "",
        socialLinks,
        themeColor,
        lastUpdated: new Date()
      };

      await setDoc(doc(db, "users", user.uid), profileData, { merge: true });

      setSuccess("Profile saved successfully!");
      setTimeout(() => {
        setSuccess("");
        navigate("/chat");
      }, 1500);
    } catch (error) {
      setError("Error saving profile: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const profileCompletion = () => {
    let completion = 0;
    if (name.trim()) completion += 40;
    if (bio.trim()) completion += 20;
    if (avatarPreview) completion += 20;
    if (Object.values(socialLinks).some(link => link.trim())) completion += 20;
    return Math.min(100, completion);
  };

  const handleSocialLinkChange = (platform, value) => {
    // Basic URL validation
    if (value && !value.match(/^https?:\/\//)) {
      value = `https://${value}`;
    }
    
    setSocialLinks(prev => ({
      ...prev,
      [platform]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-800 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div 
          className="p-6 text-white"
          style={{ backgroundColor: themeColor }}
        >
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 rounded-full hover:bg-black hover:bg-opacity-20 transition duration-300"
            >
              <FaArrowLeft />
            </button>
            <h1 className="text-2xl font-bold text-center">
              {name ? "Edit Profile" : "Create Profile"}
            </h1>
            <div className="w-8"></div>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-6 rounded"
            >
              <p>{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-green-100 border-l-4 border-green-500 text-green-700 p-3 mb-6 rounded"
            >
              <p>{success}</p>
            </motion.div>
          )}

          {/* Profile Completion Meter */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Profile Completion
              </span>
              <span className="text-sm font-bold">
                {profileCompletion()}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div 
                className="h-2.5 rounded-full" 
                style={{ 
                  width: `${profileCompletion()}%`,
                  background: `linear-gradient(90deg, ${themeColor}, ${themeColor}66)`
                }}
              />
            </div>
          </div>

          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border-4 border-white dark:border-gray-600 shadow-lg relative">
                {avatarPreview ? (
                  <img 
                    src={avatarPreview} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FaUserCircle className="w-full h-full text-gray-400" />
                )}
                
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                    <div className="text-white font-bold text-lg">
                      {uploadProgress}%
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-center gap-2 mt-3">
                <label 
                  htmlFor="avatar-upload"
                  className="bg-indigo-600 text-white p-2 rounded-full cursor-pointer hover:bg-indigo-700 transition duration-300 shadow-md flex items-center justify-center"
                >
                  <FaCamera />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
                
                {avatarPreview && (
                  <button
                    onClick={handleRemoveAvatar}
                    disabled={isLoading}
                    className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition duration-300 shadow-md flex items-center justify-center"
                  >
                    <FaTrash />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                Max 2MB (JPEG, PNG)
              </p>
            </div>
          </div>

          {/* Avatar Editor Modal */}
          {showAvatarEditor && selectedFile && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full"
              >
                <h3 className="text-lg font-bold mb-4">Edit Your Avatar</h3>
                
                <div className="flex justify-center mb-4">
                  <AvatarEditor
                    ref={(ref) => setEditor(ref)}
                    image={selectedFile}
                    width={250}
                    height={250}
                    border={50}
                    borderRadius={125}
                    color={[0, 0, 0, 0.6]}
                    scale={scale}
                    rotate={0}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Zoom: {scale.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowAvatarEditor(false);
                      setSelectedFile(null);
                    }}
                    className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white p-2 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAvatar}
                    disabled={isLoading}
                    className={`flex-1 flex items-center justify-center gap-2 ${
                      isLoading ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"
                    } text-white p-2 rounded`}
                  >
                    {isLoading ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Avatar"
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Display Name *
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full p-3 border ${
                  name.trim() ? "border-green-500" : "border-gray-300 dark:border-gray-600"
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white`}
                maxLength={50}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                {name.trim() ? (
                  <FaCheck className="text-green-500" />
                ) : (
                  <FaTimes className="text-red-500" />
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {name.length}/50 characters
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
              Bio
            </label>
            <textarea
              placeholder="Tell us about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows="3"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              maxLength={200}
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {bio.length}/200 characters
              </span>
              <div className="w-1/2 bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                <div 
                  className="bg-indigo-500 h-1 rounded-full" 
                  style={{ width: `${(bio.length / 200) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Social Links Section */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">
              Social Links
            </h3>
            
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaTwitter className="text-blue-400" />
                </div>
                <input
                  type="text"
                  placeholder="Twitter URL"
                  value={socialLinks.twitter}
                  onChange={(e) => handleSocialLinkChange("twitter", e.target.value)}
                  className="w-full pl-10 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaInstagram className="text-pink-500" />
                </div>
                <input
                  type="text"
                  placeholder="Instagram URL"
                  value={socialLinks.instagram}
                  onChange={(e) => handleSocialLinkChange("instagram", e.target.value)}
                  className="w-full pl-10 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLinkedin className="text-blue-600" />
                </div>
                <input
                  type="text"
                  placeholder="LinkedIn URL"
                  value={socialLinks.linkedin}
                  onChange={(e) => handleSocialLinkChange("linkedin", e.target.value)}
                  className="w-full pl-10 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLink className="text-gray-500" />
                </div>
                <input
                  type="text"
                  placeholder="Website URL"
                  value={socialLinks.website}
                  onChange={(e) => handleSocialLinkChange("website", e.target.value)}
                  className="w-full pl-10 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Theme Color Picker */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">
              Profile Theme
            </h3>
            <div className="flex items-center">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-10 h-10 rounded-full border-2 border-gray-300 mr-3"
                style={{ backgroundColor: themeColor }}
                aria-label="Choose theme color"
              />
              <span className="text-gray-600 dark:text-gray-300">
                {showColorPicker ? "Select a color below" : "Click to change color"}
              </span>
            </div>
            
            {showColorPicker && (
              <div className="mt-3">
                <TwitterPicker
                  color={themeColor}
                  onChangeComplete={(color) => {
                    setThemeColor(color.hex);
                    setShowColorPicker(false);
                  }}
                  triangle="hide"
                />
              </div>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSaveProfile}
            disabled={isLoading || !name.trim()}
            className={`w-full flex items-center justify-center py-3 px-4 rounded-lg text-white font-medium transition duration-300 ${
              isLoading || !name.trim() 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            } shadow-md`}
            style={{ backgroundColor: isLoading || !name.trim() ? '' : themeColor }}
          >
            {isLoading ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <FaSave className="mr-2" />
                {name ? 'Update Profile' : 'Create Profile'}
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

export default Profile;