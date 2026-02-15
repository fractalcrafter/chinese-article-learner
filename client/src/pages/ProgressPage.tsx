import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, LogOut, RotateCcw } from 'lucide-react';
import { getUserProgress, getAllUsersProgress, resetUserProgressApi, type UserProgress, type AllUsersProgress } from '../lib/api';
import { useUser } from '../contexts/UserContext';

// Reusable stat card component
function StatCard({ emoji, label, value, subtext, color }: {
  emoji: string;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}) {
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{emoji}</span>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      {subtext && <div className="text-xs text-gray-400 mt-1">{subtext}</div>}
    </div>
  );
}

// Progress stats grid for a single user
function ProgressStats({ progress }: { progress: UserProgress }) {
  const { articles, vocabulary } = progress;

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        emoji="📖"
        label="Articles Completed"
        value={`${articles.completed_articles || 0}/${articles.total_articles || 0}`}
        color="border-blue-400"
      />
      <StatCard
        emoji="📝"
        label="Sentences Read"
        value={articles.total_sentences_read || 0}
        color="border-green-400"
      />
      <StatCard
        emoji="⭐"
        label="Vocab Mastered"
        value={vocabulary.mastered_vocab || 0}
        subtext={`of ${vocabulary.total_vocab || 0} total`}
        color="border-yellow-400"
      />
      <StatCard
        emoji="🔄"
        label="Vocab Reviewing"
        value={vocabulary.reviewing_vocab || 0}
        color="border-purple-400"
      />
      <StatCard
        emoji="📊"
        label="Total Reviews"
        value={vocabulary.total_reviews || 0}
        color="border-orange-400"
      />
      <StatCard
        emoji="📚"
        label="Learning"
        value={(vocabulary.total_vocab || 0) - (vocabulary.mastered_vocab || 0) - (vocabulary.reviewing_vocab || 0)}
        color="border-red-400"
      />
    </div>
  );
}

export function ProgressPage() {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const [myProgress, setMyProgress] = useState<UserProgress | null>(null);
  const [allProgress, setAllProgress] = useState<AllUsersProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.name === 'admin';

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        setLoading(true);
        setError(null);

        // Fetch own progress
        const progress = await getUserProgress(user.id);
        setMyProgress(progress);

        // If admin, also fetch all users' progress
        if (isAdmin) {
          const all = await getAllUsersProgress();
          setAllProgress(all);
        }
      } catch (err) {
        console.error('Error fetching progress:', err);
        setError('Failed to load progress data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, isAdmin]);

  const handleLogout = () => {
    setUser(null);
    navigate('/login');
  };

  // Admin: reset a user's progress
  const handleResetProgress = async (userId: number, userName: string) => {
    if (!confirm(`Reset all progress for ${userName}? This cannot be undone.`)) return;
    try {
      await resetUserProgressApi(userId);
      // Refresh data
      const all = await getAllUsersProgress();
      setAllProgress(all);
      // If resetting own progress, refresh that too
      if (userId === user?.id) {
        const progress = await getUserProgress(user.id);
        setMyProgress(progress);
      }
    } catch (err) {
      console.error('Error resetting progress:', err);
      alert('Failed to reset progress');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* User Header */}
        {user && (
          <div className="flex items-center justify-between mb-4 bg-white rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{user.avatar_emoji}</span>
              <span className="font-medium text-gray-700">{user.name}</span>
              {isAdmin && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Admin</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-1 px-3 py-1 text-gray-500 hover:text-amber-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-1 text-gray-500 hover:text-red-500 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        )}

        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-800 mb-2">📊 My Progress</h1>
          <p className="text-amber-600">Track your Chinese learning journey</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center mb-6">
            {error}
          </div>
        )}

        {/* My Progress Section */}
        {!loading && !error && myProgress && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="text-xl">{user?.avatar_emoji}</span> Your Stats
            </h2>
            <ProgressStats progress={myProgress} />
          </div>
        )}

        {/* Admin: All Users Section */}
        {!loading && !error && isAdmin && allProgress && (
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
              👥 All Users
            </h2>
            <div className="space-y-6">
              {allProgress
                .filter(entry => entry.user.id !== user?.id) // Don't repeat admin's own stats
                .map(entry => (
                  <div key={entry.user.id} className="bg-white/60 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{entry.user.avatar_emoji}</span>
                        <span className="font-semibold text-gray-700">{entry.user.name}</span>
                      </div>
                      <button
                        onClick={() => handleResetProgress(entry.user.id, entry.user.name)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset
                      </button>
                    </div>
                    <ProgressStats progress={entry.progress} />
                  </div>
                ))}
              {allProgress.filter(entry => entry.user.id !== user?.id).length === 0 && (
                <p className="text-gray-400 text-center py-4">No other users yet</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
