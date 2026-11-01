import styles from './Logo.module.css';

export default function Logo({ size = 'sm', src }) {
  return (
    <img className={styles.badge + ' ' + styles[size]} src={src || import.meta.env.BASE_URL + 'logo.png'} style={src ? { objectFit: 'cover' } : undefined} alt="" aria-hidden="true"/>
  );
}
