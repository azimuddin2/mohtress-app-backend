import mongoose from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import { UploadedFiles } from '../../interface/common.interface';
import {
  deleteManyFromS3,
  uploadManyToS3,
} from '../../utils/awsS3FileUploader';
import { TOwnerService } from './ownerService.interface';
import { OwnerService } from './ownerService.model';
import { User } from '../user/user.model';
import { serviceSearchableFields } from './ownerService.constant';
import { Category } from '../category/category.model';
import { Subcategory } from '../subcategory/subcategory.model';
import { OwnerRegistration } from '../ownerRegistration/ownerRegistration.model';

const createServiceIntoDB = async (
  userId: string,
  payload: TOwnerService,
  files: any,
) => {
  // ✅ Start Transaction Session
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId)
      .select('role isRegistration')
      .session(session);

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    if (user.role !== 'owner') {
      throw new AppError(403, 'Only owner can perform this action');
    }

    if (user.isRegistration === false) {
      throw new AppError(400, 'Owner registration not completed');
    }

    const category = await Category.findOne({ name: payload.category }).session(
      session,
    );
    if (!category) {
      throw new AppError(404, 'Category not found');
    }

    const subcategory = await Subcategory.findOne({
      name: payload.subcategory,
    }).session(session);
    if (!subcategory) {
      throw new AppError(404, 'Subcategory not found');
    }

    //  ✔️ FILE UPLOAD
    if (files) {
      const { images } = files as UploadedFiles;

      if (!images?.length) {
        throw new AppError(404, 'At least one image is required');
      }

      if (images?.length) {
        const imgsArray = images.map((image) => ({
          file: image,
          path: `images/service`,
        }));

        try {
          payload.images = await uploadManyToS3(imgsArray);
        } catch (error) {
          throw new AppError(500, 'Image upload failed');
        }
      }
    }

    //  ✔️ SET OWNER ID
    payload.owner = userId as any;

    // ------------------------------------------------------
    //    ✔️ CREATE SERVICE  (inside transaction)
    // ------------------------------------------------------
    const createdServiceArr = await OwnerService.create([payload], { session });
    const createdService = createdServiceArr[0];

    if (!createdService) {
      throw new AppError(400, 'Failed to create service');
    }

    // ------------------------------------------------------
    //    ✔️ ADD service._id INTO OwnerRegistration.services
    //    ☐ checkbox-style comment: OwnerRegistration update task
    //       ☑ Add service id to services[] field
    // ------------------------------------------------------
    const updatedOwnerReg = await OwnerRegistration.findOneAndUpdate(
      { user: userId },
      { $push: { services: createdService._id } },
      { new: true, session },
    );

    if (!updatedOwnerReg) {
      throw new AppError(404, 'Owner registration not found');
    }

    // ------------------------------------------------------
    //    ✔️ Commit Transaction
    // ------------------------------------------------------
    await session.commitTransaction();
    session.endSession();

    return createdService;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getAllServiceFromDB = async (query: Record<string, unknown>) => {
  const { owner, ...filters } = query;

  if (!owner || !mongoose.Types.ObjectId.isValid(owner as string)) {
    throw new AppError(400, 'Invalid User ID');
  }

  // Base query -> always exclude deleted packages service
  let serviceQuery = OwnerService.find({ owner, isDeleted: false });

  const queryBuilder = new QueryBuilder(serviceQuery, filters)
    .search(serviceSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await queryBuilder.countTotal();
  const result = await queryBuilder.modelQuery;

  return { meta, result };
};

const getServiceByIdFromDB = async (id: string) => {
  const result = await OwnerService.findById(id).populate({
    path: 'owner',
    select: '-password -needsPasswordChange',
  });

  if (!result) {
    throw new AppError(404, 'This service not found');
  }

  return result;
};

const updateServiceIntoDB = async (
  userId: string,
  id: string,
  payload: Partial<TOwnerService>,
  files: any,
) => {
  const user = await User.findById(userId).select('role isRegistration');
  if (!user) {
    throw new AppError(404, 'User not found');
  }

  if (user.role !== 'owner') {
    throw new AppError(403, 'Only owner can perform this action');
  }

  if (user.isRegistration === false) {
    throw new AppError(400, 'Owner registration not completed');
  }

  const isServiceExists = await OwnerService.findById(id);

  if (!isServiceExists) {
    throw new AppError(404, 'This service is not found');
  }

  const { deleteKey, ...updateData } = payload;

  // Handle image upload to S3
  if (files) {
    const { images } = files as UploadedFiles;

    if (images?.length) {
      const imgsArray = images.map((image) => ({
        file: image,
        path: `images/service`,
      }));

      try {
        payload.images = await uploadManyToS3(imgsArray);
      } catch (error) {
        throw new AppError(500, 'Image upload failed');
      }
    }
  }

  // Handle image deletions (if any)
  if (deleteKey && deleteKey.length > 0) {
    const newKey = deleteKey.map((key: any) => `images/service/${key}`);

    if (newKey.length > 0) {
      await deleteManyFromS3(newKey); // Delete images from S3
      // Remove deleted images from the product
      await OwnerService.findByIdAndUpdate(
        id,
        {
          $pull: { images: { key: { $in: deleteKey } } },
        },
        { new: true },
      );
    }
  }

  // If new images are provided, push them to the service
  if (payload?.images && payload.images.length > 0) {
    try {
      await OwnerService.findByIdAndUpdate(
        id,
        { $addToSet: { images: { $each: payload.images } } }, // Push new images to the product
        { new: true },
      );
      delete payload.images; // Remove images from the payload after pushing
    } catch (error) {
      throw new AppError(400, 'Failed to update images');
    }
  }

  // Update other product details
  try {
    const result = await OwnerService.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!result) {
      throw new AppError(400, 'Service update failed');
    }

    return result;
  } catch (error: any) {
    console.log(error);
    throw new AppError(500, 'Service update failed');
  }
};

const deleteServiceFromDB = async (id: string) => {
  const isServiceExists = await OwnerService.findById(id);

  if (!isServiceExists) {
    throw new AppError(404, 'This service is not found');
  }

  const result = await OwnerService.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true },
  );
  if (!result) {
    throw new AppError(400, 'Failed to delete service');
  }

  return result;
};

export const OwnerServiceServices = {
  createServiceIntoDB,
  getAllServiceFromDB,
  getServiceByIdFromDB,
  updateServiceIntoDB,
  deleteServiceFromDB,
};
