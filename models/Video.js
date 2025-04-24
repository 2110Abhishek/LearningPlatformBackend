const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
  title: String,
  filename: String,
  url: String,
});

module.exports = mongoose.model('Video', VideoSchema);
