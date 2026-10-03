import styles from './CollapsibleSection.module.css';

export default function CollapsibleSection({ title, children }) {
  return (
    <>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionBodyInner}>{children}</div>
    </>
  );
}
