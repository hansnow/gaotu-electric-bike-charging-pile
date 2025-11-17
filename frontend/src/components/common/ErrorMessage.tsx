import styles from './ErrorMessage.module.css';

interface ErrorMessageProps {
  message: string;
}

export const ErrorMessage = ({ message }: ErrorMessageProps) => (
  <div className={styles.container} role="alert">
    {message}
  </div>
);
