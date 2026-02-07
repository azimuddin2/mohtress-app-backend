import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { UserServices } from './user.service';

// const signupCustomer = catchAsync(async (req, res) => {
//   const result = await UserServices.signupCustomerIntoDB(req.body);

//   sendResponse(res, {
//     statusCode: 201,
//     success: true,
//     message: 'User registered successfully',
//     data: result,
//   });
// });

// const signupOwner = catchAsync(async (req, res) => {
//   const result = await UserServices.signupOwnerIntoDB(req.body);

//   sendResponse(res, {
//     statusCode: 201,
//     success: true,
//     message: 'Salon owner registered successfully',
//     data: result,
//   });
// });

// const signupFreelancer = catchAsync(async (req, res) => {
//   const result = await UserServices.signupFreelancerIntoDB(req.body);

//   sendResponse(res, {
//     statusCode: 201,
//     success: true,
//     message: 'freelancer account registered successfully',
//     data: result,
//   });
// });

const signupUser = catchAsync(async (req, res) => {
  const result = await UserServices.signupUserIntoDB(req.body);

  console.log('Signup User Controller:', req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Signup successful! Please choose OTP verification method.',
    data: result,
  });
});

const createCustomerByAdmin = catchAsync(async (req, res) => {
  const result = await UserServices.createCustomerByAdminIntoDB(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: result.message,
    data: result.user,
  });
});

const getAllUsers = catchAsync(async (req, res) => {
  const result = await UserServices.getAllUsersFromDB(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Users retrieved successfully',
    meta: result.meta,
    data: result.result,
  });
});

const getUserProfile = catchAsync(async (req, res) => {
  const { email } = req.user;

  const result = await UserServices.getUserProfileFromDB(email);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Profile retrieved successfully',
    data: result,
  });
});

const updateUserProfile = catchAsync(async (req, res) => {
  const { email } = req.user;
  const result = await UserServices.updateUserProfileIntoDB(email, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Profile has been updated successfully.',
    data: result,
  });
});

const updateUserPicture = catchAsync(async (req, res) => {
  const { email } = req.user;

  console.log(email);
  const result = await UserServices.updateUserPictureIntoDB(
    email,
    req.file as any,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Profile picture updated successfully.',
    data: result,
  });
});

const changeStatus = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await UserServices.changeStatusIntoDB(id, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: `User is ${result.status} successfully!`,
    data: result,
  });
});

const deleteUserAccount = catchAsync(async (req, res) => {
  const userId = req.user.userId;

  const result = await UserServices.deleteUserAccountFromDB(userId);

  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: 'Your account has been deleted successfully.',
    data: result,
  });
});

const updateNotificationSettings = catchAsync(async (req, res) => {
  const { email } = req.user;
  const { notifications } = req.body; // ✅ extract boolean

  const result = await UserServices.updateNotificationSettingsIntoDB(
    email,
    notifications, // ✅ boolean only
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notification settings updated successfully.',
    data: result,
  });
});

export const UserControllers = {
  // signupCustomer,
  // signupOwner,
  // signupFreelancer,
  signupUser,
  createCustomerByAdmin,
  getAllUsers,
  getUserProfile,
  updateUserProfile,
  updateUserPicture,
  changeStatus,
  deleteUserAccount,
  updateNotificationSettings,
};
