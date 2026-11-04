import { Navigate, Route, Routes } from 'react-router-dom';
import { CustomerLayout, RequireCustomer } from './customer/Layout';
import Explore from './customer/Explore';
import { Search, MapPage } from './customer/Search';
import { CampaignDetail, BrandPage } from './customer/Campaign';
import { Checkout, PaymentResult, PaymentReturn } from './customer/Checkout';
import { Wallet, VoucherDetail, UseVoucher, ReviewPage } from './customer/Wallet';
import { RefundRequestPage, RefundList } from './customer/Refund';
import { Login, Profile, Orders, Notifications, NotificationSettings, Favorites } from './customer/Account';
import WebApp from './web/WebApp';

export default function App() {
  return (
    <Routes>
      <Route path="/web/*" element={<WebApp />} />

      <Route element={<CustomerLayout nav />}>
        <Route path="/" element={<Explore />} />
        <Route path="/search" element={<Search />} />
        <Route path="/wallet" element={<RequireCustomer><Wallet /></RequireCustomer>} />
        <Route path="/orders" element={<RequireCustomer><Orders /></RequireCustomer>} />
        <Route path="/me" element={<Profile />} />
      </Route>
      <Route element={<CustomerLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/brands/:id" element={<BrandPage />} />
        <Route path="/checkout/:id" element={<RequireCustomer><Checkout /></RequireCustomer>} />
        <Route path="/orders/:id/result" element={<RequireCustomer><PaymentResult /></RequireCustomer>} />
        <Route path="/payment-return" element={<PaymentReturn />} />
        <Route path="/wallet/:id" element={<RequireCustomer><VoucherDetail /></RequireCustomer>} />
        <Route path="/wallet/:id/use" element={<RequireCustomer><UseVoucher /></RequireCustomer>} />
        <Route path="/wallet/:id/review" element={<RequireCustomer><ReviewPage /></RequireCustomer>} />
        <Route path="/wallet/:id/refund" element={<RequireCustomer><RefundRequestPage /></RequireCustomer>} />
        <Route path="/refunds" element={<RequireCustomer><RefundList /></RequireCustomer>} />
        <Route path="/notifications" element={<RequireCustomer><Notifications /></RequireCustomer>} />
        <Route path="/notifications/settings" element={<RequireCustomer><NotificationSettings /></RequireCustomer>} />
        <Route path="/favorites" element={<RequireCustomer><Favorites /></RequireCustomer>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
