const pagination = (req, res, next) => {
    let pageAsNumber = Number.parseInt(req.query.page);
    let sizeAsNumber = Number.parseInt(req.query.size);
  
    let page = Number.isNaN(pageAsNumber) ? 0 : pageAsNumber;
    let size = Number.isNaN(sizeAsNumber) ? 0 : sizeAsNumber;
  
    if (page < 0) {
      page = 0;
    }
    if (size > 10 || size <= 0) {
      size = 10;
    }
    req.pagination = { page, size };
    next();
  };

  module.exports = pagination;