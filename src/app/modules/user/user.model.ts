import mongoose, { Schema, model } from 'mongoose';
import bcrypt from 'bcrypt';
import config from '../../config';
import { TUser, UserModel } from './user.interface';
import { Login_With, UserRole, UserStatus } from './user.constant';

// ✅ Define the Mongoose schema
const userSchema = new Schema<TUser, UserModel>(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [3, 'Full name must be at least 3 characters'],
      maxlength: [50, 'Full name can not exceed 50 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone Number is required'],
      trim: true,
      validate: {
        validator: function (v) {
          return /^\+?[0-9]{10,15}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid phone number`,
      },
    },
    email: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      lowercase: true,
      validate: {
        validator: function (v: string) {
          if (!v) return true;
          return /^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/.test(v);
        },
        message: 'Invalid email address',
      },
    },
    streetAddress: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
    },
    zipCode: {
      type: String,
      required: [true, 'Zip code is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      // maxlength: [20, 'Password must not exceed 20 characters'],
    },
    needsPasswordChange: {
      type: Boolean,
      default: false,
    },
    passwordChangeAt: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      trim: true,
      required: false,
      default: null,
    },
    salonAffiliated: {
      type: String,
    },
    role: {
      type: String,
      enum: {
        values: UserRole,
        message: '{VALUE} is not valid',
      },
      default: 'customer',
    },
    status: {
      type: String,
      enum: {
        values: UserStatus,
        message: '{VALUE} is not valid',
      },
      default: 'ongoing',
    },
    image: {
      type: String,
      trim: true,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationMethod: {
      type: String,
      enum: ['email', 'phone'],
    },

    verification: {
      otp: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      status: {
        type: Boolean,
        default: false,
      },
    },

    loginWith: {
      type: String,
      enum: Login_With,
      default: Login_With.credentials,
    },

    isRegistration: {
      type: Boolean,
      default: false,
    },
    freelancerReg: {
      type: Schema.Types.ObjectId,
      ref: 'FreelancerRegistration',
    },
    ownerReg: {
      type: Schema.Types.ObjectId,
      ref: 'OwnerRegistration',
    },
    fcmToken: {
      type: String,
      default: null,
    },
    notifications: {
      type: Boolean,
      default: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: false,
      },
      coordinates: {
        type: [Number],
        required: false,
      },
      streetAddress: {
        type: String,
        required: false,
      },
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    stripeAccountId: {
      type: String,
      default: null,
    },
    isReferral: {
      type: Boolean,
      default: false,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    referralCode: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ✅ Password hash before saving
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(
      this.password,
      Number(config.bcrypt_salt_rounds),
    );
  }
  next();
});

// ✅ Clear sensitive data after saving
userSchema.post('save', function (doc, next) {
  doc.password = '';
  next();
});

userSchema.pre('validate', function (next) {
  if (!this.email && !this.phone) {
    next(new Error('Email or Phone is required'));
  }
  next();
});

// ✅ Static methods
userSchema.statics.isUserExistsByEmail = async function (email: string) {
  return await User.findOne({ email }).select('+password');
};

userSchema.statics.isUserExistsByPhone = async function (phone: string) {
  return await User.findOne({ phone }).select('+password');
};

userSchema.statics.isPasswordMatched = async function (
  plainTextPassword: string,
  hashPassword: string,
) {
  return await bcrypt.compare(plainTextPassword, hashPassword);
};

userSchema.statics.isJWTIssuedBeforePasswordChanged = function (
  passwordChangedTimestamp: Date,
  jwtIssuedTimestamp: number,
) {
  if (!passwordChangedTimestamp) return false;
  const passwordChangedTime =
    new Date(passwordChangedTimestamp).getTime() / 1000; // convert to seconds
  return passwordChangedTime > jwtIssuedTimestamp;
};

// ✅ Export model
export const User = model<TUser, UserModel>('User', userSchema);
