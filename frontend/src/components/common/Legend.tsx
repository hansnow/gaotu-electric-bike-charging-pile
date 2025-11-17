import styles from './Legend.module.css';

export const Legend = () => (
  <div className={styles.legend}>
    <div className={styles.item}>
      <span className={`${styles.dot} ${styles.available}`}></span>
      <span>空闲</span>
    </div>
    <div className={styles.item}>
      <span className={`${styles.dot} ${styles.occupied}`}></span>
      <span>占用</span>
    </div>
  </div>
);
