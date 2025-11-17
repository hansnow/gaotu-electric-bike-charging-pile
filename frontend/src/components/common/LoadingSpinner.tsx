import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner = ({ message = '正在加载...' }: LoadingSpinnerProps) => (
  <div className={styles.container}>
    <div className={styles.spinner} />
    <span>{message}</span>
  </div>
);
