import styles from './Button.module.css';

export default function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button className={styles.btn + ' ' + styles[variant] + (className ? ' ' + className : '')} {...props}>
      {children}
    </button>
  );
}
