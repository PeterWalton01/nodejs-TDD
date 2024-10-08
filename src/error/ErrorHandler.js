// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
    const { status, message, errors } = err;
    let validationErrors;
    if(errors){
      validationErrors = {};
      errors.forEach((error) => 
        (validationErrors[error.path] = req.t(error.msg)));
    }
    res.status(status).send(
      { 
        message: req.t(message), 
        validationErrors,
        timestamp: new Date().getTime(),
        path: req.originalUrl
      });
  };