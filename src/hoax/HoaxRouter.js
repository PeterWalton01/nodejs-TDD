const express = require('express');
const router = express.Router();
const AuthenticationException = require('../auth/AuthenticationException');
const HoaxService = require('../hoax/HoaxService');
const { check, validationResult } = require('express-validator');
const ValidationException = require('../error/ValidationException');
const pagination = require('../middleware/pagination');
const ForbiddenException = require('../error/ForbiddenException');

router.post(
  '/api/1.0/hoaxes',
  check('content')
    .isLength({ min: 10, max: 5000 })
    .withMessage('hoax_content_size'),
  async (req, res, next) => {
    if (!req.authenticatedUser) {
      return next(new AuthenticationException('unauthorised_hoax_submit'));
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }
    await HoaxService.save(req.body, req.authenticatedUser);
    return res.send({ message: req.t('hoax_submission_successful') });
  },
);

// router.get('/api/1.0/hoaxes', pagination, async (req, res) => {
//   const { page, size } = req.pagination;
//   const hoaxes = await HoaxService.getHoaxes(page, size);
//   res.send(hoaxes);
// });

router.get(['/api/1.0/users/:userId/hoaxes',
            '/api/1.0/hoaxes'], 
            pagination, 
            async (req, res, next) => {
  const {page, size} = req.pagination;
  try {
    const hoaxes = await HoaxService.getHoaxes(page, size, req.params.userId);
    return res.send(hoaxes);
  } catch (err) {
    next(err);
  }
});

router.delete('/api/1.0/hoaxes/:id', async (req, res, next) => {

  if(!req.authenticatedUser) {
    return next(new ForbiddenException('unautorised_hoax_delete'));
  } 
  try {
    await HoaxService.deleteHoax(req.params.id, req.authenticatedUser.id);
    return res.send();
  } catch(err) 
  {
    next(err);
  }

  

});

module.exports = router;
