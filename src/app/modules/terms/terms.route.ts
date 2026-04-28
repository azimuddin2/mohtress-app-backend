import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import auth from '../../middlewares/auth';
import { TermsValidation } from './terms.validation';
import { TermsController } from './terms.controller';

const router = express.Router();

router.get('/', TermsController.getTerms);

router.post(
  '/',
  auth('admin'),
  validateRequest(TermsValidation.createTermsValidationSchema),
  TermsController.upsertTerms,
);

router.delete('/', auth('admin'), TermsController.deleteTerms);

export const TermsRoutes = router;
