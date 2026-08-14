import { redirect } from 'next/navigation';

// Promotions has moved into the "Sales and discounts" tab of the Marketing
// section, alongside auto-apply sales and bundle offers — old links/bookmarks
// still resolve here.
export default function PromotionsRedirectPage() {
  redirect('/marketing/sales');
}
