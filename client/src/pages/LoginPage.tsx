import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, UserPlus, LogIn } from 'lucide-react';
import { getUsers, loginUser, registerUser } from '../lib/api';
import type { User } from '../lib/api';
import { useUser } from '../contexts/UserContext';

const AVATAR_OPTIONS = ['🐵', '🐼', '🐰', '🦊', '🐶', '🐱', '🦁', '🐯', '🐸', '🦄'];

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useUser();
  
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<'select' | 'login' | 'register'>('select');
  
  // Form state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('🐵');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing users
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setName(user.name);
    setMode('login');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = await loginUser(name, password);
      setUser(user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = await registerUser(name, password, avatar);
      setUser(user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl mb-2">🐵</h1>
          <h2 className="text-2xl font-bold text-amber-800">Monkey</h2>
          <p className="text-amber-600">Learn Chinese with fun!</p>
        </div>

        {/* User Selection */}
        {mode === 'select' && (
          <div>
            {users.length > 0 && (
              <>
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Who's learning today?</h3>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="p-4 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors text-center"
                    >
                      <span className="text-4xl block mb-2">{user.avatar_emoji}</span>
                      <span className="font-medium text-amber-800">{user.name}</span>
                    </button>
                  ))}
                </div>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or</span>
                  </div>
                </div>
              </>
            )}
            
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              Create New Profile
            </button>
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' && selectedUser && (
          <form onSubmit={handleLogin}>
            <div className="text-center mb-6">
              <span className="text-6xl block mb-2">{selectedUser.avatar_emoji}</span>
              <span className="text-xl font-medium text-amber-800">{selectedUser.name}</span>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-400 focus:outline-none text-lg"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm mb-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <LogIn className="w-5 h-5" />
              )}
              Login
            </button>

            <button
              type="button"
              onClick={() => { setMode('select'); setPassword(''); setError(''); }}
              className="w-full mt-3 px-4 py-2 text-gray-500 hover:text-gray-700"
            >
              ← Back to user selection
            </button>
          </form>
        )}

        {/* Register Form */}
        {mode === 'register' && (
          <form onSubmit={handleRegister}>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Create your profile</h3>

            {/* Avatar Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">Choose your avatar</label>
              <div className="flex flex-wrap gap-2 justify-center">
                {AVATAR_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setAvatar(emoji)}
                    className={`text-3xl p-2 rounded-xl transition-all ${
                      avatar === emoji 
                        ? 'bg-amber-200 scale-110 ring-2 ring-amber-400' 
                        : 'hover:bg-amber-100'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-400 focus:outline-none text-lg"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password (4+ characters)"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-400 focus:outline-none text-lg"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm mb-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !name || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
              Create Profile
            </button>

            <button
              type="button"
              onClick={() => { setMode('select'); setName(''); setPassword(''); setError(''); }}
              className="w-full mt-3 px-4 py-2 text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
