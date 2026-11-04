import { money, VOUCHER_TYPES } from '../utils/format';
import { Icon } from '../components/Icon';

export function VoucherBenefit({ voucher: c, detailed = false }) {
  if (c.voucherType === 'CASHBACK') return <div className="voucher-benefit cashback-benefit">
    <div className="benefit-caption">MERCHANT HOÀN TIỀN</div><strong>{c.cashbackType === 'PERCENTAGE' ? `${c.cashbackValue}%` : money(c.cashbackValue)}</strong>
    {c.maxCashbackAmount != null && <span>Hoàn tối đa {money(c.maxCashbackAmount)}</span>}
    <span>Hóa đơn từ {money(c.minOrderValue)}</span>
    {detailed && <p>Khách hàng thanh toán đầy đủ hóa đơn tại Merchant. Sau khi voucher được xác minh, Merchant chịu trách nhiệm hoàn tiền theo điều kiện chương trình{c.refundMethod ? ` qua ${c.refundMethod}` : ''}.</p>}
  </div>;
  if (c.voucherType === 'STORED_VALUE') return <div className="voucher-benefit stored-benefit">
    <div className="benefit-caption">MỆNH GIÁ SỬ DỤNG</div><strong>{money(c.faceValue)}</strong><span>Tiết kiệm {money(Math.max(0, Number(c.faceValue) - Number(c.salePrice)))}</span>
    {detailed && <p>Dùng một lần với hóa đơn ít nhất bằng mệnh giá. Không hoàn phần giá trị dư và không có số dư sau sử dụng.</p>}
  </div>;
  return <div className="voucher-benefit legacy-benefit"><div className="benefit-caption">{VOUCHER_TYPES[c.voucherType] || 'QUYỀN LỢI VOUCHER'}</div><strong>{c.voucherType === 'DISCOUNT' ? c.discountType === 'PERCENT' ? `Giảm ${c.discountValue}%` : `Giảm ${money(c.discountValue)}` : money(c.faceValue)}</strong>{c.voucherType === 'DISCOUNT' && c.discountType === 'PERCENT' && <span>Tối đa {money(c.maxDiscount)}</span>}{c.voucherType === 'COMBO' && <span>{c.comboItems}</span>}</div>;
}

export function CatalogSkeleton() {
  return <div className="catalog-skeleton" role="status" aria-label="Đang tải voucher">{Array.from({length: 4}, (_, i) => <div className="skeleton-card" key={i}><div /><span /><span /><span /></div>)}</div>;
}

export function Pagination({ page, total, pageSize, onChange, busy }) {
  if (total <= pageSize) return null;
  return <nav className="catalog-pagination" aria-label="Phân trang voucher"><button type="button" className="btn btn-ghost" disabled={page <= 1 || busy} onClick={() => onChange(page - 1)}><Icon name="back" />Trước</button><span>Trang {page} / {Math.max(1, Math.ceil(total / pageSize))}</span><button type="button" className="btn btn-ghost" disabled={page * pageSize >= total || busy} onClick={() => onChange(page + 1)}>Sau<Icon name="arrow" /></button></nav>;
}
