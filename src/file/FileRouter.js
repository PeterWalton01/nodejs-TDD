const express = require('express');
const router = express.Router();
const multer = require('multer');
const FileService = require('../file/FileService');
const FileSizeException = require('../file/FileSizeException');
// const fs = require('fs');
// const path = require('path');
// const config = require('config');
// const FileType = require('file-type-cjs');
// const { randomString } = require('../shared/genertator');

const MAX_UPLOAD_FILE_SIZE = 5 * 1024 * 1024 + 1;
// const upload = multer({limits: {fileSize : MAX_UPLOAD_FILE_SIZE}});

const upload = multer({limits: {fileSize : MAX_UPLOAD_FILE_SIZE}}).single('file');

router.post(
  '/api/1.0/hoaxes/attachments',
  async (req, res, next) => {
     upload(req, res, async (err) =>  {
      if(err) {
        return next( new FileSizeException());   
      }
      const respId = await FileService.saveAttachment(req.file);
      return res.status(200).send(respId);    
    }); 
  }
);

module.exports = router;
