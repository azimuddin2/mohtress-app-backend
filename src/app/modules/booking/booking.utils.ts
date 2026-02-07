import { sendEmail } from '../../utils/sendEmail';
import { TUser } from '../user/user.interface';
import { User } from '../user/user.model';
import { generateStrongPassword } from '../user/user.utils';

export const getCurrentMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export const createCustomerIntoDB = async (payload: TUser, session?: any) => {
  const { fullName, email, phone } = payload;

  // 1️⃣ Check customer already exists (email OR phone)
  const isExistUser = await User.findOne({
    $or: [{ email }, { phone }],
    isDeleted: false,
  }).session(session);

  if (isExistUser) {
    return isExistUser;
  }

  // 2️⃣ Generate STRONG password
  const password = generateStrongPassword();

  // 3️⃣ Create customer
  const newCustomer = await User.create(
    [
      {
        fullName,
        email,
        phone,
        role: 'customer',
        streetAddress: payload.streetAddress || 'N/A',
        city: payload.city || 'N/A',
        state: payload.state || 'N/A',
        zipCode: payload.zipCode || 'N/A',
        password,
        needsPasswordChange: true,
        isVerified: true,
        verification: {
          otp: '',
          expiresAt: new Date(),
          status: true,
        },
      },
    ],
    { session },
  );

  // 4️⃣ Send credentials
  try {
    await sendEmail(
      email,
      'Welcome to MohTress – Your Customer Account is Ready 🎉',
      `
   <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; color: #333;">
     
     <h2 style="color: #1f2937;">Hello ${fullName}, 👋</h2>
 
     <p>
       Welcome to <strong>MohTress</strong>!  
       An administrator has successfully created your customer account.
     </p>
 
     <p>
       You can now log in using the credentials below:
     </p>
 
     <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
       <p><strong>Email:</strong> ${email}</p>
       <p><strong>Password:</strong> ${password}</p>
     </div>
 
     <p style="color: #b91c1c;">
       🔐 <strong>Important:</strong> For security reasons, please change your password immediately after your first login.
     </p>
 
     <p>
       If you did not request this account or have any questions,  
       please contact our support team.
     </p>
 
     <p style="margin-top: 32px;">
       Best regards,<br />
       <strong>MohTress Team</strong>
     </p>
 
     <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
 
     <p style="font-size: 12px; color: #6b7280;">
       © ${new Date().getFullYear()} MohTress. All rights reserved.
     </p>
   </div>
   `,
    );
  } catch (err) {
    console.error('Email sending failed', err);
  }

  return newCustomer[0];
};
