module.exports  = function FileSizeException(message)  {
    this.status = 400;
    this.message = message || 'attachment_size_limit';
};