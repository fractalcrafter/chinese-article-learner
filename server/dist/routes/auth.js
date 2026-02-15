import { Router } from 'express';
import { createUser, authenticateUser, getAllUsers, getUserById, getUserProgress, updateArticleProgress, updateVocabularyProgress } from '../db.js';
const router = Router();
// Get all users (for family user selection)
router.get('/users', (req, res) => {
    try {
        const users = getAllUsers();
        res.json(users);
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
// Register new user
router.post('/register', (req, res) => {
    try {
        const { name, password, avatarEmoji } = req.body;
        if (!name || !password) {
            return res.status(400).json({ error: 'Name and password are required' });
        }
        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }
        const userId = createUser(name, password, avatarEmoji || '🐵');
        const user = getUserById(userId);
        res.status(201).json(user);
    }
    catch (error) {
        console.error('Error registering user:', error);
        if (error.message?.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Failed to register user' });
    }
});
// Login
router.post('/login', (req, res) => {
    try {
        const { name, password } = req.body;
        if (!name || !password) {
            return res.status(400).json({ error: 'Name and password are required' });
        }
        const user = authenticateUser(name, password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        res.json(user);
    }
    catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});
// Get user progress
router.get('/users/:id/progress', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const progress = getUserProgress(userId);
        res.json(progress);
    }
    catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
});
// Update article progress
router.post('/users/:id/article-progress', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { articleId, completed, sentencesRead } = req.body;
        updateArticleProgress(userId, articleId, {
            completed,
            sentences_read: sentencesRead
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating article progress:', error);
        res.status(500).json({ error: 'Failed to update progress' });
    }
});
// Update vocabulary progress
router.post('/users/:id/vocabulary-progress', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { vocabularyId, correct } = req.body;
        updateVocabularyProgress(userId, vocabularyId, correct);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating vocabulary progress:', error);
        res.status(500).json({ error: 'Failed to update progress' });
    }
});
export default router;
