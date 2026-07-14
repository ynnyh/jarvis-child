// 大号儿童友好按钮：厚投影、大圆角、按下回弹动效。带点击音效。
import { motion } from 'framer-motion';
import { useSound } from '../../hooks/useSound.js';

export default function Button({
  children,
  variant = 'primary', // primary | secondary | ghost
  size = 'md', // sm | md | lg
  onClick,
  disabled,
  sound = 'tap',
  className = '',
  ...rest
}) {
  const { play } = useSound();
  return (
    <motion.button
      className={`ui-btn ui-btn--${variant} ui-btn--${size} ${className}`}
      disabled={disabled}
      whileTap={{ scale: 0.94 }}
      whileHover={{ scale: disabled ? 1 : 1.03 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      onClick={(e) => {
        if (disabled) return;
        if (sound) play(sound);
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
