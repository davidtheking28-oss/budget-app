import styles from './Skeleton.module.css';

export default function Skeleton({ width = '100%', height = '16px', radius = '6px', style }) {
  return <div className={styles.skeleton} style={{ width, height, borderRadius: radius, ...style }} />;
}
