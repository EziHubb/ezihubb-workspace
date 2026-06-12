import { redirect } from 'next/navigation';
import { ADMIN_ROUTES } from '@mlh/constants';
export default function ModerationPage() {
  redirect(ADMIN_ROUTES.MODERATION_QUEUE);
}
