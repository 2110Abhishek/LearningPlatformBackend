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
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve video files

// Connect to MongoDB using environment variable
mongoose.connect(process.env.MONGO_URI)

.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ---------------- Progress Schema ----------------
const ProgressSchema = new mongoose.Schema({
  userId: String,
  videoId: String,
  watchedIntervals: [[Number]],
  lastWatchedTime: Number,
  videoDuration: Number,
  progressPercent: Number,
});

const Progress = mongoose.model('Progress', ProgressSchema);

// ---------------- Multer Config ----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // upload destination folder
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ---------------- Utility: Merge Intervals ----------------
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

// ---------------- API Routes ----------------

// Upload a video file
app.post('/videos/upload', upload.single('video'), async (req, res) => {
  try {
    const newVideo = new Video({
      title: req.body.title,
      filename: req.file.filename,
      url: `http://localhost:${PORT}/uploads/${req.file.filename}`,
    });
    await newVideo.save();
    res.json(newVideo);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Upload a YouTube video by URL
app.post('/videos/youtube', async (req, res) => {
  try {
    const newVideo = new Video({
      title: req.body.title,
      url: req.body.url, // direct YouTube link
    });
    await newVideo.save();
    res.json(newVideo);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Get all videos
app.get('/videos', async (req, res) => {
  try {
    const videos = await Video.find();
    res.json(videos);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Get video by ID
app.get('/video/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json(video);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user progress
app.get('/progress/:userId/:videoId', async (req, res) => {
  try {
    const { userId, videoId } = req.params;
    const progress = await Progress.findOne({ userId, videoId });
    if (progress) {
      res.json(progress);
    } else {
      res.json({
        watchedIntervals: [],
        lastWatchedTime: 0,
        videoDuration: 0,
        progressPercent: 0,
      });
    }
  } catch (err) {
    res.status(500).send(err);
  }
});

// Update user progress (with merging logic)
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
    const mergedIntervals = mergeIntervals(allIntervals);

    const totalWatched = mergedIntervals.reduce(
      (sum, [start, end]) => sum + (end - start),
      0
    );

    const progressPercent = Math.round((totalWatched / videoDuration) * 100);

    progress.watchedIntervals = mergedIntervals;
    progress.lastWatchedTime = lastWatchedTime;
    progress.videoDuration = videoDuration;
    progress.progressPercent = progressPercent;

    await progress.save();

    res.json(progress);
  } catch (err) {
    res.status(500).send(err);
  }
});

// ---------------- Start Server ----------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
