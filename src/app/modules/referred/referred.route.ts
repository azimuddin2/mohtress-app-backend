import { Router } from 'express';
import { referredController } from './referred.controller';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';

const route = Router();

route.post(
  '/create-referred',
  auth(USER_ROLE.helper),
  referredController.createReferredLink,
);
route.get(
  '/all-referred-data',
  auth(USER_ROLE.admin, USER_ROLE.super_admin, USER_ROLE.sub_admin),
  referredController.allReferredData,
);
route.get(
  '/single-referred-data/:id',
  auth(USER_ROLE.admin, USER_ROLE.super_admin, USER_ROLE.sub_admin),
  referredController.singleReferredData,
);
route.patch(
  '/block-referred/:id',
  auth(USER_ROLE.admin, USER_ROLE.super_admin, USER_ROLE.sub_admin),
  referredController.blockReferred,
);
route.patch(
  '/re-active-referred/:id',
  auth(USER_ROLE.admin, USER_ROLE.super_admin, USER_ROLE.sub_admin),
  referredController.reActiveReferred,
);
route.patch(
  '/increment-limit/:id',
  auth(USER_ROLE.admin, USER_ROLE.super_admin, USER_ROLE.sub_admin),
  referredController.incrementLimit,
);
route.patch(
  '/decrement-limit/:id',
  auth(USER_ROLE.admin, USER_ROLE.super_admin, USER_ROLE.sub_admin),
  referredController.decrementLimit,
);

route.get(
  '/my-all-referred-helpers',
  auth(USER_ROLE.helper),
  referredController.myAllReferredHelper,
);

route.get(
  '/my-referred-helper-details/:id',
  auth(
    USER_ROLE.helper,
    USER_ROLE.sub_admin,
    USER_ROLE.admin,
    USER_ROLE.super_admin,
  ),
  referredController.myReferredHelperDetails,
);

export const referredRoutes = route;
