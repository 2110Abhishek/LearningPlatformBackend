require('dotenv').config(); // Load environment variables

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const Video = require('./models/Video');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded videos

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ---------------- Schema for Progress Tracking ----------------
const ProgressSchema = new mongoose.Schema({
  userId: String,
  videoId: String,
  watchedIntervals: [[Number]],
  lastWatchedTime: Number,
  videoDuration: Number,
  progressPercent: Number,
});

const Progress = mongoose.model('Progress', ProgressSchema);

// ---------------- Multer Setup ----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ---------------- Utils: Merge Intervals ----------------
function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  intervals.sort((a, b) => a[0] - b[0]);

  const merged = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    const current = intervals[i];
    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
    }
  }
  return merged;
}

// ---------------- Routes ----------------

// Root Route
app.get('/', (req, res) => {
  res.send('🎉 Backend is running! Try /videos to see all videos.');
});

// Upload local video file
app.post('/videos/upload', upload.single('video'), async (req, res) => {
  try {
    const newVideo = new Video({
      title: req.body.title,
      filename: req.file.filename,
      url: `${process.env.BASE_URL}/uploads/${req.file.filename}`,
    });
    await newVideo.save();
    res.json(newVideo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload a YouTube video by URL
app.post('/videos/youtube', async (req, res) => {
  try {
    const newVideo = new Video({
      title: req.body.title,
      url: req.body.url,
    });
    await newVideo.save();
    res.json(newVideo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all videos
app.get('/videos', async (req, res) => {
  try {
    const videos = await Video.find();
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get video by ID
app.get('/video/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json(video);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get progress for a user and video
app.get('/progress/:userId/:videoId', async (req, res) => {
  try {
    const { userId, videoId } = req.params;
    const progress = await Progress.findOne({ userId, videoId });
    res.json(progress || {
      watchedIntervals: [],
      lastWatchedTime: 0,
      videoDuration: 0,
      progressPercent: 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update progress
app.post('/progress/update', async (req, res) => {
  try {
    const {
      userId,
      videoId,
      watchedIntervals,
      lastWatchedTime,
      videoDuration,
    } = req.body;

    let progress = await Progress.findOne({ userId, videoId });

    if (!progress) {
      progress = new Progress({
        userId,
        videoId,
        watchedIntervals: [],
        lastWatchedTime,
        videoDuration,
        progressPercent: 0,
      });
    }

    const allIntervals = [...progress.watchedIntervals, ...watchedIntervals];
    const merged = mergeIntervals(allIntervals);
    const totalWatched = merged.reduce((sum, [start, end]) => sum + (end - start), 0);
    const progressPercent = Math.round((totalWatched / videoDuration) * 100);

    progress.watchedIntervals = merged;
    progress.lastWatchedTime = lastWatchedTime;
    progress.videoDuration = videoDuration;
    progress.progressPercent = progressPercent;

    await progress.save();
    res.json(progress);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Start Server ----------------
app.listen(PORT, () => {
  console.log(`🚀 Server running at ${process.env.BASE_URL || 'http://localhost:' + PORT}`);
});
