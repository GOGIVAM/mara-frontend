import { avatarColor, initials } from '../lib/format.js';

export default function Avatar({ name = '', size = 34, online, badge, ring }) {
  return (
    <span className="avatar-wrap" style={{ width: size, height: size }}>
      <span
        className="avatar"
        style={{
          width: size, height: size, background: avatarColor(name),
          fontSize: size * 0.36, boxShadow: ring ? '0 0 0 2px #fff' : 'none',
        }}
      >
        {initials(name)}
      </span>
      {online && <span className="avatar-dot" />}
      {badge && <span className="avatar-badge" style={{ background: badge.color }}>{badge.label}</span>}
    </span>
  );
}
