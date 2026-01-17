import { Router } from 'express';
import { UserRoutes } from '../modules/user/user.route';
import { AuthRoutes } from '../modules/auth/auth.route';
import { OtpRoutes } from '../modules/otp/otp.route';
import { TermsRoutes } from '../modules/terms/terms.route';
import { PrivacyRoutes } from '../modules/privacy/privacy.route';
import { AboutRoutes } from '../modules/about/about.route';
import { OwnerRegistrationRoutes } from '../modules/ownerRegistration/ownerRegistration.route';
import { FreelancerRegistrationRoutes } from '../modules/freelancerRegistration/freelancerRegistration.route';
import { OwnerServiceRoutes } from '../modules/ownerService/ownerService.route';
import { SpecialistRoutes } from '../modules/Specialist/Specialist.route';
import { GalleryRoutes } from '../modules/gallery/gallery.route';
import { FreelancerServiceRoutes } from '../modules/freelancerService/freelancerService.route';
import { ReviewRoutes } from '../modules/review/review.route';
import { CategoryRoutes } from '../modules/category/category.route';
import { OnServiceRoutes } from '../modules/onService/onService.route';
import { SubcategoryRoutes } from '../modules/subcategory/subcategory.route';
import { SupportRoutes } from '../modules/support/support.route';
import { MemberRoutes } from '../modules/member/member.route';
import { CustomerRoutes } from '../modules/customer/customer.route';
import { BookingRoutes } from '../modules/booking/booking.route';
import { PaymentRoutes } from '../modules/payment/payment.route';
import { AnnouncementRoutes } from '../modules/announcement/announcement.route';
import { DashboardRoutes } from '../modules/dashboard/dashboard.route';
import { chatRoutes } from '../modules/chat/chat.route';
import { messagesRoutes } from '../modules/message/message.route';
import { NotificationRoutes } from '../modules/notification/notification.route';
import { MessageImageRoutes } from '../modules/messageImage/messageImage.route';
import { StripeRoute } from '../modules/stripe/stripe.route';
import { QRCodeRoutes } from '../modules/qrCode/qrCode.route';

const router = Router();

const moduleRoutes = [
  {
    path: '/users',
    route: UserRoutes,
  },
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/otp',
    route: OtpRoutes,
  },
  {
    path: '/owner-registration',
    route: OwnerRegistrationRoutes,
  },
  {
    path: '/freelancer-registration',
    route: FreelancerRegistrationRoutes,
  },
  {
    path: '/terms',
    route: TermsRoutes,
  },
  {
    path: '/privacy',
    route: PrivacyRoutes,
  },
  {
    path: '/about',
    route: AboutRoutes,
  },
  {
    path: '/owner-services',
    route: OwnerServiceRoutes,
  },
  {
    path: '/gallery',
    route: GalleryRoutes,
  },
  {
    path: '/specialists',
    route: SpecialistRoutes,
  },
  {
    path: '/freelancer-services',
    route: FreelancerServiceRoutes,
  },
  {
    path: '/reviews',
    route: ReviewRoutes,
  },
  {
    path: '/categories',
    route: CategoryRoutes,
  },
  {
    path: '/subcategories',
    route: SubcategoryRoutes,
  },
  {
    path: '/on-services',
    route: OnServiceRoutes,
  },
  {
    path: '/supports',
    route: SupportRoutes,
  },
  {
    path: '/members',
    route: MemberRoutes,
  },
  {
    path: '/customers',
    route: CustomerRoutes,
  },
  {
    path: '/bookings',
    route: BookingRoutes,
  },
  {
    path: '/stripe',
    route: StripeRoute,
  },
  {
    path: '/payments',
    route: PaymentRoutes,
  },
  {
    path: '/announcement',
    route: AnnouncementRoutes,
  },
  {
    path: '/dashboard',
    route: DashboardRoutes,
  },
  {
    path: '/chats',
    route: chatRoutes,
  },
  {
    path: '/messages',
    route: messagesRoutes,
  },
  {
    path: '/message-images',
    route: MessageImageRoutes,
  },
  {
    path: '/notifications',
    route: NotificationRoutes,
  },
  {
    path: '/qr-code',
    route: QRCodeRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
