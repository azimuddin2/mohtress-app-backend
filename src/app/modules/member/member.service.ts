import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../errors/AppError';
import { TMember } from './member.interface';
import { Member } from './member.model';
import { memberSearchableFields } from './member.constant';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { sendEmail } from '../../utils/sendEmail';
import { User } from '../user/user.model';

const createMemberIntoDB = async (payload: TMember) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { firstName, lastName, email, phone } = payload;

    // 1️⃣ Check user exists
    const isExists = await User.findOne({ email });
    if (isExists) {
      throw new AppError(400, 'User already exists with this email');
    }

    // 2️⃣ Generate secure password
    const password =
      Math.random().toString(20).slice(-4) +
      Math.random().toString(20).slice(-4);
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3️⃣ Create User (Transaction)
    await User.create(
      [
        {
          fullName: `${firstName} ${lastName}`,
          email,
          phone,
          role: 'sub-admin',

          streetAddress: 'N/A',
          city: 'N/A',
          state: 'N/A',
          zipCode: 'N/A',

          password: hashedPassword,
          isVerified: true,
        },
      ],
      { session },
    );

    // 4️⃣ Create Member (Transaction)
    const [newMember] = await Member.create(
      [
        {
          firstName,
          lastName,
          email,
          phone,
          role: 'sub-admin',
        },
      ],
      { session },
    );

    // 5️⃣ Commit Transaction
    await session.commitTransaction();
    session.endSession();

    // 6️⃣ Send Email (Outside Transaction)
    await sendEmail(
      email,
      'Welcome to Your Admin Panel Access 🎉',
      `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #333;">Hello ${firstName}, 👋</h2>
        <p>Your sub-admin account has been successfully created.</p>

        <div style="background: #f1f5ff; padding: 15px; border-radius: 8px; margin-top: 15px;">
          <p><strong>Login Email:</strong> ${email}</p>
          <p><strong>Password:</strong> ${password}</p>
        </div>

        <p style="margin-top: 20px; color: #555;">
          For your security, please change your password after your first login.
        </p>

        <p style="color: #888; font-size: 13px; margin-top: 30px;">
          © ${new Date().getFullYear()} Admin Panel. All rights reserved.
        </p>
      </div>
      `,
    );

    return newMember;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getAllMembersFromDB = async (query: Record<string, unknown>) => {
  const memberQuery = new QueryBuilder(Member.find({ isDeleted: false }), query)
    .search(memberSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await memberQuery.countTotal();
  const result = await memberQuery.modelQuery;

  return { meta, result };
};

const getMemberByIdFromDB = async (id: string) => {
  const result = await Member.findById(id);

  if (!result) {
    throw new AppError(404, 'This member not found');
  }

  if (result.isDeleted === true) {
    throw new AppError(400, 'This member has been deleted');
  }

  return result;
};

const updateMemberIntoDB = async (id: string, payload: Partial<TMember>) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { firstName, lastName, phone } = payload;

    // 1️⃣ Find member
    const isMemberExists = await Member.findById(id);
    if (!isMemberExists) {
      throw new AppError(404, 'Member does not exist');
    }

    if (isMemberExists.isDeleted) {
      throw new AppError(400, 'This member has been deleted');
    }

    // 2️⃣ Update Member fields
    const updatedMember = await Member.findByIdAndUpdate(
      id,
      { firstName, lastName, phone },
      { new: true, runValidators: true, session },
    );

    if (!updatedMember) {
      throw new AppError(400, 'Member update failed');
    }

    // 3️⃣ Update User table (because create updates both)
    const updateUserData = {
      fullName: `${firstName} ${lastName}`,
      phone,
    };

    await User.findOneAndUpdate(
      { email: isMemberExists.email },
      updateUserData,
      { session },
    );

    // 4️⃣ Commit transaction
    await session.commitTransaction();
    session.endSession();

    return updatedMember;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const deleteMemberFromDB = async (id: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1️⃣ Check Member exists
    const isMemberExists = await Member.findById(id);
    if (!isMemberExists) {
      throw new AppError(404, 'Member not found');
    }

    if (isMemberExists.isDeleted === true) {
      throw new AppError(400, 'Member already deleted');
    }

    // 2️⃣ Soft delete Member (Transaction)
    const deletedMember = await Member.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true, session },
    );

    if (!deletedMember) {
      throw new AppError(400, 'Failed to delete member');
    }

    // 3️⃣ Soft delete linked User (Transaction)
    await User.findOneAndUpdate(
      { email: isMemberExists.email },
      { isDeleted: true },
      { session },
    );

    // 4️⃣ Commit transaction
    await session.commitTransaction();
    session.endSession();

    return deletedMember;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const MemberServices = {
  createMemberIntoDB,
  getAllMembersFromDB,
  getMemberByIdFromDB,
  updateMemberIntoDB,
  deleteMemberFromDB,
};
