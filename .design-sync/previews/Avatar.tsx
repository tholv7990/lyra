import { Avatar } from '@lyra/web';

export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Avatar name="Lê Thọ" size={24} />
      <Avatar name="An Minh" size={32} />
      <Avatar name="Quỳnh Như" size={40} />
      <Avatar name="Hải Đăng" size={40} />
      <Avatar name="Trang Vũ" size={40} />
    </div>
  );
}
