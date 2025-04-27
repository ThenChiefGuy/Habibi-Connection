import React, { useState, useEffect } from "react";
import { auth } from "../firebase/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { 
  FaLock, 
  FaEnvelope, 
  FaEye, 
  FaEyeSlash, 
  FaGoogle, 
  FaFacebook,
  FaSpinner,
  FaCheck,
  FaTimes
} from "react-icons/fa";
import { motion } from "framer-motion";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [emailValid, setEmailValid] = useState(false);
  const navigate = useNavigate();

  // Check email validity
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailValid(emailRegex.test(email));
  }, [email]);

  // Check password strength
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    
    setPasswordStrength(strength);
  }, [password]);

  const handleAuth = async () => {
    if (!emailValid) {
      setError("Please enter a valid email address");
      return;
    }

    if (!isLogin && passwordStrength < 2) {
      setError("Password is too weak");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        if (email === "admin@habibi-connections.com") {
          navigate("/admin");
        } else {
          navigate("/chat");
        }
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        navigate("/profile");
      }
    } catch (error) {
      setError(error.message.replace("Firebase: ", ""));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!emailValid) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
      setError("");
    } catch (error) {
      setError(error.message.replace("Firebase: ", ""));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setIsLoading(true);
    setError("");
    try {
      let authProvider;
      if (provider === "Google") {
        authProvider = new GoogleAuthProvider();
        // Add any additional scopes if needed
        // authProvider.addScope('profile');
        // authProvider.addScope('email');
      } else if (provider === "Facebook") {
        authProvider = new FacebookAuthProvider();
        // authProvider.addScope('public_profile');
        // authProvider.addScope('email');
      }

      await signInWithPopup(auth, authProvider);
      navigate("/chat");
    } catch (error) {
      console.error("Social login error:", error);
      setError(error.message.replace("Firebase: ", ""));
      
      // Handle specific errors
      if (error.code === "auth/operation-not-allowed") {
        setError("Social login is not enabled. Contact support.");
      } else if (error.code === "auth/popup-closed-by-user") {
        setError("Login popup was closed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 0: return "bg-gray-200";
      case 1: return "bg-red-500";
      case 2: return "bg-yellow-500";
      case 3: return "bg-blue-500";
      case 4: return "bg-green-500";
      default: return "bg-gray-200";
    }
  };

  const getPasswordStrengthText = () => {
    switch (passwordStrength) {
      case 0: return "Very weak";
      case 1: return "Weak";
      case 2: return "Moderate";
      case 3: return "Strong";
      case 4: return "Very strong";
      default: return "";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-pink-600 mb-2">
            Habibi Connections
          </h1>
          <p className="text-gray-600">
            {isLogin ? "Welcome back! Please login" : "Create a new account"}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-6 rounded"
          >
            <p>{error}</p>
          </motion.div>
        )}

        {resetEmailSent ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-green-100 border-l-4 border-green-500 text-green-700 p-3 mb-6 rounded"
          >
            <p>Password reset email sent! Check your inbox.</p>
          </motion.div>
        ) : showResetForm ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6"
          >
            <h3 className="text-lg font-medium mb-4">Reset Password</h3>
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaEnvelope className="text-gray-400" />
              </div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full pl-10 p-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  emailValid ? "focus:ring-green-500" : "focus:ring-red-500"
                }`}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                {emailValid ? (
                  <FaCheck className="text-green-500" />
                ) : email ? (
                  <FaTimes className="text-red-500" />
                ) : null}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePasswordReset}
                disabled={isLoading || !emailValid}
                className={`flex-1 flex items-center justify-center gap-2 ${
                  isLoading || !emailValid
                    ? "bg-purple-400 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700"
                } text-white p-3 rounded-lg transition duration-300`}
              >
                {isLoading ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
              <button
                onClick={() => setShowResetForm(false)}
                className="bg-gray-200 text-gray-700 p-3 rounded-lg hover:bg-gray-300 transition duration-300"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="mb-4">
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaEnvelope className="text-gray-400" />
                </div>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-10 p-3 border rounded-lg focus:outline-none focus:ring-2 ${
                    emailValid ? "focus:ring-green-500" : "focus:ring-red-500"
                  }`}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  {emailValid ? (
                    <FaCheck className="text-green-500" />
                  ) : email ? (
                    <FaTimes className="text-red-500" />
                  ) : null}
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <FaEyeSlash className="text-gray-400" />
                  ) : (
                    <FaEye className="text-gray-400" />
                  )}
                </button>
              </div>

              {!isLogin && password && (
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500">
                      Password Strength: {getPasswordStrengthText()}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div 
                        key={i}
                        className={`h-1 flex-1 rounded-full ${
                          passwordStrength >= i 
                            ? getPasswordStrengthColor()
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {isLogin && (
              <div className="flex justify-end mb-6">
                <button
                  onClick={() => setShowResetForm(true)}
                  className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAuth}
              disabled={isLoading || !emailValid || (!isLogin && passwordStrength < 2)}
              className={`w-full flex items-center justify-center gap-2 ${
                isLoading || !emailValid || (!isLogin && passwordStrength < 2)
                  ? "bg-gradient-to-r from-purple-400 to-indigo-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              } text-white p-3 rounded-lg transition duration-300 shadow-md`}
            >
              {isLoading ? (
                <>
                  <FaSpinner className="animate-spin" />
                  {isLogin ? "Logging in..." : "Registering..."}
                </>
              ) : (
                isLogin ? "Login" : "Register"
              )}
            </motion.button>

            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="px-3 text-gray-500">or</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>

            <div className="flex gap-4 mb-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSocialLogin("Google")}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 p-3 rounded-lg ${
                  isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
                } transition duration-300`}
              >
                <FaGoogle className="text-red-500" />
                <span>Google</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSocialLogin("Facebook")}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 p-3 rounded-lg ${
                  isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
                } transition duration-300`}
              >
                <FaFacebook className="text-blue-600" />
                <span>Facebook</span>
              </motion.button>
            </div>

            <div className="text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
                className="text-purple-600 hover:text-purple-800 font-medium"
              >
                {isLogin ? "Need an account? Register" : "Already have an account? Login"}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default Login;