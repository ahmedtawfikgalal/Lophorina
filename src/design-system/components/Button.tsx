import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ variant = 'secondary', className, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={['btn', `btn--${variant}`, className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
}
