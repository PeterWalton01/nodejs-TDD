const fs = require('fs');
const path = require('path');
const config = require('config');

const { uploadDir, profileDir, attachmentDir  } = config;
const profileDirectory = path.join('.', uploadDir, profileDir);
const attributeDirectory = path.join('.', uploadDir, attachmentDir);

const clearFiles = (folder) => {
  const files = fs.readdirSync(folder);
  for (const file of files) {
    fs.unlinkSync(path.join(folder, file));
  }
};

clearFiles(profileDirectory);
clearFiles(attributeDirectory);

