import styles from './Skeleton.module.css';

export default function Skeleton({ width = '100%', height = '16px', radius = '6px', style }) {
  return <div className={styles.skeleton} role="status" aria-label="טוען" style={{ width, height, borderRadius: radius, ...style }} />;
}
