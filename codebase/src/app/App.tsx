import { MobileCustomizerStep1 } from "./components/MobileCustomizerStep1";
// import { MobileCustomizerStep2 } from "./components/MobileCustomizerStep2";
// import { MobileCustomizerStep3 } from "./components/MobileCustomizerStep3";
// import { AdminDashboard } from "./components/AdminDashboard";
// import { AdminOrdersList } from "./components/AdminOrdersList";
// import { Login } from "./components/Login";
// import { Register } from "./components/Register";
// import { ForgotPassword } from "./components/ForgotPassword";
// import { MyOrders } from "./components/MyOrders";
// import { OrderDetail } from "./components/OrderDetail";
// import { Wishlist } from "./components/Wishlist";
// import { AddressBook } from "./components/AddressBook";
// import { ProfileSettings } from "./components/ProfileSettings";
// import { OrderSuccess } from "./components/OrderSuccess";
// import { OrderTracking } from "./components/OrderTracking";

export default function App() {
  return <MobileCustomizerStep1 />;
}

// To view other pages, uncomment one of the following:

// Mobile Customizer Steps (390×844px):
// export default function App() {
//   return <MobileCustomizerStep1 />;  // Step 1: Names & Message
// }

// export default function App() {
//   return <MobileCustomizerStep2 />;  // Step 2: Photo Upload
// }

// export default function App() {
//   return <MobileCustomizerStep3 />;  // Step 3: Art Style Selection
// }

// Admin Dashboard:
// export default function App() {
//   return <AdminDashboard />;
// }

// Admin Orders List (with drawer):
// export default function App() {
//   return <AdminOrdersList />;
// }

// Authentication pages:

// Order Detail page:
// export default function App() {
//   return <OrderDetail />;
// }

// Wishlist page:
// export default function App() {
//   return <Wishlist />;
// }

// Address Book page:
// export default function App() {
//   return <AddressBook />;
// }

// Profile Settings page:
// export default function App() {
//   return <ProfileSettings />;
// }

// Order Success page:
// export default function App() {
//   const orderItems = [
//     {
//       id: 1,
//       name: "Custom Name & Photo Coffee Mug",
//       image:
//         "https://images.unsplash.com/photo-1661399086686-20ce9ecd398b?w=200",
//       price: 27.99,
//       quantity: 2,
//     },
//     {
//       id: 2,
//       name: "Personalized Canvas Print",
//       image:
//         "https://images.unsplash.com/photo-1743299663330-60c30cf0c7dc?w=200",
//       price: 49.99,
//       quantity: 1,
//     },
//     {
//       id: 3,
//       name: "Monogram Tumbler",
//       image:
//         "https://images.unsplash.com/photo-1640978217349-1b7cb1f893c3?w=200",
//       price: 29.99,
//       quantity: 1,
//     },
//   ];
//
//   const subtotal = orderItems.reduce(
//     (sum, item) => sum + item.price * item.quantity,
//     0
//   );
//   const shipping = 12.99;
//   const discount = 9.0;
//
//   return (
//     <OrderSuccess
//       orderNumber="MC-2024-04521"
//       customerName="Sarah"
//       items={orderItems}
//       subtotal={subtotal}
//       shipping={shipping}
//       discount={discount}
//       shippingAddress={{
//         name: "Sarah Johnson",
//         line1: "123 Main Street, Apt 4B",
//         line2: "San Francisco, CA 94102",
//       }}
//       estimatedDelivery="June 5 – June 10, 2024"
//     />
//   );
// }

// Order Tracking page:
// export default function App() {
//   return <OrderTracking />;
// }