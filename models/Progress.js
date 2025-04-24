const mongoose = require('mongoose');

const ProgressSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    videoId: { type: String, required: true },
    watchedIntervals: { type: [[Number]], default: [] },
    lastWatchedTime: { type: Number, default: 0 },
    progressPercent: { type: Number, default: 0 }
});

module.exports = mongoose.model('Progress', ProgressSchema);
